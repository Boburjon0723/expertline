import { NativeModules, Platform, TurboModuleRegistry } from "react-native";
import Constants from "expo-constants";

type OutputPref = "speaker" | "earpiece";

let sessionDepth = 0;
let globalsRegistered = false;
let liveKitMod: any = null;
let liveKitClientMod: any = null;
let loadAttempted = false;
let loadError: string | null = null;

function polyfillDomException() {
  const g = globalThis as any;
  if (typeof g.DOMException !== "undefined") return;
  g.DOMException = class DOMException extends Error {
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name ?? "DOMException";
    }
  };
}

function readWebRTCNative(): any {
  try {
    const turbo = (TurboModuleRegistry as any)?.get?.("WebRTCModule");
    if (turbo) return turbo;
  } catch {
    /* ignore */
  }
  return NativeModules.WebRTCModule ?? null;
}

export function isExpoGoRuntime(): boolean {
  const exec = String((Constants as any).executionEnvironment || "");
  const ownership = String((Constants as any).appOwnership || "");
  return exec === "storeClient" || ownership === "expo";
}

export function getLiveKitUnavailableReason(): string {
  if (isExpoGoRuntime()) {
    return "Expo Go da LiveKit/WebRTC ishlamaydi. EAS APK o‘rnating (dev client).";
  }
  if (loadError) return loadError;
  if (!readWebRTCNative()) {
    return "WebRTC native modul topilmadi. Yangi EAS APK o‘rnating.";
  }
  return "LiveKit yuklanmadi.";
}

/** Faqat call/sessiya paytida — App startida require qilinmasin. */
export function getLiveKitModules(): { LiveKit: any; LiveKitClient: any } | null {
  if (liveKitMod && liveKitClientMod) {
    return { LiveKit: liveKitMod, LiveKitClient: liveKitClientMod };
  }
  if (loadAttempted && !liveKitMod) return null;
  loadAttempted = true;
  loadError = null;

  if (isExpoGoRuntime()) {
    loadError = "Expo Go runtime";
    return null;
  }

  try {
    polyfillDomException();
    // Native modul ba’zan require qilinguncha NativeModules da ko‘rinmaydi
    require("@livekit/react-native-webrtc");
    liveKitMod = require("@livekit/react-native");
    liveKitClientMod = require("livekit-client");
    if (!globalsRegistered) {
      liveKitMod.registerGlobals?.();
      globalsRegistered = true;
    }
    if (!readWebRTCNative()) {
      console.warn("[LiveKit] WebRTCModule still missing after require", Platform.OS);
    }
    return { LiveKit: liveKitMod, LiveKitClient: liveKitClientMod };
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
    console.warn("[LiveKit] lazy load failed:", e);
    liveKitMod = null;
    liveKitClientMod = null;
    return null;
  }
}

function getAudioSession(): {
  configureAudio: (c: unknown) => Promise<void>;
  startAudioSession: () => Promise<void>;
  stopAudioSession: () => Promise<void>;
  AndroidAudioTypePresets?: { communication: unknown; media: unknown };
} | null {
  const mods = getLiveKitModules();
  if (!mods?.LiveKit?.AudioSession) return null;
  const AudioSession = mods.LiveKit.AudioSession;
  return {
    configureAudio: AudioSession.configureAudio.bind(AudioSession),
    startAudioSession: AudioSession.startAudioSession.bind(AudioSession),
    stopAudioSession: AudioSession.stopAudioSession.bind(AudioSession),
    AndroidAudioTypePresets: mods.LiveKit.AndroidAudioTypePresets,
  };
}

/** LiveKit ulanishidan oldin — Android/iOS da mic + remote audio uchun shart. */
export async function startLiveKitAudioSession(output: OutputPref = "speaker"): Promise<void> {
  getLiveKitModules();
  const AudioSession = getAudioSession();
  if (!AudioSession) return;
  try {
    const communication =
      AudioSession.AndroidAudioTypePresets?.communication ?? {
        manageAudioFocus: true,
        audioMode: "inCommunication",
        audioFocusMode: "gain",
        audioAttributesUsageType: "voiceCommunication",
        audioAttributesContentType: "speech",
      };
    await AudioSession.configureAudio({
      android: {
        preferredOutputList:
          output === "speaker"
            ? ["speaker", "bluetooth", "headset", "earpiece"]
            : ["earpiece", "bluetooth", "headset", "speaker"],
        audioTypeOptions: communication,
      },
      ios: {
        // Har doim earpiece asosida — karnay selectAudioOutput("force_speaker") bilan yoqiladi,
        // shunda karnay tugmasi ikkala tomonga ham ishlaydi.
        defaultOutput: "earpiece",
      },
    });
    await AudioSession.startAudioSession();
    sessionDepth += 1;
    try {
      const mods = getLiveKitModules();
      await mods?.LiveKit?.AudioSession?.setDefaultRemoteAudioTrackVolume?.(1);
    } catch {
      /* ignore */
    }
    if (output === "speaker") {
      try {
        await modsSelectSpeaker();
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    console.warn("[LiveKit AudioSession] start failed:", e);
  }
}

async function modsSelectSpeaker() {
  await setLiveKitSpeaker(true);
}

/**
 * Qo'ng'iroq ovozini karnay yoki quloq dinamigiga (earpiece) yo'naltiradi.
 * iOS da faqat "default" | "force_speaker", Android da "speaker" | "earpiece" (LiveKit API).
 */
export async function setLiveKitSpeaker(on: boolean): Promise<void> {
  const AudioSession = getLiveKitModules()?.LiveKit?.AudioSession;
  if (!AudioSession?.selectAudioOutput) return;
  try {
    if (Platform.OS === "ios") {
      await AudioSession.selectAudioOutput(on ? "force_speaker" : "default");
    } else {
      await AudioSession.selectAudioOutput(on ? "speaker" : "earpiece");
    }
  } catch (e) {
    console.warn("[LiveKit AudioSession] selectAudioOutput failed:", e);
  }
}

export async function stopLiveKitAudioSession(): Promise<void> {
  const AudioSession = getAudioSession();
  if (!AudioSession) return;
  if (sessionDepth <= 0) return;
  sessionDepth -= 1;
  if (sessionDepth > 0) return;
  try {
    await AudioSession.stopAudioSession();
  } catch (e) {
    console.warn("[LiveKit AudioSession] stop failed:", e);
  }
}

export function isLiveKitNativeAvailable(): boolean {
  if (isExpoGoRuntime()) return false;
  if (readWebRTCNative()) return true;
  return !!getLiveKitModules();
}

export function sameChatId(a: unknown, b: unknown): boolean {
  const x = String(a ?? "").trim().toLowerCase();
  const y = String(b ?? "").trim().toLowerCase();
  return !!x && !!y && x === y;
}

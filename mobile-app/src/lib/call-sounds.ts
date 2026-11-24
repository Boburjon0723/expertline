import { Platform, Vibration } from "react-native";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

/**
 * Qo'ng'iroq ovozlari: kiruvchi ringtone (+ vibratsiya) va chiquvchi "tuuut".
 * Bir vaqtda faqat bitta ovoz chaladi; har bir start oldingisini to'xtatadi.
 */

const INCOMING = require("../../assets/sounds/incoming_ring.wav");
const RINGBACK = require("../../assets/sounds/outgoing_ringback.wav");

/** Android: [kutish, vibratsiya, pauza, ...] takrorlanadi. iOS: pauzalar orasida standart vibratsiya. */
const VIBRATION_PATTERN = Platform.OS === "android" ? [0, 800, 1700] : [0, 1500, 1000];

let current: Audio.Sound | null = null;
/** Har start/stop uni oshiradi — kech yuklangan ovoz eskirgan bo'lsa darhol to'xtatiladi. */
let generation = 0;
let vibrating = false;

async function unload(s: Audio.Sound | null) {
  if (!s) return;
  try {
    await s.stopAsync();
  } catch {
    /* ignore */
  }
  try {
    await s.unloadAsync();
  } catch {
    /* ignore */
  }
}

async function play(source: number, volume: number, gen: number) {
  try {
    const { sound } = await Audio.Sound.createAsync(source, {
      shouldPlay: false,
      isLooping: true,
      volume,
    });
    if (gen !== generation) {
      await unload(sound);
      return;
    }
    current = sound;
    await sound.playAsync();
  } catch (e) {
    console.warn("[CallSounds] play failed:", e);
  }
}

export function stopCallSounds(): void {
  generation += 1;
  if (vibrating) {
    Vibration.cancel();
    vibrating = false;
  }
  const s = current;
  current = null;
  void unload(s);
}

/** Kiruvchi qo'ng'iroq: ringtone (iOS da jim rejim tugmasiga bo'ysunadi) + takroriy vibratsiya. */
export function startIncomingRing(): void {
  stopCallSounds();
  const gen = generation;
  Vibration.vibrate(VIBRATION_PATTERN, true);
  vibrating = true;
  void (async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
    } catch {
      /* ignore */
    }
    if (gen !== generation) return;
    await play(INCOMING, 1.0, gen);
  })();
}

/** Chiquvchi qo'ng'iroq: javob kutilayotganda "tuuut". Audio rejimini qo'ng'iroq ekrani belgilaydi. */
export function startOutgoingRingback(): void {
  stopCallSounds();
  void play(RINGBACK, 0.6, generation);
}

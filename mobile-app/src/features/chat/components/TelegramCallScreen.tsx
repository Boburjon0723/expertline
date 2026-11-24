import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Audio } from "expo-av";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

const KEEP_AWAKE_TAG = "call-screen";
import { Mic, MicOff, Phone, Video as VideoIcon, VideoOff, Volume2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AvatarImage } from "../../../components/AvatarImage";
import { useAuthLocale } from "../../auth/locale";
import { ensureSpeakerPlayback, restoreSongLoudness } from "../../../lib/mobile-song-player";
import { getLiveKitModules } from "../../../lib/livekit-call-session";
import { LIVEKIT_AUDIO_CAPTURE, LIVEKIT_AUDIO_PUBLISH } from "../../../lib/livekit-media";

export type CallUiStatus = "ringing" | "incoming" | "connected";

type Props = {
  visible: boolean;
  status: CallUiStatus;
  name: string;
  callType: "audio" | "video";
  timerLabel: string;
  connecting?: boolean;
  isMicMuted: boolean;
  isCamOff: boolean;
  speakerOn?: boolean;
  videoContent?: React.ReactNode;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleSpeaker?: () => void;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
};

export function CallVideoStage({ name, isCamOff }: { name: string; isCamOff: boolean }) {
  const mods = getLiveKitModules();
  if (!mods) {
    return (
      <View style={styles.videoFill}>
        <View style={styles.videoCenter}>
          <AvatarImage name={name} size={96} />
        </View>
      </View>
    );
  }
  return <CallVideoStageInner name={name} isCamOff={isCamOff} LiveKit={mods.LiveKit} LiveKitClient={mods.LiveKitClient} />;
}

function CallVideoStageInner({
  name,
  isCamOff,
  LiveKit,
  LiveKitClient,
}: {
  name: string;
  isCamOff: boolean;
  LiveKit: any;
  LiveKitClient: any;
}) {
  const tracks = LiveKit.useTracks([
    { source: LiveKitClient.Track.Source.Camera, withPlaceholder: true },
  ]);
  const remoteTrack = tracks.find(
    (t: any) => !t.participant.isLocal && t.source === LiveKitClient.Track.Source.Camera
  );
  const localTrack = tracks.find(
    (t: any) => t.participant.isLocal && t.source === LiveKitClient.Track.Source.Camera
  );
  return (
    <View style={styles.videoFill}>
      {remoteTrack?.publication ? (
        <LiveKit.VideoTrack trackRef={remoteTrack} style={styles.videoFill} objectFit="cover" zOrder={0} />
      ) : (
        <View style={styles.videoCenter}>
          <AvatarImage name={name} size={120} />
        </View>
      )}
      {localTrack?.publication && !isCamOff ? (
        <View style={styles.pip} pointerEvents="none">
          <LiveKit.VideoTrack trackRef={localTrack} style={styles.videoFill} objectFit="cover" zOrder={1} />
        </View>
      ) : null}
    </View>
  );
}

/** LiveKitRoom ichida: UI tugmalari haqiqiy mik/kameraga tushadi */
export function CallMediaSync({ micOn, camOn }: { micOn: boolean; camOn: boolean }) {
  const mods = getLiveKitModules();
  if (!mods) return null;
  return <CallMediaSyncInner micOn={micOn} camOn={camOn} LiveKit={mods.LiveKit} />;
}

function CallMediaSyncInner({
  micOn,
  camOn,
  LiveKit,
}: {
  micOn: boolean;
  camOn: boolean;
  LiveKit: any;
}) {
  const { localParticipant } = LiveKit.useLocalParticipant();
  useEffect(() => {
    if (!localParticipant) return;
    let cancelled = false;
    const apply = async () => {
      try {
        await localParticipant.setMicrophoneEnabled(
          micOn,
          LIVEKIT_AUDIO_CAPTURE,
          LIVEKIT_AUDIO_PUBLISH
        );
        await localParticipant.setCameraEnabled(camOn);
      } catch (e) {
        if (!cancelled) console.warn("[CallMediaSync]", e);
      }
    };
    void apply();
    // Track ni ko‘p recreate qilmaslik — faqat birinchi muvaffaqiyatsiz bo‘lsa
    const t1 = setTimeout(() => {
      if (cancelled) return;
      if (localParticipant.isMicrophoneEnabled === micOn) return;
      void apply();
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(t1);
    };
  }, [localParticipant, micOn, camOn]);
  return null;
}

function HangupIcon({ size = 30 }: { size?: number }) {
  return (
    <View style={{ transform: [{ rotate: "135deg" }] }}>
      <Phone color="#fff" size={size} strokeWidth={2.4} />
    </View>
  );
}

function RoundBtn({
  bg,
  onPress,
  children,
  label,
}: {
  bg: string;
  onPress: () => void;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <View style={styles.btnCol}>
      <Pressable onPress={onPress} style={[styles.round, { backgroundColor: bg }]} hitSlop={8}>
        {children}
      </Pressable>
      {label ? <Text style={styles.btnLabel}>{label}</Text> : null}
    </View>
  );
}

/** Telegram VoIP: katta avatar, pastda qabul/rad, ulanishda mute + video + qizil tugma */
export function TelegramCallScreen({
  visible,
  status,
  name,
  callType,
  timerLabel,
  connecting,
  isMicMuted,
  isCamOff,
  videoContent,
  onToggleMic,
  onToggleCam,
  onAccept,
  onReject,
  onEnd,
}: Props) {
  const { t } = useAuthLocale();
  const insets = useSafeAreaInsets();
  const isVideo = callType === "video";
  const [spkOn, setSpkOn] = useState(callType === "video");
  const [chromeOn, setChromeOn] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulse = useRef(new Animated.Value(0.35)).current;

  // Qo'ng'iroq oynasi ochiq ekan — ekran o'chmasin/qulflanmasin.
  useEffect(() => {
    if (!visible) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    void Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: !spkOn,
    }).catch(() => {});
    return () => {
      void ensureSpeakerPlayback().then(() => restoreSongLoudness());
    };
  }, [visible, spkOn]);

  useEffect(() => {
    if (status !== "incoming") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulse]);

  const bumpChrome = () => {
    setChromeOn(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (status === "connected" && isVideo) {
      hideTimer.current = setTimeout(() => setChromeOn(false), 4000);
    }
  };

  useEffect(() => {
    bumpChrome();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [status, isVideo]);

  const showChrome = status !== "connected" || !isVideo || chromeOn;
  const statusText =
    status === "ringing"
      ? t("callRinging")
      : status === "incoming"
        ? isVideo
          ? t("callIncomingVideo")
          : t("callIncoming")
        : connecting
          ? t("callConnecting")
          : timerLabel;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={status === "incoming" ? onReject : onEnd}>
      <Pressable style={styles.root} onPress={bumpChrome}>
        <View style={[styles.rootInner, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* LiveKitRoom audio+video uchun ham mount bo‘lishi shart (PWA bilan media). */}
        {status === "connected" && videoContent ? (
          <View
            style={isVideo ? StyleSheet.absoluteFill : styles.hiddenMediaRoot}
            pointerEvents="none"
          >
            {videoContent}
          </View>
        ) : null}
        {status === "connected" && isVideo ? <View style={styles.topShade} pointerEvents="none" /> : null}

        {showChrome ? (
          <View style={styles.top} pointerEvents="none">
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.status}>{statusText}</Text>
          </View>
        ) : (
          <View style={{ height: 56 }} />
        )}

        {!(status === "connected" && isVideo && videoContent) ? (
          <View style={styles.center}>
            <View style={styles.avatarRing}>
              <AvatarImage name={name} size={128} />
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {showChrome && status === "incoming" ? (
          <View style={styles.incomingRow}>
            <RoundBtn bg="#fe3b30" onPress={onReject} label={t("callDecline")}>
              <HangupIcon />
            </RoundBtn>
            <View style={styles.acceptWrap}>
              <Animated.View style={[styles.pulseRing, { opacity: pulse, transform: [{ scale: pulse.interpolate({ inputRange: [0.35, 1], outputRange: [1, 1.45] }) }] }]} />
              <RoundBtn bg="#34c759" onPress={onAccept} label={t("callAccept")}>
                {isVideo ? <VideoIcon color="#fff" size={30} /> : <Phone color="#fff" size={30} strokeWidth={2.4} />}
              </RoundBtn>
            </View>
          </View>
        ) : showChrome && status === "ringing" ? (
          <View style={styles.incomingRow}>
            <RoundBtn bg="#fe3b30" onPress={onEnd} label={t("callCancel")}>
              <HangupIcon />
            </RoundBtn>
          </View>
        ) : showChrome ? (
          <View style={styles.connectedRow}>
            <RoundBtn
              bg={isMicMuted ? "#fff" : "rgba(255,255,255,0.18)"}
              onPress={onToggleMic}
              label={t("callMute")}
            >
              {isMicMuted ? <MicOff color="#111" size={24} /> : <Mic color="#fff" size={24} />}
            </RoundBtn>
            <RoundBtn
              bg={spkOn ? "#fff" : "rgba(255,255,255,0.18)"}
              onPress={() => setSpkOn((v) => !v)}
              label={t("callSpeaker")}
            >
              <Volume2 color={spkOn ? "#111" : "#fff"} size={24} />
            </RoundBtn>
            {isVideo ? (
              <RoundBtn
                bg={isCamOff ? "#fff" : "rgba(255,255,255,0.18)"}
                onPress={onToggleCam}
                label={t("callVideo")}
              >
                {isCamOff ? <VideoOff color="#111" size={24} /> : <VideoIcon color="#fff" size={24} />}
              </RoundBtn>
            ) : null}
            <RoundBtn bg="#fe3b30" onPress={onEnd} label={t("callEnd")}>
              <HangupIcon size={28} />
            </RoundBtn>
          </View>
        ) : (
          <View style={{ height: 88 }} />
        )}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1c2733",
  },
  rootInner: {
    flex: 1,
    justifyContent: "space-between",
  },
  /** Audio call: LiveKitRoom mount bo‘lsin, lekin UI ni bosmasin */
  hiddenMediaRoot: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
  },
  topShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 1,
  },
  acceptWrap: { alignItems: "center", justifyContent: "center" },
  pulseRing: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(52,199,89,0.45)",
  },
  top: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  name: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  status: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 16,
    marginTop: 8,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  incomingRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-start",
    paddingHorizontal: 28,
    paddingBottom: 28,
  },
  connectedRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  btnCol: { alignItems: "center", minWidth: 72 },
  round: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  btnLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    marginTop: 8,
    fontWeight: "500",
  },
  videoFill: { flex: 1, width: "100%", height: "100%" },
  videoCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  pip: {
    position: "absolute",
    top: 88,
    right: 16,
    width: 92,
    height: 128,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
});

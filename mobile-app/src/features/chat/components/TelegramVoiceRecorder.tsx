import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Dimensions, Easing, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { Audio } from "expo-av";
import { Camera, CameraView } from "expo-camera";
import { Camera as CameraIcon, ChevronLeft, ChevronUp, Lock, Mic, Pause, Play, Send, Trash2 } from "lucide-react-native";
import { ensureSpeakerPlayback, holdSongForVideo, releaseSongFromVideo } from "../../../lib/mobile-song-player";
import { GlassBackground } from "../../../components/GlassBackground";

/**
 * Telegram uslubidagi ovozli xabar tugmasi:
 * - ushlab turish — yozish; qo'yib yuborish — yuborish;
 * - chapga surish — bekor; yuqoriga surish — 🔒 qulflash (qo'lsiz yozish);
 * - qulflanganda ⏸ — oldindan eshitish (to'lqin chizig'i, 🗑 / ✈);
 * - qisqa bosish — maslahat.
 * To'lqin chizig'i (waveform) yozuv paytidagi ovoz balandligidan olinadi va xabar bilan yuboriladi.
 */

const HOLD_MS = 180;
const CANCEL_DX = -110;
const LOCK_DY = -80;
const WAVE_POINTS = 48;

type Phase = "idle" | "recording" | "locked" | "preview";

export type VoiceResult = { uri: string; durationMs: number; waveform: number[] };
export type VideoNoteResult = { uri: string; durationMs: number };

type Mode = "voice" | "video";
const { height: SCREEN_H } = Dimensions.get("window");
const NOTE_SIZE = 260;
const MAX_NOTE_SEC = 60;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function fmtTimer(ms: number) {
  const total = Math.max(0, Math.floor(ms / 10));
  const cs = total % 100;
  const s = Math.floor(total / 100);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")},${String(cs).padStart(2, "0")}`;
}

function fmtDur(ms: number) {
  const s = Math.max(1, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** dB (-160..0) namunalarini 0..31 oralig'idagi WAVE_POINTS ta qiymatga keltiradi. */
export function buildWaveform(samples: number[], points = WAVE_POINTS): number[] {
  if (!samples.length) return [];
  const norm = samples.map((db) => Math.max(0, Math.min(1, (db + 55) / 55)));
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const a = Math.floor((i * norm.length) / points);
    const b = Math.max(a + 1, Math.floor(((i + 1) * norm.length) / points));
    let peak = 0;
    for (let j = a; j < b && j < norm.length; j++) peak = Math.max(peak, norm[j]);
    out.push(Math.round(peak * 31));
  }
  return out;
}

export function TelegramVoiceRecorder({
  disabled,
  onSend,
  onSendVideoNote,
}: {
  disabled?: boolean;
  onSend: (r: VoiceResult) => void;
  /** Berilsa — qisqa bosish 🎤 ↔ 📷 rejimini almashtiradi (dumaloq video xabar). */
  onSendVideoNote?: (r: VideoNoteResult) => void;
}) {
  const [mode, setMode] = useState<Mode>("voice");
  const modeRef = useRef<Mode>("voice");
  modeRef.current = mode;
  /** Video rejimi: kamera, yozuv va'dasi, boshlanish vaqti */
  const cameraRef = useRef<CameraView | null>(null);
  const cameraReady = useRef<(() => void) | null>(null);
  const cameraReadyFlag = useRef(false);
  const videoPromise = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const videoStartAt = useRef(0);
  const videoTick = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoActiveRef = useRef(false);
  const videoErrorRef = useRef<string | null>(null);
  const [videoOn, setVideoOn] = useState(false);
  const [hintText, setHintText] = useState("Ovozli xabar uchun ushlab turing");
  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  const [elapsed, setElapsed] = useState(0);
  const [hint, setHint] = useState(false);
  const [preview, setPreview] = useState<VoiceResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playPos, setPlayPos] = useState(0);

  const recRef = useRef<Audio.Recording | null>(null);
  const samplesRef = useRef<number[]>([]);
  const durRef = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);
  const releasedEarlyRef = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const dx = useRef(new Animated.Value(0)).current;
  const dy = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase !== "recording" && phase !== "locked") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  const resetGesture = () => {
    Animated.spring(dx, { toValue: 0, useNativeDriver: true }).start();
    Animated.spring(dy, { toValue: 0, useNativeDriver: true }).start();
  };

  const unloadSound = async () => {
    const s = soundRef.current;
    soundRef.current = null;
    setPlaying(false);
    setPlayPos(0);
    if (s) {
      try {
        await s.unloadAsync();
      } catch {
        /* ignore */
      }
    }
  };

  const restoreAudio = async () => {
    try {
      await ensureSpeakerPlayback();
    } catch {
      /* ignore */
    }
    try {
      await releaseSongFromVideo();
    } catch {
      /* ignore */
    }
  };

  const startVideo = useCallback(async () => {
    try {
      const [cam, mic] = await Promise.all([
        Camera.requestCameraPermissionsAsync(),
        Camera.requestMicrophonePermissionsAsync(),
      ]);
      if (!cam.granted || !mic.granted) {
        Alert.alert("Ruxsat", "Kamera va mikrofon ruxsati kerak");
        return false;
      }
      await holdSongForVideo();
      // iOS: kamera ovoz bilan yozishi uchun audio sessiya "yozish" rejimida bo'lishi shart
      // (aks holda yozuv boshlanmaydi va hech narsa yuborilmaydi).
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      videoActiveRef.current = true;
      // Kamera HAQIQATAN tayyor bo'lguncha kutamiz (onCameraReady), aks holda recordAsync
      // "Camera is not ready yet" bilan rad etiladi.
      cameraReadyFlag.current = false;
      const ready = new Promise<boolean>((resolve) => {
        cameraReady.current = () => {
          cameraReadyFlag.current = true;
          resolve(true);
        };
      });
      setVideoOn(true);
      const ok = await Promise.race([ready, sleep(6000).then(() => false)]);
      if (!videoActiveRef.current || !cameraRef.current) return false;
      if (!ok) {
        videoErrorRef.current = "Kamera ishga tushmadi. Qayta urinib ko'ring.";
        return false;
      }
      // iOS: sessiya tayyor bo'lgach video chiqishi biroz keyin ishga tushadi.
      await sleep(300);
      videoErrorRef.current = null;
      // "Hali tayyor emas" rad etilsa — bir necha marta qayta urinamiz.
      for (let attempt = 0; attempt < 5; attempt++) {
        if (!videoActiveRef.current || !cameraRef.current) return false;
        let failed: string | null = null;
        const rec = cameraRef.current.recordAsync({ maxDuration: MAX_NOTE_SEC, codec: "avc1" });
        const guarded = rec.catch((err: unknown) => {
          failed = err instanceof Error ? err.message : String(err);
          videoErrorRef.current = failed;
          return undefined;
        });
        // Darhol rad etilganini bilish uchun qisqa kutamiz.
        await Promise.race([guarded, sleep(350)]);
        if (failed && /not ready/i.test(failed) && attempt < 4) {
          await sleep(400);
          continue;
        }
        if (failed) return false;
        videoPromise.current = guarded;
        videoStartAt.current = Date.now();
        setElapsed(0);
        videoTick.current = setInterval(() => setElapsed(Date.now() - videoStartAt.current), 60);
        return true;
      }
      return false;
    } catch (e) {
      Alert.alert("Video", e instanceof Error ? e.message : "Yozib bo'lmadi");
      return false;
    }
  }, []);

  /** Video yozuvni to'xtatadi; uri qaytaradi (bekor qilinsa ham fayl tashlanadi). */
  const stopVideo = useCallback(async (): Promise<VideoNoteResult | null> => {
    videoActiveRef.current = false;
    if (videoTick.current) clearInterval(videoTick.current);
    videoTick.current = null;
    const durationMs = videoStartAt.current ? Date.now() - videoStartAt.current : 0;
    videoStartAt.current = 0;
    const p = videoPromise.current;
    videoPromise.current = null;
    try {
      cameraRef.current?.stopRecording();
    } catch {
      /* ignore */
    }
    let uri: string | undefined;
    try {
      uri = (await p)?.uri;
    } catch (err) {
      videoErrorRef.current = err instanceof Error ? err.message : String(err);
    }
    setVideoOn(false);
    await restoreAudio();
    return uri ? { uri, durationMs } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async () => {
    if (modeRef.current === "video") return startVideo();
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Ruxsat", "Mikrofon ruxsati kerak");
        return false;
      }
      await holdSongForVideo();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({ ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true });
      samplesRef.current = [];
      durRef.current = 0;
      rec.setProgressUpdateInterval(60);
      rec.setOnRecordingStatusUpdate((st) => {
        if (!st.isRecording) return;
        durRef.current = st.durationMillis || 0;
        setElapsed(st.durationMillis || 0);
        if (typeof st.metering === "number") samplesRef.current.push(st.metering);
      });
      await rec.startAsync();
      recRef.current = rec;
      return true;
    } catch (e) {
      Alert.alert("Ovoz", e instanceof Error ? e.message : "Yozib bo'lmadi");
      return false;
    }
  }, []);

  /** Yozuvni to'xtatadi va natijani qaytaradi (yuborish yoki oldindan eshitish uchun). */
  const stop = useCallback(async (): Promise<VoiceResult | null> => {
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return null;
    try {
      await rec.stopAndUnloadAsync();
    } catch {
      /* ignore */
    }
    const uri = rec.getURI();
    await restoreAudio();
    if (!uri) return null;
    return { uri, durationMs: Math.max(500, durRef.current), waveform: buildWaveform(samplesRef.current) };
  }, []);

  const cancel = useCallback(async () => {
    if (modeRef.current === "video") await stopVideo();
    else await stop();
    await unloadSound();
    setPreview(null);
    setPhase("idle");
    setElapsed(0);
    resetGesture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop]);

  const finishAndSend = useCallback(async () => {
    if (modeRef.current === "video") {
      const v = await stopVideo();
      setPhase("idle");
      setElapsed(0);
      resetGesture();
      if (v && v.durationMs >= 700) {
        onSendVideoNote?.(v);
      } else if (v) {
        setHintText("Video juda qisqa — ushlab turing");
        setHint(true);
        setTimeout(() => setHint(false), 1800);
      } else {
        // Sababini ko'rsatamiz — jim qolib ketmasin.
        Alert.alert("Video yuborilmadi", videoErrorRef.current || "Kamera yozuvni boshlay olmadi. Qayta urinib ko'ring.");
      }
      return;
    }
    const r = await stop();
    setPhase("idle");
    setElapsed(0);
    resetGesture();
    // Juda qisqa (tasodifiy) yozuvlar yuborilmaydi.
    if (r && r.durationMs >= 700) onSend(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop, stopVideo, onSend, onSendVideoNote]);

  const toPreview = useCallback(async () => {
    const r = await stop();
    if (!r) {
      setPhase("idle");
      return;
    }
    setPreview(r);
    setPhase("preview");
  }, [stop]);

  const sendPreview = async () => {
    const r = preview;
    await unloadSound();
    setPreview(null);
    setPhase("idle");
    setElapsed(0);
    if (r) onSend(r);
  };

  const togglePlay = async () => {
    if (!preview) return;
    if (soundRef.current) {
      const st = await soundRef.current.getStatusAsync();
      if (st.isLoaded && st.isPlaying) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setPlaying(true);
      }
      return;
    }
    await ensureSpeakerPlayback().catch(() => {});
    const { sound } = await Audio.Sound.createAsync({ uri: preview.uri }, { shouldPlay: true, progressUpdateIntervalMillis: 80 });
    soundRef.current = sound;
    setPlaying(true);
    sound.setOnPlaybackStatusUpdate((st) => {
      if (!st.isLoaded) return;
      setPlayPos(st.positionMillis || 0);
      if (st.didJustFinish) {
        setPlaying(false);
        setPlayPos(0);
        void sound.setPositionAsync(0);
        void sound.pauseAsync();
      }
    });
  };

  useEffect(() => {
    return () => {
      void recRef.current?.stopAndUnloadAsync().catch(() => {});
      void soundRef.current?.unloadAsync().catch(() => {});
      if (videoTick.current) clearInterval(videoTick.current);
    };
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current && phaseRef.current === "idle",
      onMoveShouldSetPanResponder: () => phaseRef.current === "recording",
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startedRef.current = false;
        releasedEarlyRef.current = false;
        holdTimer.current = setTimeout(() => {
          holdTimer.current = null;
          startedRef.current = true;
          setPhase("recording");
          setElapsed(0);
          void start().then((ok) => {
            if (!ok) {
              setPhase("idle");
              if (modeRef.current === "video") {
                setVideoOn(false);
                videoActiveRef.current = false;
                void restoreAudioRef.current();
                if (videoErrorRef.current) Alert.alert("Video yuborilmadi", videoErrorRef.current);
              }
              return;
            }
            // Barmoq yozuv boshlanguncha qo'yib yuborilgan bo'lsa — yuboramiz (juda qisqa bo'lsa tashlanadi).
            if (releasedEarlyRef.current && phaseRef.current === "recording") void finishAndSendRef.current();
          });
        }, HOLD_MS);
      },
      onPanResponderMove: (_e, g) => {
        if (phaseRef.current !== "recording") return;
        dx.setValue(Math.min(0, g.dx));
        dy.setValue(Math.min(0, g.dy));
        if (g.dx < CANCEL_DX) {
          void cancelRef.current();
        } else if (g.dy < LOCK_DY) {
          setPhase("locked");
          resetGesture();
        }
      },
      onPanResponderRelease: () => {
        if (holdTimer.current) {
          // Qisqa bosish — maslahat
          clearTimeout(holdTimer.current);
          holdTimer.current = null;
          if (videoNoteEnabledRef.current) {
            // Telegram: qisqa bosish rejimni almashtiradi.
            const next: Mode = modeRef.current === "voice" ? "video" : "voice";
            setMode(next);
            setHintText(next === "video" ? "Video — ushlab turing. Ovoz — bosing" : "Ovoz — ushlab turing. Video — bosing");
          } else {
            setHintText("Ovozli xabar uchun ushlab turing");
          }
          setHint(true);
          setTimeout(() => setHint(false), 1600);
          return;
        }
        if (phaseRef.current !== "recording") return;
        const startedNow = modeRef.current === "video" ? !!videoPromise.current : !!recRef.current;
        if (!startedNow) {
          releasedEarlyRef.current = true;
          return;
        }
        void finishAndSendRef.current();
      },
      onPanResponderTerminate: () => {
        if (holdTimer.current) {
          clearTimeout(holdTimer.current);
          holdTimer.current = null;
        }
        if (phaseRef.current === "recording") void finishAndSendRef.current();
      },
    })
  ).current;

  // PanResponder bir marta yaratiladi — eng so'nggi funksiyalar ref orqali.
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const videoNoteEnabledRef = useRef(!!onSendVideoNote);
  videoNoteEnabledRef.current = !!onSendVideoNote;
  const restoreAudioRef = useRef(restoreAudio);
  restoreAudioRef.current = restoreAudio;
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  const finishAndSendRef = useRef(finishAndSend);
  finishAndSendRef.current = finishAndSend;

  const recording = phase === "recording" || phase === "locked";
  const dot = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] });

  return (
    <>
      {/* Yozish / qulf / oldindan eshitish paneli — butun yozish maydoni ustida */}
      {phase !== "idle" ? (
        <View style={styles.overlay} pointerEvents="box-none">
          {phase === "preview" && preview ? (
            <View style={styles.previewRow}>
              <Pressable onPress={() => void cancel()} hitSlop={8} style={styles.iconBtn}>
                <Trash2 color="#ff6b6b" size={22} />
              </Pressable>
              <View style={styles.previewPill}>
                <Pressable onPress={() => void togglePlay()} hitSlop={8} style={styles.playBtn}>
                  {playing ? <Pause color="#fff" size={16} fill="#fff" /> : <Play color="#fff" size={16} fill="#fff" />}
                </Pressable>
                <View style={styles.wave}>
                  {(preview.waveform.length ? preview.waveform : Array(WAVE_POINTS).fill(4)).map((v, i, arr) => {
                    const filled = preview.durationMs > 0 && i / arr.length <= playPos / preview.durationMs;
                    return (
                      <View
                        key={i}
                        style={[styles.waveBar, { height: 3 + (v / 31) * 18, opacity: filled ? 1 : 0.45 }]}
                      />
                    );
                  })}
                </View>
                <Text style={styles.previewDur}>{fmtDur(playing ? playPos : preview.durationMs)}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.recRow}>
              <Animated.View style={[styles.redDot, { opacity: dot }]} />
              <Text style={styles.timer}>{fmtTimer(elapsed)}</Text>
              {phase === "recording" ? (
                <Animated.View
                  style={[
                    styles.slideHint,
                    {
                      transform: [{ translateX: dx }],
                      opacity: dx.interpolate({ inputRange: [CANCEL_DX, 0], outputRange: [0.2, 1], extrapolate: "clamp" }),
                    },
                  ]}
                >
                  <ChevronLeft color="rgba(255,255,255,0.6)" size={18} />
                  <Text style={styles.slideText}>Chapga — bekor</Text>
                </Animated.View>
              ) : (
                <Pressable onPress={() => void cancel()} hitSlop={8} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Bekor</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      ) : null}

      {/* Qulf ko'rsatkichi (ushlab turganda) yoki ⏸ (qulflanganda) — tugma tepasida */}
      {phase === "recording" ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.lockPill,
            { transform: [{ translateY: dy.interpolate({ inputRange: [LOCK_DY, 0], outputRange: [-20, 0], extrapolate: "clamp" }) }] },
          ]}
        >
          <Lock color="#fff" size={16} />
          <ChevronUp color="rgba(255,255,255,0.7)" size={16} />
        </Animated.View>
      ) : phase === "locked" && mode === "voice" ? (
        <Pressable onPress={() => void toPreview()} style={[styles.lockPill, styles.pauseBtn]} hitSlop={8}>
          <Pause color="#fff" size={18} fill="#fff" />
        </Pressable>
      ) : null}

      {hint ? (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>{hintText}</Text>
        </View>
      ) : null}

      {/* Dumaloq video: ekran xiralashadi, o'rtada old kamera doirasi + taymer */}
      {videoOn ? (
        <View style={styles.noteLayer} pointerEvents="none">
          <View style={styles.noteDim} />
          <View style={styles.noteCircle}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="front"
              mode="video"
              mirror
              onCameraReady={() => cameraReady.current?.()}
            />
          </View>
          <View style={styles.noteTimer}>
            <View style={styles.redDot} />
            <Text style={styles.timer}>{fmtTimer(elapsed)}</Text>
          </View>
        </View>
      ) : null}

      {/* Asosiy tugma: idle — 🎤 (ushlab turish); yozishda kattalashgan ko'k doira; qulf/preview — yuborish */}
      {phase === "locked" ? (
        <Pressable onPress={() => void finishAndSend()} style={[styles.btn, styles.btnBig]}>
          <Send color="#fff" size={22} />
        </Pressable>
      ) : phase === "preview" ? (
        <Pressable onPress={() => void sendPreview()} style={[styles.btn, styles.btnBig]}>
          <Send color="#fff" size={22} />
        </Pressable>
      ) : (
        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.btn,
            // Kutish holatida — shisha doira (iMe); yozishda — ko'k doira.
            !recording && styles.btnGlass,
            disabled && { opacity: 0.5 },
            // Yozishda kattalashadi va barmoq bilan birga siljiydi (bitta transform ichida).
            recording ? { transform: [{ translateX: dx }, { translateY: dy }, { scale: 1.3 }] } : null,
          ]}
        >
          {!recording ? <GlassBackground tint="rgba(255,255,255,0.07)" /> : null}
          {mode === "video" ? (
            <CameraIcon color="#fff" size={recording ? 26 : 20} />
          ) : (
            <Mic color="#fff" size={recording ? 26 : 20} />
          )}
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 56,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    zIndex: 5,
  },
  recRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    backgroundColor: "#17212b",
    paddingHorizontal: 14,
    gap: 10,
  },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ff3b30" },
  timer: { color: "#fff", fontSize: 16, fontVariant: ["tabular-nums"], minWidth: 72 },
  slideHint: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
  slideText: { color: "rgba(255,255,255,0.6)", fontSize: 14 },
  cancelBtn: { flex: 1, alignItems: "center" },
  cancelText: { color: "#64b5ef", fontSize: 15, fontWeight: "600" },
  previewRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  previewPill: {
    flex: 1,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#3a8ee6",
    paddingHorizontal: 6,
    gap: 8,
  },
  playBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  wave: { flex: 1, flexDirection: "row", alignItems: "center", gap: 1.5, overflow: "hidden" },
  waveBar: { width: 2.5, borderRadius: 1.5, backgroundColor: "#fff" },
  previewDur: { color: "#fff", fontSize: 13, marginRight: 6, fontVariant: ["tabular-nums"] },
  lockPill: {
    position: "absolute",
    right: 4,
    bottom: 64,
    width: 40,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(23,33,43,0.95)",
    alignItems: "center",
    gap: 2,
    zIndex: 6,
  },
  pauseBtn: { height: 40, paddingVertical: 0, justifyContent: "center" },
  hint: {
    position: "absolute",
    right: 0,
    bottom: 60,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.75)",
    zIndex: 6,
  },
  hintText: { color: "#fff", fontSize: 13 },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3a8ee6",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 7,
  },
  btnBig: { transform: [{ scale: 1.25 }] },
  btnGlass: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.22)",
    overflow: "hidden",
  },
  noteLayer: {
    position: "absolute",
    left: -40,
    right: -40,
    bottom: 0,
    height: SCREEN_H * 2,
    alignItems: "center",
    zIndex: 4,
  },
  noteDim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
  noteCircle: {
    position: "absolute",
    bottom: SCREEN_H * 0.32,
    width: NOTE_SIZE,
    height: NOTE_SIZE,
    borderRadius: NOTE_SIZE / 2,
    overflow: "hidden",
    backgroundColor: "#000",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.15)",
  },
  noteTimer: {
    position: "absolute",
    bottom: SCREEN_H * 0.32 - 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});

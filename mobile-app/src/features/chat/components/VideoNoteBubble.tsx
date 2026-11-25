import React, { useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { Play } from "lucide-react-native";
import { peekCachedMediaUriSync } from "../../../lib/media-cache";
import { ProgressControl } from "./UploadingMediaBubble";
import { palette } from "../../../lib/theme";

const SIZE = 220;

function fmt(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Telegram uslubidagi dumaloq video xabar: doira ichida birinchi kadr; bosilsa shu yerda ovozi bilan
 * o'ynaydi, yana bosilsa pauza. Yuklanayotganda (tempId) — lokal video + halqa/✕.
 */
export function VideoNoteBubble({
  uri,
  localUri,
  thumb,
  durationMs,
  timeLabel,
  tempId,
  onLongPress,
}: {
  uri?: string | null;
  localUri?: string | null;
  thumb?: string | null;
  durationMs?: number | null;
  timeLabel?: string;
  /** Yuklanayotgan vaqtinchalik xabar — jarayon halqasi ko'rsatiladi */
  tempId?: string;
  onLongPress?: () => void;
}) {
  const source = localUri || peekCachedMediaUriSync(uri) || uri || null;
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const videoRef = useRef<Video | null>(null);

  useEffect(() => () => void videoRef.current?.unloadAsync().catch(() => {}), []);

  const onStatus = (st: AVPlaybackStatus) => {
    if (!st.isLoaded) return;
    setPos(st.positionMillis || 0);
    if (st.didJustFinish) {
      setPlaying(false);
      setPos(0);
      void videoRef.current?.setPositionAsync(0);
    }
  };

  const toggle = async () => {
    if (tempId || !source) return;
    const next = !playing;
    setPlaying(next);
    try {
      if (next) await videoRef.current?.playAsync();
      else await videoRef.current?.pauseAsync();
    } catch {
      setPlaying(false);
    }
  };

  const remaining = durationMs ? Math.max(0, durationMs - pos) : pos;

  return (
    <Pressable onPress={() => void toggle()} onLongPress={onLongPress} delayLongPress={280} style={styles.wrap}>
      <View style={styles.circle}>
        {thumb ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} blurRadius={1} /> : null}
        {source ? (
          <Video
            ref={videoRef}
            source={{ uri: source }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            isMuted={false}
            progressUpdateIntervalMillis={200}
            onPlaybackStatusUpdate={onStatus}
          />
        ) : null}
        {tempId ? (
          <View style={styles.center} pointerEvents="box-none">
            <ProgressControl tempId={tempId} />
          </View>
        ) : !playing ? (
          <View style={styles.center} pointerEvents="none">
            <View style={styles.play}>
              <Play color="#fff" size={24} fill="#fff" />
            </View>
          </View>
        ) : null}
      </View>
      <View style={styles.dur} pointerEvents="none">
        <Text style={styles.durText}>{fmt(remaining)}</Text>
      </View>
      {timeLabel ? (
        <View style={styles.time} pointerEvents="none">
          <Text style={styles.timeText}>{timeLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, position: "relative" },
  circle: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: "hidden", backgroundColor: palette.bg },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  play: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 3,
  },
  dur: {
    position: "absolute",
    left: 14,
    bottom: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  durText: { color: "#fff", fontSize: 12, fontVariant: ["tabular-nums"] },
  time: {
    position: "absolute",
    right: 10,
    bottom: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  timeText: { color: "#fff", fontSize: 11 },
});

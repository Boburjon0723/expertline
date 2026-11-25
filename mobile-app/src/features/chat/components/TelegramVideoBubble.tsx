import { MEDIA_BUBBLE_WIDTH } from "../../../lib/upload-queue";
import React, { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowDown, Play, VolumeX, X } from "lucide-react-native";
import { ResizeMode, Video } from "expo-av";
import {
  cancelMediaDownload,
  peekCachedMediaUri,
  peekCachedMediaUriSync,
  startMediaDownload,
  subscribeMediaCache,
} from "../../../lib/media-cache";
import { palette } from "../../../lib/theme";

function formatDur(ms: number) {
  const t = Math.round(ms / 1000);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

function formatMb(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

type Props = {
  /** eni/bo'yi (metadata o'lchamidan) */
  aspect?: number;
  /** Kichik nusxa (data URI) — birinchi kadr o'rnida xira fon */
  thumb?: string | null;
  /** Davomiylik (ms) va hajm (bayt) — chap tepadagi yorliq uchun */
  durationMs?: number | null;
  size?: number | null;
  uri: string;
  timeLabel?: string;
  ticks?: string;
  onOpen: (localUri: string) => void;
  onLongPress?: () => void;
};

export function TelegramVideoBubble({ uri, timeLabel, ticks, onOpen, onLongPress, aspect = 3 / 4, thumb, durationMs, size }: Props) {
  // Keshda bo'lsa (o'zim yuborgan / yuklab olingan) — birinchi kadrdanoq.
  const [localUri, setLocalUri] = useState<string | null>(() => peekCachedMediaUriSync(uri));
  const [downloading, setDownloading] = useState(false);
  const [written, setWritten] = useState(0);
  const [total, setTotal] = useState(0);
  const durationLabel = durationMs ? formatDur(durationMs) : "";
  const sizeLabel = formatMb(size || total);

  const refreshPeek = useCallback(async () => {
    const p = await peekCachedMediaUri(uri, "video");
    setLocalUri(p);
    if (p) setDownloading(false);
  }, [uri]);

  useEffect(() => {
    void refreshPeek();
    return subscribeMediaCache(() => {
      void refreshPeek();
    });
  }, [refreshPeek]);

  const startDl = async (thenOpen?: boolean) => {
    setDownloading(true);
    setWritten(0);
    try {
      const path = await startMediaDownload(uri, "video", (w, t) => {
        setWritten(w);
        if (t) setTotal(t);
      });
      setLocalUri(path);
      setDownloading(false);
      if (thenOpen) onOpen(path);
    } catch {
      setDownloading(false);
      await refreshPeek();
    }
  };

  const cancelDl = async () => {
    await cancelMediaDownload(uri);
    setDownloading(false);
    setWritten(0);
    await refreshPeek();
  };

  const onPress = () => {
    if (downloading) {
      void cancelDl();
      return;
    }
    if (localUri) {
      onOpen(localUri);
      return;
    }
    void startDl(true);
  };

  const progress = total > 0 ? Math.min(1, written / total) : downloading ? 0.15 : 0;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={280}
        style={[styles.media, { width: MEDIA_BUBBLE_WIDTH, height: MEDIA_BUBBLE_WIDTH / aspect }]}
      >
        <View style={[styles.video, styles.placeholder]} />
        {thumb ? (
          // Video kadri (160 px) — deyarli tiniq; eski 24 px nusxalar xira.
          <Image source={{ uri: thumb }} blurRadius={1} resizeMode="cover" style={StyleSheet.absoluteFill} />
        ) : null}
        {localUri ? (
          // Lokal nusxa bor: yuklanish pufakchasi bilan aynan bir xil kadr — yuborilgach rasm o'zgarmaydi.
          <Video
            source={{ uri: localUri }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            isMuted
            pointerEvents="none"
          />
        ) : null}
        {/* Telegram: ⬇ + davomiylik / hajm; yuklanayotganda "3,1 / 8,7 MB" */}
        <View style={styles.topLeft} pointerEvents="none">
          {!localUri && !downloading ? <ArrowDown color="#fff" size={16} strokeWidth={2.6} /> : null}
          <View>
            {downloading ? (
              <Text style={styles.dur}>
                {formatMb(written)} / {sizeLabel || "…"}
              </Text>
            ) : (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Text style={styles.dur}>{durationLabel || "VIDEO"}</Text>
                  {localUri ? <VolumeX color="#fff" size={13} /> : null}
                </View>
                {!localUri && sizeLabel ? <Text style={styles.sub}>{sizeLabel}</Text> : null}
              </>
            )}
          </View>
        </View>
        <View style={styles.center} pointerEvents="none">
          <View style={styles.circle}>
            {!downloading ? (
              <Play color="#fff" size={26} fill="#fff" style={{ marginLeft: 3 }} />
            ) : downloading ? (
              <>
                <View style={styles.ringBg} />
                <View style={[styles.dotSpin, { transform: [{ rotate: `${progress * 360}deg` }] }]}>
                  <View style={styles.dot} />
                </View>
                <X color="#fff" size={22} strokeWidth={2.4} />
              </>
            ) : (
              <>
                <View style={styles.ringBg} />
                <ArrowDown color="#fff" size={24} strokeWidth={2.6} />
              </>
            )}
          </View>
        </View>
        {downloading ? (
          <View style={styles.barTrack} pointerEvents="none">
            <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        ) : null}
      </Pressable>
      {timeLabel ? (
        <View style={styles.time} pointerEvents="none">
          <Text style={styles.timeText}>
            {timeLabel}
            {ticks ? ` ${ticks}` : ""}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  media: {
    width: 240,
    height: 320,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: palette.bg,
  },
  video: { width: "100%", height: "100%" },
  placeholder: { backgroundColor: "#1a2733" },
  topLeft: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  dur: { color: "#fff", fontSize: 12, fontWeight: "700" },
  sub: { color: "#fff", fontSize: 12, fontWeight: "600", marginTop: 1 },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  ringBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.28)",
  },
  dotSpin: { ...StyleSheet.absoluteFillObject },
  dot: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#fff",
  },
  barTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  barFill: { height: "100%", backgroundColor: "#5eb5f7" },
  time: {
    position: "absolute",
    bottom: 8,
    right: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  timeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
});

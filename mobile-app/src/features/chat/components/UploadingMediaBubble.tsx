import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { ResizeMode, Video } from "expo-av";
import Svg, { Circle } from "react-native-svg";
import { FileText, RotateCw, X } from "lucide-react-native";
import {
  cancelChatUpload,
  hasUploadJob,
  retryChatUpload,
  useUploadStore,
  MEDIA_BUBBLE_WIDTH,
  mediaAspect,
  type UploadInfo,
} from "../../../lib/upload-queue";

const { width } = Dimensions.get("window");
const RING = 52;
const STROKE = 3;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

function formatBytes(n?: number) {
  if (!n || n <= 0) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Telegram: aylana jarayon, o'rtada X (bekor qilish) yoki xatoda qayta urinish. */
export function ProgressControl({ tempId, light }: { tempId: string; light?: boolean }) {
  const progress = useUploadStore((s) => s.progress[tempId]);
  const failed = useUploadStore((s) => s.failed[tempId]);
  // Ilova qayta ochilgan — yuklash ishi yo'q, faqat o'chirish mumkin.
  const orphan = !hasUploadJob(tempId);
  const isFailed = !!failed || orphan;
  const p = Math.max(0.03, progress ?? 0);
  // Telegram "Обработка...": bayt ketishidan oldin (nusxa yaratish, ulanish) — foizsiz aylanuvchi chiziq.
  const preparing = !isFailed && !(progress && progress > 0);
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!preparing) return;
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [preparing, spin]);

  return (
    <Pressable
      hitSlop={8}
      onPress={() => (isFailed && !orphan ? retryChatUpload(tempId) : cancelChatUpload(tempId))}
      style={[styles.ring, light ? styles.ringLight : null]}
    >
      {preparing ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] },
          ]}
        >
          <Svg width={RING} height={RING}>
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              stroke="#fff"
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${CIRC * 0.22} ${CIRC}`}
            />
          </Svg>
        </Animated.View>
      ) : !isFailed ? (
        <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            stroke="#fff"
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={CIRC * (1 - p)}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
      ) : null}
      {isFailed && !orphan ? <RotateCw color="#fff" size={22} /> : <X color="#fff" size={22} />}
    </Pressable>
  );
}

export function UploadingMediaBubble({
  tempId,
  info,
  timeLabel,
}: {
  tempId: string;
  info: UploadInfo;
  timeLabel?: string;
}) {
  const failed = useUploadStore((s) => s.failed[tempId]);
  const progress = useUploadStore((s) => s.progress[tempId]);
  const orphan = !hasUploadJob(tempId);
  const sizeLabel = formatBytes(info.size);
  const statusLabel = orphan
    ? "Yuborilmadi"
    : failed
      ? "Xato — qayta urinish"
      : !progress
        ? "Tayyorlanmoqda…"
        : info.size
          ? `${formatBytes(info.size * Math.min(1, progress / 0.95))} / ${sizeLabel}`
          : "Yuklanmoqda…";

  if (info.kind === "file") {
    return (
      <View style={styles.fileRow}>
        <ProgressControl tempId={tempId} light />
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>
            {info.name}
          </Text>
          <Text style={[styles.fileMeta, failed || orphan ? styles.failedText : null]}>{statusLabel}</Text>
        </View>
        <FileText color="rgba(255,255,255,0.35)" size={18} />
      </View>
    );
  }

  return (
    <View style={[styles.mediaWrapper, { width: MEDIA_BUBBLE_WIDTH, aspectRatio: mediaAspect(info) }]}>
      <View style={styles.mediaContainer}>
        {info.kind === "image" ? (
          <Image source={{ uri: info.localUri }} style={styles.media} resizeMode="cover" />
        ) : (
          <Video
            source={{ uri: info.localUri }}
            style={styles.media}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            isMuted
            pointerEvents="none"
          />
        )}
        <View style={styles.dim} pointerEvents="none" />
        <View style={styles.center} pointerEvents="box-none">
          <ProgressControl tempId={tempId} />
        </View>
      </View>
      <View style={styles.badge} pointerEvents="none">
        <Text style={[styles.badgeText, failed || orphan ? styles.failedText : null]}>{statusLabel}</Text>
      </View>
      {timeLabel ? (
        <View style={styles.time} pointerEvents="none">
          <Text style={styles.timeText}>{timeLabel} 🕓</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mediaWrapper: {
    width: width * 0.72,
    maxWidth: 280,
    aspectRatio: 3 / 4,
    position: "relative",
    alignSelf: "flex-start",
  },
  mediaContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0e1621",
  },
  media: { width: "100%", height: "100%" },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  ringLight: { backgroundColor: "#3a8ee6" },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "500" },
  failedText: { color: "#ff8a80" },
  time: {
    position: "absolute",
    right: 8,
    bottom: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  timeText: { color: "#fff", fontSize: 11 },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 220, paddingVertical: 4 },
  fileInfo: { flex: 1 },
  fileName: { color: "#fff", fontSize: 15, fontWeight: "500" },
  fileMeta: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 },
});

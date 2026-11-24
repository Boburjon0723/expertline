import React from "react";
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { ResizeMode, Video } from "expo-av";
import { Play } from "lucide-react-native";
import { CachedImage } from "../../../components/CachedImage";
import type { Message } from "../types";
import { MEDIA_BUBBLE_WIDTH, type UploadInfo } from "../../../lib/upload-queue";
import { ProgressControl } from "./UploadingMediaBubble";

const { width } = Dimensions.get("window");
const GRID_W = Math.min(width * 0.72, MEDIA_BUBBLE_WIDTH);
const GAP = 2;

/** Telegram'ga o'xshash qatorlar: 2 → [2], 3 → [1,2], 4 → [2,2], 5 → [2,3], keyin 3 talik qatorlar. */
export function albumRows(n: number): number[] {
  if (n <= 2) return [n];
  if (n === 3) return [1, 2];
  if (n === 4) return [2, 2];
  const rows: number[] = [];
  let left = n;
  while (left > 0) {
    if (left === 4) {
      rows.unshift(2, 2);
      break;
    }
    const take = left === 2 ? 2 : 3;
    rows.unshift(take);
    left -= take;
  }
  return rows;
}

function rowHeight(count: number) {
  if (count === 1) return GRID_W * 0.62;
  return (GRID_W - GAP * (count - 1)) / count;
}

function isVideoItem(m: Message) {
  const up = m.metadata?.upload as UploadInfo | undefined;
  if (up) return up.kind === "video";
  return m.messageType === "video" || /\.(mp4|mov|avi|mkv)(\?|$)/i.test(m.remoteFileUrl || "");
}

function Tile({
  item,
  w,
  h,
  onOpen,
  onLongPress,
  isMe,
}: {
  isMe?: boolean;
  item: Message;
  w: number;
  h: number;
  onOpen: (m: Message) => void;
  onLongPress: (m: Message) => void;
}) {
  const upload = item.metadata?.upload as UploadInfo | undefined;
  const video = isVideoItem(item);
  return (
    <Pressable
      style={[styles.tile, { width: w, height: h }]}
      onPress={() => !upload && onOpen(item)}
      onLongPress={() => onLongPress(item)}
      delayLongPress={280}
    >
      {upload ? (
        upload.kind === "video" ? (
          <Video
            source={{ uri: upload.localUri }}
            style={styles.fill}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            isMuted
            pointerEvents="none"
          />
        ) : (
          <Image source={{ uri: upload.localUri }} style={styles.fill} resizeMode="cover" />
        )
      ) : video ? (
        <View style={[styles.fill, styles.videoBg]}>
          {typeof item.metadata?.thumb === "string" ? (
            <Image source={{ uri: item.metadata.thumb }} blurRadius={8} style={styles.fill} />
          ) : null}
        </View>
      ) : item.remoteFileUrl ? (
        <CachedImage
          uri={item.remoteFileUrl}
          forceCache={isMe}
          thumb={typeof item.metadata?.thumb === "string" ? item.metadata.thumb : null}
          style={styles.fill}
          resizeMode="cover"
          onLongPress={() => onLongPress(item)}
        />
      ) : null}
      {upload ? (
        <View style={styles.center} pointerEvents="box-none">
          <ProgressControl tempId={item.id} />
        </View>
      ) : video ? (
        <View style={styles.center} pointerEvents="none">
          <View style={styles.play}>
            <Play color="#fff" size={20} fill="#fff" />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Albom: bir nechta rasm/video bitta xabarda to'r ko'rinishida. */
export function AlbumGrid({
  items,
  timeLabel,
  onOpen,
  onLongPress,
  isMe = false,
}: {
  isMe?: boolean;
  items: Message[];
  timeLabel?: string;
  onOpen: (m: Message) => void;
  onLongPress: (m: Message) => void;
}) {
  const rows = albumRows(items.length);
  let cursor = 0;
  return (
    <View style={styles.grid}>
      {rows.map((count, r) => {
        const rowItems = items.slice(cursor, cursor + count);
        cursor += count;
        const h = rowHeight(count);
        const w = (GRID_W - GAP * (count - 1)) / count;
        return (
          <View key={r} style={[styles.row, r > 0 ? { marginTop: GAP } : null]}>
            {rowItems.map((m, i) => (
              <View key={m.id} style={i > 0 ? { marginLeft: GAP } : null}>
                <Tile item={m} w={w} h={h} onOpen={onOpen} onLongPress={onLongPress} isMe={isMe} />
              </View>
            ))}
          </View>
        );
      })}
      {timeLabel ? (
        <View style={styles.time} pointerEvents="none">
          <Text style={styles.timeText}>{timeLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { width: GRID_W, borderRadius: 12, overflow: "hidden", position: "relative" },
  row: { flexDirection: "row" },
  tile: { backgroundColor: "#0e1621", overflow: "hidden" },
  fill: { width: "100%", height: "100%" },
  videoBg: { backgroundColor: "#1f2a3a" },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 2,
  },
  time: {
    position: "absolute",
    right: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  timeText: { color: "#fff", fontSize: 11 },
});

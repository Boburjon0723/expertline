import React, { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import * as MediaLibrary from "expo-media-library";
import { Camera, File, Image as ImageIcon, type LucideIcon } from "lucide-react-native";

export type AttachAction = "gallery" | "file" | "camera";

const THUMB = 96;
const isExpoGo = Constants.appOwnership === "expo";

type Recent = {
  id: string;
  uri: string;
  isVideo: boolean;
  durationSec?: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (id: AttachAction) => void;
  onPickRecent: (uri: string, name: string, mime: string) => void;
};

export function TelegramAttachSheet({ visible, onClose, onPick, onPickRecent }: Props) {
  const insets = useSafeAreaInsets();
  const [recents, setRecents] = useState<Recent[]>([]);

  useEffect(() => {
    if (!visible || isExpoGo) {
      setRecents([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        setRecents([]);
        return;
      }
      const page = await MediaLibrary.getAssetsAsync({
        first: 48,
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sortBy: [MediaLibrary.SortBy.creationTime],
      });
      if (cancelled) return;
      setRecents(
        page.assets.map((a) => ({
          id: a.id,
          uri: a.uri,
          isVideo: a.mediaType === MediaLibrary.MediaType.video,
          durationSec: typeof a.duration === "number" ? a.duration : undefined,
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const sendRecent = async (item: Recent) => {
    const info = await MediaLibrary.getAssetInfoAsync(item.id);
    const uri = info.localUri || info.uri;
    if (!uri) return;
    const isVideo = item.isVideo;
    onPickRecent(
      uri,
      isVideo ? `video_${Date.now()}.mp4` : `photo_${Date.now()}.jpg`,
      isVideo ? "video/mp4" : "image/jpeg"
    );
  };

  const ACTIONS: { id: AttachAction; label: string; color: string; Icon: LucideIcon }[] = [
    { id: "gallery", label: "Galereya", color: "#5a9ce6", Icon: ImageIcon },
    { id: "file", label: "Fayl", color: "#f0a030", Icon: File },
  ];

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.handle} pointerEvents="none" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.strip}
        >
          <Pressable onPress={() => onPick("camera")} style={styles.thumb}>
            <View style={styles.camFallback}>
              <Camera color="#fff" size={28} pointerEvents="none" />
              <Text style={styles.camLabel}>Kamera</Text>
            </View>
          </Pressable>
          {isExpoGo ? (
            <Pressable onPress={() => onPick("gallery")} style={[styles.thumb, styles.expoGalleryTile]}>
              <ImageIcon color="#fff" size={26} pointerEvents="none" />
              <Text style={styles.expoGalleryText}>Rasmlar</Text>
            </Pressable>
          ) : (
            recents.map((item) => (
              <Pressable key={item.id} onPress={() => void sendRecent(item)} style={styles.thumb}>
                <Image source={{ uri: item.uri }} style={styles.thumbImg} />
                {item.isVideo ? (
                  <View style={styles.videoDot}>
                    <Text style={styles.videoDotText}>
                      {item.durationSec
                        ? `${Math.floor(item.durationSec / 60)}:${Math.floor(item.durationSec % 60)
                            .toString()
                            .padStart(2, "0")}`
                        : "VIDEO"}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ))
          )}
        </ScrollView>
        <View style={styles.actions}>
          {ACTIONS.map((it) => (
            <Pressable
              key={it.id}
              onPress={() => onPick(it.id)}
              style={({ pressed }) => [styles.action, pressed && { opacity: 0.75 }]}
              hitSlop={8}
            >
              <View style={[styles.circle, { backgroundColor: it.color }]}>
                <it.Icon color="#fff" size={26} pointerEvents="none" />
              </View>
              <Text style={styles.label}>{it.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
    elevation: 2000,
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: "#1c2733",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    elevation: 24,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.28)",
    marginBottom: 10,
  },
  strip: {
    paddingHorizontal: 10,
    paddingBottom: 14,
    gap: 4,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0e1621",
  },
  thumbImg: { width: "100%", height: "100%" },
  camFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2b3a4a",
    gap: 6,
  },
  camLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "600",
  },
  expoGalleryTile: {
    width: THUMB * 1.55,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2b3a4a",
    gap: 6,
  },
  expoGalleryText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "600",
  },
  videoDot: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  videoDotText: { color: "#fff", fontSize: 10 },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 4,
    zIndex: 3,
    elevation: 26,
  },
  action: {
    width: 76,
    alignItems: "center",
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  label: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    textAlign: "center",
  },
});

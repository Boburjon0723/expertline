import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { File, Play, X } from "lucide-react-native";
import { ResizeMode, Video } from "expo-av";

export type PendingSendFile = {
  uri: string;
  name: string;
  mime: string;
  size?: number;
};

function formatBytes(n?: number) {
  if (!n || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mime: string, name: string) {
  return mime.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
}

function isVideo(mime: string, name: string) {
  return mime.startsWith("video/") || /\.(mp4|mov|mkv|webm)$/i.test(name);
}

type Props = {
  files: PendingSendFile[];
  onChangeFiles: (next: PendingSendFile[]) => void;
  onAdd: () => void;
  onCancel: () => void;
  onSend: (caption: string, asDocument?: boolean) => void;
  sending?: boolean;
};

/** Telegram Desktop: Send as a file — izoh, qo‘shish, bekor, yuborish */
export function TelegramSendPreviewSheet({
  files,
  onChangeFiles,
  onAdd,
  onCancel,
  onSend,
  sending,
}: Props) {
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState("");
  const [asDocument, setAsDocument] = useState(false);
  if (!files.length) return null;

  const allMedia = files.every((f) => isImage(f.mime, f.name) || isVideo(f.mime, f.name));
  const title = allMedia
    ? files.some((f) => isVideo(f.mime, f.name))
      ? "Video yuborish"
      : "Rasm yuborish"
    : "Fayl sifatida yuborish";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
      >
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {files.map((f, i) => {
              const img = isImage(f.mime, f.name);
              const vid = isVideo(f.mime, f.name);
              return (
                <View key={`${f.uri}-${i}`} style={styles.row}>
                  {img ? (
                    <Image source={{ uri: f.uri }} style={styles.thumb} />
                  ) : vid ? (
                    <View style={styles.videoThumbWrap}>
                      <Video
                        source={{ uri: f.uri }}
                        style={styles.videoThumb}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={false}
                        isMuted
                      />
                      <View style={styles.videoPlay}>
                        <Play color="#fff" size={18} fill="#fff" />
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.thumb, styles.fileIcon]}>
                      <File color="#fff" size={22} />
                    </View>
                  )}
                  <View style={styles.meta}>
                    <Text style={styles.name} numberOfLines={2}>
                      {f.name}
                    </Text>
                    <Text style={styles.size}>{formatBytes(f.size) || f.mime || "Fayl"}</Text>
                  </View>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      const next = files.filter((_, idx) => idx !== i);
                      onChangeFiles(next);
                      if (!next.length) onCancel();
                    }}
                    style={styles.xBtn}
                  >
                    <X color="rgba(255,255,255,0.55)" size={20} />
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
          {files.some((f) => isVideo(f.mime, f.name)) ? (
            <Pressable
              style={styles.checkRow}
              onPress={() => setAsDocument((v) => !v)}
            >
              <View style={[styles.check, asDocument && styles.checkOn]}>
                {asDocument ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={styles.checkLabel}>Hujjat sifatida yuborish</Text>
            </Pressable>
          ) : null}
          <TextInput
            style={styles.caption}
            placeholder="Izoh"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={caption}
            onChangeText={setCaption}
            multiline
          />
          <View style={styles.actions}>
            <Pressable onPress={onAdd} hitSlop={8}>
              <Text style={styles.link}>Qo‘shish</Text>
            </Pressable>
            <View style={styles.actionsRight}>
              <Pressable onPress={onCancel} hitSlop={8} disabled={sending}>
                <Text style={styles.cancel}>Bekor</Text>
              </Pressable>
              <Pressable
                onPress={() => onSend(caption.trim(), asDocument)}
                hitSlop={8}
                disabled={sending}
              >
                <Text style={styles.send}>{sending ? "…" : "Yuborish"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  card: {
    marginHorizontal: 20,
    backgroundColor: "#212d3b",
    borderRadius: 14,
    paddingTop: 16,
    paddingHorizontal: 16,
    zIndex: 2,
    elevation: 12,
  },
  title: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 14,
  },
  list: { maxHeight: 280 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  videoThumbWrap: {
    width: 120,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#0e1621",
  },
  videoThumb: { width: "100%", height: "100%" },
  videoPlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: {
    backgroundColor: "#64b5ef",
    borderColor: "#64b5ef",
  },
  checkMark: { color: "#fff", fontSize: 13, fontWeight: "800" },
  checkLabel: { color: "rgba(255,255,255,0.85)", fontSize: 15 },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0e1621",
  },
  fileIcon: {
    backgroundColor: "#5eb5f7",
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { flex: 1, minWidth: 0 },
  name: { color: "#fff", fontSize: 15, fontWeight: "600" },
  size: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 2 },
  xBtn: { padding: 4 },
  caption: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
    color: "#fff",
    fontSize: 16,
    minHeight: 44,
    paddingVertical: 10,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  actionsRight: { flexDirection: "row", alignItems: "center", gap: 20 },
  link: { color: "#64b5ef", fontSize: 16, fontWeight: "600" },
  cancel: { color: "rgba(255,255,255,0.55)", fontSize: 16, fontWeight: "600" },
  send: { color: "#64b5ef", fontSize: 16, fontWeight: "700" },
});

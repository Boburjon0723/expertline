import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
  CheckSquare,
  Copy,
  Download,
  Forward,
  Pencil,
  Pin,
  Reply,
  Trash2,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Message } from "../types";
import {
  classifyMessageKind as kindOfMessage,
  messageCaption,
  type MessageKind,
} from "../message-preview";
import { getActionMessage, subscribeActionMessage } from "../message-action-store";
import { AnimatedPressable } from "../../../components/AnimatedPressable";
import { palette } from "../../../lib/theme";

export type MessageMenuLabels = {
  reply: string;
  edit: string;
  copy: string;
  save: string;
  pin: string;
  forward: string;
  select: string;
  delete: string;
  kindText: string;
  kindImage: string;
  kindVideo: string;
  kindVoice: string;
  kindAudio: string;
  kindFile: string;
  kindSticker: string;
};

type Props = {
  currentUserId: string;
  labels: MessageMenuLabels;
  onClose: () => void;
  onReply: (m: Message) => void;
  onEdit: (m: Message) => void;
  onCopy: (m: Message) => void;
  onSave: (m: Message) => void;
  onPin: (m: Message) => void;
  onForward: (m: Message) => void;
  onSelect: (m: Message) => void;
  onDelete: (m: Message) => void;
};

function snippetFor(message: Message, kind: MessageKind, labels: MessageMenuLabels) {
  const cap = messageCaption(message);
  if (kind === "sticker") return cap || labels.kindSticker;
  if (kind === "voice") return cap || labels.kindVoice;
  if (kind === "image") return cap || labels.kindImage;
  if (kind === "video") return cap || labels.kindVideo;
  if (kind === "audio") return cap || labels.kindAudio;
  if (kind === "file") return cap || labels.kindFile;
  return cap || labels.kindText;
}

function actionsForKind(kind: MessageKind, isOwn: boolean, message?: Message | null) {
  const cap = message ? messageCaption(message) : "";
  return {
    reply: true,
    edit: isOwn && kind === "text",
    copy: kind === "image" || kind === "text" || !!cap,
    save: kind === "image" || kind === "video" || kind === "voice" || kind === "audio" || kind === "file",
    pin: kind !== "other",
    forward: kind !== "other",
    select: true,
    delete: true,
  };
}

export function MessageContextMenu({
  currentUserId,
  labels,
  onClose,
  onReply,
  onEdit,
  onCopy,
  onSave,
  onPin,
  onForward,
  onSelect,
  onDelete,
}: Props) {
  const message = useSyncExternalStore(subscribeActionMessage, getActionMessage, getActionMessage);
  const isOwn = !!message && currentUserId.length > 0 && message.senderId === currentUserId;
  const insets = useSafeAreaInsets();
  const [held, setHeld] = useState<Message | null>(message);
  const opacity = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(36)).current;
  const closing = useRef(false);

  useEffect(() => {
    if (message) {
      closing.current = false;
      setHeld(message);
      opacity.setValue(0);
      slide.setValue(36);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
      ]).start();
      return;
    }
    if (!held) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 28, duration: 150, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setHeld(null);
    });
  }, [message]);

  const kind = held ? kindOfMessage(held) : "text";
  const allowed = held ? actionsForKind(kind, isOwn, held) : actionsForKind("text", false);
  const snippet = held ? snippetFor(held, kind, labels) : "";
  const kindLabel =
    kind === "image"
      ? labels.kindImage
      : kind === "video"
        ? labels.kindVideo
        : kind === "voice"
          ? labels.kindVoice
          : kind === "audio"
            ? labels.kindAudio
            : kind === "file"
              ? labels.kindFile
              : kind === "sticker"
                ? labels.kindSticker
                : labels.kindText;

  const run = (fn: () => void) => {
    if (closing.current) return;
    onClose();
    setTimeout(fn, 160);
  };

  const items = useMemo(() => {
    if (!held) return [];
    const all = [
      allowed.reply && {
        key: "reply",
        label: labels.reply,
        icon: <Reply color="#6eb1ff" size={22} />,
        onPress: () => run(() => onReply(held)),
      },
      allowed.edit && {
        key: "edit",
        label: labels.edit,
        icon: <Pencil color="#6eb1ff" size={22} />,
        onPress: () => run(() => onEdit(held)),
      },
      allowed.copy && {
        key: "copy",
        label: labels.copy,
        icon: <Copy color="#6eb1ff" size={22} />,
        onPress: () => run(() => onCopy(held)),
      },
      allowed.save && {
        key: "save",
        label: labels.save,
        icon: <Download color="#6eb1ff" size={22} />,
        onPress: () => run(() => onSave(held)),
      },
      allowed.pin && {
        key: "pin",
        label: labels.pin,
        icon: <Pin color="#6eb1ff" size={22} />,
        onPress: () => run(() => onPin(held)),
      },
      allowed.forward && {
        key: "forward",
        label: labels.forward,
        icon: <Forward color="#6eb1ff" size={22} />,
        onPress: () => run(() => onForward(held)),
      },
      allowed.select && {
        key: "select",
        label: labels.select,
        icon: <CheckSquare color="#6eb1ff" size={22} />,
        onPress: () => run(() => onSelect(held)),
      },
      allowed.delete && {
        key: "delete",
        label: labels.delete,
        icon: <Trash2 color={palette.danger} size={22} />,
        danger: true,
        onPress: () => run(() => onDelete(held)),
      },
    ];
    return all.filter(Boolean) as {
      key: string;
      label: string;
      icon: React.ReactNode;
      danger?: boolean;
      onPress: () => void;
    }[];
  }, [held, allowed, labels]);

  if (!held) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
    <View style={styles.host} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity }]} />
      </Pressable>
      <Animated.View
        style={[
          styles.bottom,
          { paddingBottom: Math.max(insets.bottom, 10), opacity, transform: [{ translateY: slide }] },
        ]}
        pointerEvents="box-none"
      >
        <View style={[styles.previewWrap, isOwn ? styles.previewOwn : styles.previewPeer]}>
          <View style={[styles.previewBubble, isOwn ? styles.previewBubbleOwn : styles.previewBubblePeer]}>
            <Text style={styles.previewKind}>{kindLabel}</Text>
            <Text style={styles.previewText} numberOfLines={3}>
              {snippet}
            </Text>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.grid}>
            {items.map((item) => (
              <AnimatedPressable key={item.key} style={styles.cell} innerStyle={styles.cellInner} onPress={item.onPress} scaleTo={0.9}>
                <View style={[styles.iconWrap, item.danger && styles.iconWrapDanger]}>{item.icon}</View>
                <Text style={[styles.cellLabel, item.danger && styles.cellDanger]} numberOfLines={1}>
                  {item.label}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 14, 22, 0.42)",
  },
  bottom: {
    paddingHorizontal: 10,
  },
  previewWrap: {
    marginBottom: 10,
    maxWidth: "86%",
  },
  previewOwn: { alignSelf: "flex-end" },
  previewPeer: { alignSelf: "flex-start" },
  previewBubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: "100%",
  },
  previewBubbleOwn: { backgroundColor: "#3d8fd4" },
  previewBubblePeer: { backgroundColor: "#2b3948" },
  previewKind: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  previewText: { color: "#fff", fontSize: 15, lineHeight: 20 },
  sheet: {
    backgroundColor: "#17212b",
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: "25%",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  cellInner: { alignItems: "center", width: "100%" },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(110,177,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  iconWrapDanger: { backgroundColor: "rgba(248,113,113,0.14)" },
  cellLabel: { color: "rgba(255,255,255,0.88)", fontSize: 11, fontWeight: "600" },
  cellDanger: { color: palette.danger },
});

import React, { useEffect, useRef } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { GlassBackground } from "../../../components/GlassBackground";
import {
  Bell,
  BellOff,
  CircleCheck,
  Download,
  Eraser,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react-native";

export type ChatHeaderMoreMenuProps = {
  visible: boolean;
  onClose: () => void;
  topOffset?: number;
  muted: boolean;
  onSelect: () => void;
  onToggleMute: () => void;
  onShowProfile: () => void;
  onExport: () => void;
  onClearHistory: () => void;
  onDeleteChat: () => void;
  labels: {
    select: string;
    mute: string;
    unmute: string;
    showProfile: string;
    exportHistory: string;
    clearHistory: string;
    deleteChat: string;
  };
};

/** Chat sarlavhasidagi ⋮ menyusi — Telegram uslubi: belgili bandlar, o'ng yuqoridan ochiladi (web bilan bir xil tartib). */
export function ChatHeaderMoreMenu({
  visible,
  onClose,
  topOffset = 56,
  muted,
  onSelect,
  onToggleMute,
  onShowProfile,
  onExport,
  onClearHistory,
  onDeleteChat,
  labels,
}: ChatHeaderMoreMenuProps) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) {
      v.setValue(0);
      return;
    }
    Animated.timing(v, { toValue: 1, duration: 170, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible, v]);

  const run = (fn: () => void) => {
    onClose();
    setTimeout(fn, 50);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.anchor, { top: topOffset }]} pointerEvents="box-none">
          <Animated.View
            style={{
              opacity: v,
              transform: [
                // O'ng yuqori burchakdan kattalashib chiqadi
                { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
                { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
              ],
            }}
          >
            <Pressable style={styles.menu} onPress={(e) => e.stopPropagation()}>
              {/* Shaffof xira fon — Sozlamalardagi panel xiraligiga bog'liq */}
              <GlassBackground tint="rgba(30,30,30,0.35)" />
              <MenuItem Icon={CircleCheck} label={labels.select} onPress={() => run(onSelect)} />
              <MenuItem
                Icon={muted ? Bell : BellOff}
                label={muted ? labels.unmute : labels.mute}
                onPress={() => run(onToggleMute)}
              />
              <MenuItem Icon={UserRound} label={labels.showProfile} onPress={() => run(onShowProfile)} />
              <MenuItem Icon={Download} label={labels.exportHistory} onPress={() => run(onExport)} />
              <MenuItem Icon={Eraser} label={labels.clearHistory} onPress={() => run(onClearHistory)} />
              <View style={styles.separator} />
              <MenuItem Icon={Trash2} label={labels.deleteChat} onPress={() => run(onDeleteChat)} destructive />
            </Pressable>
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
}

function MenuItem({
  Icon,
  label,
  onPress,
  destructive,
  disabled,
}: {
  Icon: LucideIcon;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  const color = destructive ? "#ff6b6b" : "rgba(255,255,255,0.75)";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed, disabled && { opacity: 0.5 }]}
    >
      <Icon color={color} size={20} strokeWidth={2} />
      <Text style={[styles.itemText, destructive && styles.itemDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)" },
  anchor: { position: "absolute", right: 10, left: 0, alignItems: "flex-end" },
  menu: {
    minWidth: 230,
    borderRadius: 14,
    backgroundColor: "transparent",
    overflow: "hidden",
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  item: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 11 },
  itemPressed: { backgroundColor: "rgba(255,255,255,0.08)" },
  itemText: { color: "#fff", fontSize: 15 },
  itemDanger: { color: "#ff6b6b" },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 4 },
});

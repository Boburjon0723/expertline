import React from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";
import { palette } from "../../lib/theme";
import { REGIONS, type RegionCode } from "../../lib/regions";
import { DIRECTIONS, type DirectionCode } from "../../lib/directions";
import { useAuthLocale } from "../auth/locale";

export type RegionFilter = RegionCode | "all";
export type DirectionFilter = DirectionCode | "all";

type Option = { code: string; label: string; n?: number };

type PickerProps = {
  visible: boolean;
  title: string;
  options: Option[];
  value: string | null;
  onSelect: (code: string) => void;
  onClose: () => void;
};

/** Pastdan ochiladigan tanlash ro'yxati (viloyat / yo'nalish) */
export function PickerSheet({ visible, title, options, value, onSelect, onClose }: PickerProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]} onPress={() => {}}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(r) => r.code}
            renderItem={({ item }) => {
              const on = value === item.code;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item.code);
                    onClose();
                  }}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: palette.surface }]}
                >
                  <Text style={[styles.rowText, on && { color: palette.accent, fontWeight: "600" }]}>{item.label}</Text>
                  {item.n != null ? <Text style={styles.count}>{item.n}</Text> : null}
                  <View style={styles.checkBox}>{on ? <Check color={palette.accent} size={18} /> : null}</View>
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type SheetProps<T extends string> = {
  visible: boolean;
  value: T | null;
  onSelect: (v: T) => void;
  onClose: () => void;
  /** "Barchasi" qatori (ro'yxat filtrida bor, e'lon formasida yo'q) */
  allowAll?: boolean;
  counts?: Record<string, number>;
};

function withAll(options: Option[], allLabel: string, allowAll?: boolean, counts?: Record<string, number>): Option[] {
  if (!allowAll) return options;
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined;
  return [{ code: "all", label: allLabel, n: total }, ...options];
}

export function RegionSheet({ visible, value, onSelect, onClose, allowAll, counts }: SheetProps<RegionFilter>) {
  const { t, lang } = useAuthLocale();
  const options = withAll(
    REGIONS.map((r) => ({ code: r.code, label: r[lang], n: counts ? counts[r.code] ?? 0 : undefined })),
    t("regionAll"),
    allowAll,
    counts
  );
  return (
    <PickerSheet
      visible={visible}
      title={t("regionPick")}
      options={options}
      value={value}
      onSelect={(c) => onSelect(c as RegionFilter)}
      onClose={onClose}
    />
  );
}

export function DirectionSheet({ visible, value, onSelect, onClose, allowAll, counts }: SheetProps<DirectionFilter>) {
  const { t, lang } = useAuthLocale();
  const options = withAll(
    DIRECTIONS.map((d) => ({ code: d.code, label: `${d.emoji}  ${d[lang]}`, n: counts ? counts[d.code] ?? 0 : undefined })),
    t("directionAll"),
    allowAll,
    counts
  );
  return (
    <PickerSheet
      visible={visible}
      title={t("directionPick")}
      options={options}
      value={value}
      onSelect={(c) => onSelect(c as DirectionFilter)}
      onClose={onClose}
    />
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "75%",
    backgroundColor: palette.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: palette.border, marginTop: 8 },
  title: { color: palette.text, fontSize: 17, fontWeight: "600", paddingHorizontal: 20, paddingVertical: 12 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, height: 48 },
  rowText: { flex: 1, color: palette.text, fontSize: 16 },
  count: { color: palette.textMuted, fontSize: 14, marginRight: 8 },
  checkBox: { width: 22, alignItems: "flex-end" },
});

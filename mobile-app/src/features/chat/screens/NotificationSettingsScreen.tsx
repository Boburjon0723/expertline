import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Switch,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Bell, MessageSquare, Volume2, Vibrate } from "lucide-react-native";
import { useAuthLocale } from "../../auth/locale";
import { palette } from "../../../lib/theme";

const ICON = 22;
const ICON_COLOR = palette.textSecondary;

export function NotificationSettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useAuthLocale();

  const [notifEnabled, setNotifEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [previewEnabled, setPreviewEnabled] = useState(true);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={10}>
          <ArrowLeft color={palette.textSecondary} size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("settingsNotif")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{t("settingsAccount")}</Text>
        <NotifToggle
          icon={<Bell color={ICON_COLOR} size={ICON} />}
          label={t("notifAll")}
          value={notifEnabled}
          onValueChange={setNotifEnabled}
        />

        <Text style={styles.sectionTitle}>{t("notifSettings")}</Text>
        <NotifToggle
          icon={<MessageSquare color={ICON_COLOR} size={ICON} />}
          label={t("notifPreview")}
          subLabel={t("notifPreviewSub")}
          value={previewEnabled}
          onValueChange={setPreviewEnabled}
        />
        <NotifToggle
          icon={<Volume2 color={ICON_COLOR} size={ICON} />}
          label={t("notifSound")}
          value={soundEnabled}
          onValueChange={setSoundEnabled}
        />
        <NotifToggle
          icon={<Vibrate color={ICON_COLOR} size={ICON} />}
          label={t("notifVibrate")}
          value={vibrationEnabled}
          onValueChange={setVibrationEnabled}
        />
      </ScrollView>
    </View>
  );
}

function NotifToggle({ icon, label, subLabel, value, onValueChange }: any) {
  return (
    <View style={styles.item}>
      {icon}
      <View style={styles.itemTextContainer}>
        <Text style={styles.itemLabel}>{label}</Text>
        {subLabel ? <Text style={styles.itemSubLabel}>{subLabel}</Text> : null}
      </View>
      <Switch
        trackColor={{ false: "rgba(255,255,255,0.12)", true: palette.accent }}
        thumbColor="#fff"
        ios_backgroundColor="rgba(255,255,255,0.12)"
        onValueChange={onValueChange}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: 20, fontWeight: "500" },
  content: { flex: 1 },
  sectionTitle: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: "500",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  itemTextContainer: { flex: 1 },
  itemLabel: { color: "#fff", fontSize: 16 },
  itemSubLabel: { color: palette.textSecondary, fontSize: 13, marginTop: 2 },
});

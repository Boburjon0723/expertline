import React, { useState } from "react";
import { StyleSheet, View, Text, Pressable, ScrollView, Switch } from "react-native";
import { ArrowLeft, Lock, Eye, ShieldCheck, Key, Smartphone } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import { useAuthLocale } from "../../auth/locale";

const ICON = 22;
const ICON_COLOR = "#aaaaaa";

export function PrivacySettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useAuthLocale();
  const [lastSeen, setLastSeen] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [profilePhoto, setProfilePhoto] = useState(true);
  const [hasPasscode, setHasPasscode] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      void (async () => {
        const passcode = await SecureStore.getItemAsync("app_passcode_key");
        setHasPasscode(!!passcode);
      })();
    }, [])
  );

  const toggleAppLock = async () => {
    if (hasPasscode) {
      await SecureStore.deleteItemAsync("app_passcode_key");
      setHasPasscode(false);
    } else {
      navigation.navigate("Passcode", { mode: "set" });
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={10}>
          <ArrowLeft color="#aaaaaa" size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("privTitle")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{t("privPrivacy")}</Text>
        <PrivacyToggle
          icon={<Eye color={ICON_COLOR} size={ICON} />}
          label={t("privLastSeen")}
          subLabel={t("privLastSeenSub")}
          value={lastSeen}
          onToggle={setLastSeen}
        />
        <PrivacyToggle
          icon={<ShieldCheck color={ICON_COLOR} size={ICON} />}
          label={t("privReadReceipts")}
          subLabel={t("privReadReceiptsSub")}
          value={readReceipts}
          onToggle={setReadReceipts}
        />
        <PrivacyToggle
          icon={<Lock color={ICON_COLOR} size={ICON} />}
          label={t("privProfilePhoto")}
          subLabel={t("privProfilePhotoSub")}
          value={profilePhoto}
          onToggle={setProfilePhoto}
        />

        <Text style={styles.sectionTitle}>{t("privSecurity")}</Text>
        <Pressable style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
          <Key color={ICON_COLOR} size={ICON} />
          <View style={styles.itemText}>
            <Text style={styles.itemLabel}>{t("privChangePass")}</Text>
            <Text style={styles.itemSub}>{t("privChangePassSub")}</Text>
          </View>
        </Pressable>
        <PrivacyToggle
          icon={<Smartphone color={ICON_COLOR} size={ICON} />}
          label={t("privAppLock")}
          subLabel={hasPasscode ? t("privPassSet") : t("privPassNotSet")}
          value={hasPasscode}
          onToggle={toggleAppLock}
        />
        <Pressable style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
          <ShieldCheck color={ICON_COLOR} size={ICON} />
          <View style={styles.itemText}>
            <Text style={styles.itemLabel}>{t("priv2FA")}</Text>
            <Text style={styles.itemSub}>{t("priv2FASub")}</Text>
          </View>
        </Pressable>

        <Text style={styles.infoText}>{t("privInfoText")}</Text>
      </ScrollView>
    </View>
  );
}

function PrivacyToggle({ icon, label, subLabel, value, onToggle }: any) {
  return (
    <View style={styles.item}>
      {icon}
      <View style={styles.itemText}>
        <Text style={styles.itemLabel}>{label}</Text>
        <Text style={styles.itemSub}>{subLabel}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "rgba(255,255,255,0.12)", true: "#8774e1" }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#212121" },
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
    color: "#aaaaaa",
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
  pressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  itemText: { flex: 1 },
  itemLabel: { color: "#fff", fontSize: 16 },
  itemSub: { color: "#aaaaaa", fontSize: 13, marginTop: 2 },
  infoText: {
    color: "#aaaaaa",
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
});

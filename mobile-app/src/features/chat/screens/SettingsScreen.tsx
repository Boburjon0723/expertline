import React, { useCallback } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  StatusBar,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  User,
  Bell,
  Lock,
  Palette,
  Globe,
  Shield,
  Info,
  LifeBuoy,
  Moon,
} from "lucide-react-native";
import { AvatarImage } from "../../../components/AvatarImage";
import { useAuthStore } from "../../auth/store";
import { fetchProfileRequest } from "../../auth/profileApi";
import { AuthUser } from "../../auth/types";
import { useAuthLocale } from "../../auth/locale";

const ICON = 22;
const ICON_COLOR = "#aaaaaa";

export function SettingsScreen({ navigation, isTab }: any) {
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((s) => s.user) as AuthUser | null;
  const logout = useAuthStore((s) => s.logout);
  const patchUser = useAuthStore((s) => s.patchUser);
  const { t } = useAuthLocale();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const p = await fetchProfileRequest();
          if (!cancelled) await patchUser(p);
        } catch {
          /* tarmoq / 401 — joriy user bilan davom etamiz */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [patchUser])
  );

  const handleLogout = async () => {
    await logout();
    navigation.replace("Login");
  };

  const displayName = [currentUser?.name, currentUser?.surname].filter(Boolean).join(" ") || "Foydalanuvchi";
  const username = currentUser?.username ? `@${currentUser.username}` : "";

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {!isTab ? (
          <Pressable onPress={() => navigation?.goBack()} style={styles.headerBtn} hitSlop={10}>
            <ArrowLeft color="#aaaaaa" size={22} />
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
        <Text style={styles.headerTitle}>{t("settingsTitle")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          style={({ pressed }) => [styles.profileRow, pressed && styles.pressed]}
          onPress={() => navigation.navigate("Profile")}
        >
          <AvatarImage
            uri={currentUser?.avatar ?? currentUser?.avatar_url}
            name={currentUser?.name || "U"}
            size={64}
          />
          <View style={styles.profileText}>
            <Text style={styles.profileName} numberOfLines={1}>
              {displayName}
            </Text>
            {currentUser?.phone ? (
              <Text style={styles.profileMuted} numberOfLines={1}>
                {currentUser.phone}
              </Text>
            ) : null}
            {username ? (
              <Text style={styles.profileMuted} numberOfLines={1}>
                {username}
              </Text>
            ) : null}
          </View>
        </Pressable>

        <View style={styles.divider} />

        <SettingItem
          icon={<User color={ICON_COLOR} size={ICON} />}
          label={t("settingsProfile")}
          onPress={() => navigation.navigate("Profile")}
        />
        <SettingItem
          icon={<Bell color={ICON_COLOR} size={ICON} />}
          label={t("settingsNotif")}
          onPress={() => navigation.navigate("NotificationSettings")}
        />
        <SettingItem
          icon={<Lock color={ICON_COLOR} size={ICON} />}
          label={t("settingsPrivacy")}
          onPress={() => navigation.navigate("PrivacySettings")}
        />
        <SettingItem
          icon={<Palette color={ICON_COLOR} size={ICON} />}
          label={t("settingsTheme")}
          onPress={() => navigation.navigate("ThemeDesign")}
        />
        <SettingItem
          icon={<Globe color={ICON_COLOR} size={ICON} />}
          label={t("settingsLang")}
          onPress={() => navigation.navigate("LanguageSettings")}
        />
        <SettingItem
          icon={<Shield color={ICON_COLOR} size={ICON} />}
          label={t("settingsData")}
          hint={t("dataAutoDownSub")}
          onPress={() => navigation.navigate("DataStorageSettings")}
        />

        <View style={styles.divider} />

        <SettingItem
          icon={<LifeBuoy color={ICON_COLOR} size={ICON} />}
          label={t("supportHelp")}
          onPress={() => navigation.navigate("Support")}
        />
        <SettingItem
          icon={<Info color={ICON_COLOR} size={ICON} />}
          label={t("settingsAbout")}
          onPress={() => navigation.navigate("AboutApp")}
        />

        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutPressed]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutLabel}>{t("settingsLogout")}</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={styles.version}>v 1.2.0</Text>
        <Moon color="#aaaaaa" size={16} />
      </View>
    </View>
  );
}

function SettingItem({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.item, pressed && styles.pressed]} onPress={onPress}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={styles.itemText}>{label}</Text>
        {hint ? <Text style={styles.itemHint}>{hint}</Text> : null}
      </View>
    </Pressable>
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
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 20,
    fontWeight: "500",
  },
  content: { flex: 1 },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  profileText: { flex: 1, minWidth: 0 },
  profileName: { color: "#fff", fontSize: 16, fontWeight: "500" },
  profileMuted: { color: "#aaaaaa", fontSize: 14, marginTop: 2 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: 8,
    marginHorizontal: 20,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  pressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  itemText: { color: "#fff", fontSize: 16 },
  itemHint: { color: "#aaaaaa", fontSize: 13, marginTop: 2 },
  logoutBtn: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  logoutPressed: { backgroundColor: "rgba(229,57,53,0.1)" },
  logoutLabel: { color: "#e53935", fontSize: 16 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  version: { color: "#aaaaaa", fontSize: 13 },
});

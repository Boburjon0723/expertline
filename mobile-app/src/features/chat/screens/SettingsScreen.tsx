import React, { useCallback } from "react";
import {
  Alert,
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
  Award,
  Bell,
  Bookmark,
  ChevronRight,
  Lock,
  Palette,
  Globe,
  Shield,
  Info,
  LifeBuoy,
} from "lucide-react-native";
import { AvatarImage } from "../../../components/AvatarImage";
import { useAuthStore } from "../../auth/store";
import { fetchProfileRequest } from "../../auth/profileApi";
import { AuthUser } from "../../auth/types";
import { useAuthLocale } from "../../auth/locale";
import { openSavedMessagesRequest } from "../service";
import { palette } from "../../../lib/theme";

const ICON = 22;
const ICON_COLOR = palette.textSecondary;

/**
 * Sozlamalar — pastki tabdagi oxirgi bo'lim (eski chap menyu o'rniga).
 * ChatListScreen ichida chiziladi; ichki sahifalar stack orqali ochiladi.
 */
export function SettingsScreen({ navigation }: any) {
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

  const openSavedMessages = async () => {
    try {
      const opened = await openSavedMessagesRequest();
      navigation.navigate("ChatDetail", {
        chatId: opened.chatId,
        name: t("savedMessages"),
        avatarUrl: null,
      });
    } catch (e: any) {
      Alert.alert(t("savedMessages"), e?.message || t("loginErrorGeneric"));
    }
  };

  const displayName = [currentUser?.name, currentUser?.surname].filter(Boolean).join(" ") || "User";
  const username = currentUser?.username ? `@${currentUser.username}` : "";

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Text style={styles.headerTitle}>{t("settingsTitle")}</Text>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={({ pressed }) => [styles.card, styles.profileRow, pressed && styles.pressed]}
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
          <ChevronRight color={palette.textSecondary} size={20} />
        </Pressable>

        <Section>
          <MenuItem
            icon={<Bookmark color={ICON_COLOR} size={ICON} />}
            label={t("savedMessages")}
            onPress={() => void openSavedMessages()}
          />
          <MenuItem
            icon={<Award color={ICON_COLOR} size={ICON} />}
            label={t("expertProfileTitle")}
            hint={t("expertProfileSub")}
            onPress={() => navigation.navigate("ExpertProfile")}
          />
        </Section>

        <Section>
          <MenuItem
            icon={<Bell color={ICON_COLOR} size={ICON} />}
            label={t("settingsNotif")}
            onPress={() => navigation.navigate("NotificationSettings")}
          />
          <MenuItem
            icon={<Lock color={ICON_COLOR} size={ICON} />}
            label={t("settingsPrivacy")}
            onPress={() => navigation.navigate("PrivacySettings")}
          />
          <MenuItem
            icon={<Palette color={ICON_COLOR} size={ICON} />}
            label={t("settingsTheme")}
            onPress={() => navigation.navigate("ThemeDesign")}
          />
          <MenuItem
            icon={<Globe color={ICON_COLOR} size={ICON} />}
            label={t("settingsLang")}
            onPress={() => navigation.navigate("LanguageSettings")}
          />
          <MenuItem
            icon={<Shield color={ICON_COLOR} size={ICON} />}
            label={t("settingsData")}
            hint={t("dataAutoDownSub")}
            onPress={() => navigation.navigate("DataStorageSettings")}
          />
        </Section>

        <Section>
          <MenuItem
            icon={<LifeBuoy color={ICON_COLOR} size={ICON} />}
            label={t("supportHelp")}
            onPress={() => navigation.navigate("Support")}
          />
          <MenuItem
            icon={<Info color={ICON_COLOR} size={ICON} />}
            label={t("settingsAbout")}
            onPress={() => navigation.navigate("AboutApp")}
          />
        </Section>

        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutPressed]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutLabel}>{t("settingsLogout")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** Telegram/iOS uslubidagi guruhlangan shisha kartochka */
function Section({ children }: { children: React.ReactNode }) {
  return <View style={[styles.card, styles.section]}>{children}</View>;
}

function MenuItem({
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
  container: { flex: 1 },
  headerTitle: {
    textAlign: "center",
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    paddingTop: 4,
    paddingBottom: 12,
  },
  card: {
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  section: { marginTop: 14 },
  content: { flex: 1 },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  profileText: { flex: 1, minWidth: 0 },
  profileName: { color: "#fff", fontSize: 17, fontWeight: "500" },
  profileMuted: { color: palette.textSecondary, fontSize: 14, marginTop: 2 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  pressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  itemText: { color: "#fff", fontSize: 16 },
  itemHint: { color: palette.textSecondary, fontSize: 13, marginTop: 2 },
  logoutBtn: {
    marginTop: 20,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  logoutPressed: { backgroundColor: "rgba(229,57,53,0.1)" },
  logoutLabel: { color: palette.danger, fontSize: 16 },
});

export default SettingsScreen;

import React from "react";
import { StyleSheet, Text, View, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ShieldCheck, Globe } from "lucide-react-native";
import { useAuthLocale } from "../../auth/locale";
import { palette } from "../../../lib/theme";

const ICON = 22;
const ICON_COLOR = palette.textSecondary;

export function AboutAppScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useAuthLocale();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={10}>
          <ArrowLeft color={palette.textSecondary} size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("settingsAbout")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.appName}>ExpertLine</Text>
        <Text style={styles.version}>Version 1.2.0</Text>
        <Text style={styles.description}>{t("aboutFull")}</Text>

        <View style={styles.item}>
          <ShieldCheck color={ICON_COLOR} size={ICON} />
          <View style={styles.itemText}>
            <Text style={styles.itemTitle}>Xavfsiz muloqot</Text>
            <Text style={styles.itemDesc}>Barcha xabarlar va qo'ng'iroqlar shifrlangan</Text>
          </View>
        </View>
        <View style={styles.item}>
          <Globe color={ICON_COLOR} size={ICON} />
          <View style={styles.itemText}>
            <Text style={styles.itemTitle}>Global platforma</Text>
            <Text style={styles.itemDesc}>Dunyoning istalgan nuqtasidan mutaxassislar</Text>
          </View>
        </View>

        <Text style={styles.copyright}>© 2026 MALI Platform. Barcha huquqlar himoyalangan.</Text>
      </ScrollView>
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
  scrollContent: { paddingBottom: 40 },
  appName: { color: "#fff", fontSize: 20, fontWeight: "500", paddingHorizontal: 20, paddingTop: 16 },
  version: { color: palette.textSecondary, fontSize: 14, paddingHorizontal: 20, paddingTop: 4 },
  description: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  itemText: { flex: 1 },
  itemTitle: { color: "#fff", fontSize: 16 },
  itemDesc: { color: palette.textSecondary, fontSize: 13, marginTop: 2 },
  copyright: { color: palette.textSecondary, fontSize: 13, paddingHorizontal: 20, paddingTop: 24 },
});

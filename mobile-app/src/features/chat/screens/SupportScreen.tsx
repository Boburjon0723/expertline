import React from "react";
import { StyleSheet, Text, View, ScrollView, Pressable, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, MessageCircle, Phone, Send } from "lucide-react-native";
import { useAuthLocale } from "../../auth/locale";

const ICON = 22;
const ICON_COLOR = "#aaaaaa";

export function SupportScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useAuthLocale();

  const handleTG = () => Linking.openURL("https://t.me/ExpertLine_Support");
  const handleCall = () => Linking.openURL("tel:+998901234567");

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={10}>
          <ArrowLeft color="#aaaaaa" size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("settingsOther")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Qanday yordam bera olamiz?</Text>
        <Text style={styles.introSub}>
          Savollaringiz bormi yoki muammoga duch keldingiz? Bizning jamoamiz sizga yordam berishga tayyor.
        </Text>

        <SupportOption icon={<Send color={ICON_COLOR} size={ICON} />} title={t("supportTg")} onPress={handleTG} />
        <SupportOption icon={<Phone color={ICON_COLOR} size={ICON} />} title={t("supportCall")} onPress={handleCall} />
        <SupportOption
          icon={<MessageCircle color={ICON_COLOR} size={ICON} />}
          title={t("supportHelp")}
          onPress={() => {}}
        />

        <Text style={styles.hoursLabel}>Ish vaqti</Text>
        <Text style={styles.hoursText}>Dushanba - Shanba: 09:00 - 18:00</Text>
        <Text style={styles.hoursSub}>Yakshanba: Dam olish kuni</Text>
      </ScrollView>
    </View>
  );
}

function SupportOption({ icon, title, onPress }: any) {
  return (
    <Pressable style={({ pressed }) => [styles.item, pressed && styles.pressed]} onPress={onPress}>
      {icon}
      <Text style={styles.itemTitle}>{title}</Text>
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
  headerTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: 20, fontWeight: "500" },
  intro: { color: "#fff", fontSize: 16, fontWeight: "500", paddingHorizontal: 20, paddingTop: 16 },
  introSub: { color: "#aaaaaa", fontSize: 14, lineHeight: 20, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  pressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  itemTitle: { color: "#fff", fontSize: 16 },
  hoursLabel: { color: "#aaaaaa", fontSize: 13, fontWeight: "500", paddingHorizontal: 20, paddingTop: 24 },
  hoursText: { color: "#fff", fontSize: 16, paddingHorizontal: 20, paddingTop: 8 },
  hoursSub: { color: "#aaaaaa", fontSize: 14, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
});

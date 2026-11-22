import React from "react";
import { StyleSheet, View, Text, Pressable, ScrollView } from "react-native";
import { ArrowLeft, Check } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthLocale } from "../../auth/locale";

export function LanguageSettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { lang, setLang, t }: any = useAuthLocale();

  const languages = [
    { code: "uz", name: "O'zbekcha", label: "O'zbekcha" },
    { code: "ru", name: "Русский", label: "Русский" },
    { code: "en", name: "English", label: "English" },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={10}>
          <ArrowLeft color="#aaaaaa" size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("langTitle")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{t("langSection")}</Text>
        {languages.map((langItem) => (
          <Pressable
            key={langItem.code}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            onPress={() => setLang(langItem.code)}
          >
            <View style={styles.itemInfo}>
              <Text style={styles.langName}>{langItem.name}</Text>
              <Text style={styles.langLabel}>{langItem.label}</Text>
            </View>
            {lang === langItem.code ? <Check color="#8774e1" size={22} /> : null}
          </Pressable>
        ))}
        <Text style={styles.infoText}>{t("langInfo")}</Text>
      </ScrollView>
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
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  pressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  itemInfo: { flex: 1 },
  langName: { color: "#fff", fontSize: 16 },
  langLabel: { color: "#aaaaaa", fontSize: 13, marginTop: 2 },
  infoText: {
    color: "#aaaaaa",
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
});

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, LayoutGrid, MapPin, X } from "lucide-react-native";
import { palette } from "../../lib/theme";
import { useAuthLocale } from "../auth/locale";
import { createListing, type ListingSubType } from "./api";
import { isRegionCode, regionLabel, type RegionCode } from "../../lib/regions";
import { directionEmoji, directionLabel, isDirectionCode, type DirectionCode } from "../../lib/directions";
import { useAuthStore } from "../auth/store";
import { DirectionSheet, RegionSheet } from "./RegionSheet";

const MIN_LEN = 20;
const MAX_LEN = 3000;

/** E'lon berish: tur + bitta matn maydoni + bitta tugma (placeholder'da to'liq namuna) */
export function ListingComposeScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { t, lang } = useAuthLocale();
  const profileRegion = useAuthStore((s) => (s.user as { region?: string } | null)?.region);
  // Ro'yxatda tanlangan viloyat, bo'lmasa profildagi viloyat oldindan tanlanadi
  const initialRegion = isRegionCode(route?.params?.region)
    ? route.params.region
    : isRegionCode(profileRegion)
      ? profileRegion
      : null;
  const [region, setRegion] = useState<RegionCode | null>(initialRegion);
  const [regionOpen, setRegionOpen] = useState(false);
  // Ro'yxatda tanlangan yo'nalish oldindan qo'yiladi
  const [direction, setDirection] = useState<DirectionCode | null>(
    isDirectionCode(route?.params?.direction) ? route.params.direction : null
  );
  const [directionOpen, setDirectionOpen] = useState(false);
  const [type, setType] = useState<ListingSubType>(route?.params?.type === "seeker" ? "seeker" : "employer");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);

  const publish = async () => {
    const cleanTitle = title.replace(/\s+/g, " ").trim();
    if (cleanTitle.length < 5 || cleanTitle.length > 80) {
      Alert.alert(t("errTitle"), t("listingTitleRequired"));
      return;
    }
    if (!region) {
      Alert.alert(t("errTitle"), t("regionRequired"));
      setRegionOpen(true);
      return;
    }
    if (!direction) {
      Alert.alert(t("errTitle"), t("directionRequired"));
      setDirectionOpen(true);
      return;
    }
    if (text.trim().length < MIN_LEN) {
      Alert.alert(t("errTitle"), t("listingTooShort"));
      return;
    }
    setBusy(true);
    try {
      await createListing({ subType: type, title: cleanTitle, text, region, direction, company });
      Alert.alert(t("successTitle"), t("listingPublished"));
      navigation.goBack();
    } catch (e: any) {
      Alert.alert(t("errTitle"), e?.message || t("errServer"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>{t("listingNew")}</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={8}>
          <X color={palette.textSecondary} size={22} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <View style={styles.typeRow}>
            <ListingTypeSwitchInline value={type} onChange={setType} />
          </View>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={(v) => setTitle(v.replace(/\n/g, " ").slice(0, 80))}
            placeholder={type === "employer" ? t("listingTitlePhEmployer") : t("listingTitlePhSeeker")}
            placeholderTextColor={palette.textMuted}
            autoFocus
            returnKeyType="next"
          />
          {type === "employer" ? (
            <TextInput
              style={styles.companyInput}
              value={company}
              onChangeText={(v) => setCompany(v.slice(0, 80))}
              placeholder={t("listingCompanyPh")}
              placeholderTextColor={palette.textMuted}
              returnKeyType="next"
            />
          ) : null}
          <Pressable
            onPress={() => setRegionOpen(true)}
            style={({ pressed }) => [styles.regionBtn, pressed && { opacity: 0.8 }]}
          >
            <MapPin color={region ? palette.accent : palette.textMuted} size={18} />
            <Text style={[styles.regionText, !region && { color: palette.textMuted }]} numberOfLines={1}>
              {region ? regionLabel(region, lang) : t("regionPick")}
            </Text>
            <ChevronDown color={palette.textMuted} size={18} />
          </Pressable>
          <Pressable
            onPress={() => setDirectionOpen(true)}
            style={({ pressed }) => [styles.regionBtn, pressed && { opacity: 0.8 }]}
          >
            {direction ? (
              <Text style={{ fontSize: 16 }}>{directionEmoji(direction)}</Text>
            ) : (
              <LayoutGrid color={palette.textMuted} size={18} />
            )}
            <Text style={[styles.regionText, !direction && { color: palette.textMuted }]} numberOfLines={1}>
              {direction ? directionLabel(direction, lang) : t("directionPick")}
            </Text>
            <ChevronDown color={palette.textMuted} size={18} />
          </Pressable>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={(v) => setText(v.slice(0, MAX_LEN))}
            placeholder={type === "employer" ? t("listingPhEmployer") : t("listingPhSeeker")}
            placeholderTextColor={palette.textMuted}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.counter}>
            {text.length}/{MAX_LEN}
          </Text>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={() => void publish()}
            disabled={busy}
            style={({ pressed }) => [styles.btn, (pressed || busy) && { backgroundColor: palette.accentPressed }]}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t("listingPublish")}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <RegionSheet
        visible={regionOpen}
        value={region}
        onSelect={(v) => v !== "all" && setRegion(v)}
        onClose={() => setRegionOpen(false)}
      />
      <DirectionSheet
        visible={directionOpen}
        value={direction}
        onSelect={(v) => v !== "all" && setDirection(v)}
        onClose={() => setDirectionOpen(false)}
      />
    </View>
  );
}

/** Formadagi tur tanlovi: "Ish beraman" / "Ish qidiryapman" */
function ListingTypeSwitchInline({ value, onChange }: { value: ListingSubType; onChange: (v: ListingSubType) => void }) {
  const { t } = useAuthLocale();
  return (
    <View style={styles.switch}>
      {(["employer", "seeker"] as ListingSubType[]).map((k) => {
        const on = value === k;
        return (
          <Pressable key={k} onPress={() => onChange(k)} style={[styles.switchItem, on && styles.switchItemOn]}>
            <Text style={[styles.switchText, on && styles.switchTextOn]}>
              {k === "employer" ? t("listingTypeEmployer") : t("listingTypeSeeker")}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10 },
  title: { flex: 1, color: palette.text, fontSize: 20, fontWeight: "600" },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  typeRow: { marginBottom: 10 },
  regionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  regionText: { flex: 1, color: palette.text, fontSize: 15 },
  titleInput: {
    height: 48,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.text,
    fontSize: 16,
    fontWeight: "600",
  },
  companyInput: {
    height: 46,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.text,
    fontSize: 15,
  },
  switch: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  switchItem: { flex: 1, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  switchItemOn: { backgroundColor: palette.accent },
  switchText: { color: palette.textSecondary, fontSize: 14, fontWeight: "600" },
  switchTextOn: { color: "#fff" },
  input: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    color: palette.text,
    fontSize: 15,
    lineHeight: 22,
  },
  counter: { color: palette.textMuted, fontSize: 12, textAlign: "right", paddingVertical: 6 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  btn: { height: 50, borderRadius: 14, backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

export default ListingComposeScreen;

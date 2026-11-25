import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { ArrowLeft, CheckCircle, Clock, Crown, FileText, Upload } from "lucide-react-native";
import { apiFetch } from "../../../lib/api";
import { API_URL } from "../../../lib/config";
import { getToken } from "../../../lib/auth-storage";
import { palette } from "../../../lib/theme";
import { EXPERT_SUBSCRIPTION_MONTHLY_UZS, formatUzs } from "../../../lib/subscription";
import { useAuthLocale } from "../../auth/locale";

const PREDEFINED_PROFESSIONS = [
  "Mentor / Ustoz",
  "Huquqshunos",
  "Psixolog",
  "Konsultant",
  "Dasturchi",
  "Boshqa",
];

const MAX_RESUME_BYTES = 10 * 1024 * 1024;

/**
 * Mutaxassis profili (mobil) — web formasi bilan bir xil maydonlar:
 * yo'nalish, tillar, rezyume (majburiy), tavsif/bio, oylik obuna.
 * Narx, xizmat turi (doim onlayn), diplom va tajriba so'ralmaydi.
 */
export function ExpertProfileScreen() {
  const navigation = useNavigation();
  const { t } = useAuthLocale();
  const insets = useSafeAreaInsets();

  const [verifiedStatus, setVerifiedStatus] = useState("none");
  const [profession, setProfession] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [serviceLanguages, setServiceLanguages] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [specialtyDesc, setSpecialtyDesc] = useState("");
  const [bioExpert, setBioExpert] = useState("");
  const [uploadingResume, setUploadingResume] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await apiFetch("/api/users/me");
      if (!res.ok) return;
      const data = await res.json();
      setProfession(data.profession || "");
      setSpecialization(data.specialization_details || data.specialization || "");
      setServiceLanguages(data.service_languages || "");
      setResumeUrl(data.resume_url || "");
      setSpecialtyDesc(data.specialty_desc || data.expert_proposal || "");
      setBioExpert(data.bio_expert || "");
      setVerifiedStatus(data.verified_status || "none");
    } catch {
      /* ignore */
    }
  };

  /** PDF tanlash → /api/media/upload → URL (admin panel uni yangi oynada ochadi) */
  const pickResume = async () => {
    if (uploadingResume) return;
    const picked = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const file = picked.assets[0];
    if (file.size && file.size > MAX_RESUME_BYTES) {
      Alert.alert(t("errTitle"), t("errResumeTooBig"));
      return;
    }
    setUploadingResume(true);
    try {
      const formData = new FormData();
      formData.append("files", {
        uri: file.uri,
        name: file.name || "resume.pdf",
        type: file.mimeType || "application/pdf",
      } as any);
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/media/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("upload");
      const data = await res.json();
      const url = data?.url || data?.urls?.[0] || data?.files?.[0]?.url;
      if (!url) throw new Error("no url");
      setResumeUrl(url);
    } catch {
      Alert.alert(t("errTitle"), t("errAvatarUpload"));
    } finally {
      setUploadingResume(false);
    }
  };

  const handleSave = async () => {
    if (!profession.trim() || !specialization.trim()) {
      Alert.alert(t("errTitle"), t("errRequiredFields"));
      return;
    }
    if (!resumeUrl) {
      Alert.alert(t("errTitle"), t("errResumeRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        is_expert: true,
        profession: profession.trim(),
        specialization_details: specialization.trim(),
        specialization: specialization.trim(),
        service_languages: serviceLanguages.trim(),
        service_format: "online",
        resume_url: resumeUrl,
        specialty_desc: specialtyDesc.trim(),
        expert_proposal: specialtyDesc.trim(),
        bio_expert: bioExpert.trim(),
      };
      const res = await apiFetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        Alert.alert(t("successTitle"), t("expertSaved"));
        await loadProfile();
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert(t("errTitle"), (err as any).message || t("errSaveFailed"));
      }
    } catch {
      Alert.alert(t("errTitle"), t("errServer"));
    } finally {
      setSaving(false);
    }
  };

  const isCustomProfession = profession !== "" && !PREDEFINED_PROFESSIONS.includes(profession);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={8}>
          <ArrowLeft color={palette.textSecondary} size={22} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t("expertProfileTitle")}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        >
          {verifiedStatus === "pending" || verifiedStatus === "approved" ? (
            <View
              style={[
                styles.statusBox,
                verifiedStatus === "pending" ? styles.statusPending : styles.statusApproved,
              ]}
            >
              {verifiedStatus === "pending" ? (
                <Clock color={palette.warning} size={18} />
              ) : (
                <CheckCircle color={palette.success} size={18} />
              )}
              <Text
                style={[
                  styles.statusText,
                  { color: verifiedStatus === "pending" ? palette.warning : palette.success },
                ]}
              >
                {verifiedStatus === "pending" ? t("expertStatusPending") : t("expertStatusApproved")}
              </Text>
            </View>
          ) : (
            <Text style={styles.intro}>{t("expertFormIntro")}</Text>
          )}

          {/* Yo'nalish */}
          <View style={[styles.card, styles.section]}>
            <Text style={styles.sectionTitle}>{t("expertSectionMain")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {PREDEFINED_PROFESSIONS.map((prof) => {
                const active = profession === prof || (prof === "Boshqa" && isCustomProfession);
                return (
                  <Pressable
                    key={prof}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setProfession(prof === "Boshqa" ? "" : prof)}
                  >
                    <Text style={[styles.chipText, active && styles.chipActiveText]}>{prof}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {profession === "" || isCustomProfession ? (
              <TextInput
                style={[styles.input, { marginBottom: 10 }]}
                placeholder={t("expertOtherProfession")}
                placeholderTextColor={palette.textMuted}
                value={profession}
                onChangeText={setProfession}
              />
            ) : null}
            <TextInput
              style={styles.input}
              placeholder={t("expertSpecialization")}
              placeholderTextColor={palette.textMuted}
              value={specialization}
              onChangeText={setSpecialization}
            />
            <TextInput
              style={[styles.input, { marginTop: 10 }]}
              placeholder={`${t("expertLanguages")} — ${t("expertLanguagesPh")}`}
              placeholderTextColor={palette.textMuted}
              value={serviceLanguages}
              onChangeText={setServiceLanguages}
            />
          </View>

          {/* Rezyume — majburiy */}
          <View style={[styles.card, styles.section]}>
            <Text style={styles.sectionTitle}>{t("expertSectionResume")}</Text>
            <Pressable
              onPress={() => void pickResume()}
              style={({ pressed }) => [
                styles.resumeBox,
                resumeUrl ? styles.resumeBoxDone : null,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={[styles.resumeIcon, resumeUrl ? styles.resumeIconDone : null]}>
                {uploadingResume ? (
                  <ActivityIndicator color={palette.accent} />
                ) : resumeUrl ? (
                  <FileText color={palette.success} size={22} />
                ) : (
                  <Upload color={palette.accent} size={22} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.resumeTitle, resumeUrl ? { color: palette.success } : null]}>
                  {resumeUrl ? t("expertResumeUploaded") : t("expertResumeUpload")}
                </Text>
                <Text style={styles.hint}>{resumeUrl ? t("expertResumeReplace") : "PDF"}</Text>
              </View>
            </Pressable>
            <Text style={[styles.hint, { marginTop: 10 }]}>{t("expertResumeHint")}</Text>
          </View>

          {/* Siz haqingizda */}
          <View style={[styles.card, styles.section]}>
            <Text style={styles.sectionTitle}>{t("expertSectionAbout")}</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder={t("expertListing")}
              placeholderTextColor={palette.textMuted}
              multiline
              value={specialtyDesc}
              onChangeText={setSpecialtyDesc}
            />
            <TextInput
              style={[styles.input, styles.multiline, { marginTop: 10 }]}
              placeholder="Bio"
              placeholderTextColor={palette.textMuted}
              multiline
              value={bioExpert}
              onChangeText={setBioExpert}
            />
          </View>

          {/* Obuna */}
          <View style={[styles.card, styles.section, styles.subRow]}>
            <Crown color={palette.accent} size={22} />
            <View style={{ flex: 1 }}>
              <Text style={styles.subTitle}>{t("expertSubscriptionTitle")}</Text>
              <Text style={styles.hint}>{t("expertSubscriptionDesc")}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.subPrice}>{formatUzs(EXPERT_SUBSCRIPTION_MONTHLY_UZS)}</Text>
              <Text style={styles.hint}>{t("expertSubscriptionPeriod")}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={() => void handleSave()}
          disabled={saving || uploadingResume}
          style={({ pressed }) => [
            styles.saveBtn,
            (pressed || saving) && { backgroundColor: palette.accentPressed },
          ]}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{t("expertSend")}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", color: palette.text, fontSize: 18, fontWeight: "600" },
  intro: { color: palette.textSecondary, fontSize: 14, lineHeight: 20, paddingHorizontal: 4, paddingTop: 4 },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusPending: { backgroundColor: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.25)" },
  statusApproved: { backgroundColor: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.25)" },
  statusText: { fontSize: 14, fontWeight: "600" },
  card: {
    borderRadius: 16,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
  },
  section: { marginTop: 14 },
  sectionTitle: { color: palette.accent, fontSize: 14, fontWeight: "600", marginBottom: 12 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.text,
    fontSize: 15,
  },
  multiline: { minHeight: 84, textAlignVertical: "top" },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  chipActive: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
  chipText: { color: palette.textSecondary, fontSize: 13 },
  chipActiveText: { color: palette.text },
  resumeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.2)",
  },
  resumeBoxDone: { borderColor: "rgba(16,185,129,0.45)", backgroundColor: "rgba(16,185,129,0.06)" },
  resumeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accentSoft,
  },
  resumeIconDone: { backgroundColor: "rgba(16,185,129,0.15)" },
  resumeTitle: { color: palette.text, fontSize: 15, fontWeight: "500" },
  hint: { color: palette.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  subRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  subTitle: { color: palette.text, fontSize: 16 },
  subPrice: { color: palette.text, fontSize: 18, fontWeight: "700" },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    backgroundColor: palette.bg,
  },
  saveBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

export default ExpertProfileScreen;

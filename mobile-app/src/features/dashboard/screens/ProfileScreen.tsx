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
import { Check, Camera, Briefcase, Award, Clock, DollarSign, AlignLeft } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { apiFetch } from "../../../lib/api";
import { API_URL } from "../../../lib/config";
import { getToken } from "../../../lib/auth-storage";
import { useAuthStore } from "../../auth/store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthLocale } from "../../auth/locale";
import { AvatarImage } from "../../../components/AvatarImage";

const PREDEFINED_PROFESSIONS = [
  "Mentor / Ustoz",
  "Huquqshunos",
  "Psixolog",
  "Konsultant",
  "Dasturchi",
  "Boshqa",
];

const LINK = "#6ab3f3";
const MUTED = "#6d7f8f";

export function ProfileScreen() {
  const navigation = useNavigation();
  const { user, patchUser } = useAuthStore();
  const { t, lang } = useAuthLocale();
  const insets = useSafeAreaInsets();

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [birthday, setBirthday] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [isExpertMode, setIsExpertMode] = useState(false);
  const [verifiedStatus, setVerifiedStatus] = useState("none");
  const [profession, setProfession] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [experience, setExperience] = useState("");
  const [pricingModel, setPricingModel] = useState("hourly");
  const [price, setPrice] = useState("");
  const [bioExpert, setBioExpert] = useState("");
  const [savingExpert, setSavingExpert] = useState(false);

  useEffect(() => {
    void loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await apiFetch("/api/users/me");
      if (!res.ok) return;
      const data = await res.json();
      setName(data.name || "");
      setSurname(data.surname || "");
      setUsername(String(data.username || "").replace(/^@+/, ""));
      setBio(data.bio || "");
      setAvatarUrl(data.avatar_url || data.avatar || null);
      if (data.birthday) {
        const date = new Date(data.birthday);
        if (!Number.isNaN(date.getTime())) {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, "0");
          const d = String(date.getDate()).padStart(2, "0");
          setBirthday(`${y}-${m}-${d}`);
        }
      }
      setProfession(data.profession || "");
      setSpecialization(data.specialization || data.specialization_details || "");
      setExperience(data.experience_years ? String(data.experience_years) : "");
      setPricingModel(data.pricing_model || "hourly");
      setPrice(
        data.hourly_rate
          ? String(data.hourly_rate)
          : data.service_price
            ? String(data.service_price)
            : ""
      );
      setBioExpert(data.bio_expert || data.bio || "");
      setVerifiedStatus(data.verified_status || "none");
      setIsExpertMode(
        !!data.is_expert || data.verified_status === "pending" || data.verified_status === "approved"
      );
    } catch {
      /* ignore */
    }
  };

  const handleAvatarChange = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    setUploadingAvatar(true);
    try {
      const filename = uri.split("/").pop() || "avatar.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;
      const formData = new FormData();
      formData.append("files", { uri, name: filename, type } as any);
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/media/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        Alert.alert("Xato", "Rasmni serverga yuklab bo'lmadi.");
        return;
      }
      const data = await res.json();
      const url = data?.url || data?.urls?.[0] || data?.files?.[0]?.url;
      if (!url) return;
      setAvatarUrl(url);
      await apiFetch("/api/users/me", {
        method: "PUT",
        body: JSON.stringify({ avatar_url: url }),
      });
      patchUser({ ...user, avatar_url: url, avatar: url });
    } catch {
      Alert.alert("Xato", "Rasm yuklashda tarmoq xatosi yuz berdi.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Xato", "Ism kiritilishi shart.");
      return;
    }
    const cleanUsername = username.trim().replace(/^@+/, "");
    if (!cleanUsername) {
      Alert.alert("Xato", "Username kiritilishi shart.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        surname: surname.trim(),
        username: cleanUsername,
        bio: bio.trim(),
        birthday: birthday || null,
      };
      const res = await apiFetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Xato", (err as any).message || "Saqlab bo'lmadi, username band bo'lishi mumkin.");
        return;
      }
      patchUser({ ...user, ...payload, avatar: avatarUrl, avatar_url: avatarUrl });
      navigation.goBack();
    } catch {
      Alert.alert("Xato", "Server bilan ulanishda muammo");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExpert = async () => {
    if (!profession || !specialization || !experience || !price) {
      Alert.alert("Xato", "Barcha majburiy maydonlarni to'ldiring.");
      return;
    }
    setSavingExpert(true);
    try {
      const payload = {
        is_expert: true,
        profession,
        specialization_details: specialization,
        specialization,
        experience_years: parseInt(experience, 10),
        pricing_model: pricingModel,
        hourly_rate: parseFloat(price) || 0,
        currency: "MALI",
        bio_expert: bioExpert,
      };
      const res = await apiFetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        Alert.alert("Muvaffaqiyatli", "Mutaxassis profili yangilandi va tasdiqqa yuborildi.");
        await loadProfile();
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Xato", (err as any).message || "Saqlab bo'lmadi");
      }
    } catch {
      Alert.alert("Xato", "Server bilan ulanishda muammo");
    } finally {
      setSavingExpert(false);
    }
  };

  const nameHint =
    lang === "ru"
      ? "Ваше имя будет видно в контактах, как в Telegram."
      : lang === "en"
        ? "Your name will appear in contacts, like in Telegram."
        : "Ismingiz Telegramdagi kabi kontaktlarda ko‘rinadi.";
  const bioHint =
    lang === "ru" ? "Коротко о себе" : lang === "en" ? "A few words about yourself" : "O‘zingiz haqingizda qisqacha";
  const usernameHint =
    lang === "ru"
      ? "Вы можете выбрать публичное имя пользователя."
      : lang === "en"
        ? "You can choose a public username."
        : "Ommaviy username tanlashingiz mumkin.";
  const title =
    lang === "ru" ? "Изменить профиль" : lang === "en" ? "Edit Profile" : "Profilni tahrirlash";
  const cancelLabel = lang === "ru" ? "Отмена" : lang === "en" ? "Cancel" : "Bekor qilish";
  const photoLabel = lang === "ru" ? "Загрузить фото" : lang === "en" ? "Upload photo" : "Rasm yuklash";
  const birthdayLabel = lang === "ru" ? "День рождения" : lang === "en" ? "Birthday" : "Tug‘ilgan kun";

  const birthdayDate = birthday ? new Date(`${birthday}T12:00:00`) : new Date(2000, 0, 1);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerSide} hitSlop={8}>
          <Text style={styles.headerLink}>{cancelLabel}</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <Pressable
          onPress={() => void handleSave()}
          disabled={saving}
          style={styles.headerSideRight}
          hitSlop={8}
        >
          {saving ? (
            <ActivityIndicator color={LINK} />
          ) : (
            <Check color={LINK} size={24} strokeWidth={2.5} />
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarBlock}>
            <Pressable onPress={handleAvatarChange} style={styles.avatarWrap}>
              <View style={styles.avatarCircle}>
                <AvatarImage uri={avatarUrl} name={name || "?"} size={100} />
                {uploadingAvatar ? (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : null}
              </View>
              {!uploadingAvatar ? (
                <View style={styles.cameraBadge}>
                  <Camera size={14} color="#fff" />
                </View>
              ) : null}
            </Pressable>
            <Pressable onPress={handleAvatarChange}>
              <Text style={styles.photoLink}>{photoLabel}</Text>
            </Pressable>
          </View>

          <View style={styles.gap} />

          <View style={styles.pad}>
            <View style={styles.card}>
              <TextInput
                style={styles.field}
                placeholder={t("regPlaceholderName")}
                placeholderTextColor={MUTED}
                value={name}
                onChangeText={setName}
                autoComplete="given-name"
              />
              <View style={styles.fieldDivider} />
              <TextInput
                style={styles.field}
                placeholder={t("regPlaceholderSurname")}
                placeholderTextColor={MUTED}
                value={surname}
                onChangeText={setSurname}
                autoComplete="family-name"
              />
            </View>
            <Text style={styles.hint}>{nameHint}</Text>
          </View>

          <View style={styles.gap} />

          <View style={styles.pad}>
            <View style={styles.card}>
              <TextInput
                style={[styles.field, styles.bio]}
                placeholder={lang === "en" ? "Bio" : lang === "ru" ? "О себе" : "Bio"}
                placeholderTextColor={MUTED}
                value={bio}
                onChangeText={(v) => setBio(v.slice(0, 70))}
                multiline
                maxLength={70}
              />
            </View>
            <View style={styles.hintRow}>
              <Text style={styles.hint}>{bioHint}</Text>
              <Text style={styles.hint}>{bio.length}/70</Text>
            </View>
          </View>

          <View style={styles.gap} />

          <View style={styles.pad}>
            <View style={[styles.card, styles.usernameRow]}>
              <Text style={styles.at}>@</Text>
              <TextInput
                style={[styles.field, { flex: 1, paddingLeft: 4 }]}
                placeholder="username"
                placeholderTextColor={MUTED}
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={(v) => setUsername(v.replace(/[^a-zA-Z0-9_]/g, ""))}
              />
            </View>
            <Text style={styles.hint}>{usernameHint}</Text>
          </View>

          <View style={styles.gap} />

          <View style={styles.pad}>
            <View style={styles.card}>
              <Text style={styles.dateLabel}>{birthdayLabel}</Text>
              <Pressable onPress={() => setShowDatePicker(true)} style={styles.field}>
                <Text style={birthday ? styles.dateValue : styles.datePlaceholder}>
                  {birthday || "YYYY-MM-DD"}
                </Text>
              </Pressable>
            </View>
          </View>

          {showDatePicker ? (
            <DateTimePicker
              value={Number.isNaN(birthdayDate.getTime()) ? new Date(2000, 0, 1) : birthdayDate}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={(_, date) => {
                setShowDatePicker(Platform.OS === "ios");
                if (date) {
                  const y = date.getFullYear();
                  const m = String(date.getMonth() + 1).padStart(2, "0");
                  const d = String(date.getDate()).padStart(2, "0");
                  setBirthday(`${y}-${m}-${d}`);
                }
                if (Platform.OS === "android") setShowDatePicker(false);
              }}
            />
          ) : null}

          <View style={styles.gap} />

          <View style={styles.expertHeader}>
            <Text style={styles.expertTitle}>Mutaxassis</Text>
            <Pressable onPress={() => setIsExpertMode(!isExpertMode)}>
              <Text style={styles.headerLink}>{isExpertMode ? t("pickerClose") : "Ochish"}</Text>
            </Pressable>
          </View>
          {verifiedStatus === "approved" ? (
            <Text style={[styles.hint, { paddingHorizontal: 20 }]}>Tasdiqlangan</Text>
          ) : verifiedStatus === "pending" ? (
            <Text style={[styles.hint, { paddingHorizontal: 20 }]}>Ko‘rib chiqilmoqda</Text>
          ) : null}

          {isExpertMode ? (
            <View style={styles.pad}>
              <Text style={styles.hint}>
                Mutaxassis profilini to‘liq to‘ldiring. Sizning xizmatlaringiz mijozlarga ko‘rinadi.
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                {PREDEFINED_PROFESSIONS.map((prof) => (
                  <Pressable
                    key={prof}
                    style={[styles.chip, profession === prof && styles.chipActive]}
                    onPress={() => setProfession(prof)}
                  >
                    <Text style={[styles.chipText, profession === prof && styles.chipActiveText]}>{prof}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {profession === "Boshqa" ? (
                <View style={styles.card}>
                  <View style={styles.iconField}>
                    <Briefcase size={18} color={MUTED} />
                    <TextInput
                      style={[styles.field, { flex: 1 }]}
                      placeholder="Kasbingizni kiriting"
                      placeholderTextColor={MUTED}
                      onChangeText={setProfession}
                    />
                  </View>
                </View>
              ) : null}

              <View style={[styles.card, { marginTop: 12 }]}>
                <View style={styles.iconField}>
                  <Award size={18} color={MUTED} />
                  <TextInput
                    style={[styles.field, { flex: 1 }]}
                    placeholder="Mutaxassislik"
                    placeholderTextColor={MUTED}
                    value={specialization}
                    onChangeText={setSpecialization}
                  />
                </View>
                <View style={styles.fieldDivider} />
                <View style={[styles.iconField, { alignItems: "flex-start" }]}>
                  <AlignLeft size={18} color={MUTED} style={{ marginTop: 16 }} />
                  <TextInput
                    style={[styles.field, styles.bio, { flex: 1 }]}
                    placeholder="Mutaxassis tavsifi"
                    placeholderTextColor={MUTED}
                    multiline
                    value={bioExpert}
                    onChangeText={setBioExpert}
                  />
                </View>
                <View style={styles.fieldDivider} />
                <View style={styles.iconField}>
                  <Clock size={18} color={MUTED} />
                  <TextInput
                    style={[styles.field, { flex: 1 }]}
                    placeholder="Tajriba (yil)"
                    placeholderTextColor={MUTED}
                    keyboardType="numeric"
                    value={experience}
                    onChangeText={setExperience}
                  />
                </View>
                <View style={styles.fieldDivider} />
                <View style={styles.iconField}>
                  <DollarSign size={18} color={MUTED} />
                  <TextInput
                    style={[styles.field, { flex: 1 }]}
                    placeholder="Narx (MALI)"
                    placeholderTextColor={MUTED}
                    keyboardType="numeric"
                    value={price}
                    onChangeText={setPrice}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <Pressable
                  style={[styles.radio, pricingModel === "hourly" && styles.radioActive]}
                  onPress={() => setPricingModel("hourly")}
                >
                  <Text style={[styles.radioText, pricingModel === "hourly" && styles.radioActiveText]}>
                    Soatlik
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.radio, pricingModel === "session" && styles.radioActive]}
                  onPress={() => setPricingModel("session")}
                >
                  <Text style={[styles.radioText, pricingModel === "session" && styles.radioActiveText]}>
                    Seans
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={styles.expertSave}
                onPress={() => void handleSaveExpert()}
                disabled={savingExpert}
              >
                {savingExpert ? (
                  <ActivityIndicator color={LINK} />
                ) : (
                  <Text style={styles.expertSaveText}>Mutaxassis profilini saqlash</Text>
                )}
              </Pressable>
            </View>
          ) : null}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f0f" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: "#212121",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerSide: { minWidth: 72 },
  headerSideRight: { minWidth: 72, alignItems: "flex-end" },
  headerLink: { color: LINK, fontSize: 16, fontWeight: "500" },
  headerTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: 17, fontWeight: "600" },
  avatarBlock: {
    backgroundColor: "#212121",
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 20,
  },
  avatarWrap: { position: "relative" },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
    backgroundColor: "#8774e1",
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: LINK,
    alignItems: "center",
    justifyContent: "center",
  },
  photoLink: { marginTop: 12, color: LINK, fontSize: 15, fontWeight: "500" },
  gap: { height: 12, backgroundColor: "#0f0f0f" },
  pad: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#0f0f0f" },
  card: {
    borderRadius: 12,
    backgroundColor: "#181818",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  field: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 16,
  },
  bio: { minHeight: 88, textAlignVertical: "top" },
  fieldDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.06)", marginLeft: 16 },
  hint: { color: MUTED, fontSize: 13, lineHeight: 18, marginTop: 8, paddingHorizontal: 4 },
  hintRow: { flexDirection: "row", justifyContent: "space-between" },
  usernameRow: { flexDirection: "row", alignItems: "center" },
  at: { paddingLeft: 16, color: LINK, fontSize: 16 },
  dateLabel: { color: MUTED, fontSize: 13, paddingHorizontal: 16, paddingTop: 12 },
  dateValue: { color: "#fff", fontSize: 16 },
  datePlaceholder: { color: MUTED, fontSize: 16 },
  expertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  expertTitle: { color: "#fff", fontSize: 16, fontWeight: "500" },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#181818",
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  chipActive: { borderColor: LINK },
  chipText: { color: MUTED, fontSize: 13 },
  chipActiveText: { color: LINK },
  iconField: { flexDirection: "row", alignItems: "center", paddingLeft: 16, gap: 8 },
  row: { flexDirection: "row", gap: 10, marginTop: 12 },
  radio: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#181818",
  },
  radioActive: { borderWidth: 1, borderColor: LINK },
  radioText: { color: MUTED, fontSize: 14 },
  radioActiveText: { color: LINK },
  expertSave: { marginTop: 16, paddingVertical: 14, alignItems: "center" },
  expertSaveText: { color: LINK, fontSize: 16, fontWeight: "500" },
});

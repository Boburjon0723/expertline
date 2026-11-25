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
import { Check, Camera } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { apiFetch } from "../../../lib/api";
import { API_URL } from "../../../lib/config";
import { getToken } from "../../../lib/auth-storage";
import { useAuthStore } from "../../auth/store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthLocale } from "../../auth/locale";
import { AvatarImage } from "../../../components/AvatarImage";
import { palette } from "../../../lib/theme";

const LINK = palette.accent;
const MUTED = palette.textSecondary;

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
        Alert.alert(t("errTitle"), t("errAvatarUpload"));
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
      Alert.alert(t("errTitle"), t("errAvatarNetwork"));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t("errTitle"), t("errNameRequired"));
      return;
    }
    // Username ixtiyoriy: bo'sh qoldirilsa backend uni olib tashlaydi (NULL)
    const cleanUsername = username.trim().replace(/^@+/, "");
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
        Alert.alert(t("errTitle"), (err as any).message || t("errSaveProfile"));
        return;
      }
      patchUser({ ...user, ...payload, avatar: avatarUrl, avatar_url: avatarUrl });
      navigation.goBack();
    } catch {
      Alert.alert(t("errTitle"), t("errServer"));
    } finally {
      setSaving(false);
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
      ? "Необязательно. Можно выбрать публичное имя пользователя."
      : lang === "en"
        ? "Optional. You can choose a public username."
        : "Ixtiyoriy. Ommaviy username tanlashingiz mumkin.";
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

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingBottom: 10,
    backgroundColor: palette.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerSide: { minWidth: 72 },
  headerSideRight: { minWidth: 72, alignItems: "flex-end" },
  headerLink: { color: LINK, fontSize: 16, fontWeight: "500" },
  headerTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: 17, fontWeight: "600" },
  avatarBlock: {
    backgroundColor: palette.bg,
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
    backgroundColor: palette.accent,
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
  gap: { height: 12, backgroundColor: palette.bg },
  pad: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: palette.bg },
  card: {
    borderRadius: 12,
    backgroundColor: palette.surfaceSolid,
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
});

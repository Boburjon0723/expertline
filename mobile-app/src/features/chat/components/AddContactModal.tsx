import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiFetch } from "../../../lib/api";
import { addContactRequest } from "../service";
import { palette } from "../../../lib/theme";

/** Web `AddContactModal` bilan bir xil oqim: ism + familiya + telefon → aniq raqam bo'yicha qidiruv → kontakt. */
export type AddedContact = {
  id: string;
  name: string;
  surname: string;
  avatar_url?: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdded: (contact: AddedContact) => void | Promise<void>;
};

const PREFIX = "+998";
const PHONE_LEN = 13; // +998 va 9 ta raqam

function normalizePhone(raw: string): string {
  let val = raw.replace(/[^\d+]/g, "");
  if (!val.startsWith(PREFIX)) {
    val = PREFIX + val.replace(/\+998/g, "").replace(/^\+/, "");
  }
  return val.substring(0, PHONE_LEN);
}

export function AddContactModal({ visible, onClose, onAdded }: Props) {
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [phone, setPhone] = useState(PREFIX);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setName("");
      setSurname("");
      setPhone(PREFIX);
      setError("");
      setLoading(false);
    }
  }, [visible]);

  const submit = async () => {
    if (!name.trim() || phone.length < PHONE_LEN) {
      setError("Ism va to'liq telefon raqamini kiriting");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/users/search?phone=${encodeURIComponent(phone)}`);
      if (!res.ok) throw new Error("search");
      const users = await res.json();
      if (!Array.isArray(users) || users.length === 0) {
        setError("Ushbu raqamli foydalanuvchi topilmadi");
        return;
      }
      const found = users[0];
      await addContactRequest(found.id, name.trim(), surname.trim());
      await onAdded({
        id: String(found.id),
        name: name.trim(),
        surname: surname.trim(),
        avatar_url: found.avatar_url ?? null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message !== "search" ? e.message : "Kontaktni saqlashda xato");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>Yangi kontakt</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>Ism</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ism"
            placeholderTextColor="#6d6d6d"
            autoFocus
            returnKeyType="next"
          />
          <Text style={styles.label}>Familiya</Text>
          <TextInput
            style={styles.input}
            value={surname}
            onChangeText={setSurname}
            placeholder="Familiya (ixtiyoriy)"
            placeholderTextColor="#6d6d6d"
            returnKeyType="next"
          />
          <Text style={styles.label}>Telefon raqami</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={(v) => setPhone(normalizePhone(v))}
            placeholder="+998 -- --- -- --"
            placeholderTextColor="#6d6d6d"
            keyboardType="phone-pad"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
          />

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.btn} disabled={loading}>
              <Text style={styles.btnText}>Bekor qilish</Text>
            </Pressable>
            <Pressable onPress={() => void submit()} style={styles.btn} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={palette.accent} />
              ) : (
                <Text style={[styles.btnText, styles.btnPrimary]}>Qo'shish</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: palette.bg,
    borderRadius: 16,
    padding: 20,
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "600", marginBottom: 12 },
  error: { color: "#ff6b6b", fontSize: 14, marginBottom: 8 },
  label: { color: palette.accent, fontSize: 13, marginTop: 12 },
  input: {
    color: "#fff",
    fontSize: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 24 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, minWidth: 80, alignItems: "center" },
  btnText: { color: palette.textSecondary, fontSize: 15, fontWeight: "600" },
  btnPrimary: { color: palette.accent },
});

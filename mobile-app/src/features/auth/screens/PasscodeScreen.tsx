import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text, Pressable, Alert, Vibration, BackHandler } from "react-native";
import { Lock, Delete, ScanFace } from "lucide-react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../store";
import { palette } from "../../../lib/theme";

interface PasscodeScreenProps {
  navigation: any;
  route: any;
}

export function PasscodeScreen({ navigation, route }: PasscodeScreenProps) {
  const insets = useSafeAreaInsets();
  const mode = route.params?.mode || 'unlock'; // 'set' or 'unlock'
  const [passcode, setPasscode] = useState("");
  const [confirmMode, setConfirmMode] = useState(false);
  const [newPasscode, setNewPasscode] = useState("");
  
  const PASSCODE_KEY = 'app_passcode_key';

  // Qulf rejimida Android "orqaga" tugmasi kodni chetlab o'tmasin.
  useEffect(() => {
    if (mode !== 'unlock') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [mode]);

  useEffect(() => {
    if (passcode.length === 4) {
      handleComplete();
    }
  }, [passcode]);

  /** Qulfdan muvaffaqiyatli chiqish (kod yoki Face ID). */
  const unlockSuccess = () => {
    if (route.params?.onSuccess) {
      route.params.onSuccess();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace("Messages");
    }
  };

  // Face ID / Touch ID: qurilmada sozlangan bo'lsa qulf ekrani ochilishi bilan so'raladi.
  const [bioAvailable, setBioAvailable] = useState(false);
  const tryBiometric = async () => {
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: "ExpertLine'ni ochish",
        cancelLabel: "Kod bilan",
        disableDeviceFallback: true,
      });
      if (res.success) unlockSuccess();
    } catch {
      /* kod bilan davom etadi */
    }
  };
  useEffect(() => {
    if (mode !== 'unlock') return;
    void (async () => {
      const [hw, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (hw && enrolled) {
        setBioAvailable(true);
        void tryBiometric();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleComplete = async () => {
    if (mode === 'set') {
      if (!confirmMode) {
        setNewPasscode(passcode);
        setPasscode("");
        setConfirmMode(true);
      } else {
        if (passcode === newPasscode) {
          await SecureStore.setItemAsync(PASSCODE_KEY, passcode);
          Alert.alert("Muvaffaqiyatli", "Ekran paroli o'rnatildi.");
          navigation.goBack();
        } else {
          Vibration.vibrate(500);
          Alert.alert("Xatolik", "Parollar mos kelmadi.");
          setPasscode("");
        }
      }
    } else {
      const savedPasscode = await SecureStore.getItemAsync(PASSCODE_KEY);
      if (passcode === savedPasscode) {
        // Qaytilganda — turgan joyiga; ilova ochilishida — asosiy sahifa.
        unlockSuccess();
      } else {
        Vibration.vibrate(500);
        setPasscode("");
      }
    }
  };

  /** Kodni unutganda yagona chiqish yo'li: hisobdan chiqish va kodni o'chirish, keyin parol bilan qayta kirish. */
  const onForgot = () => {
    Alert.alert(
      "Kodni unutdingizmi?",
      "Hisobingizdan chiqasiz va ekran kodi o'chiriladi. Telefon raqam va parol bilan qayta kirishingiz kerak bo'ladi.",
      [
        { text: "Bekor qilish", style: "cancel" },
        {
          text: "Chiqish",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await SecureStore.deleteItemAsync(PASSCODE_KEY);
              await useAuthStore.getState().logout();
              navigation.reset({ index: 0, routes: [{ name: "Login" }] });
            })();
          },
        },
      ]
    );
  };

  const onPressNumber = (num: string) => {
    if (passcode.length < 4) {
      setPasscode(passcode + num);
    }
  };

  const onDelete = () => {
    setPasscode(passcode.slice(0, -1));
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { marginTop: insets.top + 50 }]}>
        <View style={styles.lockIconBox}>
          <Lock color="#fff" size={32} />
        </View>
        <Text style={styles.title}>
          {mode === 'set' 
            ? (confirmMode ? "Parolni tasdiqlang" : "Yangi parol o'rnating") 
            : "Ekran parolini kiriting"}
        </Text>
        <Text style={styles.subTitle}>
          {mode === 'set'
            ? "Ilovani himoya qilish uchun 4 ta raqamdan foydalaning"
            : "Davom etish uchun kodni kiriting"}
        </Text>
      </View>

      <View style={styles.dotsContainer}>
        {[1, 2, 3, 4].map((i) => (
          <View 
            key={i} 
            style={[
              styles.dot, 
              passcode.length >= i ? styles.dotActive : null
            ]} 
          />
        ))}
      </View>

      <View style={styles.numpad}>
        {[
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
          ["", "0", "delete"],
        ].map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((btn, btnIndex) => (
              <Pressable
                key={btnIndex}
                style={[
                  styles.numBtn,
                  btn === "" ? { opacity: 0 } : null,
                  btn === "delete" ? styles.deleteBtn : null
                ]}
                onPress={() => btn === "delete" ? onDelete() : onPressNumber(btn)}
                disabled={btn === ""}
              >
                {btn === "delete" ? (
                  <Delete color="#fff" size={24} />
                ) : (
                  <Text style={styles.numText}>{btn}</Text>
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      {mode === 'unlock' && bioAvailable && (
        <Pressable style={styles.cancelBtn} onPress={() => void tryBiometric()} hitSlop={10}>
           <ScanFace color="rgba(255,255,255,0.7)" size={34} />
        </Pressable>
      )}

      {mode === 'unlock' && (
        <Pressable style={styles.cancelBtn} onPress={onForgot}>
           <Text style={styles.cancelText}>Kodni unutdingizmi?</Text>
        </Pressable>
      )}

      {mode === 'set' && !confirmMode && (
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
           <Text style={styles.cancelText}>Bekor qilish</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg, alignItems: "center" },
  header: { alignItems: "center", marginBottom: 40 },
  lockIconBox: { width: 70, height: 70, borderRadius: 35, backgroundColor: "rgba(59, 130, 246, 0.2)", justifyContent: "center", alignItems: "center", marginBottom: 20 },
  title: { color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 10 },
  subTitle: { color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", paddingHorizontal: 40 },
  dotsContainer: { flexDirection: "row", marginBottom: 60 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", marginHorizontal: 15 },
  dotActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  numpad: { width: "100%", paddingHorizontal: 40 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  numBtn: { width: 75, height: 75, borderRadius: 38, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center" },
  numText: { color: "#fff", fontSize: 28, fontWeight: "500" },
  deleteBtn: { backgroundColor: "transparent" },
  cancelBtn: { marginTop: 20 },
  cancelText: { color: "rgba(255,255,255,0.4)", fontSize: 16 },
});

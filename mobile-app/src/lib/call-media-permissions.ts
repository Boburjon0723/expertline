import { Audio } from "expo-av";
import { Camera } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking, Platform } from "react-native";

export type CallMediaKind = "audio" | "video";

/**
 * Call / LiveKit oldidan kamera + mikrofon ruxsatlari va audio rejim.
 * Ruxsat rad etilsa false — ulanishni to‘xtatish uchun.
 */
export async function ensureCallMediaPermissions(
  kind: CallMediaKind = "video"
): Promise<boolean> {
  try {
    const mic = await Audio.requestPermissionsAsync();
    if (!mic.granted) {
      Alert.alert(
        "Mikrofon",
        "Qo‘ng‘iroq uchun mikrofon ruxsati kerak. Sozlamalardan yoqing.",
        [
          { text: "Bekor", style: "cancel" },
          { text: "Sozlamalar", onPress: () => void Linking.openSettings() },
        ]
      );
      return false;
    }

    if (kind === "video") {
      let camGranted = false;
      try {
        if (typeof (Camera as any)?.requestCameraPermissionsAsync === "function") {
          const cam = await (Camera as any).requestCameraPermissionsAsync();
          camGranted = !!cam?.granted;
        } else {
          const cam = await ImagePicker.requestCameraPermissionsAsync();
          camGranted = !!cam?.granted;
        }
      } catch {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        camGranted = !!cam?.granted;
      }
      if (!camGranted) {
        Alert.alert(
          "Kamera",
          "Video uchun kamera ruxsati kerak. Sozlamalardan yoqing.",
          [
            { text: "Bekor", style: "cancel" },
            { text: "Sozlamalar", onPress: () => void Linking.openSettings() },
          ]
        );
        return false;
      }
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: kind === "audio",
      ...(Platform.OS === "ios"
        ? { interruptionModeIOS: 1 }
        : { interruptionModeAndroid: 1 }),
    } as any);

    return true;
  } catch (e) {
    console.warn("[ensureCallMediaPermissions]", e);
    return false;
  }
}

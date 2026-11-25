import React, { useCallback } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import * as ImagePicker from "expo-image-picker";
import { ArrowLeft, Check, Plus } from "lucide-react-native";
import { useAppearanceStore } from "../../../lib/appearance-store";
import { CHAT_BACKGROUND_PRESETS } from "../../../lib/wallpapers";
import { useAuthLocale } from "../../auth/locale";
import { palette } from "../../../lib/theme";

type Props = {
  navigation: { goBack: () => void };
};

export function ThemeDesignScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const gap = 10;
  const pad = 16;
  const col = 3;
  const cellW = (width - pad * 2 - gap * (col - 1)) / col;

  const panelBlur = useAppearanceStore((s) => s.panelBlur);
  const imageBlur = useAppearanceStore((s) => s.imageBlur);
  const backgroundUri = useAppearanceStore((s) => s.backgroundUri);
  const isDarkTheme = useAppearanceStore((s) => s.isDarkTheme);
  const setPanelBlur = useAppearanceStore((s) => s.setPanelBlur);
  const setImageBlur = useAppearanceStore((s) => s.setImageBlur);
  const setBackgroundUri = useAppearanceStore((s) => s.setBackgroundUri);
  const setDarkTheme = useAppearanceStore((s) => s.setDarkTheme);
  const { t } = useAuthLocale();

  const pickCustomWallpaper = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Ruxsat", "Galereyadan rasm tanlash uchun ruxsat kerak.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      setBackgroundUri(res.assets[0].uri);
    }
  }, [setBackgroundUri]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={12}>
          <ArrowLeft color={palette.textSecondary} size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("themeTitle")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>{t('themeBlurSection')}</Text>
        <View style={styles.card}>
          <View style={styles.sliderBlock}>
            <View style={styles.sliderHeader}>
              <Text style={styles.sliderCap}>{t('themePanelBlur')}</Text>
              <Text style={styles.sliderVal}>{panelBlur}px</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={panelBlur}
              onValueChange={setPanelBlur}
              minimumTrackTintColor={palette.accent}
              maximumTrackTintColor="rgba(255,255,255,0.12)"
              thumbTintColor={palette.accent}
            />
          </View>

          <View style={styles.sliderBlock}>
            <View style={styles.sliderHeader}>
              <Text style={styles.sliderCap}>{t('themeWallBlur')}</Text>
              <Text style={styles.sliderVal}>{imageBlur}px</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={imageBlur}
              onValueChange={setImageBlur}
              minimumTrackTintColor={palette.accent}
              maximumTrackTintColor="rgba(255,255,255,0.12)"
              thumbTintColor={palette.accent}
            />
          </View>

          <View style={styles.themeRow}>
            <Text style={styles.themeLabel}>{t('themeDark')}</Text>
            <Switch
              value={isDarkTheme}
              onValueChange={setDarkTheme}
              trackColor={{ false: "rgba(255,255,255,0.12)", true: palette.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 22 }]}>{t('themeWallSection')}</Text>
        <View style={styles.grid}>
          <Pressable
            onPress={pickCustomWallpaper}
            style={[styles.uploadCell, { width: cellW }]}
          >
            <View style={styles.uploadCircle}>
              <Plus color="rgba(255,255,255,0.85)" size={22} />
            </View>
            <Text style={styles.uploadText}>{t('themeUpload')}</Text>
          </Pressable>

          {CHAT_BACKGROUND_PRESETS.map((uri, index) => {
            const selected = backgroundUri === uri;
            return (
              <Pressable
                key={`wp-${index}`}
                onPress={() => setBackgroundUri(uri)}
                style={[
                  styles.thumbWrap,
                  { width: cellW },
                  selected && styles.thumbWrapSelected,
                ]}
              >
                <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                {selected ? (
                  <View style={styles.checkOverlay}>
                    <View style={styles.checkCircle}>
                      <Check color="#fff" size={20} strokeWidth={3} />
                    </View>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
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
  headerBtn: { padding: 8 },
  headerTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: 20, fontWeight: "500" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionLabel: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 8,
    marginTop: 8,
  },
  card: {
    paddingVertical: 8,
    gap: 4,
  },
  sliderBlock: { marginBottom: 8 },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sliderCap: { color: "#fff", fontSize: 16 },
  sliderVal: { color: palette.textSecondary, fontSize: 13 },
  slider: { width: "100%", height: 44 },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  themeLabel: { color: "#fff", fontSize: 16 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  uploadCell: {
    aspectRatio: 16 / 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  uploadText: { color: palette.textSecondary, fontSize: 12 },
  thumbWrap: {
    aspectRatio: 16 / 10,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbWrapSelected: {
    borderColor: palette.accent,
  },
  thumb: { width: "100%", height: "100%" },
  checkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(135, 116, 225, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});

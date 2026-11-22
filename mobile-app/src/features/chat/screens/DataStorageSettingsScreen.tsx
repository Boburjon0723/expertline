import React, { useCallback, useState } from "react";
import { StyleSheet, View, Text, Pressable, ScrollView, Switch, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft, Trash2, HardDrive, Database, Shield, Image as ImageIcon, Video, File } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthLocale } from "../../auth/locale";
import {
  clearMediaCache,
  formatCacheBytes,
  getMediaCacheBytes,
} from "../../../lib/media-cache";
import {
  getMediaPrefs,
  setAutoDownloadEnabled,
  setKindAutoDownload,
  setSaveToGalleryEnabled,
} from "../../../lib/media-prefs";

const ICON = 22;
const ICON_COLOR = "#aaaaaa";

export function DataStorageSettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useAuthLocale();
  const [photo, setPhoto] = useState(true);
  const [video, setVideo] = useState(true);
  const [file, setFile] = useState(true);
  const [saveToGallery, setSaveToGallery] = useState(false);
  const [usageLabel, setUsageLabel] = useState("…");

  const master = photo && video && file;

  const refresh = async () => {
    const p = await getMediaPrefs();
    const n = await getMediaCacheBytes();
    setPhoto(p.photo);
    setVideo(p.video);
    setFile(p.file);
    setSaveToGallery(p.gallery);
    setUsageLabel(formatCacheBytes(n));
  };

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [])
  );

  const onMaster = (on: boolean) => {
    setPhoto(on);
    setVideo(on);
    setFile(on);
    void setAutoDownloadEnabled(on);
  };

  const clearCache = () => {
    Alert.alert(
      t("dataClear"),
      "Keshdagi rasm, video va hujjatlar o'chiriladi. Avtomatik yuklash yoqiq bo'lsa, keyin qayta yuklanadi.",
      [
        { text: t("msgCancel"), style: "cancel" },
        {
          text: t("dataClear"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              await clearMediaCache();
              await refresh();
              Alert.alert(t("dataClear"), "Kesh tozalandi.");
            })();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={10}>
          <ArrowLeft color="#aaaaaa" size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("dataTitle")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{t("dataNetwork")}</Text>
        <View style={styles.item}>
          <Database color={ICON_COLOR} size={ICON} />
          <View style={styles.itemText}>
            <Text style={styles.itemLabel}>{t("dataAutoDown")}</Text>
            <Text style={styles.itemSub}>{t("dataAutoDownSub")}</Text>
          </View>
          <Switch
            value={master}
            onValueChange={onMaster}
            trackColor={{ false: "rgba(255,255,255,0.12)", true: "#8774e1" }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.item}>
          <ImageIcon color={ICON_COLOR} size={ICON} />
          <Text style={styles.itemLabelFlex}>{t("dataAutoPhoto")}</Text>
          <Switch
            value={photo}
            onValueChange={(on) => {
              setPhoto(on);
              void setKindAutoDownload("photo", on);
            }}
            trackColor={{ false: "rgba(255,255,255,0.12)", true: "#8774e1" }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.item}>
          <Video color={ICON_COLOR} size={ICON} />
          <Text style={styles.itemLabelFlex}>{t("dataAutoVideo")}</Text>
          <Switch
            value={video}
            onValueChange={(on) => {
              setVideo(on);
              void setKindAutoDownload("video", on);
            }}
            trackColor={{ false: "rgba(255,255,255,0.12)", true: "#8774e1" }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.item}>
          <File color={ICON_COLOR} size={ICON} />
          <Text style={styles.itemLabelFlex}>{t("dataAutoFile")}</Text>
          <Switch
            value={file}
            onValueChange={(on) => {
              setFile(on);
              void setKindAutoDownload("file", on);
            }}
            trackColor={{ false: "rgba(255,255,255,0.12)", true: "#8774e1" }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.item}>
          <Shield color={ICON_COLOR} size={ICON} />
          <View style={styles.itemText}>
            <Text style={styles.itemLabel}>{t("dataGallery")}</Text>
            <Text style={styles.itemSub}>{t("dataGallerySub")}</Text>
          </View>
          <Switch
            value={saveToGallery}
            onValueChange={(on) => {
              setSaveToGallery(on);
              void setSaveToGalleryEnabled(on);
            }}
            trackColor={{ false: "rgba(255,255,255,0.12)", true: "#8774e1" }}
            thumbColor="#fff"
          />
        </View>

        <Text style={styles.sectionTitle}>{t("dataStorage")}</Text>
        <View style={styles.item}>
          <HardDrive color={ICON_COLOR} size={ICON} />
          <View style={styles.itemText}>
            <Text style={styles.itemLabel}>{t("dataUsage")}</Text>
            <Text style={styles.itemSub}>{usageLabel}</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.dangerBtn, pressed && styles.dangerPressed]}
          onPress={clearCache}
        >
          <Trash2 color="#e53935" size={ICON} />
          <Text style={styles.dangerBtnText}>{t("dataClear")}</Text>
        </Pressable>
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
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  itemText: { flex: 1 },
  itemLabel: { color: "#fff", fontSize: 16 },
  itemLabelFlex: { flex: 1, color: "#fff", fontSize: 16 },
  itemSub: { color: "#aaaaaa", fontSize: 13, marginTop: 2 },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 8,
  },
  dangerPressed: { backgroundColor: "rgba(229,57,53,0.1)" },
  dangerBtnText: { color: "#e53935", fontSize: 16 },
});

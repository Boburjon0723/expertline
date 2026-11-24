import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Keyboard,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import * as MediaLibrary from "expo-media-library";
import * as ImageManipulator from "expo-image-manipulator";
import { Camera, File, Image as ImageIcon, Send, X, type LucideIcon } from "lucide-react-native";
import type { PendingSendFile } from "./TelegramSendPreviewSheet";

export type AttachAction = "gallery" | "file" | "camera";

const isExpoGo = Constants.appOwnership === "expo";
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const COLS = 3;
const GAP = 2;
const TILE = (SCREEN_W - GAP * (COLS - 1)) / COLS;
const PAGE = 60;
/** Yuborishdan oldin rasm shu o'lchamdan katta bo'lsa kichraytiriladi (Telegram ~2560). */
const MAX_IMAGE_EDGE = 2560;

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Kamera / tizim galereyasi / fayl tanlagich */
  onPick: (id: AttachAction) => void;
  /** Ichki galereyadan tanlanganlar (tanlash tartibida) + izoh */
  onSendMedia: (files: PendingSendFile[], caption: string) => void;
};

type Snap = "half" | "full";

function fmtDur(sec?: number) {
  if (!sec) return "";
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Galereya asset'ini yuboriladigan faylga aylantiradi: lokal yo'l, HEIC → JPEG, katta rasm → 2560 px. */
async function assetToFile(asset: MediaLibrary.Asset): Promise<PendingSendFile | null> {
  const info = await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: true });
  const uri = info.localUri || info.uri;
  if (!uri) return null;
  const isVideo = asset.mediaType === MediaLibrary.MediaType.video;
  const baseName = (asset.filename || `${isVideo ? "video" : "photo"}_${Date.now()}`).replace(/\.[^.]+$/, "");
  if (isVideo) {
    const ext = (asset.filename?.split(".").pop() || "mp4").toLowerCase();
    return {
      uri,
      name: `${baseName}.${ext}`,
      mime: ext === "mov" ? "video/quicktime" : "video/mp4",
      width: asset.width,
      height: asset.height,
      durationMs: asset.duration ? Math.round(asset.duration * 1000) : undefined,
    };
  }
  // Rasm: brauzerlar HEIC ni ochmaydi — har doim JPEG; juda katta bo'lsa kichraytiramiz.
  const big = Math.max(asset.width, asset.height) > MAX_IMAGE_EDGE;
  const resize = big
    ? [{ resize: asset.width >= asset.height ? { width: MAX_IMAGE_EDGE } : { height: MAX_IMAGE_EDGE } }]
    : [];
  const out = await ImageManipulator.manipulateAsync(uri, resize, {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: out.uri, name: `${baseName}.jpg`, mime: "image/jpeg", width: out.width, height: out.height };
}

/**
 * Telegram uslubidagi biriktirish oynasi: chat ustida pastdan yarim oyna, tepaga tortilsa to'liq ekran;
 * 3 ustunli ichki galereya (birinchi katak — kamera), tartib raqamli ko'p tanlash, tanlovda izoh + yuborish.
 */
export function TelegramAttachSheet({ visible, onClose, onPick, onSendMedia }: Props) {
  const insets = useSafeAreaInsets();
  const FULL_H = SCREEN_H - insets.top - 8;
  const HALF_H = Math.round(SCREEN_H * 0.56);
  /** translateY: 0 — to'liq ekran, HALF_Y — yarim, FULL_H — yopiq */
  const HALF_Y = FULL_H - HALF_H;

  const ty = useRef(new Animated.Value(FULL_H)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [snap, setSnap] = useState<Snap>("half");
  const snapRef = useRef<Snap>("half");
  snapRef.current = snap;

  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [perm, setPerm] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);
  const loadingRef = useRef(false);

  const animateTo = useCallback(
    (y: number, after?: () => void) => {
      Animated.timing(ty, {
        toValue: y,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) after?.();
      });
    },
    [ty]
  );

  // Ochilish / yopilish animatsiyasi
  useEffect(() => {
    if (visible) {
      setMounted(true);
      setSnap("half");
      ty.setValue(FULL_H);
      animateTo(HALF_Y);
      Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      animateTo(FULL_H, () => {
        setMounted(false);
        setSelected([]);
        setCaption("");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || isExpoGo) return;
    loadingRef.current = true;
    try {
      const page = await MediaLibrary.getAssetsAsync({
        first: PAGE,
        after: cursor,
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });
      setAssets((prev) => [...prev, ...page.assets]);
      setCursor(page.endCursor);
      setHasMore(page.hasNextPage);
    } catch (e) {
      console.warn("[AttachSheet] load", e);
    } finally {
      loadingRef.current = false;
    }
  }, [cursor, hasMore]);

  useEffect(() => {
    if (!visible || isExpoGo) return;
    void (async () => {
      const p = await MediaLibrary.requestPermissionsAsync();
      setPerm(p.granted);
      if (p.granted && assets.length === 0) void loadMore();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Tepadagi tutqichni tortish: yarim ↔ to'liq, pastga — yopish.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_e, g) => {
        const base = snapRef.current === "full" ? 0 : HALF_Y;
        ty.setValue(Math.max(0, base + g.dy));
      },
      onPanResponderRelease: (_e, g) => {
        const base = snapRef.current === "full" ? 0 : HALF_Y;
        const y = base + g.dy;
        if (g.vy > 1.2 || y > HALF_Y + HALF_H * 0.35) {
          onClose();
        } else if (g.vy < -0.6 || y < HALF_Y / 2) {
          setSnap("full");
          animateTo(0);
        } else {
          setSnap("half");
          animateTo(HALF_Y);
        }
      },
    })
  ).current;

  /** Galereya aylantirila boshlasa — to'liq ekranga (yarim holatda pastki qatorlar ko'rinmaydi). */
  const expand = () => {
    if (snapRef.current === "half") {
      setSnap("full");
      animateTo(0);
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const send = async () => {
    if (!selected.length || sending) return;
    setSending(true);
    Keyboard.dismiss();
    try {
      const byId = new Map(assets.map((a) => [a.id, a]));
      const files: PendingSendFile[] = [];
      for (const id of selected) {
        const a = byId.get(id);
        if (!a) continue;
        const f = await assetToFile(a).catch((e) => {
          console.warn("[AttachSheet] asset", e);
          return null;
        });
        if (f) files.push(f);
      }
      if (files.length) onSendMedia(files, caption.trim());
      onClose();
    } finally {
      setSending(false);
    }
  };

  if (!mounted) return null;

  const ACTIONS: { id: AttachAction; label: string; color: string; Icon: LucideIcon }[] = [
    { id: "gallery", label: "Galereya", color: "#5a9ce6", Icon: ImageIcon },
    { id: "file", label: "Fayl", color: "#f0a030", Icon: File },
  ];

  const data: (MediaLibrary.Asset | "camera")[] = ["camera", ...assets];

  return (
    <View style={styles.overlay} pointerEvents={visible ? "auto" : "none"}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdrop }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { height: FULL_H, transform: [{ translateY: ty }] }]}>
        <View {...pan.panHandlers} style={styles.header}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <Pressable onPress={onClose} hitSlop={10} style={styles.headerBtn}>
              <X color="#fff" size={22} />
            </Pressable>
            <Text style={styles.headerTitle}>
              {selected.length ? `${selected.length} ta tanlandi` : "Galereya"}
            </Text>
            <View style={styles.headerBtn} />
          </View>
        </View>

        {isExpoGo || perm === false ? (
          <View style={styles.noPerm}>
            <Text style={styles.noPermText}>
              {isExpoGo ? "Expo Go da galereya to'ri ishlamaydi." : "Galereyaga ruxsat berilmagan."}
            </Text>
            <Pressable onPress={() => onPick("gallery")} style={styles.noPermBtn}>
              <Text style={styles.noPermBtnText}>Tizim galereyasini ochish</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={data}
            numColumns={COLS}
            keyExtractor={(it) => (it === "camera" ? "camera" : it.id)}
            columnWrapperStyle={{ gap: GAP }}
            contentContainerStyle={{ gap: GAP, paddingBottom: 140 + insets.bottom }}
            onScrollBeginDrag={expand}
            onEndReached={() => void loadMore()}
            onEndReachedThreshold={0.6}
            initialNumToRender={18}
            windowSize={7}
            removeClippedSubviews
            renderItem={({ item }) => {
              if (item === "camera") {
                return (
                  <Pressable style={[styles.tile, styles.cameraTile]} onPress={() => onPick("camera")}>
                    <Camera color="#fff" size={30} />
                  </Pressable>
                );
              }
              const order = selected.indexOf(item.id);
              const isVideo = item.mediaType === MediaLibrary.MediaType.video;
              return (
                <Pressable style={styles.tile} onPress={() => toggle(item.id)}>
                  <Image source={{ uri: item.uri }} style={styles.tileImg} />
                  {order >= 0 ? <View style={styles.tileDim} pointerEvents="none" /> : null}
                  <View style={[styles.check, order >= 0 && styles.checkOn]} pointerEvents="none">
                    {order >= 0 ? <Text style={styles.checkText}>{order + 1}</Text> : null}
                  </View>
                  {isVideo ? (
                    <View style={styles.dur} pointerEvents="none">
                      <Text style={styles.durText}>{fmtDur(item.duration)}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}
      </Animated.View>

      {/* Pastki suzuvchi panel: tanlov yo'q — bo'limlar; tanlov bor — izoh + yuborish */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {selected.length ? (
          <View style={styles.captionRow}>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Izoh qo'shing…"
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={styles.captionInput}
              multiline
            />
            <Pressable onPress={() => void send()} style={styles.sendBtn} disabled={sending}>
              {sending ? <ActivityIndicator color="#fff" /> : <Send color="#fff" size={20} />}
              <View style={styles.sendBadge}>
                <Text style={styles.sendBadgeText}>{selected.length}</Text>
              </View>
            </Pressable>
          </View>
        ) : (
          <View style={styles.actions}>
            {ACTIONS.map((it) => (
              <Pressable
                key={it.id}
                onPress={() => onPick(it.id)}
                style={({ pressed }) => [styles.action, pressed && { opacity: 0.75 }]}
                hitSlop={8}
              >
                <View style={[styles.circle, { backgroundColor: it.color }]}>
                  <it.Icon color="#fff" size={24} pointerEvents="none" />
                </View>
                <Text style={styles.label}>{it.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 2000, elevation: 2000 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#1c2733",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
  },
  header: { paddingTop: 8, paddingBottom: 8 },
  grabber: {
    alignSelf: "center",
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginBottom: 6,
  },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  headerBtn: { width: 32, alignItems: "flex-start" },
  headerTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: 17, fontWeight: "600" },
  tile: { width: TILE, height: TILE, backgroundColor: "#0e1621", overflow: "hidden" },
  cameraTile: { alignItems: "center", justifyContent: "center", backgroundColor: "#0b1118" },
  tileImg: { width: "100%", height: "100%" },
  tileDim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
  check: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#fff",
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: "#3a8ee6", borderColor: "#3a8ee6" },
  checkText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  dur: {
    position: "absolute",
    left: 6,
    bottom: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  durText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  noPerm: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  noPermText: { color: "rgba(255,255,255,0.7)", textAlign: "center" },
  noPermBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: "#3a8ee6" },
  noPermBtnText: { color: "#fff", fontWeight: "600" },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(28,39,51,0.96)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  actions: { flexDirection: "row", justifyContent: "center", gap: 40 },
  action: { alignItems: "center", gap: 6 },
  circle: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  label: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  captionRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  captionInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    color: "#fff",
    fontSize: 15,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3a8ee6",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBadgeText: { color: "#3a8ee6", fontSize: 11, fontWeight: "800" },
});

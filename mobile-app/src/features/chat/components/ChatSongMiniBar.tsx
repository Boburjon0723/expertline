import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ChevronsUpDown, Eye, Play, Repeat, SkipBack, SkipForward, X } from "lucide-react-native";
import { mobileSongPlayer } from "../../../lib/mobile-song-player";
import { useAppearanceStore } from "../../../lib/appearance-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { navigationRef } from "../../../lib/navigationRef";
import { useChatStore } from "../../../store/chatStore";
import { AnimatedPressable } from "../../../components/AnimatedPressable";
import { palette } from "../../../lib/theme";

function fmt(sec: number) {
  if (!sec || !Number.isFinite(sec)) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function fmtMb(n?: number | null) {
  if (!n || n <= 0) return "";
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export const SONG_MINI_BAR_HEIGHT = 38;

/**
 * Telegram: FragmentContextView + chatdagi audio pleylist (shu chatning MP3 lari).
 */
export function ChatSongMiniBar() {
  const s = useSyncExternalStore(
    mobileSongPlayer.subscribe,
    mobileSongPlayer.getSnapshot,
    mobileSongPlayer.getSnapshot
  );
  const themeId = useAppearanceStore((s) => s.themeId);
  const [listOpen, setListOpen] = useState(false);
  const barW = useRef(1);
  const appear = useRef(new Animated.Value(0)).current;
  const hasTrack = !!s.track;
  useEffect(() => {
    if (!hasTrack) {
      appear.setValue(0);
      return;
    }
    appear.setValue(0);
    Animated.timing(appear, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [hasTrack, appear]);
  if (!s.track) return null;
  const progress = s.duration ? Math.min(1, s.currentTime / s.duration) : 0;
  const hasQueue = s.playlist.length > 1;
  const accent = palette.accent;
  const queueColor = hasQueue ? accent : "rgba(255,255,255,0.28)";
  const barBg =
    themeId === "vibrant" ? "rgba(30, 41, 59, 0.72)" : "rgba(255, 255, 255, 0.08)";

  const jumpToSong = () => {
    const t = s.track;
    if (!t?.chatId || !navigationRef.isReady()) return;
    const chats = useChatStore.getState().chats;
    const c = chats.find((x) => String(x.id) === String(t.chatId));
    navigationRef.navigate({
      name: "ChatDetail",
      params: {
        chatId: String(t.chatId),
        name: c?.name || "Chat",
        avatarUrl: c?.avatarUrl ?? null,
        focusMessageId: t.id,
      },
      merge: true,
    });
  };

  return (
    <>
      <Animated.View style={[styles.wrap, { backgroundColor: barBg, opacity: appear }]}>
        <View style={styles.row}>
          <AnimatedPressable
            style={styles.icon}
            hitSlop={8}
            disabled={!hasQueue}
            onPress={() => void mobileSongPlayer.prev()}
          >
            <SkipBack color={queueColor} size={16} />
          </AnimatedPressable>
          <AnimatedPressable style={styles.icon} hitSlop={8} onPress={() => void mobileSongPlayer.toggle()}>
            {s.playing ? (
              <View style={styles.pause} />
            ) : (
              <Play color={palette.accent} size={18} fill={palette.accent} />
            )}
          </AnimatedPressable>
          <AnimatedPressable
            style={styles.icon}
            hitSlop={8}
            disabled={!hasQueue}
            onPress={() => void mobileSongPlayer.next()}
          >
            <SkipForward color={queueColor} size={16} />
          </AnimatedPressable>
          <View style={styles.meta}>
            <Text style={styles.title} numberOfLines={1}>
              {s.track.title}
              <Text style={styles.timeInline}>  {fmt(s.currentTime)}</Text>
            </Text>
          </View>
          <AnimatedPressable
            style={styles.icon}
            hitSlop={8}
            onPress={jumpToSong}
            accessibilityLabel="Qoshiq xabariga o'tish"
          >
            <Eye color="rgba(255,255,255,0.7)" size={15} />
          </AnimatedPressable>
          <AnimatedPressable
            style={styles.icon}
            hitSlop={8}
            onPress={() => setListOpen(true)}
            accessibilityLabel="Pleylist"
          >
            <ChevronsUpDown
              color={listOpen ? palette.accent : "rgba(255,255,255,0.55)"}
              size={15}
            />
          </AnimatedPressable>
          <AnimatedPressable style={styles.icon} hitSlop={8} onPress={() => mobileSongPlayer.toggleRepeatOne()}>
            <Repeat color={s.repeatOne ? palette.accent : "rgba(255,255,255,0.45)"} size={15} />
            {s.repeatOne ? <Text style={styles.one}>1</Text> : null}
          </AnimatedPressable>
          <AnimatedPressable style={styles.icon} hitSlop={8} onPress={() => void mobileSongPlayer.cycleRate()}>
            <Text style={styles.rate}>{s.rate === 1 ? "1X" : `${s.rate}X`}</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.icon} hitSlop={8} onPress={() => void mobileSongPlayer.close()}>
            <X color="rgba(255,255,255,0.55)" size={15} />
          </AnimatedPressable>
        </View>
        <Pressable
          style={styles.progressTrack}
          onLayout={(e) => {
            barW.current = Math.max(1, e.nativeEvent.layout.width);
          }}
          onPress={(e) => {
            if (!s.duration) return;
            const x = Math.max(0, Math.min(e.nativeEvent.locationX, barW.current));
            void mobileSongPlayer.seek((x / barW.current) * s.duration);
          }}
        >
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                {
                  transform: [{ scaleX: Math.max(0.001, progress) }],
                },
              ]}
            />
          </View>
        </Pressable>
      </Animated.View>

      <Modal visible={listOpen} transparent animationType="fade" onRequestClose={() => setListOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setListOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Shu chatdagi musiqa</Text>
            <ScrollView style={styles.sheetList} nestedScrollEnabled>
              {(s.playlist.length ? s.playlist : s.track ? [s.track] : []).map((t) => {
                const active = t.id === s.track?.id || t.uri === s.track?.uri;
                const sub = [fmt(active && s.duration ? s.duration : 0), fmtMb(t.fileSize)]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <Pressable
                    key={t.id || t.uri}
                    style={styles.sheetRow}
                    onPress={() => {
                      void mobileSongPlayer.play(t, s.playlist);
                      setListOpen(false);
                    }}
                  >
                    <View style={[styles.sheetPlay, active && styles.sheetPlayOn]}>
                      {active && s.playing ? (
                        <View style={styles.pauseSm} />
                      ) : (
                        <Play color="#fff" size={14} fill="#fff" />
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.sheetName} numberOfLines={1}>
                        {t.title}
                      </Text>
                      <Text style={styles.sheetSub} numberOfLines={1}>
                        {active
                          ? `${fmt(s.currentTime)}${s.duration ? ` / ${fmt(s.duration)}` : ""}`
                          : sub || "MP3"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  globalHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12,
    elevation: 8,
  },
  wrap: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 0,
    overflow: "hidden",
    marginHorizontal: 0,
    marginVertical: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.14)",
  },
  row: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  icon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  pause: {
    width: 9,
    height: 11,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: palette.accent,
  },
  pauseSm: {
    width: 8,
    height: 10,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: "#fff",
  },
  meta: { flex: 1, minWidth: 0, paddingHorizontal: 2 },
  title: { color: "#fff", fontSize: 13, fontWeight: "600" },
  timeInline: { color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: "500" },
  one: {
    position: "absolute",
    bottom: 4,
    right: 4,
    color: palette.accent,
    fontSize: 8,
    fontWeight: "800",
  },
  rate: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700" },
  progressTrack: {
    height: 10,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  progressBg: {
    height: 2,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  progressFill: {
    height: 2,
    width: "100%",
    backgroundColor: palette.accent,
    transformOrigin: "left center",
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-start",
    paddingTop: 88,
    paddingHorizontal: 16,
  },
  sheet: {
    backgroundColor: "#212d3b",
    borderRadius: 14,
    maxHeight: 360,
    paddingVertical: 10,
    overflow: "hidden",
  },
  sheetTitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  sheetList: { maxHeight: 320 },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sheetPlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#5eb5f7",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetPlayOn: { backgroundColor: "#3d8fd4" },
  sheetName: { color: "#fff", fontSize: 15, fontWeight: "600" },
  sheetSub: { color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 },
});

const AUTH_ROUTES = new Set(["Login", "Register", "Passcode"]);
const EMBEDDED_SONG_ROUTES = new Set(["ChatDetail", "Messages"]);

/** Chat/list layout ichida; boshqa sahifalarda overlay. */
export function GlobalSongDock({ routeName = "" }: { routeName?: string }) {
  const insets = useSafeAreaInsets();
  const live =
    navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name ?? routeName : routeName;
  if (AUTH_ROUTES.has(live) || EMBEDDED_SONG_ROUTES.has(live)) return null;
  return (
    <View pointerEvents="box-none" style={styles.globalHost}>
      <View style={{ marginTop: insets.top + 8 }} pointerEvents="box-none">
        <ChatSongMiniBar />
      </View>
    </View>
  );
}

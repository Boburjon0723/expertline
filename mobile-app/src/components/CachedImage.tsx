import React, { useEffect, useState } from "react";
import { Image, ImageStyle, Pressable, StyleProp, View, ViewStyle } from "react-native";
import { ArrowDown } from "lucide-react-native";
import { getCachedMediaUri, peekCachedMediaUriSync } from "../lib/media-cache";
import { subscribeMediaPrefs } from "../lib/media-prefs";
import { palette } from "../lib/theme";

interface CachedImageProps {
  uri: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: "cover" | "contain" | "stretch";
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  forceCache?: boolean;
  /** Avatar/stiker — avtomatik o‘chiq bo‘lsa ham keshga yoziladi */
  alwaysCache?: boolean;
  onLongPress?: () => void;
  /** Kichik nusxa (data URI) — yuklanmaguncha xira ko'rsatiladi (Telegram kabi). */
  thumb?: string | null;
}

export const CachedImage = ({
  uri,
  style,
  resizeMode = "cover",
  onLoadStart,
  onLoadEnd,
  forceCache = false,
  alwaysCache = false,
  onLongPress,
  thumb,
}: CachedImageProps) => {
  // Keshda bor bo'lsa birinchi kadrdanoq (spinnersiz) ko'rsatiladi.
  const [localUri, setLocalUri] = useState<string | null>(() => peekCachedMediaUriSync(uri));
  const [needsDownload, setNeedsDownload] = useState(false);
  const [prefTick, setPrefTick] = useState(0);

  useEffect(() => subscribeMediaPrefs(() => setPrefTick((n) => n + 1)), []);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (!uri) return;
      if (uri.startsWith("data:") || uri.startsWith("file:")) {
        if (isMounted) {
          setLocalUri(uri);
          setNeedsDownload(false);
        }
        return;
      }
      try {
        onLoadStart?.();
        const path = await getCachedMediaUri(uri, "image", {
          force: forceCache || alwaysCache,
        });
        if (!isMounted) return;
        if (path) {
          setLocalUri(path);
          setNeedsDownload(false);
        } else {
          setLocalUri(null);
          setNeedsDownload(true);
        }
        onLoadEnd?.();
      } catch {
        if (isMounted) {
          setLocalUri(null);
          setNeedsDownload(true);
          onLoadEnd?.();
        }
      }
    };
    void run();
    return () => {
      isMounted = false;
    };
  }, [uri, forceCache, alwaysCache, prefTick]);

  const pull = async () => {
    try {
      const path = await getCachedMediaUri(uri, "image", { force: true });
      if (path) {
        setLocalUri(path);
        setNeedsDownload(false);
      }
    } catch {
      /* ignore */
    }
  };

  if (needsDownload && !localUri) {
    return (
      <Pressable
        onPress={() => void pull()}
        onLongPress={onLongPress}
        delayLongPress={280}
        style={[style, { alignItems: "center", justifyContent: "center", backgroundColor: palette.bg, overflow: "hidden" }]}
      >
        {thumb ? (
          <Image source={{ uri: thumb }} blurRadius={12} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        ) : null}
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}>
          <ArrowDown color="#fff" size={24} strokeWidth={2.4} />
        </View>
      </Pressable>
    );
  }

  if (!localUri) {
    // Spinner o'rniga tinch fon — avatar/rasm joyi miltillamaydi.
    return <View style={[style as StyleProp<ViewStyle>, { backgroundColor: "rgba(255,255,255,0.06)" }]} />;
  }

  return (
    <Image
      source={{ uri: localUri }}
      style={style}
      resizeMode={resizeMode}
      pointerEvents="none"
      onLoadStart={onLoadStart}
      onLoadEnd={onLoadEnd}
    />
  );
};

import React, { useEffect, useState } from "react";
import { Image, ImageStyle, Pressable, StyleProp, View, ActivityIndicator } from "react-native";
import { CloudDownload } from "lucide-react-native";
import { getCachedMediaUri } from "../lib/media-cache";
import { subscribeMediaPrefs } from "../lib/media-prefs";

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
}: CachedImageProps) => {
  const [localUri, setLocalUri] = useState<string | null>(null);
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
        style={[style, { alignItems: "center", justifyContent: "center", backgroundColor: "#0e1621" }]}
      >
        <CloudDownload color="#fff" size={28} />
      </Pressable>
    );
  }

  if (!localUri) {
    return (
      <View style={style}>
        <ActivityIndicator color="#fff" style={{ flex: 1 }} />
      </View>
    );
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

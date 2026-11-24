import React, { useEffect, useState } from "react";
import { getCachedMediaUri, peekCachedMediaUriSync } from "../lib/media-cache";
import { ImageBackground, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import {
  nativeImageBlurRadius,
  overlayOpacityFromPanelBlur,
  useAppearanceStore,
} from "../lib/appearance-store";

import { THEMES } from "../lib/constants";

type Props = {
  children: React.ReactNode;
  /** Qat’iy qoplamasdan oldin qo‘shimcha uslublar */
  contentStyle?: StyleProp<ViewStyle>;
  /** Faqat chat oynasi uchun rasm ko'rsatilsinmi? */
  isChatWindow?: boolean;
};


/** Masofaviy fon URL ni lokal faylga aylantiradi (birinchi martadan keyin sinxron). */
function useCachedBackground(remote?: string | null): string | null {
  const isRemote = !!remote && /^https?:\/\//i.test(remote);
  const [local, setLocal] = useState<string | null>(() =>
    isRemote ? peekCachedMediaUriSync(remote) : remote || null
  );
  useEffect(() => {
    if (!remote) {
      setLocal(null);
      return;
    }
    if (!isRemote) {
      setLocal(remote);
      return;
    }
    const sync = peekCachedMediaUriSync(remote);
    if (sync) {
      setLocal(sync);
      return;
    }
    let alive = true;
    void getCachedMediaUri(remote, "image", { force: true })
      .then((p) => alive && setLocal(p || remote))
      .catch(() => alive && setLocal(remote));
    return () => {
      alive = false;
    };
  }, [remote, isRemote]);
  return local;
}

export function ChatBackground({ children, contentStyle, isChatWindow }: Props) {
  const imageBlur = useAppearanceStore((s) => s.imageBlur);
  const panelBlur = useAppearanceStore((s) => s.panelBlur);
  const backgroundUri = useAppearanceStore((s) => s.backgroundUri);
  const themeId = useAppearanceStore((s) => s.themeId);

  // Theme support
  const isTelegram = themeId === "telegram";
  const isPureDark = themeId === "pure_dark";
  const themeData = isPureDark ? THEMES.pure_dark : (isTelegram ? THEMES.telegram : THEMES.default);

  const blurR = nativeImageBlurRadius(imageBlur);
  const overlayA = overlayOpacityFromPanelBlur(panelBlur, themeData.isDark);

  
  // If it's a solid theme but NOT the chat window, use solid background
  const shouldUseSolidColor = (isTelegram || isPureDark) && !isChatWindow;
  
  const remoteUri = themeId === "vibrant" || isChatWindow ? backgroundUri : themeData.background;
  // Fon rasmi diskda keshlanadi: chat har ochilganda tarmoqdan qayta yuklanib, 1 soniya qora turmasin.
  const uri = useCachedBackground(remoteUri);

  // For solid colors, we use black overlay to "dim" the solid base color.
  // For image backgrounds, we use the theme color to "tint" the image.
  const overlayBaseColor = (isTelegram || isPureDark) ? "14, 22, 33" : (shouldUseSolidColor ? "0, 0, 0" : "15, 23, 42");
  const finalOverlay = `rgba(${overlayBaseColor}, ${overlayA})`;



  const content = (
    <>
      <View style={[styles.dim, { backgroundColor: finalOverlay }]} />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </>
  );

  if (shouldUseSolidColor) {
    return (
      <View style={[styles.bg, { backgroundColor: `rgb(${overlayBaseColor})` }]}>
        {content}
      </View>
    );
  }

  return (
    <ImageBackground
      source={uri ? { uri } : undefined}
      style={[styles.bg, { backgroundColor: `rgb(${overlayBaseColor})` }]}
      fadeDuration={0}
      blurRadius={blurR}
      resizeMode="cover"
    >
      {content}
    </ImageBackground>
  );
}





const styles = StyleSheet.create({
  bg: { flex: 1, width: "100%" },
  dim: { ...StyleSheet.absoluteFillObject },
  content: { flex: 1 },
});

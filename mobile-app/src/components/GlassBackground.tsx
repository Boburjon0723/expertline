import React from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useAppearanceStore } from "../lib/appearance-store";

/**
 * Shaffof xira (shisha) fon — chat sarlavhasi, pastki yozish qismi va menyular uchun.
 * Kuchi Sozlamalardagi "panel xiraligi" (panelBlur, 0–100) ga bog'liq: 0 — blursiz, faqat yarim shaffof.
 */
export function GlassBackground({ tint = "rgba(17,24,33,0.45)" }: { tint?: string }) {
  const panelBlur = useAppearanceStore((s) => s.panelBlur);
  // 0 — o'chiq; aks holda 20..100 (sukut 8 → ~26, sezilarli lekin yengil).
  const v = Math.max(0, Math.min(100, panelBlur));
  const intensity = v === 0 ? 0 : Math.round(20 + v * 0.8);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {intensity > 0 ? <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: intensity > 0 ? tint : "rgba(17,24,33,0.85)" }]} />
    </View>
  );
}

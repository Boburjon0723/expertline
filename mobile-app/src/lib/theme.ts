/**
 * ExpertLine yagona rang palitrasi.
 * Yangi rang kerak bo'lsa — avval shu yerga qo'shing, komponentda hex yozmang.
 */
export const palette = {
  /** Yagona aksent: tugmalar, havolalar, faol tab, ✓✓, mening xabarim */
  accent: "#8774e1",
  accentPressed: "#7563d0",
  accentSoft: "rgba(135,116,225,0.18)",

  /** Ekran foni (ko'kimtir to'q, sof qora emas) */
  bg: "#0e1621",
  /** Qattiq yuza: modal, kirish maydoni, boshqalarning xabari */
  surfaceSolid: "#17212b",
  bubbleIn: "#1c2733",
  /** Mening xabarim: aksentning biroz to'qroq tusi — oq matn kontrasti ~5:1 */
  bubbleOut: "#6f5fd0",
  /** Shisha yuza: kartochka, qidiruv, tab-bar */
  surface: "rgba(255,255,255,0.08)",
  surfacePressed: "rgba(255,255,255,0.12)",
  border: "rgba(255,255,255,0.12)",

  /** Matn darajalari */
  text: "#ffffff",
  textSecondary: "rgba(255,255,255,0.6)",
  textMuted: "rgba(255,255,255,0.4)",

  /** Holatlar — faqat o'z vazifasida */
  danger: "#ef4444",
  success: "#10b981",
  warning: "#f59e0b",

  /** Chat oynasidagi fon rasmi ustidagi qoplama (40–60%) */
  wallpaperOverlay: "rgba(14,22,33,0.5)",
} as const;

export type PaletteKey = keyof typeof palette;

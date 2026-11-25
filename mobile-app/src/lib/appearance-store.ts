import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import * as FileSystem from "expo-file-system/legacy";
import { DEFAULT_PLATFORM_BACKGROUND } from "./constants";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export type AppearanceState = {
  themeId: string;
  /** Panel / shisha effekt (web: `app-bg-blur`) */
  panelBlur: number;
  /** Fon rasmi xiraligi (web: `app-bg-image-blur`) */
  imageBlur: number;
  backgroundUri: string;
  isDarkTheme: boolean;
  setTheme: (id: string) => void;
  setPanelBlur: (v: number) => void;
  setImageBlur: (v: number) => void;
  setBackgroundUri: (uri: string) => void;
  setDarkTheme: (dark: boolean) => void;
};

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      themeId: "pure_dark",
      panelBlur: 8,
      imageBlur: 20,
      backgroundUri: DEFAULT_PLATFORM_BACKGROUND,
      isDarkTheme: true,
      setTheme: (id: string) => set({ themeId: id }),
      setPanelBlur: (v: number) => set({ panelBlur: clamp(Math.round(v), 0, 100) }),
      setImageBlur: (v: number) => set({ imageBlur: clamp(Math.round(v), 0, 100) }),
      setBackgroundUri: (uri: string) => set({ backgroundUri: uri }),
      setDarkTheme: (dark: boolean) => set({ isDarkTheme: dark }),
    }),

    {
      name: "app-appearance",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        themeId: s.themeId,
        panelBlur: s.panelBlur,
        imageBlur: s.imageBlur,
        backgroundUri: s.backgroundUri,
        isDarkTheme: s.isDarkTheme,
      }),

    }
  )
);

/** RN `blurRadius` uchun (iOS/Android cheklovlari) */
export function nativeImageBlurRadius(imageBlur: number): number {
  return clamp(Math.round(imageBlur * 0.45), 0, 50);
}

/** Qorong‘i qatlam — panelBlur va tema */
export function overlayOpacityFromPanelBlur(panelBlur: number, isDark: boolean): number {
  const base = 0.38 + (panelBlur / 100) * 0.32;
  return clamp(base + (isDark ? 0.12 : 0), 0.25, 0.92);
}

/* --- Galereyadan tanlangan fon rasmi ---
 * ImagePicker rasmni vaqtinchalik kesh papkasiga qo'yadi; iOS ilova yangilanganda keshni tozalaydi va
 * ilova papkasi manzili ham o'zgaradi. Shuning uchun rasm doimiy (Documents) papkaga nusxalanadi va
 * to'liq yo'l emas, nisbiy belgi saqlanadi: "doc:wallpapers/bg-123.jpg".
 */
const DOC_PREFIX = "doc:";
const WALLPAPER_DIR = "wallpapers/";

/** Tanlangan rasmni doimiy papkaga nusxalaydi; saqlash uchun belgini qaytaradi. */
export async function saveCustomWallpaper(pickedUri: string): Promise<string> {
  const docDir = FileSystem.documentDirectory;
  if (!docDir) return pickedUri;
  const dir = docDir + WALLPAPER_DIR;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const ext = (pickedUri.match(/\.(jpe?g|png|webp|heic)(\?|$)/i)?.[1] || "jpg").toLowerCase();
  const name = `bg-${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: pickedUri, to: dir + name });
  // Eski tanlangan fonlar joy egallamasin
  try {
    const files = await FileSystem.readDirectoryAsync(dir);
    await Promise.all(
      files.filter((f) => f !== name).map((f) => FileSystem.deleteAsync(dir + f, { idempotent: true }))
    );
  } catch {
    /* ignore */
  }
  return DOC_PREFIX + WALLPAPER_DIR + name;
}

/** Saqlangan belgini joriy fayl yo'liga aylantiradi (eski to'liq Documents yo'llari ham tiklanadi). */
export function resolveBackgroundUri(stored: string | null | undefined): string {
  if (!stored) return "";
  const docDir = FileSystem.documentDirectory || "";
  if (stored.startsWith(DOC_PREFIX)) return docDir + stored.slice(DOC_PREFIX.length);
  const m = stored.match(/^file:\/\/.*?\/Documents\/(.+)$/);
  if (m && docDir) return docDir + m[1];
  return stored;
}

/** Lokal fon fayli yo'qolgan bo'lsa (masalan, eski keshdagi rasm) — standart fonga qaytariladi. */
export async function ensureBackgroundExists(): Promise<void> {
  const stored = useAppearanceStore.getState().backgroundUri;
  const uri = resolveBackgroundUri(stored);
  if (!uri.startsWith("file://")) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) useAppearanceStore.getState().setBackgroundUri(DEFAULT_PLATFORM_BACKGROUND);
  } catch {
    /* ignore */
  }
}

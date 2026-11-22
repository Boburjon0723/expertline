import AsyncStorage from "@react-native-async-storage/async-storage";

const PHOTO_KEY = "@expertline_auto_dl_photo";
const VIDEO_KEY = "@expertline_auto_dl_video";
const FILE_KEY = "@expertline_auto_dl_file";
const GALLERY_KEY = "@expertline_save_gallery";
const LEGACY_AUTO = "@expertline_auto_download";

type Prefs = { photo: boolean; video: boolean; file: boolean; gallery: boolean };

const listeners = new Set<() => void>();

let mem: Prefs | null = null;

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeMediaPrefs(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function load(): Promise<Prefs> {
  if (mem) return mem;
  try {
    const [p, v, f, g, legacy] = await AsyncStorage.multiGet([
      PHOTO_KEY,
      VIDEO_KEY,
      FILE_KEY,
      GALLERY_KEY,
      LEGACY_AUTO,
    ]);
    const legacyOn = legacy[1] !== "0";
    mem = {
      photo: p[1] == null ? legacyOn : p[1] !== "0",
      video: v[1] == null ? legacyOn : v[1] !== "0",
      file: f[1] == null ? legacyOn : f[1] !== "0",
      gallery: g[1] === "1",
    };
  } catch {
    mem = { photo: true, video: true, file: true, gallery: false };
  }
  return mem;
}

export async function getMediaPrefs(): Promise<Prefs> {
  return load();
}

export async function isAutoDownloadEnabled(
  kind?: "image" | "video" | "audio" | "file"
): Promise<boolean> {
  const p = await load();
  if (!kind) return p.photo || p.video || p.file;
  if (kind === "image") return p.photo;
  if (kind === "video") return p.video;
  return p.file;
}

export async function setAutoDownloadEnabled(on: boolean): Promise<void> {
  const p = await load();
  p.photo = on;
  p.video = on;
  p.file = on;
  mem = { ...p };
  await AsyncStorage.multiSet([
    [PHOTO_KEY, on ? "1" : "0"],
    [VIDEO_KEY, on ? "1" : "0"],
    [FILE_KEY, on ? "1" : "0"],
    [LEGACY_AUTO, on ? "1" : "0"],
  ]);
  notify();
}

export async function setKindAutoDownload(kind: "photo" | "video" | "file", on: boolean): Promise<void> {
  const p = await load();
  p[kind] = on;
  mem = { ...p };
  const key = kind === "photo" ? PHOTO_KEY : kind === "video" ? VIDEO_KEY : FILE_KEY;
  await AsyncStorage.setItem(key, on ? "1" : "0");
  notify();
}

export async function isSaveToGalleryEnabled(): Promise<boolean> {
  return (await load()).gallery;
}

export async function setSaveToGalleryEnabled(on: boolean): Promise<void> {
  const p = await load();
  p.gallery = on;
  mem = { ...p };
  await AsyncStorage.setItem(GALLERY_KEY, on ? "1" : "0");
  notify();
}

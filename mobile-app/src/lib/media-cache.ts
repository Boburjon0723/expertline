import * as FileSystem from "expo-file-system/legacy";
import { getToken } from "./auth-storage";
import { isAutoDownloadEnabled, isSaveToGalleryEnabled } from "./media-prefs";
import { API_URL } from "./config";

/**
 * Telegram FileLoader analogi:
 * - OS keshini emas, ilovaning documentDirectory sini ishlatadi (qayta kirganda saqlanadi)
 * - Rasm / video / audio / hujjat alohida papkada
 * - URL dan barqaror nom — bir xil fayl qayta yuklanmaydi
 * - Bir URL uchun parallel download bitta
 */
export type MediaKind = "image" | "video" | "audio" | "file";

const ROOT = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ""}ExpertLine/`;

const DIRS: Record<MediaKind, string> = {
  image: `${ROOT}Telegram Images/`,
  video: `${ROOT}Telegram Video/`,
  audio: `${ROOT}Telegram Audio/`,
  file: `${ROOT}Telegram Documents/`,
};

const inflight = new Map<string, Promise<string>>();
const resumables = new Map<string, FileSystem.DownloadResumable>();
const cacheListeners = new Set<() => void>();

export function subscribeMediaCache(fn: () => void): () => void {
  cacheListeners.add(fn);
  return () => cacheListeners.delete(fn);
}

export function notifyMediaCacheChanged() {
  cacheListeners.forEach((fn) => fn());
}

function hashUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = (Math.imul(31, h) + url.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function extFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\.([a-zA-Z0-9]{1,8})$/);
    if (m) return m[1].toLowerCase();
  } catch {
    const m = url.split("?")[0].match(/\.([a-zA-Z0-9]{1,8})$/);
    if (m) return m[1].toLowerCase();
  }
  return "bin";
}

export function guessMediaKind(url: string, mime?: string): MediaKind {
  const m = (mime || "").toLowerCase();
  const u = url.toLowerCase().split("?")[0];
  if (m.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|heic)$/.test(u)) return "image";
  if (m.startsWith("video/") || /\.(mp4|mov|mkv|webm|avi)$/.test(u)) return "video";
  if (m.startsWith("audio/") || /\.(mp3|m4a|ogg|opus|wav|aac|webm)$/.test(u)) return "audio";
  return "file";
}

/** Query/token o‘zgarishi keshni sindirmasin — bir xil fayl bir path. */
function toAbsoluteMediaUrl(url: string): string {
  if (url.startsWith("http") || url.startsWith("file:") || url.startsWith("data:")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function cacheKeyUrl(url: string): string {
  try {
    const u = new URL(toAbsoluteMediaUrl(url));
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.split("?")[0];
  }
}

function destPath(url: string, kind: MediaKind): string {
  const key = cacheKeyUrl(url);
  const ext = extFromUrl(key);
  return `${DIRS[kind]}${hashUrl(key)}.${ext}`;
}

async function ensureDir(dir: string) {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

async function downloadTo(url: string, dest: string): Promise<string> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token && url.includes(API_URL.replace(/\/$/, ""))) {
    headers.Authorization = `Bearer ${token}`;
  }
  const result = await FileSystem.downloadAsync(url, dest, { headers });
  if (result.status >= 400) {
    throw new Error("Fayl yuklanmadi");
  }
  return result.uri;
}

/** Diskda bor-yo‘qligini tekshiradi (yuklamaydi). */
/** Bir marta topilgan lokal fayllar — keyingi renderlarda sinxron (spinner/qora kadr bo'lmasin). */
const resolved = new Map<string, string>();

export function peekCachedMediaUriSync(remoteUrl?: string | null): string | null {
  if (!remoteUrl) return null;
  if (remoteUrl.startsWith("file:") || remoteUrl.startsWith("data:")) return remoteUrl;
  return resolved.get(remoteUrl) ?? null;
}

export async function peekCachedMediaUri(
  remoteUrl: string,
  kind?: MediaKind
): Promise<string | null> {
  if (!remoteUrl) return null;
  if (remoteUrl.startsWith("file:") || remoteUrl.startsWith("data:")) return remoteUrl;
  const k = kind || guessMediaKind(remoteUrl);
  await ensureDir(DIRS[k]);
  const dest = destPath(remoteUrl, k);
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists && (info as { size?: number }).size !== 0) {
    resolved.set(remoteUrl, dest);
    return dest;
  }
  return null;
}

/**
 * Telegram FileLoader.getPathToAttach: avval lokal, yo‘q bo‘lsa yuklaydi.
 * force=false va avtomatik yuklash o‘chiq bo‘lsa — diskka yozmaydi, remote URL qaytaradi.
 */
export async function getCachedMediaUri(
  remoteUrl: string,
  kind?: MediaKind,
  opts?: { force?: boolean }
): Promise<string> {
  if (!remoteUrl) throw new Error("URL yo‘q");
  if (remoteUrl.startsWith("file:") || remoteUrl.startsWith("data:")) return remoteUrl;

  const k = kind || guessMediaKind(remoteUrl);
  await ensureDir(DIRS[k]);
  const dest = destPath(remoteUrl, k);

  const existing = await peekCachedMediaUri(remoteUrl, k);
  if (existing) return existing;

  const auto = await isAutoDownloadEnabled(k);
  if (!opts?.force && !auto) {
    return "";
  }

  const pending = inflight.get(dest);
  if (pending) return pending;

  const job = downloadTo(remoteUrl, dest)
    .then(async (uri) => {
      if (k === "image" || k === "video") {
        try {
          if (await isSaveToGalleryEnabled()) {
            const MediaLibrary = require("expo-media-library") as typeof import("expo-media-library");
            const perm = await MediaLibrary.requestPermissionsAsync();
            if (perm.granted) await MediaLibrary.saveToLibraryAsync(uri);
          }
        } catch {
          /* Expo Go / ruxsat */
        }
      }
      resolved.set(remoteUrl, uri);
      // Shu URL ni ko'rsatayotgan pufakchalar (bulut belgisi) yangilansin.
      notifyMediaCacheChanged();
      return uri;
    })
    .finally(() => inflight.delete(dest));
  inflight.set(dest, job);
  return job;
}

/** Telegram: progress bilan yuklash; cancelMediaDownload to‘xtatadi. */
export async function startMediaDownload(
  remoteUrl: string,
  kind: MediaKind,
  onProgress?: (written: number, total: number) => void
): Promise<string> {
  if (!remoteUrl) throw new Error("URL yo‘q");
  if (remoteUrl.startsWith("file:") || remoteUrl.startsWith("data:")) return remoteUrl;

  const k = kind || guessMediaKind(remoteUrl);
  await ensureDir(DIRS[k]);
  const dest = destPath(remoteUrl, k);
  const existing = await peekCachedMediaUri(remoteUrl, k);
  if (existing) return existing;

  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token && remoteUrl.includes(API_URL.replace(/\/$/, ""))) {
    headers.Authorization = `Bearer ${token}`;
  }

  const job = FileSystem.createDownloadResumable(
    remoteUrl,
    dest,
    { headers },
    (p) => {
      onProgress?.(p.totalBytesWritten, p.totalBytesExpectedToWrite || 0);
    }
  );
  resumables.set(remoteUrl, job);
  try {
    const result = await job.downloadAsync();
    if (!result || result.status >= 400) {
      throw new Error("Fayl yuklanmadi");
    }
    notifyMediaCacheChanged();
    return result.uri;
  } catch (e) {
    try {
      await FileSystem.deleteAsync(dest, { idempotent: true });
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    resumables.delete(remoteUrl);
  }
}

export async function cancelMediaDownload(remoteUrl: string): Promise<void> {
  const job = resumables.get(remoteUrl);
  if (!job) return;
  try {
    await job.pauseAsync();
  } catch {
    /* ignore */
  }
  resumables.delete(remoteUrl);
  try {
    const k = guessMediaKind(remoteUrl);
    await FileSystem.deleteAsync(destPath(remoteUrl, k), { idempotent: true });
  } catch {
    /* ignore */
  }
  notifyMediaCacheChanged();
}
export async function putLocalInMediaCache(
  remoteUrl: string,
  localUri: string,
  mime?: string
): Promise<void> {
  if (!remoteUrl || !localUri) return;
  try {
    const k = guessMediaKind(remoteUrl, mime);
    await ensureDir(DIRS[k]);
    const dest = destPath(remoteUrl, k);
    const info = await FileSystem.getInfoAsync(dest);
    const size = (info as { size?: number }).size || 0;
    if (info.exists && size > 0) {
      notifyMediaCacheChanged();
      return;
    }
    if (info.exists) {
      await FileSystem.deleteAsync(dest, { idempotent: true });
    }
    await FileSystem.copyAsync({ from: localUri, to: dest });
    resolved.set(remoteUrl, dest);
    notifyMediaCacheChanged();
  } catch {
    /* ignore */
  }
}

export async function getMediaCacheBytes(): Promise<number> {
  let total = 0;
  for (const dir of Object.values(DIRS)) {
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) continue;
      const names = await FileSystem.readDirectoryAsync(dir);
      for (const name of names) {
        const f = await FileSystem.getInfoAsync(`${dir}${name}`);
        total += (f as { size?: number }).size || 0;
      }
    } catch {
      /* ignore */
    }
  }
  return total;
}

export async function clearMediaCache(): Promise<void> {
  inflight.clear();
  for (const job of resumables.values()) {
    try {
      await job.pauseAsync();
    } catch {
      /* ignore */
    }
  }
  resumables.clear();
  try {
    const info = await FileSystem.getInfoAsync(ROOT);
    if (info.exists) {
      await FileSystem.deleteAsync(ROOT, { idempotent: true });
    }
  } catch {
    /* ignore */
  }
  notifyMediaCacheChanged();
}

export function formatCacheBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

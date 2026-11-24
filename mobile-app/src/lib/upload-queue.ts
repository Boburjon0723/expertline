import * as FileSystem from "expo-file-system/legacy";
import { AppState } from "react-native";
import { create } from "zustand";
import { API_URL } from "./config";
import { getToken } from "./auth-storage";
import { putLocalInMediaCache } from "./media-cache";
import { createMediaThumb } from "./media-thumb";
import { useChatStore } from "../store/chatStore";
import {
  messageTypeFromMime,
  sendMessageRequest,
  type OutgoingMessageType,
} from "../features/chat/service";
import type { Message } from "../features/chat/types";

/**
 * Telegram uslubidagi media yuborish navbati.
 * - Xabar chatda darhol paydo bo'ladi (vaqtinchalik "local_" id), ustida yuklanish foizi.
 * - Yuklash chat ekraniga bog'liq emas: chatdan chiqilsa yoki boshqa chatga o'tilsa ham davom etadi.
 * - Bir vaqtda 3 tagacha fayl yuklanadi; tartib albumIndex va joyida almashtirish bilan saqlanadi.
 * - Osilib qolgan yuklash (45s progress yo'q) bekor qilinib qayta uriniladi; bekor qilish/qayta urinish mumkin.
 */

export type UploadKind = "image" | "video" | "file";

export interface UploadInfo {
  localUri: string;
  name: string;
  mime: string;
  size?: number;
  kind: UploadKind;
  width?: number;
  height?: number;
  /** Video davomiyligi (ms) */
  durationMs?: number;
  /** Kichik nusxa (data URI) — yuborishdan oldin yaratiladi */
  thumb?: string | null;
}

/** Telegram albomi: bir xil albumId li rasm/videolar chatda bitta to'r bo'lib ko'rinadi. */
export interface AlbumRef {
  id: string;
  index: number;
}

interface UploadJob {
  tempId: string;
  chatId: string;
  info: UploadInfo;
  caption?: string;
  forceType?: OutgoingMessageType;
  album?: AlbumRef;
  /** Qo'shimcha metadata (masalan { kind: "video_note" }) */
  extraMeta?: Record<string, unknown>;
}

function albumMeta(album?: AlbumRef) {
  return album ? { albumId: album.id, albumIndex: album.index } : {};
}

export function newAlbumId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

interface UploadState {
  /** tempId -> 0..1 */
  progress: Record<string, number>;
  /** tempId -> xato matni */
  failed: Record<string, string>;
}

export const useUploadStore = create<UploadState>(() => ({ progress: {}, failed: {} }));

export const LOCAL_MESSAGE_PREFIX = "local_";

export function isLocalUploadMessage(m: Pick<Message, "id">): boolean {
  return String(m.id).startsWith(LOCAL_MESSAGE_PREFIX);
}

const jobs = new Map<string, UploadJob>();
const tasks = new Map<string, FileSystem.UploadTask>();
const cancelled = new Set<string>();
/** Bir vaqtda yuklanadigan fayllar soni — bittasi osilib qolsa ham qolganlari to'xtamaydi. */
const MAX_PARALLEL = 3;
const waiting: UploadJob[] = [];
const running = new Set<string>();

function setProgress(id: string, value: number | null) {
  useUploadStore.setState((s) => {
    const progress = { ...s.progress };
    if (value == null) delete progress[id];
    else progress[id] = value;
    return { progress };
  });
}

function setFailed(id: string, error: string | null) {
  useUploadStore.setState((s) => {
    const failed = { ...s.failed };
    if (error == null) delete failed[id];
    else failed[id] = error;
    return { failed };
  });
}

function kindFromMime(mime: string, forceType?: OutgoingMessageType): UploadKind {
  if (forceType === "file") return "file";
  const t = messageTypeFromMime(mime);
  return t === "image" ? "image" : t === "video" ? "video" : "file";
}

/** Faylni yuboradi: chatga darhol vaqtinchalik xabar qo'shadi va navbatga qo'yadi. */
export function enqueueChatUpload(params: {
  chatId: string;
  senderId: string;
  uri: string;
  name: string;
  mime: string;
  size?: number;
  caption?: string;
  forceType?: OutgoingMessageType;
  album?: AlbumRef;
  width?: number;
  height?: number;
  durationMs?: number;
  extraMeta?: Record<string, unknown>;
}): string {
  const tempId = `${LOCAL_MESSAGE_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const info: UploadInfo = {
    localUri: params.uri,
    name: params.name,
    mime: params.mime,
    size: params.size,
    kind: kindFromMime(params.mime, params.forceType),
    ...(params.width && params.height ? { width: params.width, height: params.height } : {}),
    ...(params.durationMs ? { durationMs: Math.round(params.durationMs) } : {}),
  };
  const now = new Date();
  const temp: Message = {
    id: tempId,
    chatId: String(params.chatId),
    text: "",
    senderId: String(params.senderId),
    timestamp: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    createdAt: now.toISOString(),
    status: "sent",
    messageType: info.kind,
    remoteFileUrl: null,
    metadata: {
      upload: info,
      ...(params.extraMeta ?? {}),
      ...albumMeta(params.album),
      ...(params.caption ? { caption: params.caption } : {}),
    },
  };
  useChatStore.getState().addMessageLocally(String(params.chatId), temp);
  const job: UploadJob = {
    tempId,
    chatId: String(params.chatId),
    info,
    caption: params.caption,
    forceType: params.forceType,
    album: params.album,
    extraMeta: params.extraMeta,
  };
  jobs.set(tempId, job);
  setProgress(tempId, 0);
  schedule(job);
  return tempId;
}

function schedule(job: UploadJob) {
  if (running.has(job.tempId) || waiting.some((j) => j.tempId === job.tempId)) return;
  waiting.push(job);
  pump();
}

function pump() {
  while (running.size < MAX_PARALLEL && waiting.length) {
    const job = waiting.shift()!;
    if (cancelled.has(job.tempId)) continue;
    running.add(job.tempId);
    void runJob(job)
      .catch(() => {})
      .finally(() => {
        running.delete(job.tempId);
        pump();
      });
  }
}

// Ilova fondan qaytganda: xato bo'lib qolgan yuklashlarni o'zi qayta boshlaydi.
AppState.addEventListener("change", (state) => {
  if (state !== "active") return;
  const failed = useUploadStore.getState().failed;
  for (const id of Object.keys(failed)) {
    const job = jobs.get(id);
    if (job) {
      setFailed(id, null);
      schedule(job);
    }
  }
});

/** Server/tarmoq vaqtincha ishlamasa (masalan deploy paytida) shuncha kutib qayta uriniladi. */
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000];

class UploadError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Shuncha vaqt bir bayt ham yuborilmasa — yuklash osilib qolgan deb hisoblanadi va qayta uriniladi. */
const STALL_TIMEOUT_MS = 45_000;

async function runJob(job: UploadJob): Promise<void> {
  const { tempId } = job;
  for (let attempt = 0; ; attempt++) {
    if (cancelled.has(tempId)) return;
    try {
      await attemptJob(job);
      return;
    } catch (e) {
      tasks.delete(tempId);
      if (cancelled.has(tempId)) return;
      const retryable = !(e instanceof UploadError) || e.retryable;
      if (retryable && attempt < RETRY_DELAYS_MS.length) {
        console.warn(`[upload-queue] attempt ${attempt + 1} failed, retrying:`, e);
        setProgress(tempId, 0);
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      setProgress(tempId, null);
      setFailed(tempId, e instanceof Error ? e.message : "Fayl yuborilmadi");
      return;
    }
  }
}

async function attemptJob(job: UploadJob): Promise<void> {
  const { tempId, chatId, info } = job;
  setFailed(tempId, null);
  setProgress(tempId, 0);
  // Kichik nusxa (bir marta): qabul qiluvchi yuklamaguncha xira rasm / video kadrini ko'radi.
  if (info.thumb === undefined && (info.kind === "image" || info.kind === "video")) {
    info.thumb = await createMediaThumb(info.localUri, info.kind, info.width, info.height);
  }
  const token = await getToken();
  let lastActivity = Date.now();
  let lastSent = -1;
  const task = FileSystem.createUploadTask(
    `${API_URL}/api/media/upload`,
    info.localUri,
    {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "files",
      mimeType: info.mime,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      // FOREGROUND: iOS fon sessiyasi vazifalarni o'zi rejalashtiradi va ilova ochiq bo'lsa ham
      // kechiktirib yuborardi (birinchi fayl ketib, qolganlari osilib qolardi). Ilova fonga o'tib
      // ulanish uzilsa — qayta urinish va AppState "active" da qayta boshlash bor.
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
    },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      if (totalBytesSent !== lastSent) {
        lastSent = totalBytesSent;
        lastActivity = Date.now();
      }
      if (totalBytesExpectedToSend > 0) {
        // 95% gacha — qolgani server javobi va xabarni saqlash.
        setProgress(tempId, Math.min(0.95, (totalBytesSent / totalBytesExpectedToSend) * 0.95));
      }
    }
  );
  tasks.set(tempId, task);
  let watchdog: ReturnType<typeof setInterval> | null = null;
  const stalled = new Promise<never>((_, reject) => {
    watchdog = setInterval(() => {
      // Ilova fonda bo'lsa taymerlar baribir to'xtaydi; faol holatda progress kelmasa — osilgan.
      if (AppState.currentState === "active" && Date.now() - lastActivity > STALL_TIMEOUT_MS) {
        void task.cancelAsync().catch(() => {});
        reject(new UploadError("Aloqa uzildi", true));
      }
    }, 5_000);
  });
  let res: Awaited<ReturnType<typeof task.uploadAsync>>;
  try {
    res = await Promise.race([task.uploadAsync(), stalled]);
  } finally {
    if (watchdog) clearInterval(watchdog);
  }
  tasks.delete(tempId);
  if (cancelled.has(tempId)) return;
  if (!res) throw new UploadError("Yuklash to'xtatildi", true);
  if (res.status < 200 || res.status >= 300) {
    let msg = "Fayl yuklanmadi";
    try {
      msg = (JSON.parse(res.body) as { error?: string }).error || msg;
    } catch {
      /* ignore */
    }
    // 5xx / 408 / 429 — vaqtinchalik; boshqa 4xx (masalan APK, hajm) — qayta urinish befoyda.
    const retryable = res.status >= 500 || res.status === 408 || res.status === 429;
    throw new UploadError(msg, retryable);
  }
  const data = JSON.parse(res.body) as { files?: { url?: string }[]; urls?: string[] };
  const url = data.files?.[0]?.url ?? data.urls?.[0];
  if (!url) throw new Error("Server javobida fayl URL yo'q");

  await putLocalInMediaCache(url, info.localUri, info.mime).catch(() => {});
  const typ = job.forceType || messageTypeFromMime(info.mime);
  const saved = await sendMessageRequest(chatId, url, typ, {
    metadata: {
      fileName: info.name,
      originalname: info.name,
      ...(info.size ? { size: info.size } : {}),
      ...(info.width && info.height ? { width: info.width, height: info.height } : {}),
      ...(info.durationMs ? { durationMs: info.durationMs } : {}),
      ...(info.thumb ? { thumb: info.thumb } : {}),
      ...(job.caption ? { caption: job.caption } : {}),
      ...albumMeta(job.album),
      ...(job.extraMeta ?? {}),
    },
  });
  if (cancelled.has(tempId)) return;
  useChatStore.getState().replaceMessageLocally(chatId, tempId, { ...saved, localKey: tempId });
  jobs.delete(tempId);
  setProgress(tempId, null);
}

/** Yuklashni bekor qiladi va vaqtinchalik xabarni o'chiradi. */
export function cancelChatUpload(tempId: string) {
  const job = jobs.get(tempId);
  cancelled.add(tempId);
  const task = tasks.get(tempId);
  if (task) void task.cancelAsync().catch(() => {});
  tasks.delete(tempId);
  jobs.delete(tempId);
  setProgress(tempId, null);
  setFailed(tempId, null);
  if (job) useChatStore.getState().removeMessagesLocally(job.chatId, [tempId]);
}

/** Xato bo'lgan yuklashni qayta navbatga qo'yadi. */
export function retryChatUpload(tempId: string) {
  const job = jobs.get(tempId);
  if (!job) return;
  setFailed(tempId, null);
  setProgress(tempId, 0);
  schedule(job);
}

/** Bu xabar uchun yuklash ishi bormi (ilova qayta ochilganda eski vaqtinchalik xabarlar uchun yo'q). */
export function hasUploadJob(tempId: string): boolean {
  return jobs.has(tempId);
}

/** Media pufakchasi nisbati (eni/bo'yi): metadata dagi o'lchamdan, chegaralangan; yo'q bo'lsa 3:4. */
export function mediaAspect(meta?: { width?: unknown; height?: unknown } | null): number {
  const w = Number(meta?.width) || 0;
  const h = Number(meta?.height) || 0;
  if (w > 0 && h > 0) return Math.min(1.6, Math.max(0.6, w / h));
  return 3 / 4;
}

/** Barcha media pufakchalari uchun bir xil en. */
export const MEDIA_BUBBLE_WIDTH = 260;

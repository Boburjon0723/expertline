import * as FileSystem from "expo-file-system/legacy";
import { create } from "zustand";
import { API_URL } from "./config";
import { getToken } from "./auth-storage";
import { putLocalInMediaCache } from "./media-cache";
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
 * - Yuklash chat ekraniga bog'liq emas: chatdan chiqilsa ham davom etadi, iOS da fon sessiyasi
 *   (BACKGROUND) tufayli ilova fonga o'tganda ham.
 * - Fayllar ketma-ket yuklanadi (tartib saqlanadi); bekor qilish va qayta urinish mumkin.
 */

export type UploadKind = "image" | "video" | "file";

export interface UploadInfo {
  localUri: string;
  name: string;
  mime: string;
  size?: number;
  kind: UploadKind;
}

interface UploadJob {
  tempId: string;
  chatId: string;
  info: UploadInfo;
  caption?: string;
  forceType?: OutgoingMessageType;
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
let chain: Promise<void> = Promise.resolve();

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
}): string {
  const tempId = `${LOCAL_MESSAGE_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const info: UploadInfo = {
    localUri: params.uri,
    name: params.name,
    mime: params.mime,
    size: params.size,
    kind: kindFromMime(params.mime, params.forceType),
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
    metadata: { upload: info, ...(params.caption ? { caption: params.caption } : {}) },
  };
  useChatStore.getState().addMessageLocally(String(params.chatId), temp);
  const job: UploadJob = {
    tempId,
    chatId: String(params.chatId),
    info,
    caption: params.caption,
    forceType: params.forceType,
  };
  jobs.set(tempId, job);
  setProgress(tempId, 0);
  schedule(job);
  return tempId;
}

function schedule(job: UploadJob) {
  chain = chain.then(() => runJob(job)).catch(() => {});
}

async function runJob(job: UploadJob): Promise<void> {
  const { tempId, chatId, info } = job;
  if (cancelled.has(tempId)) return;
  setFailed(tempId, null);
  setProgress(tempId, 0);
  try {
    const token = await getToken();
    const task = FileSystem.createUploadTask(
      `${API_URL}/api/media/upload`,
      info.localUri,
      {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "files",
        mimeType: info.mime,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
      },
      ({ totalBytesSent, totalBytesExpectedToSend }) => {
        if (totalBytesExpectedToSend > 0) {
          // 95% gacha — qolgani server javobi va xabarni saqlash.
          setProgress(tempId, Math.min(0.95, (totalBytesSent / totalBytesExpectedToSend) * 0.95));
        }
      }
    );
    tasks.set(tempId, task);
    const res = await task.uploadAsync();
    tasks.delete(tempId);
    if (cancelled.has(tempId)) return;
    if (!res) throw new Error("Yuklash to'xtatildi");
    if (res.status < 200 || res.status >= 300) {
      let msg = "Fayl yuklanmadi";
      try {
        msg = (JSON.parse(res.body) as { error?: string }).error || msg;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
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
        ...(job.caption ? { caption: job.caption } : {}),
      },
    });
    if (cancelled.has(tempId)) return;
    const store = useChatStore.getState();
    store.removeMessagesLocally(chatId, [tempId]);
    store.addMessageLocally(chatId, saved);
    jobs.delete(tempId);
    setProgress(tempId, null);
  } catch (e) {
    tasks.delete(tempId);
    if (cancelled.has(tempId)) return;
    setProgress(tempId, null);
    setFailed(tempId, e instanceof Error ? e.message : "Fayl yuborilmadi");
  }
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

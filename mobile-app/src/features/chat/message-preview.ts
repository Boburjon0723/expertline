import type { Message } from "./types";

export type MessageKind =
  | "text"
  | "image"
  | "video"
  | "voice"
  | "audio"
  | "file"
  | "sticker"
  | "other";

export function looksLikeMediaUrl(value: string | null | undefined): boolean {
  const s = String(value || "").trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  if (s.startsWith("/") && /uploads?|media|files?/i.test(s)) return true;
  return /\.(jpg|jpeg|png|gif|webp|mp4|mov|mkv|avi|mp3|m4a|aac|wav|ogg|opus|pdf|zip|rar)(\?|$)/i.test(s);
}

export function classifyMessageKind(message: Pick<Message, "messageType" | "remoteFileUrl" | "metadata" | "text">): MessageKind {
  const typ = String(message.messageType || "").toLowerCase();
  const url = String(message.remoteFileUrl || message.text || "");
  const meta = message.metadata || {};
  if (typ === "sticker" || meta.stickerCode || meta.emoji || meta.code) return "sticker";
  if (typ === "voice") return "voice";
  if (typ === "image" || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) return "image";
  if (typ === "video" || /\.(mp4|mov|avi|mkv)(\?|$)/i.test(url)) return "video";
  if (typ === "audio" || typ === "song" || /\.(mp3|wav|m4a|aac|ogg)(\?|$)/i.test(url)) return "audio";
  if (typ === "file" || typ === "document") return "file";
  if (looksLikeMediaUrl(url) && typ !== "text") return "file";
  if (looksLikeMediaUrl(String(message.text || "")) && !typ) {
    return classifyMessageKind({ ...message, messageType: "file", remoteFileUrl: String(message.text) });
  }
  if (typ === "text" || typ === "encrypted" || !typ) {
    if (looksLikeMediaUrl(message.text) || looksLikeMediaUrl(message.remoteFileUrl)) {
      const u = String(message.remoteFileUrl || message.text || "");
      if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(u)) return "image";
      if (/\.(mp4|mov|avi|mkv)(\?|$)/i.test(u)) return "video";
      if (/\.(mp3|wav|m4a|aac|ogg)(\?|$)/i.test(u)) return "audio";
      return "file";
    }
    return "text";
  }
  return "other";
}

export function messageCaption(message: Message): string {
  const meta = message.metadata || {};
  const cap = typeof meta.caption === "string" ? meta.caption.trim() : "";
  if (cap && !looksLikeMediaUrl(cap)) return cap;
  const raw = String(message.text || "").trim();
  if (!raw || looksLikeMediaUrl(raw)) return "";
  if (message.remoteFileUrl && raw === message.remoteFileUrl) return "";
  return raw;
}

export function messageReplyPreview(
  message: Message,
  kindLabels?: Partial<Record<MessageKind, string>>
): string {
  const cap = messageCaption(message);
  if (cap) return cap;
  const kind = classifyMessageKind(message);
  const fallback: Record<MessageKind, string> = {
    text: "Xabar",
    image: "📷 Rasm",
    video: "🎬 Video",
    voice: "🎤 Ovoz",
    audio: "🎵 Musiqa",
    file: "📎 Fayl",
    sticker: "Stiker",
    other: "Xabar",
  };
  return kindLabels?.[kind] || fallback[kind];
}

export function messageCopyText(message: Message): string {
  return messageCaption(message);
}

export function sanitizeMappedText(typ: string, content: string, remoteUrl: string | null, caption?: string): string {
  const cap = String(caption || "").trim();
  if (cap && !looksLikeMediaUrl(cap)) return cap;
  const text = String(content || "").trim();
  const mediaTyp = ["image", "video", "audio", "voice", "file", "document", "sticker", "song"].includes(typ);
  if (looksLikeMediaUrl(text) || (remoteUrl && text === remoteUrl)) {
    return mediaTyp || looksLikeMediaUrl(text) ? "" : text;
  }
  return text;
}

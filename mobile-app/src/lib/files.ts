import * as Sharing from "expo-sharing";
import { getCachedMediaUri } from "./media-cache";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

function baseNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.split("/").filter(Boolean).pop();
    return path && path.length > 0 ? path : "fayl";
  } catch {
    const parts = url.split("/");
    return parts[parts.length - 1]?.split("?")[0] || "fayl";
  }
}

/**
 * Avval ExpertLine keshidan ochadi (Telegram FileLoader).
 * Yo‘q bo‘lsa bir marta yuklab keshga yozadi, keyin tizim share oynasi.
 */
export async function downloadAndOpenWithSystemSheet(
  remoteUrl: string,
  suggestedName?: string
): Promise<void> {
  const local = await getCachedMediaUri(remoteUrl, undefined, { force: true });
  const can = await Sharing.isAvailableAsync();
  if (!can) {
    throw new Error("Faylni ochish bu qurilmada qo‘llab-quvvatlanmaydi");
  }
  const name = sanitizeFileName(suggestedName || baseNameFromUrl(remoteUrl));
  await Sharing.shareAsync(local, {
    dialogTitle: "Faylni ochish",
    mimeType: guessMime(name),
  });
}

function guessMime(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  return "application/octet-stream";
}

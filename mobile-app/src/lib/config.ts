import { BACKEND_PUBLIC_ORIGIN } from "./backend-origin";

const trimmed = (process.env.EXPO_PUBLIC_API_URL || BACKEND_PUBLIC_ORIGIN).replace(/\/$/, "");

export const API_URL = trimmed;

export const WS_URL = (() => {
  try {
    const u = new URL(trimmed);
    const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProto}//${u.host}`;
  } catch {
    const u = new URL(BACKEND_PUBLIC_ORIGIN);
    return `wss://${u.host}`;
  }
})();


/** Prod sayt manzili (Vercel) — taklif havolalari shu manzilda bo'ladi */
const DEFAULT_WEB_ORIGIN = "https://messenjar-ali.vercel.app";

/**
 * Web sayt manzili (taklif havolalari va h.k. uchun). EXPO_PUBLIC_WEB_URL bilan o'zgartiriladi.
 * Lokal backend (:4000) bo'lsa — o'sha hostdagi :3000 (web dev server); aks holda prod sayt.
 */
export const WEB_URL = (() => {
  const fromEnv = (process.env.EXPO_PUBLIC_WEB_URL || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  try {
    const u = new URL(trimmed);
    if (u.port === "4000") {
      u.port = "3000";
      return u.origin;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_WEB_ORIGIN;
})();

import { io, Socket } from "socket.io-client";
import { API_URL } from "./config";
import { getToken } from "./auth-storage";
import { showLocalNotification } from "./notifications";
import { E2E_PLACEHOLDER, isE2eEnvelope } from "./e2e-envelope";
import { sameChatId } from "./livekit-call-session";

let socket: Socket | null = null;
export let currentChatId: string | null = null;
export const chatMetadataMap = new Map<string, { name: string; type: string }>();

export const setCurrentChatId = (id: string | null) => {
  currentChatId = id ? String(id) : null;
};

export const getSocket = () => socket;

function attachGlobalHandlers(s: Socket) {
  if ((s as any).__expertlineHandlersAttached) return;
  (s as any).__expertlineHandlersAttached = true;

  s.on("connect", () => {
    console.log("[Socket] Global Connected");
  });

  s.on("disconnect", () => {
    console.log("[Socket] Global Disconnected");
  });

  s.on("receive_message", (data) => {
    const msg = data.message || data;
    const chatId = msg.chatId || msg.chat_id || msg.roomId || msg.room_id;
    if (!chatId) return;

    // Shu chat ochiq bo‘lsa local notification chiqmasin (case-insensitive)
    if (sameChatId(currentChatId, chatId)) return;

    const senderName = msg.sender?.name || msg.sender?.username || "Yangi xabar";
    const meta = chatMetadataMap.get(String(chatId)) || chatMetadataMap.get(String(chatId).toLowerCase());
    let title = senderName;

    if (meta && (meta.type === "group" || meta.type === "channel")) {
      title = `${meta.name} - ${senderName.split(" ")[0]}`;
    } else if (meta && meta.name) {
      title = meta.name;
    }

    const text = isE2eEnvelope(msg.metadata)
      ? E2E_PLACEHOLDER
      : msg.text || msg.content || "📎 Tasvir/Fayl keldi";
    showLocalNotification(title, text, "chat", { chatId, type: meta?.type });
  });

  s.on("balance_updated", (data) => {
    showLocalNotification("Hamyon 💰", "Sizning hisobingizda o'zgarishlar mavjud", "wallet", data);
  });

  s.on("new_notification", (data) => {
    const title = data.title || "Bildirishnoma 🔔";
    const body = data.body || data.message || "Sizga yangi xabar keldi";
    const payload =
      typeof data?.data === "string"
        ? (() => {
            try {
              return JSON.parse(data.data);
            } catch {
              return {};
            }
          })()
        : data?.data && typeof data.data === "object"
          ? data.data
          : data;
    const chatId = payload?.chatId ?? payload?.chat_id ?? data?.chatId ?? data?.chat_id;
    const type = String(data?.type || "");
    const channel =
      chatId || /murojaat|application|listing|session|chat/i.test(type) ? "chat" : "default";
    showLocalNotification(title, body, channel, { ...(payload || {}), chatId, type });
  });
}

export const connectSocket = async () => {
  const token = await getToken();
  if (!token) return null;

  if (socket) {
    (socket as any).auth = { token };
    if (!socket.connected) socket.connect();
    attachGlobalHandlers(socket);
    return socket;
  }

  socket = io(API_URL, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });
  attachGlobalHandlers(socket);
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

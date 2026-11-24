import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Chat, Message } from "../features/chat/types";
import { getChatsRequest, getMessagesRequest } from "../features/chat/service";
import {
  readChatsFromCache,
  readMessagesFromCache,
  writeChatsToCache,
  writeMessagesToCache,
} from "../lib/app-cache";

interface ChatState {
  chats: Chat[];
  messages: Record<string, Message[]>;
  isLoadingChats: boolean;

  loadChats: () => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;

  addMessageLocally: (chatId: string, message: Message) => void;
  updateMessageLocally: (chatId: string, messageId: string, updates: Partial<Message>) => void;
  removeMessagesLocally: (chatId: string, messageIds: string[]) => void;
  clearMessagesLocally: (chatId: string) => void;
  removeChatLocally: (chatId: string) => void;
  updateChatLocally: (chatId: string, updates: Partial<Chat>) => void;
}

const LEGACY_CHATS = "@expertline_chats";
const legacyMessagesKey = (chatId: string) => `@expertline_messages_${chatId}`;

/** Yuklanayotgan media uchun vaqtinchalik xabar (lib/upload-queue). Keshga yozilmaydi. */
const isLocalUpload = (m: Message) => String(m.id).startsWith("local_");

async function persistMessages(chatId: string, all: Message[]) {
  const messages = all.filter((m) => !isLocalUpload(m));
  await writeMessagesToCache(chatId, messages);
  try {
    await AsyncStorage.setItem(legacyMessagesKey(chatId), JSON.stringify(messages));
  } catch {
    /* ignore */
  }
}

async function hydrateMessages(chatId: string): Promise<Message[] | null> {
  const fromApp = await readMessagesFromCache(chatId);
  if (fromApp?.length) return fromApp;
  try {
    const raw = await AsyncStorage.getItem(legacyMessagesKey(chatId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Message[];
    if (!Array.isArray(parsed) || !parsed.length) return null;
    await writeMessagesToCache(chatId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

async function hydrateChats(): Promise<Chat[] | null> {
  const fromApp = await readChatsFromCache();
  if (fromApp?.length) return fromApp;
  try {
    const raw = await AsyncStorage.getItem(LEGACY_CHATS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Chat[];
    if (!Array.isArray(parsed) || !parsed.length) return null;
    await writeChatsToCache(parsed);
    return parsed;
  } catch {
    return null;
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  messages: {},
  isLoadingChats: true,

  loadChats: async () => {
    if (!get().chats.length) {
      const cached = await hydrateChats();
      if (cached?.length) {
        set({ chats: cached, isLoadingChats: false });
      }
    } else {
      set({ isLoadingChats: false });
    }

    try {
      if (!get().chats.length) set({ isLoadingChats: true });
      const serverChats = await getChatsRequest();
      set({ chats: serverChats, isLoadingChats: false });
      await writeChatsToCache(serverChats);
      await AsyncStorage.setItem(LEGACY_CHATS, JSON.stringify(serverChats));
    } catch (error) {
      console.warn("Chats sync failed (Offline mode active):", error);
      set({ isLoadingChats: false });
    }
  },

  loadMessages: async (chatId: string) => {
    const id = String(chatId || "");
    if (!id) return;

    const inMem = get().messages[id];
    if (!inMem?.length) {
      const cached = await hydrateMessages(id);
      if (cached?.length) {
        set((state) => ({
          messages: { ...state.messages, [id]: cached },
        }));
      }
    }

    try {
      const serverMessages = await getMessagesRequest(id);
      set((state) => {
        // Hali yuklanayotgan media xabarlari server ro'yxatida yo'q — ularni saqlab qolamiz.
        const pending = (state.messages[id] || []).filter(isLocalUpload);
        return { messages: { ...state.messages, [id]: [...serverMessages, ...pending] } };
      });
      await persistMessages(id, serverMessages);
    } catch (error) {
      console.warn(`Messages sync failed for ${id} (Offline mode active):`, error);
    }
  },

  addMessageLocally: (chatId, message) => {
    const id = String(chatId);
    set((state) => {
      const current = state.messages[id] || [];
      if (current.some((m) => m.id === message.id)) return state;

      const newMessages = [...current, message];
      void persistMessages(id, newMessages);

      return {
        messages: { ...state.messages, [id]: newMessages },
      };
    });
  },

  updateMessageLocally: (chatId, messageId, updates) => {
    const id = String(chatId);
    set((state) => {
      const current = state.messages[id] || [];
      const newMessages = current.map((m) =>
        m.id === messageId ? { ...m, ...updates } : m
      );
      void persistMessages(id, newMessages);
      return { messages: { ...state.messages, [id]: newMessages } };
    });
  },

  removeMessagesLocally: (chatId, messageIds) => {
    const id = String(chatId);
    const idSet = new Set(messageIds.map(String));
    set((state) => {
      const current = state.messages[id] || [];
      const newMessages = current.filter((m) => !idSet.has(String(m.id)));
      void persistMessages(id, newMessages);
      return { messages: { ...state.messages, [id]: newMessages } };
    });
  },

  clearMessagesLocally: (chatId) => {
    const id = String(chatId);
    set((state) => {
      void persistMessages(id, []);
      return { messages: { ...state.messages, [id]: [] } };
    });
  },

  removeChatLocally: (chatId) => {
    const id = String(chatId);
    set((state) => {
      const nextMessages = { ...state.messages };
      delete nextMessages[id];
      AsyncStorage.removeItem(legacyMessagesKey(id)).catch(() => {});
      void writeMessagesToCache(id, []);
      const newChats = state.chats.filter((c) => String(c.id) !== id);
      void writeChatsToCache(newChats);
      AsyncStorage.setItem(LEGACY_CHATS, JSON.stringify(newChats)).catch(() => {});
      return { chats: newChats, messages: nextMessages };
    });
  },

  updateChatLocally: (chatId, updates) => {
    const id = String(chatId);
    set((state) => {
      const newChats = state.chats.map((c) =>
        String(c.id) === id ? { ...c, ...updates } : c
      );
      void writeChatsToCache(newChats);
      return { chats: newChats };
    });
  },
}));

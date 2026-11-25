import React, { useCallback, useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  StatusBar,
  Alert,
  Platform,
  ActionSheetIOS,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Briefcase,
  MessageSquare,
  Search,
  Users,
  Bookmark,
  Pin,
  X,
  Circle,
  CheckCircle,
  BellOff,
  Archive,
  CheckCheck,
  Trash2,
  UserPlus,
  Megaphone,
} from "lucide-react-native";
import { Chat } from "../types";
import { ChatBackground } from "../../../components/ChatBackground";
import { useAuthStore } from "../../auth/store";
import { normalizeUserId } from "../service";
import { palette } from "../../../lib/theme";

/** Ro'yxat vaqti: bugun — soat, shu hafta — hafta kuni, aks holda kun.oy */
function chatListTimeLabel(iso?: string | null, fallback?: string): string {
  if (!iso) return fallback || "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback || "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (days < 6) return ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"][d.getDay()];
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}
import { ContactsView } from "./DashboardViews";
import { ExpertsView } from "../../market/ExpertsView";
import { SettingsScreen } from "./SettingsScreen";
import { ChatSongMiniBar } from "../components/ChatSongMiniBar";
import {
  CHAT_CATEGORY_ITEMS,
  HEADER_RIGHT_ACTIONS,
  getMenuIcon,
  getVisibleComposeMenuItems,
  type ComposeActionId,
} from "../chat-shell-menu";
import { AvatarImage } from "../../../components/AvatarImage";
import { getSocket, chatMetadataMap } from "../../../lib/socket";
import { E2E_PLACEHOLDER, isE2eEnvelope } from "../../../lib/e2e-envelope";
import { decryptListPreview } from "../../../lib/e2e-chat";
import {
  openSavedMessagesRequest,
  updateChatPrefsRequest,
  deleteChatRequest,
  getContactsRequest,
  createOrOpenPrivateChat,
  createGroupOrChannelRequest,
  getFullUrl,
  type ContactRow,
} from "../service";
import PagerView from "react-native-pager-view";
import { useChatStore } from "../../../store/chatStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthLocale } from "../../auth/locale";
import { ListingsFeed } from "../../market/ListingsFeed";
import { SearchSuggestions } from "../../market/SearchSuggestions";
import { addSearchHistory, type ListingSubType } from "../../market/api";

const ICON_MD = 24;

function categoryMatchesChat(categoryId: string, chat: Chat): boolean {
  if (categoryId === "archive") return !!chat.archived;
  if (chat.archived) return false;
  if (categoryId === "all") return true;
  if (categoryId === "listings") return false;
  if (categoryId === "requests") return !!chat.listing;
  const t = (chat.type || "").toLowerCase();
  switch (categoryId) {
    case "user":
      // E'lon orqali kelganlar "Murojaatlar" da — shaxsiy suhbatlar bilan aralashmasin
      if (chat.listing) return false;
      return !t || t === "private" || t === "user" || t === "direct";
    case "group":
      return t === "group";
    case "channel":
      return t === "channel";
    default:
      return true;
  }
}

function sortChats(list: Chat[]): Chat[] {
  return [...list].sort((a, b) => {
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return 0;
  });
}

function ChatListAvatar({ item }: { item: Chat }) {
  if (item.is_saved_messages) {
    return (
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: "#2AABEE",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Bookmark color="#fff" size={24} fill="#fff" />
      </View>
    );
  }
  return <AvatarImage uri={item.avatarUrl} name={item.name} size={50} />;
}

const BOTTOM_TABS: {
  id: "chats" | "contacts" | "services";
  labelKey: "tabChats" | "tabContacts" | "tabExperts";
  icon: (active: boolean) => React.ReactNode;
}[] = [
  {
    id: "chats",
    labelKey: "tabChats",
    icon: (active) => <MessageSquare color={active ? "#fff" : "rgba(255,255,255,0.4)"} size={ICON_MD} />,
  },
  {
    id: "contacts",
    labelKey: "tabContacts",
    icon: (active) => <Users color={active ? "#fff" : "rgba(255,255,255,0.4)"} size={ICON_MD} />,
  },
  {
    id: "services",
    labelKey: "tabExperts",
    icon: (active) => <Briefcase color={active ? "#fff" : "rgba(255,255,255,0.4)"} size={ICON_MD} />,
  },
];

export function ChatListScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((s) => s.user);
  const myUserId = normalizeUserId(
    (currentUser as { id?: string; _id?: string } | null)?.id ??
      (currentUser as { _id?: string } | null)?._id
  );
  const [bottomTab, setBottomTab] = useState<"chats" | "contacts" | "services" | "settings">("chats");

  const { chats, loadChats, isLoadingChats, updateChatLocally, removeChatLocally } = useChatStore();
  const { t } = useAuthLocale();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchHistoryVersion, setSearchHistoryVersion] = useState(0);
  const [listingSubType, setListingSubType] = useState<ListingSubType>("employer");
  const [contactHits, setContactHits] = useState<ContactRow[]>([]);
  const [typingByChat, setTypingByChat] = useState<Record<string, boolean>>({});
  const [draftsByChat, setDraftsByChat] = useState<Record<string, string>>({});
  const [createModal, setCreateModal] = useState<null | { type: "group" | "channel" }>(null);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [isBulkSelecting, setIsBulkSelecting] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const useCategoryPager = searchQuery.trim().length === 0;
  const [pageIndex, setPageIndex] = useState(0);
  const pagerRef = useRef<PagerView>(null);
  const categoryNavScrollRef = useRef<ScrollView>(null);
  const chipLayoutsRef = useRef<Array<{ x: number; width: number }>>([]);
  const [categoryStripWidth, setCategoryStripWidth] = useState(0);
  const [categoryContentWidth, setCategoryContentWidth] = useState(0);
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const isExpert =
    !!(currentUser as { is_expert?: boolean; isExpert?: boolean } | null)?.is_expert ||
    (currentUser as { isExpert?: boolean; role?: string } | null)?.isExpert === true ||
    (currentUser as { role?: string } | null)?.role === "expert";

  const chatsForCategory = useCallback(
    (catId: string) => sortChats(chats.filter((c) => categoryMatchesChat(catId, c))),
    [chats]
  );

  /** "Murojaatlar" tabi faqat e'lon orqali kelgan chat bo'lsa ko'rinadi */
  const hasListingChats = chats.some((c) => !!c.listing && !c.archived);
  const categoryItems = useMemo(
    () => CHAT_CATEGORY_ITEMS.filter((c) => c.id !== "requests" || hasListingChats),
    [hasListingChats]
  );

  /** ✎ tugmasi ostidagi "Yangi chat" menyusi */
  const [composeMenuOpen, setComposeMenuOpen] = useState(false);

  /** Papka tablaridagi son — o'qilmagan xabari bor chatlar soni (web kabi; ovozsiz chatlar sanalmaydi) */
  const unreadByCategory = useMemo(() => {
    const out: Record<string, number> = {};
    for (const cat of categoryItems) {
      if (cat.id === "listings") continue;
      out[cat.id] = chats.filter(
        (c) => (c.unreadCount || 0) > 0 && !(c as { muted?: boolean }).muted && categoryMatchesChat(cat.id, c)
      ).length;
    }
    return out;
  }, [chats, categoryItems]);

  /** Qaysi papka ochiq bo'lsa — qidiruv o'sha papkaga oid */
  const activeCategoryId = categoryItems[pageIndex]?.id ?? "all";
  const isListingsPage = activeCategoryId === "listings";

  const searchFilteredChats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const inFolder = chats.filter((c) => categoryMatchesChat(activeCategoryId, c));
    if (!q) return sortChats(inFolder);
    return sortChats(
      inFolder.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.lastMessage || "").toLowerCase().includes(q)
      )
    );
  }, [chats, searchQuery, activeCategoryId]);

  useFocusEffect(
    useCallback(() => {
      loadChats().then(() => {
        const socket = getSocket();
        if (socket) {
          chats.forEach((c) => {
            socket.emit("join_room", c.id);
            chatMetadataMap.set(String(c.id), { name: c.name, type: c.type || "private" });
          });
        }
      });
      void (async () => {
        try {
          const keys = await AsyncStorage.getAllKeys();
          const draftKeys = keys.filter((k) => k.startsWith("@expertline_draft_"));
          if (!draftKeys.length) {
            setDraftsByChat({});
            return;
          }
          const pairs = await AsyncStorage.multiGet(draftKeys);
          const next: Record<string, string> = {};
          for (const [key, val] of pairs) {
            if (!val?.trim()) continue;
            const id = key.replace("@expertline_draft_", "");
            next[id] = val.trim();
          }
          setDraftsByChat(next);
        } catch {
          /* ignore */
        }
      })();
    }, [loadChats, chats.length])
  );

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleReceive = (data: any) => {
      const msg = data.message || data;
      const chatId = msg.chatId || msg.chat_id;
      if (!chatId) return;

      const chat = chats.find((c) => String(c.id) === String(chatId));
      if (chat) {
        let text = msg.text || msg.content || "📎 Rasm/Fayl";
        if (isE2eEnvelope(msg.metadata)) {
          text = E2E_PLACEHOLDER;
          void decryptListPreview(String(msg.content || ""), msg.metadata, E2E_PLACEHOLDER).then((plain) => {
            updateChatLocally(chatId, { lastMessage: plain });
          });
        } else if (text === "📎 Fayl" || text === "📎 Rasm/Fayl") text = t("msgFile");
        else if (text === "📷 Rasm") text = t("msgPhoto");
        else if (text === "🎤 Ovozli xabar") text = t("msgVoice");

        updateChatLocally(chatId, {
          lastMessage: text,
          unreadCount: (chat.unreadCount || 0) + 1,
        });
      } else {
        loadChats();
      }
    };

    socket.on("receive_message", handleReceive);
    return () => {
      socket.off("receive_message", handleReceive);
    };
  }, [loadChats, chats, t, updateChatLocally]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const clearTyping = (roomId: string) => {
      setTypingByChat((prev) => {
        if (!prev[roomId]) return prev;
        const next = { ...prev };
        delete next[roomId];
        return next;
      });
    };

    const handleTyping = (data: { senderId?: string; roomId?: string; chatId?: string } | string) => {
      const roomId =
        typeof data === "string"
          ? String(data)
          : String(data?.roomId || data?.chatId || "").trim();
      if (!roomId) return;
      setTypingByChat((prev) => ({ ...prev, [roomId]: true }));
      const prevTimer = typingTimersRef.current.get(roomId);
      if (prevTimer) clearTimeout(prevTimer);
      typingTimersRef.current.set(
        roomId,
        setTimeout(() => clearTyping(roomId), 4000)
      );
    };

    const handleStopTyping = (data: { roomId?: string; chatId?: string } | string) => {
      const roomId =
        typeof data === "string"
          ? String(data)
          : String(data?.roomId || data?.chatId || "").trim();
      if (!roomId) return;
      const prevTimer = typingTimersRef.current.get(roomId);
      if (prevTimer) clearTimeout(prevTimer);
      typingTimersRef.current.delete(roomId);
      clearTyping(roomId);
    };

    socket.on("typing", handleTyping);
    socket.on("stop_typing", handleStopTyping);
    return () => {
      socket.off("typing", handleTyping);
      socket.off("stop_typing", handleStopTyping);
      typingTimersRef.current.forEach((tm) => clearTimeout(tm));
      typingTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setContactHits([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void getContactsRequest()
        .then((list) => {
          if (cancelled) return;
          const ql = q.toLowerCase();
          setContactHits(
            list
              .filter(
                (c) =>
                  (c.name || "").toLowerCase().includes(ql) ||
                  (c.phone || "").toLowerCase().includes(ql)
              )
              .slice(0, 20)
          );
        })
        .catch(() => {
          if (!cancelled) setContactHits([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const goToCategoryPage = useCallback((index: number) => {
    const safe = Math.max(0, Math.min(categoryItems.length - 1, index));
    setPageIndex(safe);
    pagerRef.current?.setPage(safe);
  }, [categoryItems.length]);

  // Tab paydo bo'lsa/yo'qolsa indekslar siljiydi — ochiq papka o'zgarmasin
  const activeCatIdRef = useRef("all");
  const prevCategoryItemsRef = useRef(categoryItems);
  useEffect(() => {
    const prev = prevCategoryItemsRef.current;
    prevCategoryItemsRef.current = categoryItems;
    if (prev === categoryItems) return;
    const id = prev[pageIndex]?.id ?? activeCatIdRef.current;
    const next = Math.max(0, categoryItems.findIndex((c) => c.id === id));
    if (next !== pageIndex) {
      setPageIndex(next);
      pagerRef.current?.setPageWithoutAnimation(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryItems]);
  activeCatIdRef.current = categoryItems[pageIndex]?.id ?? "all";

  const scrollCategoryNavToIndex = useCallback(
    (index: number) => {
      const scroll = categoryNavScrollRef.current;
      const chip = chipLayoutsRef.current[index];
      const vw = categoryStripWidth;
      if (!scroll || !chip || vw <= 0) return;
      const center = chip.x + chip.width / 2;
      let targetX = center - vw / 2;
      const maxX = Math.max(0, categoryContentWidth - vw);
      targetX = Math.max(0, Math.min(maxX, targetX));
      scroll.scrollTo({ x: targetX, animated: true });
    },
    [categoryStripWidth, categoryContentWidth]
  );

  useLayoutEffect(() => {
    if (!useCategoryPager) return;
    let inner: number | undefined;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => scrollCategoryNavToIndex(pageIndex));
    });
    return () => {
      cancelAnimationFrame(outer);
      if (inner !== undefined) cancelAnimationFrame(inner);
    };
  }, [pageIndex, useCategoryPager, scrollCategoryNavToIndex, categoryStripWidth, categoryContentWidth]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadChats().finally(() => setRefreshing(false));
  }, [loadChats]);

  const applyChatPrefs = useCallback(
    async (
      chat: Chat,
      prefs: {
        muted?: boolean;
        pinned?: boolean;
        archived?: boolean;
        unreadMarked?: boolean;
      }
    ) => {
      try {
        const next = await updateChatPrefsRequest(chat.id, prefs);
        updateChatLocally(chat.id, {
          muted: next.muted,
          pinned: next.pinned,
          archived: next.archived,
          ...(prefs.unreadMarked === true
            ? { unreadCount: Math.max(1, chat.unreadCount || 0) }
            : prefs.unreadMarked === false
              ? { unreadCount: 0 }
              : {}),
        });
      } catch (e: any) {
        Alert.alert(t("composeChatTitle"), e?.message || t("loginErrorGeneric"));
      }
    },
    [t, updateChatLocally]
  );

  const exitBulkSelecting = useCallback(() => {
    setIsBulkSelecting(false);
    setSelectedChatIds([]);
    setBulkBusy(false);
  }, []);

  const toggleChatSelected = useCallback((chatId: string) => {
    setSelectedChatIds((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]
    );
  }, []);

  const selectedChats = useMemo(
    () => chats.filter((c) => selectedChatIds.includes(c.id)),
    [chats, selectedChatIds]
  );

  const runBulkPrefs = useCallback(
    async (prefs: { muted?: boolean; archived?: boolean; unreadMarked?: boolean }) => {
      if (selectedChats.length === 0 || bulkBusy) return;
      setBulkBusy(true);
      try {
        await Promise.all(
          selectedChats.map(async (chat) => {
            const nextPrefs =
              prefs.archived === true ? { ...prefs, pinned: false as const } : prefs;
            const next = await updateChatPrefsRequest(chat.id, nextPrefs);
            updateChatLocally(chat.id, {
              muted: next.muted,
              pinned: next.pinned,
              archived: next.archived,
              ...(prefs.unreadMarked === true
                ? { unreadCount: Math.max(1, chat.unreadCount || 0) }
                : prefs.unreadMarked === false
                  ? { unreadCount: 0 }
                  : {}),
            });
          })
        );
        exitBulkSelecting();
      } catch (e: any) {
        Alert.alert(t("composeChatTitle"), e?.message || t("loginErrorGeneric"));
      } finally {
        setBulkBusy(false);
      }
    },
    [bulkBusy, exitBulkSelecting, selectedChats, t, updateChatLocally]
  );

  const runBulkDelete = useCallback(() => {
    if (selectedChats.length === 0 || bulkBusy) return;
    const deletable = selectedChats.filter((c) => !c.is_saved_messages);
    if (deletable.length === 0) {
      Alert.alert(t("msgDelete"), t("loginErrorGeneric"));
      return;
    }
    Alert.alert(t("msgDelete"), `${deletable.length} ${t("chatSelectedCount")}`, [
      { text: t("msgCancel"), style: "cancel" },
      {
        text: t("msgDelete"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBulkBusy(true);
            try {
              await Promise.all(
                deletable.map(async (chat) => {
                  await deleteChatRequest(chat.id);
                  removeChatLocally(chat.id);
                })
              );
              exitBulkSelecting();
            } catch (e: any) {
              Alert.alert(t("msgDelete"), e?.message || t("loginErrorGeneric"));
            } finally {
              setBulkBusy(false);
            }
          })();
        },
      },
    ]);
  }, [bulkBusy, exitBulkSelecting, removeChatLocally, selectedChats, t]);

  const onChatLongPress = useCallback(
    (chat: Chat) => {
      if (isBulkSelecting) {
        toggleChatSelected(chat.id);
        return;
      }

      const cancelLabel = t("msgCancel");
      const options = [
        chat.pinned ? t("chatUnpin") : t("chatPin"),
        chat.muted ? t("chatUnmute") : t("chatMute"),
        chat.archived ? t("chatUnarchive") : t("chatArchive"),
        t("chatMarkUnread"),
        cancelLabel,
      ];
      const cancelButtonIndex = options.length - 1;

      const run = (index: number) => {
        if (index < 0 || index === cancelButtonIndex) return;
        if (index === 0) void applyChatPrefs(chat, { pinned: !chat.pinned });
        else if (index === 1) void applyChatPrefs(chat, { muted: !chat.muted });
        else if (index === 2) {
          const archived = !chat.archived;
          void applyChatPrefs(chat, {
            archived,
            ...(archived ? { pinned: false } : {}),
          });
        } else if (index === 3) void applyChatPrefs(chat, { unreadMarked: true });
      };

      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          { options, cancelButtonIndex },
          (buttonIndex) => run(buttonIndex)
        );
        return;
      }

      Alert.alert(
        chat.is_saved_messages ? t("savedMessages") : chat.name,
        undefined,
        [
          { text: options[0], onPress: () => run(0) },
          { text: options[1], onPress: () => run(1) },
          { text: options[2], onPress: () => run(2) },
          { text: options[3], onPress: () => run(3) },
          { text: cancelLabel, style: "cancel" },
        ]
      );
    },
    [applyChatPrefs, isBulkSelecting, t, toggleChatSelected]
  );

  const openChat = useCallback(
    (item: Chat) => {
      if (isBulkSelecting) {
        toggleChatSelected(item.id);
        return;
      }
      if (searchQuery.trim().length >= 2) {
        void addSearchHistory("chats", searchQuery).then(() => setSearchHistoryVersion((v) => v + 1));
      }
      navigation.navigate("ChatDetail", {
        chatId: item.id,
        name: item.is_saved_messages ? t("savedMessages") : item.name,
        avatarUrl: item.avatarUrl ?? null,
      });
    },
    [isBulkSelecting, navigation, t, toggleChatSelected, searchQuery]
  );

  const openContactChat = useCallback(
    async (contact: ContactRow) => {
      try {
        const opened = await createOrOpenPrivateChat(contact.id);
        await loadChats();
        navigation.navigate("ChatDetail", {
          chatId: opened.chatId,
          name: opened.name || contact.name,
          avatarUrl: opened.avatarUrl ?? null,
        });
      } catch (e: any) {
        Alert.alert(t("searchContactsSection"), e?.message || t("loginErrorGeneric"));
      }
    },
    [loadChats, navigation, t]
  );

  const submitCreateChat = useCallback(async () => {
    if (!createModal) return;
    const name = createName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await createGroupOrChannelRequest({
        type: createModal.type,
        name,
      });
      setCreateModal(null);
      setCreateName("");
      await loadChats();
      navigation.navigate("ChatDetail", {
        chatId: created.id,
        name: created.name,
        avatarUrl: null,
      });
    } catch (e: any) {
      Alert.alert(
        createModal.type === "group" ? t("menuNewGroup") : t("menuNewChannel"),
        e?.message || t("loginErrorGeneric")
      );
    } finally {
      setCreating(false);
    }
  }, [createModal, createName, loadChats, navigation, t]);

  const onComposeAction = useCallback(
    (actionId: ComposeActionId) => {
      switch (actionId) {
        case "new_contact":
          setBottomTab("contacts");
          return;
        case "new_group":
          setCreateName("");
          setCreateModal({ type: "group" });
          return;
        case "new_channel":
          setCreateName("");
          setCreateModal({ type: "channel" });
          return;
        case "bulk_select":
          setSelectedChatIds([]);
          setIsBulkSelecting(true);
          return;
        default:
          return;
      }
    },
    []
  );

  const openSavedMessages = useCallback(async () => {
    try {
      const opened = await openSavedMessagesRequest();
      await loadChats();
      navigation.navigate("ChatDetail", {
        chatId: opened.chatId,
        name: t("savedMessages"),
        avatarUrl: null,
      });
    } catch (e: any) {
      Alert.alert(t("savedMessages"), e?.message || t("loginErrorGeneric"));
    }
  }, [loadChats, navigation, t]);

  const onHeaderAction = useCallback(
    (id: string) => {
      if (id === "compose") {
        if (getVisibleComposeMenuItems({ isExpert }).length === 0) return;
        setComposeMenuOpen(true);
        return;
      }
      if (id === "expert_tools") {
        setBottomTab("services");
      }
    },
    [isExpert, onComposeAction, t]
  );

  const renderChatRow = useCallback(
    ({ item }: { item: Chat }) => {
      const isTyping = !!typingByChat[String(item.id)];
      const draft = draftsByChat[String(item.id)];
      const selected = selectedChatIds.includes(item.id);
      const preview = isTyping
        ? t("typingStatus")
        : draft
          ? `✏️ ${draft}`
          : item.lastMessage === "Xabarlar yo'q"
          ? t("msgNoMessages")
          : item.lastMessage === "📷 Rasm"
            ? t("msgPhoto")
            : item.lastMessage === "🎤 Ovozli xabar"
              ? t("msgVoice")
              : item.lastMessage === "📎 Fayl" || item.lastMessage === "📎 Rasm/Fayl"
                ? t("msgFile")
                : item.lastMessage;

      return (
        <Pressable
          style={[
            styles.chatItem,
            item.muted && styles.chatItemMuted,
            isBulkSelecting && selected && styles.chatItemSelected,
          ]}
          onPress={() => openChat(item)}
          onLongPress={() => onChatLongPress(item)}
          delayLongPress={350}
        >
          {isBulkSelecting ? (
            <View style={styles.selectCheckWrap}>
              {selected ? (
                <CheckCircle color={palette.accent} size={22} />
              ) : (
                <Circle color="rgba(255,255,255,0.45)" size={22} />
              )}
            </View>
          ) : null}
          <ChatListAvatar item={item} />
          <View style={styles.chatInfo}>
            <View style={styles.chatInfoHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 }}>
                {item.pinned ? <Pin color="#94a3b8" size={12} style={{ marginRight: 4 }} /> : null}
                <Text style={[styles.chatName, item.muted && styles.chatNameMuted]} numberOfLines={1}>
                  {item.is_saved_messages ? t("savedMessages") : item.name}
                </Text>
                {item.type === "group" && <Text style={styles.chatTypeLabel}>{t("chatGroupLabel")}</Text>}
                {item.type === "channel" && (
                  <Text style={styles.chatTypeLabel}>{t("chatChannelLabel")}</Text>
                )}
              </View>
              {/* Telegram: o'ngda vaqt (bugun — soat, aks holda sana), o'z xabarim bo'lsa ✓ / ✓✓ */}
              {!isBulkSelecting ? (
                <View style={styles.chatMetaRight}>
                  {item.lastSenderId && normalizeUserId(item.lastSenderId) === myUserId ? (
                    <Text style={[styles.chatTicks, item.lastMessageIsRead && styles.chatTicksRead]}>
                      {item.lastMessageIsRead ? "✓✓" : "✓"}
                    </Text>
                  ) : null}
                  <Text style={styles.chatTime}>{chatListTimeLabel(item.lastMessageAt, item.timestamp)}</Text>
                </View>
              ) : null}
            </View>
            {item.listing?.title ? (
              <Text style={styles.chatListingLine} numberOfLines={1}>
                📋 {item.listing.title}
              </Text>
            ) : null}
            <View style={styles.chatMsgRow}>
              <Text
                style={[
                  styles.chatMsg,
                  { flex: 1 },
                  (isTyping || !!draft) && styles.chatMsgTyping,
                  item.muted && styles.chatMsgMuted,
                ]}
                numberOfLines={1}
              >
                {preview}
              </Text>
              {!isBulkSelecting && item.unreadCount > 0 && (
                <View style={[styles.unreadBadge, item.muted && styles.unreadBadgeMuted]}>
                  <Text style={styles.unreadText}>{item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      );
    },
    [isBulkSelecting, onChatLongPress, openChat, selectedChatIds, t, typingByChat, draftsByChat, myUserId]
  );

  const searchListHeader =
    contactHits.length > 0 && (activeCategoryId === "all" || activeCategoryId === "user") ? (
      <View style={styles.contactsSection}>
        <Text style={styles.sectionTitle}>{t("searchContactsSection")}</Text>
        {contactHits.map((c) => (
          <Pressable key={c.id} style={styles.chatItem} onPress={() => void openContactChat(c)}>
            <AvatarImage uri={getFullUrl(c.avatar) || c.avatar} name={c.name} size={50} />
            <View style={styles.chatInfo}>
              <Text style={styles.chatName} numberOfLines={1}>
                {c.name}
              </Text>
              {c.phone ? (
                <Text style={styles.chatMsg} numberOfLines={1}>
                  {c.phone}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
        {searchFilteredChats.length > 0 ? (
          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>{t("tabChats")}</Text>
        ) : null}
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent />
      <ChatBackground>
        <View
          style={[styles.mainContent, bottomTab !== "chats" && { paddingTop: insets.top + 8 }]}
        >
          {bottomTab === "chats" ? (
            <View style={styles.chatsTab}>
              <View style={[styles.chatsTop, { paddingTop: insets.top + 10 }]}>
                {isBulkSelecting ? (
                  <View style={styles.bulkHeaderRow}>
                    <Pressable
                      onPress={exitBulkSelecting}
                      style={styles.headerIconBtn}
                      accessibilityLabel={t("msgCancel")}
                      disabled={bulkBusy}
                    >
                      <X color="#fff" size={22} />
                    </Pressable>
                    <Text style={styles.bulkCountText} numberOfLines={1}>
                      {selectedChatIds.length} {t("chatSelectedCount")}
                    </Text>
                    <Pressable
                      style={[
                        styles.headerIconBtn,
                        (selectedChatIds.length === 0 || bulkBusy) && { opacity: 0.4 },
                      ]}
                      disabled={selectedChatIds.length === 0 || bulkBusy}
                      onPress={() => void runBulkPrefs({ muted: true })}
                      accessibilityLabel={t("chatMute")}
                    >
                      <BellOff color="#fff" size={20} />
                    </Pressable>
                    <Pressable
                      style={[
                        styles.headerIconBtn,
                        (selectedChatIds.length === 0 || bulkBusy) && { opacity: 0.4 },
                      ]}
                      disabled={selectedChatIds.length === 0 || bulkBusy}
                      onPress={() => void runBulkPrefs({ archived: true })}
                      accessibilityLabel={t("chatArchive")}
                    >
                      <Archive color="#fff" size={20} />
                    </Pressable>
                    <Pressable
                      style={[
                        styles.headerIconBtn,
                        (selectedChatIds.length === 0 || bulkBusy) && { opacity: 0.4 },
                      ]}
                      disabled={selectedChatIds.length === 0 || bulkBusy}
                      onPress={() => void runBulkPrefs({ unreadMarked: false })}
                      accessibilityLabel="Mark read"
                    >
                      <CheckCheck color="#fff" size={20} />
                    </Pressable>
                    <Pressable
                      style={[
                        styles.headerIconBtn,
                        (selectedChatIds.length === 0 || bulkBusy) && { opacity: 0.4 },
                      ]}
                      disabled={selectedChatIds.length === 0 || bulkBusy}
                      onPress={runBulkDelete}
                      accessibilityLabel={t("msgDelete")}
                    >
                      <Trash2 color={palette.danger} size={20} />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.searchRow}>
                    <Pressable
                      onPress={() => onComposeAction("bulk_select")}
                      style={styles.headerEditBtn}
                      accessibilityLabel={t("msgEdit")}
                    >
                      <Text style={styles.headerEditText}>{t("headerEdit")}</Text>
                    </Pressable>
                    <View style={styles.searchBox}>
                      <Search color="rgba(255,255,255,0.45)" size={18} />
                      <TextInput
                        placeholder={isListingsPage ? t("searchListingsPh") : t("searchChatsPh")}
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                        returnKeyType="search"
                      />
                    </View>
                    {HEADER_RIGHT_ACTIONS.filter((a) => a.visible({ isExpert })).map((action) => {
                      const Icon = getMenuIcon(action.icon);
                      return (
                        <Pressable
                          key={action.id}
                          onPress={() => onHeaderAction(action.id)}
                          style={styles.headerIconBtn}
                          accessibilityLabel={action.accessibilityLabel}
                        >
                          <Icon color="#fff" size={22} />
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                {searchFocused && (isListingsPage || !searchQuery.trim()) ? (
                  <SearchSuggestions
                    scope={isListingsPage ? "listings" : "chats"}
                    subType={isListingsPage ? listingSubType : undefined}
                    query={searchQuery}
                    historyVersion={searchHistoryVersion}
                    onPick={setSearchQuery}
                  />
                ) : null}
                {useCategoryPager ? (
                  <ScrollView
                    ref={categoryNavScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    bounces={Platform.OS === "ios"}
                    directionalLockEnabled
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.categoryScroll}
                    style={styles.categoryStrip}
                    onLayout={(e) => setCategoryStripWidth(e.nativeEvent.layout.width)}
                    onContentSizeChange={(w) => setCategoryContentWidth(w)}
                  >
                    {categoryItems.map((cat, idx) => {
                      const active = pageIndex === idx;
                      const CatIcon = getMenuIcon(cat.icon);
                      return (
                        <Pressable
                          key={cat.id}
                          onLayout={(e) => {
                            const { x, width } = e.nativeEvent.layout;
                            chipLayoutsRef.current[idx] = { x, width };
                          }}
                          onPress={() => goToCategoryPage(idx)}
                          style={[styles.categoryChip, active && styles.categoryChipActive]}
                        >
                          <CatIcon color={active ? "#0f172a" : "rgba(255,255,255,0.85)"} size={14} />
                          <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                            {t(`cat${cat.id.charAt(0).toUpperCase() + cat.id.slice(1)}` as any)}
                          </Text>
                          {(unreadByCategory[cat.id] ?? 0) > 0 ? (
                            <View style={styles.categoryBadge}>
                              <Text style={styles.categoryBadgeText}>
                                {unreadByCategory[cat.id] > 99 ? "99+" : unreadByCategory[cat.id]}
                              </Text>
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : null}
              </View>
              <View style={styles.chatsBody}>
              {isLoadingChats && chats.length === 0 ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color="#fff" size="large" />
                </View>
              ) : useCategoryPager ? (
                <PagerView
                  ref={pagerRef}
                  style={styles.pager}
                  initialPage={pageIndex}
                  onPageSelected={(e) => setPageIndex(e.nativeEvent.position)}
                >
                  {categoryItems.map((cat) => (
                    <View key={cat.id} style={styles.pagerPage} collapsable={false}>
                      {cat.id === "listings" ? (
                        <ListingsFeed
                          navigation={navigation}
                          searchQuery=""
                          subType={listingSubType}
                          onSubTypeChange={setListingSubType}
                        />
                      ) : (
                      <FlatList
                        style={styles.chatList}
                        nestedScrollEnabled
                        data={chatsForCategory(cat.id)}
                        keyExtractor={(item) => item.id}
                        renderItem={renderChatRow}
                        contentContainerStyle={styles.listPadding}
                        refreshControl={
                          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                        }
                        ListEmptyComponent={
                          <Text style={styles.emptyList}>{t("searchNoResult")}</Text>
                        }
                      />
                      )}
                    </View>
                  ))}
                </PagerView>
              ) : isListingsPage ? (
                <ListingsFeed
                  navigation={navigation}
                  searchQuery={searchQuery}
                  subType={listingSubType}
                  onSubTypeChange={setListingSubType}
                  onSearchCommitted={() => setSearchHistoryVersion((v) => v + 1)}
                />
              ) : (
                <FlatList
                  style={styles.chatList}
                  nestedScrollEnabled
                  data={searchFilteredChats}
                  keyExtractor={(item) => item.id}
                  renderItem={renderChatRow}
                  ListHeaderComponent={searchListHeader}
                  contentContainerStyle={styles.listPadding}
                  refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                  }
                  ListEmptyComponent={
                    contactHits.length === 0 ? (
                      <Text style={styles.emptyList}>{t("searchNoResult")}</Text>
                    ) : null
                  }
                />
              )}
              <View style={styles.songOverlay} pointerEvents="box-none">
                <ChatSongMiniBar />
              </View>
              </View>
            </View>
          ) : bottomTab === "contacts" ? (
            <ContactsView navigation={navigation} />
          ) : bottomTab === "settings" ? (
            <SettingsScreen navigation={navigation} />
          ) : (
            <ExpertsView navigation={navigation} />
          )}
        </View>

        {/* "Yangi chat" — ✎ tugmasi ostidan ochiladigan ixcham menyu (Telegram kabi) */}
        <Modal
          visible={composeMenuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setComposeMenuOpen(false)}
        >
          <Pressable style={styles.composeOverlay} onPress={() => setComposeMenuOpen(false)}>
            <View style={[styles.composeMenu, { top: insets.top + 10 + 44 + 8 }]}>
              {getVisibleComposeMenuItems({ isExpert }).map((item, idx) => {
                const Icon = item.id === "new_contact" ? UserPlus : item.id === "new_group" ? Users : Megaphone;
                return (
                  <React.Fragment key={item.id}>
                    {idx > 0 ? <View style={styles.composeSep} /> : null}
                    <Pressable
                      onPress={() => {
                        setComposeMenuOpen(false);
                        onComposeAction(item.id);
                      }}
                      style={({ pressed }) => [styles.composeRow, pressed && styles.composeRowPressed]}
                    >
                      <Icon color="#fff" size={20} />
                      <Text style={styles.composeRowText}>{t(item.titleKey)}</Text>
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </View>
          </Pressable>
        </Modal>

        <View style={styles.tabWrapper}>
          <View style={styles.glassTab}>
            {BOTTOM_TABS.map((tab) => {
              const active = bottomTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  style={styles.tabItem}
                  onPress={() => setBottomTab(tab.id)}
                >
                  {tab.icon(active)}
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {t(tab.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
            {/* Sozlamalar tabi — foydalanuvchi avatari (eski chap menyu o'rniga) */}
            <Pressable style={styles.tabItem} onPress={() => setBottomTab("settings")}>
              <View
                style={[
                  styles.tabAvatar,
                  bottomTab === "settings" && styles.tabAvatarActive,
                ]}
              >
                <AvatarImage
                  uri={
                    (currentUser as { avatar?: string | null; avatar_url?: string | null } | null)?.avatar ??
                    (currentUser as { avatar_url?: string | null } | null)?.avatar_url ??
                    null
                  }
                  name={(currentUser as { name?: string } | null)?.name || "U"}
                  size={26}
                />
              </View>
              <Text style={[styles.tabText, bottomTab === "settings" && styles.tabTextActive]}>
                {t("settingsTitle")}
              </Text>
            </Pressable>
          </View>
        </View>

        <Modal
          visible={!!createModal}
          transparent
          animationType="fade"
          onRequestClose={() => !creating && setCreateModal(null)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalOverlay}
          >
            <Pressable style={styles.modalBackdrop} onPress={() => !creating && setCreateModal(null)} />
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {createModal?.type === "channel" ? t("menuNewChannel") : t("menuNewGroup")}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder={t("createNamePlaceholder")}
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={createName}
                onChangeText={setCreateName}
                autoFocus
                editable={!creating}
                returnKeyType="done"
                onSubmitEditing={() => void submitCreateChat()}
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalCancelBtn}
                  disabled={creating}
                  onPress={() => setCreateModal(null)}
                >
                  <Text style={styles.modalCancelText}>{t("msgCancel")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalCreateBtn, (!createName.trim() || creating) && { opacity: 0.5 }]}
                  disabled={!createName.trim() || creating}
                  onPress={() => void submitCreateChat()}
                >
                  {creating ? (
                    <ActivityIndicator color="#0f172a" size="small" />
                  ) : (
                    <Text style={styles.modalCreateText}>{t("createBtn")}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ChatBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  mainContent: { flex: 1 },
  chatsTab: { flex: 1 },
  chatsBody: { flex: 1, minHeight: 0, position: "relative" },
  songOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 16,
  },
  chatsTop: { paddingHorizontal: 16, paddingBottom: 8 },
  /** Kategoriyalar bitta umumiy "pill" konteyner ichida */
  categoryStrip: {
    flexGrow: 0,
    marginTop: 10,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  pager: { flex: 1 },
  pagerPage: { flex: 1 },
  chatList: { flex: 1 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  bulkHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bulkCountText: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginHorizontal: 4,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: "#fff",
    fontSize: 15,
    paddingVertical: 0,
  },
  headerEditBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerEditText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    justifyContent: "center",
    alignItems: "center",
  },
  categoryScroll: {
    padding: 4,
    gap: 2,
    flexDirection: "row",
    alignItems: "center",
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryChipActive: {
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  categoryChipText: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" },
  categoryChipTextActive: { color: "#0f172a" },
  composeOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  composeMenu: {
    position: "absolute",
    right: 12,
    width: 230,
    borderRadius: 16,
    backgroundColor: "#1e2430",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  composeRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, height: 50 },
  composeRowPressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  composeRowText: { color: "#fff", fontSize: 16 },
  composeSep: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.1)", marginLeft: 50 },
  categoryBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  loadingBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyList: { textAlign: "center", color: "rgba(255,255,255,0.45)", marginTop: 24, fontSize: 15 },
  listPadding: { paddingHorizontal: 12, paddingBottom: 120 },
  contactsSection: { marginBottom: 4 },
  sectionTitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 4,
    textTransform: "uppercase",
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 0,
    marginBottom: 0,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  chatItemSelected: {
    backgroundColor: "rgba(59,130,246,0.14)",
    borderRadius: 12,
    borderBottomColor: "transparent",
  },
  chatItemMuted: { opacity: 0.55 },
  selectCheckWrap: {
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  chatInfo: { marginLeft: 15, flex: 1 },
  chatInfoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  chatName: { color: "#fff", fontSize: 16, fontWeight: "bold", maxWidth: "80%" },
  chatNameMuted: { color: "rgba(255,255,255,0.75)" },
  chatTypeLabel: {
    color: palette.accent,
    fontSize: 10,
    marginLeft: 6,
    fontWeight: "bold",
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unreadBadge: {
    backgroundColor: palette.accent,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  unreadBadgeMuted: { backgroundColor: "#5b6b7c" },
  chatMsgRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  chatListingLine: { color: palette.accent, fontSize: 13, fontWeight: "500", marginTop: 1 },
  chatMetaRight: { flexDirection: "row", alignItems: "center", gap: 3 },
  chatTime: { color: "rgba(255,255,255,0.45)", fontSize: 12 },
  chatTicks: { color: "rgba(255,255,255,0.45)", fontSize: 12 },
  chatTicksRead: { color: palette.accent },
  chatMsg: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 2 },
  chatMsgMuted: { color: "rgba(255,255,255,0.35)" },
  chatMsgTyping: { color: palette.accent, fontStyle: "italic" },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  modalCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    zIndex: 2,
  },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 14 },
  modalInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    color: "#fff",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalCancelText: { color: "rgba(255,255,255,0.65)", fontSize: 15, fontWeight: "600" },
  modalCreateBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 88,
    alignItems: "center",
  },
  modalCreateText: { color: "#0f172a", fontSize: 15, fontWeight: "700" },

  tabWrapper: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    height: 64,
    zIndex: 1000,
  },
  glassTab: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  tabItem: { alignItems: "center", justifyContent: "center" },
  tabText: { color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: "500", marginTop: 3 },
  tabTextActive: { color: "#fff" },
  tabAvatar: {
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "transparent",
  },
  tabAvatarActive: { borderColor: "#fff" },
});

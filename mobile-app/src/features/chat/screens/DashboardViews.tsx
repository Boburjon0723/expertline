import React, { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  Plus,
  Search,
  Zap,
  User,
  ChevronRight,
  Bell,
  Users,
  MessageSquare,
} from "lucide-react-native";

import { AvatarImage } from "../../../components/AvatarImage";
import { useAuthLocale } from "../../auth/locale";
import { AddContactModal, type AddedContact } from "../components/AddContactModal";
import {
  fetchContacts,
  type ExpertSearchRow,
} from "../../dashboard/api";
import { createOrOpenPrivateChat } from "../service";
import { palette } from "../../../lib/theme";

const { width } = Dimensions.get("window");

type MessagesNav = {
  navigate: (
    name: "ChatDetail" | "ExpertDetail",
    params: { 
      chatId?: string; 
      name?: string; 
      avatarUrl?: string | null;
      expertId?: string;
      fallbackData?: any;
      startCall?: "audio" | "video";
    }
  ) => void;
};


// --- WALLET VIEW ---
// --- CONTACTS VIEW ---
export function ContactsView({ navigation }: { navigation: MessagesNav }) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useAuthLocale();
  
  const [contacts, setContacts] = useState<ExpertSearchRow[]>([]);
  const [selectedContact, setSelectedContact] = useState<ExpertSearchRow | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      fetchContacts().then(list => {
        if (!cancelled) {
          setContacts(list);
          setLoading(false);
        }
      }).catch(() => {
        if (!cancelled) setLoading(false);
      });
      return () => { cancelled = true; };
    }, [])
  );

  const filtered = contacts.filter(c => {
    const name = `${c.name || ""} ${c.surname || ""}`.toLowerCase();
    const username = (c.username || "").toLowerCase();
    const searchLow = search.toLowerCase();
    return name.includes(searchLow) || username.includes(searchLow);
  });


  const [showAddContact, setShowAddContact] = useState(false);
  const onAddContact = () => setShowAddContact(true);
  const onContactAdded = async (c: AddedContact) => {
    setContacts(await fetchContacts());
    try {
      const { chatId, name, avatarUrl } = await createOrOpenPrivateChat(c.id);
      navigation.navigate("ChatDetail", { chatId, name: name || c.name, avatarUrl: avatarUrl ?? null });
    } catch {
      /* kontakt saqlandi; chat ochilmasa ro'yxatda qoladi */
    }
  };

  const onCallContact = async (c: ExpertSearchRow) => {
    setSelectedContact(null);
    try {
      const { chatId, name, avatarUrl } = await createOrOpenPrivateChat(c.id);
      navigation.navigate("ChatDetail", {
        chatId,
        name,
        avatarUrl: avatarUrl ?? null,
        startCall: "audio",
      });
    } catch (e) {
      Alert.alert("Qo'ng'iroq", e instanceof Error ? e.message : "Chat ochilmadi");
    }
  };

  const onOpenChat = async (c: ExpertSearchRow) => {
    setSelectedContact(null);
    try {
      const { chatId, name, avatarUrl } = await createOrOpenPrivateChat(c.id);
      navigation.navigate("ChatDetail", { chatId, name, avatarUrl: avatarUrl ?? null });
    } catch (e) {
      Alert.alert("Chat", e instanceof Error ? e.message : "Chat ochilmadi");
    }
  };

  return (
    <View style={styles.viewContainer}>
      <View style={styles.contactsHeader}>
         <View style={[styles.glassSearch, { flex: 1, marginBottom: 0 }]}>
            <Search color="rgba(255,255,255,0.4)" size={18} />
            <TextInput
              placeholder={t('searchPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
            />
         </View>
         <Pressable style={styles.addContactBtn} onPress={onAddContact}>
            <Plus color="#fff" size={24} />
         </Pressable>
      </View>
      <AddContactModal
        visible={showAddContact}
        onClose={() => setShowAddContact(false)}
        onAdded={onContactAdded}
      />

      {loading ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 180, paddingTop: 15 }}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyHistoryCard}>
              <Users color="rgba(255,255,255,0.2)" size={40} />
              <Text style={styles.emptyText}>{t('msgNoContacts')}</Text>
            </View>
          ) : (
            filtered.map((c) => (
              <Pressable 
                key={c.id} 
                style={styles.contactRow}
                onPress={() => setSelectedContact(c)}
              >
                <AvatarImage uri={c.avatar_url} name={`${c.name} ${c.surname}`} size={44} />
                <View style={styles.contactInfo}>
                   <Text style={styles.contactName}>{c.name} {c.surname}</Text>
                   <Text style={styles.contactSub}>{c.profession || c.specialization || t('msgUser')}</Text>
                </View>
                <ChevronRight color="rgba(255,255,255,0.2)" size={20} />
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {/* Contact Detail Modal */}
      {selectedContact && (
         <View style={styles.detailOverlay}>
            <View style={styles.detailGlassCard}>
               <Pressable style={styles.closeDetail} onPress={() => setSelectedContact(null)}>
                  <Plus color="#fff" size={24} style={{ transform: [{ rotate: '45deg' }] }} />
               </Pressable>
               
               <AvatarImage uri={selectedContact.avatar_url} name={`${selectedContact.name} ${selectedContact.surname}`} size={120} />
               <Text style={styles.detailName}>{selectedContact.name} {selectedContact.surname}</Text>
               <Text style={styles.detailSub}>{selectedContact.profession || selectedContact.specialization || t('msgUser')}</Text>
               
               <View style={styles.detailActions}>
                  <Pressable style={styles.detailActionBtn} onPress={() => onOpenChat(selectedContact)}>
                     <MessageSquare color="#fff" size={24} />
                     <Text style={styles.detailActionText}>{t('chatSendMessage')}</Text>
                  </Pressable>
                  <Pressable style={[styles.detailActionBtn, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]} onPress={() => void onCallContact(selectedContact)}>
                     <Bell color="#fff" size={24} />
                     <Text style={styles.detailActionText}>{t('callAccept')}</Text>
                  </Pressable>
               </View>
               
               <View style={styles.detailMeta}>
                  <View style={styles.metaRow}>
                     <User color="rgba(255,255,255,0.4)" size={16} />
                     <Text style={styles.metaLabel}>{t('settingsProfile')}:</Text>
                     <Text style={styles.metaVal}>{selectedContact.username ? `@${selectedContact.username}` : t('msgUser')}</Text>
                  </View>
                  <View style={styles.metaRow}>
                     <Zap color="rgba(255,255,255,0.4)" size={16} />
                     <Text style={styles.metaLabel}>{t('expertStatus')}:</Text>
                     <Text style={styles.metaVal}>{selectedContact.verified_status === 'approved' ? t('expertVerified') : t('expertPending')}</Text>
                  </View>
               </View>
            </View>
         </View>
      )}
    </View>
  );
}

// --- HELPERS ---

function ActionIconBtn({
  icon,
  label,
  color,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.actionItem} onPress={onPress}>
      <View style={[styles.actionGlassIcon, { borderBottomColor: color }]}>
        {icon}
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}




function MenuGlassItem({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.menuIconWrap}>{icon}</View>
      <Text style={styles.menuLabel}>{label}</Text>
      <ChevronRight color="rgba(255,255,255,0.3)" size={20} />
    </>
  );
  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.menuItemGlass, pressed && styles.menuItemPressed]}
        onPress={onPress}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={styles.menuItemGlass}>{content}</View>;
}

const styles = StyleSheet.create({
  viewContainer: { flex: 1, padding: 16 },

  // Wallet
  glassCardLarge: { borderRadius: 30, padding: 25, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)", backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden", marginBottom: 20 },
  balanceHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 15 },
  balanceLabel: { color: palette.success, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  balanceRow: { flexDirection: "row", alignItems: "baseline" },
  balanceAmount: { color: "#fff", fontSize: 44, fontWeight: "900" },
  balanceCurrency: { color: "rgba(255,255,255,0.6)", fontSize: 16, marginLeft: 8, fontWeight: "bold" },
  balanceUzs: { color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 5 },
  lockedHint: { color: "rgba(251,191,36,0.85)", fontSize: 11, marginTop: 8 },
  inlineError: { color: "#fca5a5", fontSize: 13, marginBottom: 8, marginLeft: 4 },



  actionsGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 25 },
  actionItem: { alignItems: "center", width: width / 5 },
  actionGlassIcon: { width: 52, height: 52, borderRadius: 18, justifyContent: "center", alignItems: "center", marginBottom: 8, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)", backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  actionLabel: { color: "rgba(255,255,255,0.5)", fontSize: 7, fontWeight: "900", textAlign: "center" },

  sectionHeader: {
    marginBottom: 12,
    marginLeft: 5,
    marginRight: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  withdrawLink: { color: "rgba(96,165,250,0.85)", fontSize: 11, fontWeight: "700" },
  pinHintBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
    backgroundColor: "rgba(251,191,36,0.12)",
  },
  pinHintText: { color: "#fbbf24", fontSize: 12, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "#151820",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  modalHint: { color: "rgba(255,255,255,0.45)", fontSize: 12, marginBottom: 12 },
  modalError: { color: "#fca5a5", fontSize: 13, marginTop: 10 },
  fieldLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 10,
  },
  fieldInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(0,0,0,0.35)",
    color: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  adminCardBox: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    backgroundColor: "rgba(37,99,235,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  adminCardLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  adminCardNum: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    marginTop: 10,
    letterSpacing: 2,
    textAlign: "center",
  },
  modalSubmit: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: palette.success,
  },
  modalSubmitText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  emptyHistoryCard: { borderRadius: 25, padding: 40, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  emptyText: { color: "rgba(255,255,255,0.25)", marginTop: 12, fontSize: 13 },
  txList: {},
  txRowWrap: { marginBottom: 8 },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  txIconBox: { width: 40, height: 40, borderRadius: 14, justifyContent: "center", alignItems: "center", marginRight: 15 },
  txRowText: { flex: 1 },
  txTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
  txSub: { color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 },
  txWhen: { color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: "800" },
  txCurrency: { color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: "900", marginTop: 2 },


  // Services
  glassSearch: { flexDirection: "row", alignItems: "center", borderRadius: 20, paddingHorizontal: 15, height: 50, marginBottom: 20, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)", backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  searchInput: { flex: 1, marginLeft: 10, color: "#fff", fontSize: 14 },
  searchHint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    marginBottom: 12,
    marginLeft: 4,
    lineHeight: 16,
  },
  expertGlassCard: { borderRadius: 30, padding: 20, marginBottom: 12, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)", backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  expertCardBusy: { opacity: 0.85 },
  expertTop: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  expertInfo: { flex: 1, marginLeft: 12 },
  expertName: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  expertJob: { color: "rgba(255,255,255,0.4)", fontSize: 11 },
  ratingBox: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  ratingVal: { color: palette.warning, fontSize: 10, fontWeight: "bold", marginLeft: 4 },
  expertBottom: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)", paddingTop: 15, justifyContent: "space-between" },
  priceLabel: { color: "rgba(255,255,255,0.3)", fontSize: 8, fontWeight: "900" },
  priceVal: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  bookBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  bookBtnDisabled: { opacity: 0.7 },
  bookBtnText: { color: "#fff", fontSize: 9, fontWeight: "900" },

  // Profile
  profileGlassCard: { borderRadius: 35, padding: 30, alignItems: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)", backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden", marginBottom: 25 },
  profileName: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  profilePhone: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 4 },
  editProfileBtn: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)" },
  editProfileText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  profileSectionTitle: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 4,
    marginLeft: 4,
  },
  menuSection: { gap: 12 },
  menuItemGlass: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)", backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  menuItemPressed: { opacity: 0.88 },
  menuIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center", marginRight: 15 },
  menuLabel: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "500" },
  logoutBtn: { marginTop: 15 },
  logoutGlass: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 15, borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(252,165,165,0.45)", backgroundColor: "rgba(252,165,165,0.12)", overflow: "hidden" },
  logoutText: { color: "#fca5a5", fontSize: 11, fontWeight: "900", marginLeft: 10 },
  
  // Contacts
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  contactInfo: { flex: 1, marginLeft: 12 },
  contactName: { color: "#fff", fontSize: 15, fontWeight: "600" },
  contactSub: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 },

  // Contact Detail
  contactsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addContactBtn: {
    width: 50,
    height: 50,
    borderRadius: 20,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 2000,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailGlassCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 40,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  closeDetail: { position: 'absolute', top: 20, right: 20, padding: 8 },
  detailName: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 20 },
  detailSub: { color: 'rgba(255,255,255,0.5)', fontSize: 15, marginTop: 6 },
  detailActions: { flexDirection: 'row', gap: 15, marginTop: 30, width: '100%' },
  detailActionBtn: {
    flex: 1,
    height: 90,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  detailActionText: { color: '#fff', fontSize: 11, fontWeight: 'bold', marginTop: 10 },
  detailMeta: { width: '100%', marginTop: 35, gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 25 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 13, flex: 1 },
  metaVal: { color: '#fff', fontSize: 13, fontWeight: '500' },
  p2pOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  p2pSheet: {
    backgroundColor: "#1a1f2e",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    maxHeight: "82%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  p2pHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  p2pTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  p2pTabs: { flexDirection: "row", gap: 8, marginBottom: 12 },
  p2pTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
  },
  p2pTabActive: {
    backgroundColor: "rgba(99,102,241,0.35)",
    borderWidth: 1,
    borderColor: "rgba(129,140,248,0.45)",
  },
  p2pTabText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  p2pAdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  p2pAdName: { color: "#fff", fontSize: 14, fontWeight: "600" },
  p2pAdMeta: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 },
  p2pBuyBtn: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  p2pBuyText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});

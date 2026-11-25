import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, MessageCircle } from "lucide-react-native";
import { AvatarImage } from "../../components/AvatarImage";
import { palette } from "../../lib/theme";
import { useAuthStore } from "../auth/store";
import { useAuthLocale } from "../auth/locale";
import { regionShortLabel } from "../../lib/regions";
import { directionEmoji, directionLabel } from "../../lib/directions";
import { createOrOpenPrivateChat } from "../chat/service";
import { closeListing, formatListDate, listingAuthor, listingText, type ListingRow } from "./api";

/** E'lon: muallif, to'liq matn va bitta "Bog'lanish" tugmasi */
export function ListingDetailScreen({ navigation, route }: any) {
  const listing = route?.params?.listing as ListingRow;
  const insets = useSafeAreaInsets();
  const { t, lang } = useAuthLocale();
  const me = useAuthStore((s) => s.user) as { id?: string } | null;
  const [busy, setBusy] = useState(false);

  if (!listing) return null;
  const author = listingAuthor(listing);
  const own = !!me?.id && String(listing.user_id) === String(me.id);

  const contact = async () => {
    setBusy(true);
    try {
      const chat = await createOrOpenPrivateChat(String(listing.user_id));
      navigation.navigate("ChatDetail", {
        chatId: chat.chatId,
        name: chat.name || author,
        avatarUrl: chat.avatarUrl ?? listing.user?.avatar_url ?? null,
      });
    } catch (e: any) {
      Alert.alert(t("errTitle"), e?.message || t("errServer"));
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    setBusy(true);
    try {
      if (await closeListing(listing.id)) navigation.goBack();
      else Alert.alert(t("errTitle"), t("errSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={8}>
          <ArrowLeft color={palette.textSecondary} size={22} />
        </Pressable>
        <AvatarImage uri={listing.user?.avatar_url ?? null} name={author} size={40} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.author} numberOfLines={1}>
            {author || t("listingTitle")}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {listing.sub_type === "employer" ? t("listingTypeEmployer") : t("listingTypeSeeker")}
            {listing.location ? ` · ${regionShortLabel(listing.location, lang)}` : ""}
            {listing.direction ? ` · ${directionEmoji(listing.direction)} ${directionLabel(listing.direction, lang)}` : ""}
            {listing.created_at ? ` · ${formatListDate(listing.created_at)}` : ""}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <View style={styles.card}>
          <Text style={styles.text} selectable>
            {listingText(listing)}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {own ? (
          <View style={styles.ownRow}>
            <Text style={styles.ownText}>{t("listingYours")}</Text>
            <Pressable onPress={() => void close()} disabled={busy} hitSlop={8}>
              <Text style={styles.closeText}>{t("listingClose")}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => void contact()}
            disabled={busy}
            style={({ pressed }) => [styles.btn, (pressed || busy) && { backgroundColor: palette.accentPressed }]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MessageCircle color="#fff" size={20} />
                <Text style={styles.btnText}>{t("listingContact")}</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: 4 },
  author: { color: palette.text, fontSize: 16, fontWeight: "600" },
  meta: { color: palette.textSecondary, fontSize: 13, marginTop: 1 },
  card: {
    borderRadius: 16,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
  },
  text: { color: palette.text, fontSize: 15, lineHeight: 22 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  btn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: palette.accent,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  ownRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 50 },
  ownText: { color: palette.accent, fontSize: 14 },
  closeText: { color: palette.danger, fontSize: 15, fontWeight: "500" },
});

export default ListingDetailScreen;

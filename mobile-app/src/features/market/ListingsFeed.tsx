import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Plus } from "lucide-react-native";
import { AvatarImage } from "../../components/AvatarImage";
import { palette } from "../../lib/theme";
import { useAuthStore } from "../auth/store";
import { useAuthLocale } from "../auth/locale";
import {
  addSearchHistory,
  fetchListings,
  formatListDate,
  listingAuthor,
  listingText,
  splitListingText,
  type ListingRow,
  type ListingSubType,
} from "./api";

type Props = {
  navigation: any;
  searchQuery: string;
  subType: ListingSubType;
  onSubTypeChange: (v: ListingSubType) => void;
  /** Qidiruvdan natija tanlanganda (tarix yangilanishi uchun) */
  onSearchCommitted?: () => void;
};

/** Ish beruvchilar | Ish qidiruvchilar */
export function ListingTypeSwitch({ value, onChange }: { value: ListingSubType; onChange: (v: ListingSubType) => void }) {
  const { t } = useAuthLocale();
  return (
    <View style={styles.switch}>
      {(["employer", "seeker"] as ListingSubType[]).map((k) => {
        const on = value === k;
        return (
          <Pressable key={k} onPress={() => onChange(k)} style={[styles.switchItem, on && styles.switchItemOn]}>
            <Text style={[styles.switchText, on && styles.switchTextOn]}>
              {k === "employer" ? t("listingsEmployers") : t("listingsSeekers")}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** E'lonlar — chat ro'yxatidagi papka sahifasi (chat qatorlari ko'rinishida) */
export function ListingsFeed({ navigation, searchQuery, subType, onSubTypeChange, onSearchCommitted }: Props) {
  const { t } = useAuthLocale();
  const me = useAuthStore((s) => s.user) as { id?: string } | null;
  const [items, setItems] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const q = searchQuery.trim();

  const load = useCallback(async () => {
    try {
      setItems(await fetchListings(subType, q));
    } catch {
      /* tarmoq */
    } finally {
      setLoading(false);
    }
  }, [subType, q]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => void load(), q ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  // E'lon joylab / yopib qaytilganda yangilansin
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const open = (l: ListingRow) => {
    if (q.length >= 2) {
      void addSearchHistory("listings", q).then(() => onSearchCommitted?.());
    }
    navigation.navigate("ListingDetail", { listing: l });
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.listPadding}
        ListHeaderComponent={<ListingTypeSwitch value={subType} onChange={onSubTypeChange} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={palette.accent} style={{ marginTop: 32 }} />
          ) : (
            <Text style={styles.empty}>{q ? t("searchNoResult") : t("listingsEmpty")}</Text>
          )
        }
        renderItem={({ item }) => {
          const { title, rest } = splitListingText(listingText(item));
          const author = listingAuthor(item);
          const own = !!me?.id && String(item.user_id) === String(me.id);
          return (
            <Pressable onPress={() => open(item)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <AvatarImage uri={item.user?.avatar_url ?? null} name={author || title} size={50} />
              <View style={styles.rowInfo}>
                <View style={styles.rowHead}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {title || author}
                  </Text>
                  <Text style={styles.rowTime}>{formatListDate(item.created_at)}</Text>
                </View>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {own ? <Text style={{ color: palette.accent }}>{t("listingYours")} · </Text> : author ? `${author} · ` : ""}
                  {rest}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
      <Pressable
        onPress={() => navigation.navigate("ListingCompose", { type: subType })}
        style={({ pressed }) => [styles.fab, pressed && { backgroundColor: palette.accentPressed }]}
        accessibilityLabel={t("listingNew")}
      >
        <Plus color="#fff" size={26} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  listPadding: { paddingHorizontal: 12, paddingBottom: 140 },
  switch: {
    flexDirection: "row",
    padding: 4,
    marginTop: 8,
    marginBottom: 6,
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  switchItem: { flex: 1, height: 34, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  switchItemOn: { backgroundColor: palette.accent },
  switchText: { color: palette.textSecondary, fontSize: 14, fontWeight: "600" },
  switchTextOn: { color: "#fff" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  rowPressed: { backgroundColor: palette.surface },
  rowInfo: { marginLeft: 15, flex: 1 },
  rowHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  rowTitle: { color: palette.text, fontSize: 16, fontWeight: "bold", flex: 1, marginRight: 8 },
  rowTime: { color: "rgba(255,255,255,0.45)", fontSize: 12 },
  rowSub: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  empty: { textAlign: "center", color: palette.textMuted, marginTop: 32, fontSize: 15 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 130,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});

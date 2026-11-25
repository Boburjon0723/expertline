import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ChevronRight, LayoutGrid, MapPin, PenLine, Plus, X } from "lucide-react-native";
import { AvatarImage } from "../../components/AvatarImage";
import { palette } from "../../lib/theme";
import { isRegionCode, regionShortLabel } from "../../lib/regions";
import { directionEmoji, directionLabel, isDirectionCode } from "../../lib/directions";
import { useAuthStore } from "../auth/store";
import { useAuthLocale } from "../auth/locale";
import {
  addSearchHistory,
  fetchFacets,
  fetchListings,
  formatListDate,
  getSavedFilter,
  listingAuthor,
  listingText,
  saveFilter,
  splitListingText,
  type ListingFacets,
  type ListingRow,
  type ListingSubType,
} from "./api";
import { DirectionSheet, RegionSheet, type DirectionFilter, type RegionFilter } from "./RegionSheet";

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

/**
 * Ro'yxat filtrlari (viloyat, yo'nalish). Qurilmada eslab qolinadi.
 * Viloyat birinchi marta profildagi viloyatdan olinadi.
 */
function useListingFilters() {
  const profileRegion = useAuthStore((s) => (s.user as { region?: string } | null)?.region);
  const [region, setRegionState] = useState<RegionFilter | null>(null);
  const [direction, setDirectionState] = useState<DirectionFilter>("all");
  useEffect(() => {
    let alive = true;
    void Promise.all([getSavedFilter("region"), getSavedFilter("direction")]).then(([r, d]) => {
      if (!alive) return;
      if (r === "all" || isRegionCode(r)) setRegionState(r);
      else setRegionState(isRegionCode(profileRegion) ? profileRegion : "all");
      setDirectionState(isDirectionCode(d) ? d : "all");
    });
    return () => {
      alive = false;
    };
  }, [profileRegion]);
  const setRegion = useCallback((v: RegionFilter) => {
    setRegionState(v);
    void saveFilter("region", v);
  }, []);
  const setDirection = useCallback((v: DirectionFilter) => {
    setDirectionState(v);
    void saveFilter("direction", v);
  }, []);
  return { region, direction, setRegion, setDirection };
}

/** E'lonlar — chat ro'yxatidagi papka sahifasi (chat qatorlari ko'rinishida) */
export function ListingsFeed({ navigation, searchQuery, subType, onSubTypeChange, onSearchCommitted }: Props) {
  const { t, lang } = useAuthLocale();
  const me = useAuthStore((s) => s.user) as { id?: string } | null;
  const [items, setItems] = useState<ListingRow[]>([]);
  const [facets, setFacets] = useState<ListingFacets>({ regions: {}, directions: {} });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { region, direction, setRegion, setDirection } = useListingFilters();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheet, setSheet] = useState<"region" | "direction" | null>(null);
  const q = searchQuery.trim();

  const load = useCallback(async () => {
    if (region == null) return;
    try {
      const [rows, f] = await Promise.all([
        fetchListings(subType, q, region, direction),
        fetchFacets(subType, region, direction),
      ]);
      setItems(rows);
      setFacets(f);
    } catch {
      /* tarmoq */
    } finally {
      setLoading(false);
    }
  }, [subType, q, region, direction]);

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

  // Tanlangan viloyat bo'lsa: backend shu viloyat → masofaviy → qolganlar tartibida beradi.
  // Qolganlarining birinchisidan oldin "Boshqa viloyatlardan" sarlavhasi chiqadi.
  const regional = region != null && region !== "all";
  const hasDirection = direction !== "all";
  const isOther = (l: ListingRow) => regional && l.location !== region && l.location !== "remote";
  const firstOtherIdx = regional ? items.findIndex(isOther) : -1;

  const regionText = regional ? regionShortLabel(region, lang) : t("regionAll");
  const directionText = hasDirection ? `${directionEmoji(direction)} ${directionLabel(direction, lang)}` : t("directionAll");

  const compose = () => {
    setMenuOpen(false);
    navigation.navigate("ListingCompose", {
      type: subType,
      region: regional ? region : undefined,
      direction: hasDirection ? direction : undefined,
    });
  };

  // Filtr yoqilganda ro'yxat tepasida chiplar — nega ro'yxat qisqarganini ko'rsatadi
  const header = (
    <View>
      <ListingTypeSwitch value={subType} onChange={onSubTypeChange} />
      {regional || hasDirection ? (
        <View style={styles.chips}>
          {regional ? (
            <Pressable onPress={() => setRegion("all")} style={styles.chip} hitSlop={4}>
              <MapPin color={palette.accent} size={13} />
              <Text style={styles.chipText} numberOfLines={1}>
                {regionText}
              </Text>
              <X color="rgba(255,255,255,0.6)" size={13} />
            </Pressable>
          ) : null}
          {hasDirection ? (
            <Pressable onPress={() => setDirection("all")} style={styles.chip} hitSlop={4}>
              <Text style={styles.chipText} numberOfLines={1}>
                {directionText}
              </Text>
              <X color="rgba(255,255,255,0.6)" size={13} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.listPadding}
        ListHeaderComponent={header}
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
        renderItem={({ item, index }) => {
          const { title, rest } = splitListingText(listingText(item));
          const author = listingAuthor(item);
          const own = !!me?.id && String(item.user_id) === String(me.id);
          const meta = [
            item.location ? regionShortLabel(item.location, lang) : "",
            item.direction ? directionLabel(item.direction, lang) : "",
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <>
              {index === firstOtherIdx ? <Text style={styles.section}>{t("regionOthers")}</Text> : null}
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
                  {meta ? (
                    <View style={styles.placeRow}>
                      {item.location ? <MapPin color="rgba(255,255,255,0.4)" size={11} /> : null}
                      <Text style={styles.placeText} numberOfLines={1}>
                        {meta}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            </>
          );
        }}
      />

      <Pressable
        onPress={() => setMenuOpen(true)}
        style={({ pressed }) => [styles.fab, pressed && { backgroundColor: palette.accentPressed }]}
        accessibilityLabel={t("listingNew")}
      >
        <Plus color="#fff" size={26} />
        {regional || hasDirection ? <View style={styles.fabDot} /> : null}
      </Pressable>

      {/* "+" menyusi: e'lon berish, viloyat, yo'nalish */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <View style={styles.menu}>
            <Pressable onPress={compose} style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}>
              <PenLine color={palette.accent} size={20} />
              <Text style={styles.menuTitle}>{t("listingNew")}</Text>
            </Pressable>
            <View style={styles.menuSep} />
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                setSheet("region");
              }}
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
            >
              <MapPin color="#fff" size={20} />
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>{t("regionLabel")}</Text>
                <Text style={[styles.menuValue, regional && { color: palette.accent }]} numberOfLines={1}>
                  {regionText}
                </Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.4)" size={18} />
            </Pressable>
            <View style={styles.menuSep} />
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                setSheet("direction");
              }}
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
            >
              <LayoutGrid color="#fff" size={20} />
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>{t("directionLabel")}</Text>
                <Text style={[styles.menuValue, hasDirection && { color: palette.accent }]} numberOfLines={1}>
                  {directionText}
                </Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.4)" size={18} />
            </Pressable>
          </View>
          <View style={[styles.fab, styles.fabClose]}>
            <X color="#fff" size={26} />
          </View>
        </Pressable>
      </Modal>

      <RegionSheet
        visible={sheet === "region"}
        value={region}
        onSelect={setRegion}
        onClose={() => setSheet(null)}
        allowAll
        counts={facets.regions}
      />
      <DirectionSheet
        visible={sheet === "direction"}
        value={direction}
        onSelect={setDirection}
        onClose={() => setSheet(null)}
        allowAll
        counts={facets.directions}
      />
    </View>
  );
}

const FAB_BOTTOM = 112;

const styles = StyleSheet.create({
  listPadding: { paddingHorizontal: 12, paddingBottom: 190 },
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 2, paddingBottom: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 28,
    maxWidth: "100%",
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "rgba(135,116,225,0.16)",
    borderWidth: 1,
    borderColor: "rgba(135,116,225,0.35)",
  },
  chipText: { color: "#fff", fontSize: 13, fontWeight: "500", flexShrink: 1 },
  section: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
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
  placeRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  placeText: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginLeft: 3, flexShrink: 1 },
  empty: { textAlign: "center", color: palette.textMuted, marginTop: 32, fontSize: 15 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: FAB_BOTTOM,
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
  fabDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: palette.accent,
  },
  fabClose: { backgroundColor: "#3a3f4b" },
  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  menu: {
    position: "absolute",
    right: 20,
    bottom: FAB_BOTTOM + 56 + 12,
    width: 270,
    borderRadius: 18,
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
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, minHeight: 54 },
  menuRowPressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  menuInfo: { flex: 1, paddingVertical: 8 },
  menuTitle: { color: "#fff", fontSize: 16, fontWeight: "500" },
  menuValue: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 1 },
  menuSep: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.1)", marginLeft: 48 },
});

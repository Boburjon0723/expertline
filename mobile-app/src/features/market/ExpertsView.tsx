import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BadgeCheck, Search, X } from "lucide-react-native";
import { AvatarImage } from "../../components/AvatarImage";
import { apiFetch } from "../../lib/api";
import { palette } from "../../lib/theme";
import { useAuthLocale } from "../auth/locale";
import { SearchSuggestions } from "./SearchSuggestions";
import { addSearchHistory } from "./api";

type ExpertRow = {
  id: string;
  name?: string;
  surname?: string;
  username?: string;
  avatar_url?: string | null;
  profession?: string;
  specialization?: string;
  specialization_details?: string;
  specialty_desc?: string;
};

async function fetchExperts(q: string): Promise<ExpertRow[]> {
  const params = new URLSearchParams({ limit: "100" });
  if (q.trim()) params.set("q", q.trim());
  const res = await apiFetch(`/api/users/experts?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Kasb kaliti: katta-kichik harf va bo'shliqlardan qat'i nazar bir xil guruh */
const professionKey = (e: ExpertRow) => String(e.profession || "").trim().toLowerCase();

const fullName = (e: ExpertRow) => `${e.name || ""} ${e.surname || ""}`.trim() || (e.username ? `@${e.username}` : "—");

/**
 * Mutaxassislar tabi: chat ro'yxati kabi qatorlar + shu tabga oid qidiruv va kalit so'zlar.
 * Faqat tasdiqlangan mutaxassislar (backend /api/users/experts).
 */
export function ExpertsView({ navigation }: { navigation: any }) {
  const { t } = useAuthLocale();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [items, setItems] = useState<ExpertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  /** Tanlangan kategoriya (kasb kaliti); null — hammasi */
  const [category, setCategory] = useState<string | null>(null);
  const q = query.trim();

  // Kategoriyalar — mavjud mutaxassislarning kasblaridan (ko'pi birinchi); "Boshqa" da o'zi yozganlar ham chiqadi
  const categories = useMemo(() => {
    const map = new Map<string, { label: string; n: number }>();
    for (const e of items) {
      const key = professionKey(e);
      if (!key) continue;
      const cur = map.get(key);
      if (cur) cur.n++;
      else map.set(key, { label: String(e.profession).trim(), n: 1 });
    }
    return [...map.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  }, [items]);

  // Tanlangan kategoriya qidiruv natijalarida qolmasa — "Hammasi" ga qaytamiz
  useEffect(() => {
    if (category && !loading && !categories.some((c) => c.key === category)) setCategory(null);
  }, [categories, category, loading]);

  const visible = useMemo(
    () => (category ? items.filter((e) => professionKey(e) === category) : items),
    [items, category]
  );

  const load = useCallback(async () => {
    try {
      setItems(await fetchExperts(q));
    } catch {
      /* tarmoq */
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  const open = (e: ExpertRow) => {
    if (q.length >= 2) void addSearchHistory("experts", q).then(() => setHistoryVersion((v) => v + 1));
    navigation.navigate("ExpertDetail", { expertId: e.id, fallbackData: e });
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Search color="rgba(255,255,255,0.45)" size={18} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t("searchExpertsPh")}
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <X color="rgba(255,255,255,0.5)" size={18} />
          </Pressable>
        ) : null}
      </View>

      {focused ? (
        <SearchSuggestions scope="experts" query={query} historyVersion={historyVersion} onPick={setQuery} />
      ) : null}

      {categories.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.chipsStrip}
          contentContainerStyle={styles.chips}
        >
          {[{ key: null as string | null, label: t("catAll"), n: items.length }, ...categories].map((c) => {
            const on = category === c.key;
            return (
              <Pressable
                key={c.key ?? "__all"}
                onPress={() => setCategory(c.key)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                  {c.label}
                </Text>
                <Text style={[styles.chipCount, on && styles.chipCountOn]}>{c.n}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <FlatList
        data={visible}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 140 }}
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
            <Text style={styles.empty}>{q ? t("searchNoResult") : t("expertsEmpty")}</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => open(item)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <AvatarImage uri={item.avatar_url ?? null} name={fullName(item)} size={50} />
            <View style={styles.rowInfo}>
              <View style={styles.rowHead}>
                <View style={styles.nameWrap}>
                  <Text style={styles.name} numberOfLines={1}>
                    {fullName(item)}
                  </Text>
                  <BadgeCheck color={palette.accent} size={16} />
                </View>
                {item.profession ? (
                  <Text style={styles.profession} numberOfLines={1}>
                    {item.profession}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.sub} numberOfLines={1}>
                {item.specialization_details || item.specialization || item.specialty_desc || ""}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  searchInput: { flex: 1, color: palette.text, fontSize: 15, paddingVertical: 0 },
  chipsStrip: { flexGrow: 0, marginTop: 10, marginBottom: 4, marginHorizontal: -16 },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  chipOn: { backgroundColor: palette.accent, borderColor: palette.accent },
  chipText: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "600", maxWidth: 180 },
  chipTextOn: { color: "#fff" },
  chipCount: { color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: "600" },
  chipCountOn: { color: "rgba(255,255,255,0.85)" },
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
  nameWrap: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1, marginRight: 8 },
  name: { color: palette.text, fontSize: 16, fontWeight: "bold", flexShrink: 1 },
  profession: { color: "rgba(255,255,255,0.45)", fontSize: 12, maxWidth: "45%" },
  sub: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  empty: { textAlign: "center", color: palette.textMuted, marginTop: 32, fontSize: 15 },
});

export default ExpertsView;

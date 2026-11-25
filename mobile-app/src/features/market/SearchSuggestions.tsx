import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Clock, TrendingUp } from "lucide-react-native";
import { palette } from "../../lib/theme";
import { useAuthLocale } from "../auth/locale";
import {
  clearSearchHistory,
  fetchSearchSuggestions,
  getSearchHistory,
  type ListingSubType,
  type SearchScope,
} from "./api";

type Props = {
  scope: SearchScope;
  subType?: ListingSubType;
  query: string;
  onPick: (term: string) => void;
  /** Tarix yangilanganda oshiriladi */
  historyVersion?: number;
};

/**
 * Qidiruv ostidagi kalit so'zlar: oxirgi qidiruvlar + ommabop so'zlar (tabga qarab).
 * Chatlar uchun faqat oxirgi qidiruvlar.
 */
export function SearchSuggestions({ scope, subType, query, onPick, historyVersion = 0 }: Props) {
  const { t } = useAuthLocale();
  const [recent, setRecent] = useState<string[]>([]);
  const [popular, setPopular] = useState<string[]>([]);
  const q = query.trim();

  useEffect(() => {
    let alive = true;
    void getSearchHistory(scope).then((list) => alive && setRecent(list));
    return () => {
      alive = false;
    };
  }, [scope, historyVersion]);

  useEffect(() => {
    if (scope === "chats") return;
    let alive = true;
    const timer = setTimeout(() => {
      void fetchSearchSuggestions(scope, q, subType)
        .then((list) => alive && setPopular(list))
        .catch(() => undefined);
    }, q ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [scope, subType, q]);

  const ql = q.toLowerCase();
  const recentShown = q ? recent.filter((r) => r.toLowerCase().includes(ql) && r.toLowerCase() !== ql) : recent;
  const popularShown = (scope === "chats" ? [] : popular).filter((p) => p.toLowerCase() !== ql);
  if (recentShown.length === 0 && popularShown.length === 0) return null;

  const chip = (term: string, kind: "recent" | "popular") => (
    <Pressable
      key={`${kind}-${term}`}
      onPress={() => onPick(term)}
      style={({ pressed }) => [styles.chip, pressed && { backgroundColor: palette.surfacePressed }]}
    >
      {kind === "recent" ? (
        <Clock color={palette.textMuted} size={13} />
      ) : (
        <TrendingUp color={palette.textMuted} size={13} />
      )}
      <Text style={styles.chipText} numberOfLines={1}>
        {term}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      {recentShown.length > 0 ? (
        <View>
          <View style={styles.headRow}>
            <Text style={styles.head}>{t("searchRecent")}</Text>
            {!q ? (
              <Pressable
                hitSlop={8}
                onPress={() => {
                  void clearSearchHistory(scope);
                  setRecent([]);
                }}
              >
                <Text style={styles.clear}>{t("searchClear")}</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.chips}>{recentShown.map((r) => chip(r, "recent"))}</View>
        </View>
      ) : null}
      {popularShown.length > 0 ? (
        <View style={recentShown.length > 0 ? { marginTop: 12 } : undefined}>
          <Text style={[styles.head, { marginBottom: 8 }]}>{t("searchPopular")}</Text>
          <View style={styles.chips}>{popularShown.map((p) => chip(p, "popular"))}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 12, paddingBottom: 6 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  head: { color: palette.accent, fontSize: 13, fontWeight: "600" },
  clear: { color: palette.textSecondary, fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  chipText: { color: palette.text, fontSize: 14, flexShrink: 1 },
});

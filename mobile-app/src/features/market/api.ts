import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "../../lib/api";

export type ListingSubType = "employer" | "seeker";

export type ListingRow = {
  id: string;
  user_id: string;
  sub_type: ListingSubType;
  short_text?: string | null;
  title?: string | null;
  description?: string | null;
  created_at?: string;
  status?: string;
  user?: { name?: string; surname?: string; username?: string; avatar_url?: string | null };
};

export type SearchScope = "chats" | "listings" | "experts";

export async function fetchListings(subType: ListingSubType, q?: string): Promise<ListingRow[]> {
  const params = new URLSearchParams({ sub_type: subType, limit: "60" });
  if (q?.trim()) params.set("q", q.trim());
  const res = await apiFetch(`/api/jobs?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function createListing(subType: ListingSubType, text: string): Promise<void> {
  const res = await apiFetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sub_type: subType, short_text: text.trim() }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message || "Saqlab bo'lmadi");
  }
}

export async function closeListing(id: string): Promise<boolean> {
  const res = await apiFetch(`/api/jobs/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "closed" }),
  });
  return res.ok;
}

export async function fetchSearchSuggestions(
  scope: "listings" | "experts",
  q: string,
  subType?: ListingSubType
): Promise<string[]> {
  const params = new URLSearchParams({ scope });
  if (subType) params.set("type", subType);
  if (q.trim()) params.set("q", q.trim());
  const res = await apiFetch(`/api/search/suggestions?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.suggestions) ? data.suggestions : [];
}

/* --- Oxirgi qidiruvlar (har bir tab uchun alohida, qurilmada) --- */

const HISTORY_PREFIX = "el_search_history:";
const HISTORY_MAX = 8;

export async function getSearchHistory(scope: SearchScope): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_PREFIX + scope);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function addSearchHistory(scope: SearchScope, term: string): Promise<void> {
  const clean = term.trim();
  if (clean.length < 2) return;
  const prev = await getSearchHistory(scope);
  const next = [clean, ...prev.filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, HISTORY_MAX);
  try {
    await AsyncStorage.setItem(HISTORY_PREFIX + scope, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export async function clearSearchHistory(scope: SearchScope): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_PREFIX + scope);
  } catch {
    /* ignore */
  }
}

/* --- Matn yordamchilari --- */

export function listingText(l: ListingRow): string {
  return String(l.short_text || l.description || l.title || "");
}

export function splitListingText(text: string): { title: string; rest: string } {
  const lines = text.split("\n").map((x) => x.trim());
  const idx = lines.findIndex((x) => x.length > 0);
  if (idx < 0) return { title: "", rest: "" };
  return { title: lines[idx], rest: lines.slice(idx + 1).filter(Boolean).join(" · ") };
}

export function listingAuthor(l: ListingRow): string {
  return `${l.user?.name || ""} ${l.user?.surname || ""}`.trim() || (l.user?.username ? `@${l.user.username}` : "");
}

export function formatListDate(raw?: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

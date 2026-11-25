/**
 * Oxirgi qidiruvlar — har bir tab (scope) uchun alohida, faqat shu brauzerda (localStorage).
 */
export type SearchScope = 'chats' | 'listings' | 'experts';

const KEY_PREFIX = 'el_search_history:';
const MAX_ITEMS = 8;

function key(scope: SearchScope) {
    return `${KEY_PREFIX}${scope}`;
}

export function getSearchHistory(scope: SearchScope): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(key(scope));
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
    } catch {
        return [];
    }
}

export function addSearchHistory(scope: SearchScope, term: string): string[] {
    const clean = term.trim();
    if (clean.length < 2 || typeof window === 'undefined') return getSearchHistory(scope);
    const next = [clean, ...getSearchHistory(scope).filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(
        0,
        MAX_ITEMS
    );
    try {
        window.localStorage.setItem(key(scope), JSON.stringify(next));
    } catch {
        /* quota */
    }
    return next;
}

export function clearSearchHistory(scope: SearchScope) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(key(scope));
    } catch {
        /* ignore */
    }
}

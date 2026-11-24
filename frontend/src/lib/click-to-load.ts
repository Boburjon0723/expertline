"use client";

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Telegram uslubi "avtomatik yuklash o'chiq": qabul qilingan rasm chatda faqat bosilganda yuklanadi.
 * Bir marta ochilgan URL eslab qolinadi (localStorage) — keyingi safar darhol ko'rinadi.
 */
const KEY = 'el_loaded_media_v1';
const MAX = 800;

let loaded: Set<string> | null = null;
const listeners = new Set<() => void>();

function read(): Set<string> {
    if (loaded) return loaded;
    loaded = new Set();
    if (typeof window !== 'undefined') {
        try {
            const raw = window.localStorage.getItem(KEY);
            if (raw) for (const u of JSON.parse(raw) as string[]) loaded.add(u);
        } catch {
            /* ignore */
        }
    }
    return loaded;
}

function keyOf(url: string): string {
    return url.split('?')[0];
}

export function markMediaLoaded(url: string) {
    const set = read();
    const k = keyOf(url);
    if (!k || set.has(k)) return;
    set.add(k);
    try {
        window.localStorage.setItem(KEY, JSON.stringify([...set].slice(-MAX)));
    } catch {
        /* ignore */
    }
    listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
}

/** [ko'rsatilsinmi, yuklash funksiyasi]. O'z xabarlari doim ko'rinadi. */
export function useClickToLoad(url: string, isOwn: boolean): [boolean, () => void] {
    const k = keyOf(url);
    const known = useSyncExternalStore(
        subscribe,
        () => !!k && read().has(k),
        () => false
    );
    const load = useCallback(() => {
        if (url) markMediaLoaded(url);
    }, [url]);
    return [isOwn || known, load];
}

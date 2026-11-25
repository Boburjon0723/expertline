'use client';

import React from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function resolveAvatarUrl(path?: string | null): string | null {
    if (!path || path === 'null' || path === 'use_initials') return null;
    if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) return path;
    return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

const AVATAR_COLORS = ['#e17076', '#7bc862', '#65aadd', '#a695e7', '#ee7aae', '#6ec9cb', '#faa774'];

function colorFor(seed: string) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/** Chat ro'yxatidagi kabi 54px dumaloq avatar (rasm yoki bosh harf) */
export function MarketAvatar({
    src,
    name,
    seed,
    size = 54,
}: {
    src?: string | null;
    name?: string;
    seed?: string;
    size?: number;
}) {
    const url = resolveAvatarUrl(src);
    const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
    return (
        <div
            className="rounded-full overflow-hidden shrink-0 flex items-center justify-center text-white font-medium"
            style={{ width: size, height: size, backgroundColor: url ? undefined : colorFor(seed || name || '?'), fontSize: size * 0.4 }}
        >
            {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="w-full h-full object-cover" />
            ) : (
                initial
            )}
        </div>
    );
}

/** Ro'yxat uchun sana: bugun — 14:05, shu hafta — Du, eskiroq — 12.11 */
export function formatListDate(raw: string | number | Date | null | undefined, language: string): string {
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const diffDays = (now.getTime() - d.getTime()) / 86_400_000;
    if (diffDays < 6) {
        const locale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ';
        return d.toLocaleDateString(locale, { weekday: 'short' });
    }
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}${
        d.getFullYear() !== now.getFullYear() ? `.${String(d.getFullYear()).slice(2)}` : ''
    }`;
}

/** E'lon matnidan sarlavha (birinchi bo'sh bo'lmagan qator) va qolgan qism */
export function splitListingText(text?: string | null): { title: string; rest: string } {
    const lines = String(text || '')
        .split('\n')
        .map((l) => l.trim());
    const idx = lines.findIndex((l) => l.length > 0);
    if (idx < 0) return { title: '', rest: '' };
    return {
        title: lines[idx],
        rest: lines
            .slice(idx + 1)
            .filter(Boolean)
            .join(' · '),
    };
}

export type ListingRow = {
    id: string;
    user_id: string;
    sub_type: 'employer' | 'seeker';
    short_text?: string | null;
    title?: string | null;
    description?: string | null;
    created_at?: string;
    status?: string;
    /** Viloyat kodi (lib/regions) */
    location?: string | null;
    /** Yo'nalish kodi (lib/directions) */
    direction?: string | null;
    user?: { name?: string; surname?: string; username?: string; avatar_url?: string | null };
};

export function listingText(l: ListingRow): string {
    return String(l.short_text || l.description || l.title || '');
}

export function listingAuthor(l: ListingRow): string {
    return `${l.user?.name || ''} ${l.user?.surname || ''}`.trim() || (l.user?.username ? `@${l.user.username}` : '');
}

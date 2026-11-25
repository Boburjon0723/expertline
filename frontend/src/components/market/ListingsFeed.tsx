'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { addSearchHistory } from '@/lib/search-history';
import {
    MarketAvatar,
    formatListDate,
    listingAuthor,
    listingText,
    splitListingText,
    type ListingRow,
} from './marketUi';

export type ListingSubType = 'employer' | 'seeker';

type Props = {
    subType: ListingSubType;
    onSubTypeChange: (v: ListingSubType) => void;
    searchQuery: string;
    selectedId?: string | null;
    onSelect: (listing: ListingRow) => void;
    /** Yangi e'lon joylangach / yopilgach ro'yxatni qayta yuklash */
    refreshKey?: number;
    currentUserId?: string | null;
    /** Qidiruv natija bergach (tarixga yozish uchun) */
    onSearchCommitted?: () => void;
};

/** Ish beruvchilar | Ish qidiruvchilar almashtirgichi (chat papkalari ostida) */
export function ListingTypeSwitch({ value, onChange }: { value: ListingSubType; onChange: (v: ListingSubType) => void }) {
    const { t } = useLanguage();
    const opts: { key: ListingSubType; label: string }[] = [
        { key: 'employer', label: t('listings_employers') },
        { key: 'seeker', label: t('listings_seekers') },
    ];
    return (
        <div className="px-3 pt-2 pb-2">
            <div className="flex p-1 rounded-full bg-white/[0.06] border border-white/[0.08]">
                {opts.map((o) => (
                    <button
                        key={o.key}
                        type="button"
                        onClick={() => onChange(o.key)}
                        className={`flex-1 h-8 rounded-full text-[14px] font-medium transition-colors ${
                            value === o.key ? 'bg-[#8774e1] text-white' : 'text-[#aaaaaa] hover:text-white'
                        }`}
                    >
                        {o.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

/** E'lonlar ro'yxati — chat qatorlari ko'rinishida */
export default function ListingsFeed({
    subType,
    onSubTypeChange,
    searchQuery,
    selectedId,
    onSelect,
    refreshKey = 0,
    currentUserId,
    onSearchCommitted,
}: Props) {
    const { t, language } = useLanguage();
    const [items, setItems] = useState<ListingRow[]>([]);
    const [loading, setLoading] = useState(true);
    const q = searchQuery.trim();

    useEffect(() => {
        const ac = new AbortController();
        setLoading(true);
        const timer = setTimeout(async () => {
            try {
                const params = new URLSearchParams({ sub_type: subType, limit: '60' });
                if (q) params.set('q', q);
                const res = await apiFetch(`/api/jobs?${params.toString()}`, { signal: ac.signal });
                const data = res.ok ? await res.json() : [];
                setItems(Array.isArray(data) ? data : []);
            } catch {
                /* abort */
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        }, q ? 350 : 0);
        return () => {
            clearTimeout(timer);
            ac.abort();
        };
    }, [subType, q, refreshKey]);

    return (
        <div>
            <ListingTypeSwitch value={subType} onChange={onSubTypeChange} />

            {loading && items.length === 0 ? (
                Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-3 h-[72px] animate-pulse">
                        <div className="h-[54px] w-[54px] rounded-full bg-white/10 shrink-0" />
                        <div className="flex-1 space-y-2 border-b border-white/[0.06] py-3">
                            <div className="h-3.5 w-1/2 rounded bg-white/10" />
                            <div className="h-3 w-3/4 rounded bg-white/5" />
                        </div>
                    </div>
                ))
            ) : items.length === 0 ? (
                <div className="flex items-center justify-center h-40 mt-10 text-[14px] text-[#aaaaaa]">
                    {q ? t('listings_nothing_found') : t('listings_empty')}
                </div>
            ) : (
                items.map((l) => {
                    const { title, rest } = splitListingText(listingText(l));
                    const author = listingAuthor(l);
                    const own = !!currentUserId && String(l.user_id) === String(currentUserId);
                    return (
                        <button
                            key={l.id}
                            type="button"
                            onClick={() => {
                                // Qidiruv tarixiga faqat natija tanlanganda yozamiz (chala so'zlar saqlanmasin)
                                if (q.length >= 2) {
                                    addSearchHistory('listings', q);
                                    onSearchCommitted?.();
                                }
                                onSelect(l);
                            }}
                            className={`tg-chat-row w-full flex items-center gap-3 px-3 h-[72px] text-left border-0 ${
                                selectedId && String(selectedId) === String(l.id) ? 'is-active' : ''
                            }`}
                        >
                            <MarketAvatar src={l.user?.avatar_url} name={author || title} seed={String(l.user_id)} />
                            <div className="flex-1 min-w-0 self-stretch flex flex-col justify-center border-b border-white/[0.06]">
                                <div className="flex items-baseline justify-between gap-2">
                                    <h3 className="truncate text-[15px] font-medium text-white">{title || author}</h3>
                                    <span className="shrink-0 text-[12px] text-[#aaaaaa]">
                                        {formatListDate(l.created_at, language)}
                                    </span>
                                </div>
                                <p className="truncate text-[14px] text-[#aaaaaa] mt-0.5">
                                    {own ? <span className="text-[#8774e1]">{t('listing_yours')} · </span> : author ? `${author} · ` : ''}
                                    {rest}
                                </p>
                            </div>
                        </button>
                    );
                })
            )}
        </div>
    );
}

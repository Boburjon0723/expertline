'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Clock, TrendingUp } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { clearSearchHistory, getSearchHistory, type SearchScope } from '@/lib/search-history';

type Props = {
    scope: SearchScope;
    /** E'lonlar uchun: employer | seeker */
    subType?: 'employer' | 'seeker';
    query: string;
    onPick: (term: string) => void;
    /** Tarix yangilanganini bildirish uchun (qidiruv bajarilgach oshiriladi) */
    historyVersion?: number;
};

/**
 * Qidiruv maydoni ostidagi kalit so'zlar:
 * - bo'sh qidiruv: oxirgi qidiruvlar + ommabop so'zlar
 * - yozilayotganda (e'lonlar / mutaxassislar): shu harflarga mos takliflar
 * Chatlar uchun faqat oxirgi qidiruvlar (serverga so'rov ketmaydi).
 */
export default function SearchSuggestions({ scope, subType, query, onPick, historyVersion = 0 }: Props) {
    const { t } = useLanguage();
    const [popular, setPopular] = useState<string[]>([]);
    const [clearedAt, setClearedAt] = useState(0);
    const q = query.trim();

    // localStorage'dan o'qiladi; tarix yangilanganda (historyVersion) yoki tozalanganda qayta hisoblanadi
    const recent = useMemo(
        () => getSearchHistory(scope),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [scope, historyVersion, clearedAt]
    );

    useEffect(() => {
        if (scope === 'chats') return;
        const ac = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const params = new URLSearchParams({ scope });
                if (subType) params.set('type', subType);
                if (q) params.set('q', q);
                const res = await apiFetch(`/api/search/suggestions?${params.toString()}`, { signal: ac.signal });
                if (!res.ok) return;
                const data = await res.json();
                setPopular(Array.isArray(data?.suggestions) ? data.suggestions : []);
            } catch {
                /* abort / tarmoq */
            }
        }, q ? 250 : 0);
        return () => {
            clearTimeout(timer);
            ac.abort();
        };
    }, [scope, subType, q]);

    const recentShown = q ? recent.filter((r) => r.toLowerCase().includes(q.toLowerCase()) && r.toLowerCase() !== q.toLowerCase()) : recent;
    const popularShown = (scope === 'chats' ? [] : popular).filter((p) => p.toLowerCase() !== q.toLowerCase());

    if (recentShown.length === 0 && popularShown.length === 0) return null;

    const chip = (term: string, icon: React.ReactNode) => (
        <button
            key={term}
            type="button"
            onMouseDown={(e) => e.preventDefault() /* inputdan fokus ketmasin */}
            onClick={() => onPick(term)}
            className="inline-flex items-center gap-1.5 max-w-full rounded-full border border-white/[0.12] px-3 py-1.5 text-[14px] text-white hover:bg-white/[0.06] hover:border-[#8774e1]/50 transition-colors"
        >
            {icon}
            <span className="truncate">{term}</span>
        </button>
    );

    return (
        <div className="px-3 pt-2 pb-3 space-y-3 border-b border-white/[0.06]">
            {recentShown.length > 0 && (
                <div>
                    <div className="flex items-center justify-between px-1 pb-2">
                        <span className="text-[13px] font-medium text-[#8774e1]">{t('search_recent')}</span>
                        {!q && (
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    clearSearchHistory(scope);
                                    setClearedAt(Date.now());
                                }}
                                className="text-[13px] text-[#6d7f8f] hover:text-white"
                            >
                                {t('search_clear_history')}
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {recentShown.map((r) => chip(r, <Clock className="h-3.5 w-3.5 text-[#6d7f8f] shrink-0" />))}
                    </div>
                </div>
            )}
            {popularShown.length > 0 && (
                <div>
                    <div className="px-1 pb-2 text-[13px] font-medium text-[#8774e1]">{t('search_popular')}</div>
                    <div className="flex flex-wrap gap-2">
                        {popularShown.map((p) => chip(p, <TrendingUp className="h-3.5 w-3.5 text-[#6d7f8f] shrink-0" />))}
                    </div>
                </div>
            )}
        </div>
    );
}

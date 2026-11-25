'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BadgeCheck, MessageCircle, Search, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getUser } from '@/lib/auth-storage';
import { useLanguage } from '@/context/LanguageContext';
import { addSearchHistory } from '@/lib/search-history';
import type { MarketplaceContactPayload } from '@/lib/marketplace-chat';
import SearchSuggestions from './SearchSuggestions';
import { MarketAvatar } from './marketUi';

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
    expert_proposal?: string;
    bio_expert?: string;
    service_languages?: string;
};

/** Kasb kaliti: katta-kichik harf va bo'shliqlardan qat'i nazar bir xil guruh */
const professionKey = (e: ExpertRow) => String(e.profession || '').trim().toLowerCase();

const fullName = (e: ExpertRow) => `${e.name || ''} ${e.surname || ''}`.trim() || (e.username ? `@${e.username}` : '—');
const specialtyLine = (e: ExpertRow) => e.specialization_details || e.specialization || '';
const offerText = (e: ExpertRow) => e.specialty_desc || e.expert_proposal || '';

type Props = {
    onBack: () => void;
    onStartChat: (payload: MarketplaceContactPayload) => void;
    /** ?expert=ID havolasi yoki boshqa joydan ochilganda — darhol shu mutaxassis ko'rsatiladi */
    initialExpert?: ExpertRow | null;
};

/**
 * Mutaxassislar tabi (web): chap — chat ro'yxati kabi qatorlar + tabga oid qidiruv,
 * o'ng — tanlangan mutaxassis va "Yozish" tugmasi. Mobil brauzerda — bitta ustun.
 */
export default function ExpertsPanel({ onBack, onStartChat, initialExpert = null }: Props) {
    const { t } = useLanguage();
    const me = getUser() as { id?: string } | null;
    const [query, setQuery] = useState('');
    const [focused, setFocused] = useState(false);
    const [items, setItems] = useState<ExpertRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<ExpertRow | null>(initialExpert);

    useEffect(() => {
        if (initialExpert) setSelected(initialExpert);
    }, [initialExpert]);
    const [historyVersion, setHistoryVersion] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const q = query.trim();
    /** Tanlangan kategoriya (kasb kaliti); null — hammasi */
    const [category, setCategory] = useState<string | null>(null);

    // Kategoriyalar — mavjud mutaxassislarning kasblaridan (ko'pi birinchi); o'zi yozgan kasblar ham chiqadi
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

    // Tanlangan kategoriya qidiruv natijalarida qolmasa — "Hammasi"
    const activeCategory = category && categories.some((c) => c.key === category) ? category : null;
    const visible = useMemo(
        () => (activeCategory ? items.filter((e) => professionKey(e) === activeCategory) : items),
        [items, activeCategory]
    );

    useEffect(() => {
        const ac = new AbortController();
        setLoading(true);
        const timer = setTimeout(async () => {
            try {
                const params = new URLSearchParams({ limit: '100' });
                if (q) params.set('q', q);
                const res = await apiFetch(`/api/users/experts?${params.toString()}`, { signal: ac.signal });
                const data = res.ok ? await res.json() : [];
                setItems(Array.isArray(data) ? data : []);
            } catch {
                /* abort */
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        }, q ? 300 : 0);
        return () => {
            clearTimeout(timer);
            ac.abort();
        };
    }, [q]);

    const pick = (e: ExpertRow) => {
        if (q.length >= 2) {
            addSearchHistory('experts', q);
            setHistoryVersion((v) => v + 1);
        }
        setSelected(e);
    };

    const write = (e: ExpertRow) => {
        onStartChat({
            id: String(e.id),
            name: e.name,
            surname: e.surname,
            username: e.username,
            avatar_url: e.avatar_url || undefined,
            fromExpertListing: true,
            profession: e.profession,
        });
    };

    const showSuggestions = focused && (!q || q.length < 30);

    const list = (
        <div className={`${selected ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-[420px] lg:shrink-0 min-h-0 h-full bg-[#212121] lg:border-r border-white/[0.06]`}>
            <div className="shrink-0 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onBack}
                        className="w-10 h-10 shrink-0 rounded-full hover:bg-white/10 flex items-center justify-center text-[#aaaaaa] hover:text-white"
                        aria-label={t('back')}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="relative flex-1 min-w-0">
                        {/* Chat ro'yxatidagi qidiruv bilan bir xil: lupa input balandligi bo'ylab markazda */}
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-[#aaaaaa]" />
                        </div>
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            placeholder={t('search_experts_ph')}
                            className="w-full bg-[#181818] border-none outline-none text-[15px] text-white rounded-full py-[7px] pl-10 pr-9 placeholder-[#aaaaaa]"
                        />
                        {query && (
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setQuery('')}
                                className="absolute inset-y-0 right-3 flex items-center text-[#aaaaaa] hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
                {categories.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar px-1 pt-2.5">
                        {[{ key: null as string | null, label: t('all'), n: items.length }, ...categories].map((c) => {
                            const on = activeCategory === c.key;
                            return (
                                <button
                                    key={c.key ?? '__all'}
                                    type="button"
                                    onClick={() => setCategory(c.key)}
                                    className={`shrink-0 flex items-center gap-1.5 h-8 px-3.5 rounded-full border text-[14px] font-medium transition-colors ${
                                        on
                                            ? 'bg-[#8774e1] border-[#8774e1] text-white'
                                            : 'bg-white/[0.06] border-white/[0.1] text-white/85 hover:bg-white/[0.1]'
                                    }`}
                                >
                                    <span className="max-w-[180px] truncate">{c.label}</span>
                                    <span className={`text-[12px] ${on ? 'text-white/85' : 'text-white/45'}`}>{c.n}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
                <h2 className="px-3 pt-3 text-[14px] font-medium text-[#8774e1]">{t('experts_tab')}</h2>
            </div>

            {showSuggestions && (
                <SearchSuggestions
                    scope="experts"
                    query={query}
                    historyVersion={historyVersion}
                    onPick={(term) => {
                        setQuery(term);
                        inputRef.current?.focus();
                    }}
                />
            )}

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-20">
                {loading && items.length === 0 ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 h-[72px] animate-pulse">
                            <div className="h-[54px] w-[54px] rounded-full bg-white/10 shrink-0" />
                            <div className="flex-1 space-y-2 border-b border-white/[0.06] py-3">
                                <div className="h-3.5 w-1/2 rounded bg-white/10" />
                                <div className="h-3 w-3/4 rounded bg-white/5" />
                            </div>
                        </div>
                    ))
                ) : visible.length === 0 ? (
                    <div className="flex items-center justify-center h-40 mt-10 text-[14px] text-[#aaaaaa]">
                        {q ? t('listings_nothing_found') : t('experts_empty_list')}
                    </div>
                ) : (
                    visible.map((e) => (
                        <button
                            key={e.id}
                            type="button"
                            onClick={() => pick(e)}
                            className={`tg-chat-row w-full flex items-center gap-3 px-3 h-[72px] text-left border-0 ${
                                selected?.id === e.id ? 'is-active' : ''
                            }`}
                        >
                            <MarketAvatar src={e.avatar_url} name={fullName(e)} seed={String(e.id)} />
                            <div className="flex-1 min-w-0 self-stretch flex flex-col justify-center border-b border-white/[0.06]">
                                <div className="flex items-baseline justify-between gap-2">
                                    <h3 className="flex items-center gap-1 min-w-0 text-[15px] font-medium text-white">
                                        <span className="truncate">{fullName(e)}</span>
                                        <BadgeCheck className="h-4 w-4 shrink-0 text-[#8774e1]" />
                                    </h3>
                                    <span className="shrink-0 max-w-[45%] truncate text-[12px] text-[#aaaaaa]">{e.profession}</span>
                                </div>
                                <p className="truncate text-[14px] text-[#aaaaaa] mt-0.5">
                                    {specialtyLine(e) || offerText(e)}
                                </p>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );

    const detail = selected ? (
        <div className="flex flex-col flex-1 min-w-0 min-h-0 h-full bg-[#212121] lg:bg-transparent">
            <header className="shrink-0 flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 bg-[#212121] border-b border-white/[0.06] lg:hidden">
                <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="p-2.5 min-h-[44px] min-w-[44px] rounded-full text-[#aaaaaa] hover:bg-white/[0.08] hover:text-white flex items-center justify-center"
                    aria-label={t('back')}
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <p className="truncate text-[16px] font-medium text-white">{fullName(selected)}</p>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <div className="mx-auto w-full max-w-[560px] px-4 py-6">
                    <div className="rounded-2xl bg-[#212121] border border-white/[0.06] overflow-hidden">
                        <div className="flex flex-col items-center px-6 pt-6 pb-5">
                            <MarketAvatar src={selected.avatar_url} name={fullName(selected)} seed={String(selected.id)} size={110} />
                            <h2 className="mt-3.5 flex items-center gap-1.5 text-[20px] font-medium text-white text-center">
                                {fullName(selected)}
                                <BadgeCheck className="h-5 w-5 text-[#8774e1]" />
                            </h2>
                            {selected.profession && <p className="mt-0.5 text-[14px] text-[#8774e1]">{selected.profession}</p>}
                        </div>
                        <div className="h-3 bg-[#0f0f0f]" />
                        <div className="px-5 py-3 space-y-4">
                            {specialtyLine(selected) && (
                                <div>
                                    <p className="text-[16px] text-white leading-snug">{specialtyLine(selected)}</p>
                                    <p className="text-[13px] text-[#6d7f8f] mt-0.5">{t('specialization')}</p>
                                </div>
                            )}
                            {selected.service_languages && (
                                <div>
                                    <p className="text-[16px] text-white leading-snug">{selected.service_languages}</p>
                                    <p className="text-[13px] text-[#6d7f8f] mt-0.5">{t('expert_languages_label')}</p>
                                </div>
                            )}
                            {offerText(selected) && (
                                <div>
                                    <p className="text-[15px] text-white leading-relaxed whitespace-pre-wrap">{offerText(selected)}</p>
                                    <p className="text-[13px] text-[#6d7f8f] mt-0.5">{t('expert_about_label')}</p>
                                </div>
                            )}
                            {selected.bio_expert && (
                                <div>
                                    <p className="text-[15px] text-white leading-relaxed whitespace-pre-wrap">{selected.bio_expert}</p>
                                    <p className="text-[13px] text-[#6d7f8f] mt-0.5">{t('bio')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {String(selected.id) !== String(me?.id || '') && (
                <div className="shrink-0 border-t border-white/[0.06] bg-[#212121] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <div className="mx-auto w-full max-w-[560px]">
                        <button
                            type="button"
                            onClick={() => write(selected)}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[16px] font-medium text-white bg-[#8774e1] hover:bg-[#7a67d4] transition-colors"
                        >
                            <MessageCircle className="h-5 w-5" />
                            {t('expert_write')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center">
            <span className="rounded-full bg-black/30 px-3 py-1 text-[14px] text-white/80">{t('expert_select')}</span>
        </div>
    );

    return (
        <div className="flex flex-1 min-h-0 h-full w-full overflow-hidden">
            {list}
            {detail}
        </div>
    );
}

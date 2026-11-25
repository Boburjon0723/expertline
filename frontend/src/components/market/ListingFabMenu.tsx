'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, LayoutGrid, MapPin, PenLine, Plus, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { REGIONS, regionShortLabel } from '@/lib/regions';
import { DIRECTIONS, directionEmoji, directionLabel } from '@/lib/directions';
import { useListingFilters } from '@/hooks/useListingFilters';
import type { ListingSubType } from './ListingsFeed';

type Props = {
    subType: ListingSubType;
    onCompose: () => void;
};

type Facets = { regions: Record<string, number>; directions: Record<string, number> };

/** E'lonlar papkasidagi "+" tugmasi: e'lon berish, viloyat va yo'nalish filtri */
export default function ListingFabMenu({ subType, onCompose }: Props) {
    const { t, language } = useLanguage();
    const { region, direction, setRegion, setDirection } = useListingFilters();
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<'main' | 'region' | 'direction'>('main');
    const [facets, setFacets] = useState<Facets>({ regions: {}, directions: {} });
    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const ac = new AbortController();
        const params = new URLSearchParams({ sub_type: subType });
        if (region !== 'all') params.set('region', region);
        if (direction !== 'all') params.set('direction', direction);
        apiFetch(`/api/jobs/facets?${params.toString()}`, { signal: ac.signal })
            .then((r) => (r.ok ? r.json() : null))
            .then((d: Partial<Facets> | null) => setFacets({ regions: d?.regions ?? {}, directions: d?.directions ?? {} }))
            .catch(() => {});
        const onDown = (e: MouseEvent) => {
            if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onKey);
        return () => {
            ac.abort();
            document.removeEventListener('mousedown', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [open, subType, region, direction]);

    const toggle = () => {
        setView('main');
        setOpen((v) => !v);
    };

    const regional = region !== 'all';
    const hasDirection = direction !== 'all';
    const regionText = regional ? regionShortLabel(region, language) : t('region_all');
    const directionText = hasDirection ? `${directionEmoji(direction)} ${directionLabel(direction, language)}` : t('direction_all');

    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

    const optionList = (
        rows: { code: string; label: string; n: number }[],
        value: string,
        onPick: (code: string) => void,
        title: string
    ) => (
        <>
            <div className="flex items-center gap-1 px-1.5 pt-1 pb-1">
                <button
                    type="button"
                    onClick={() => setView('main')}
                    className="p-2 rounded-full text-[#aaaaaa] hover:bg-white/[0.08] hover:text-white"
                    aria-label={t('back')}
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="text-[14px] font-medium text-white">{title}</span>
            </div>
            <div className="max-h-[min(380px,55vh)] overflow-y-auto custom-scrollbar pb-1">
                {rows.map((r) => {
                    const on = value === r.code;
                    return (
                        <button
                            key={r.code}
                            type="button"
                            onClick={() => {
                                onPick(r.code);
                                setOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-4 h-10 text-left text-[14px] hover:bg-white/[0.06] transition-colors"
                        >
                            <span className={`flex-1 truncate ${on ? 'text-[#8774e1] font-medium' : 'text-white'}`}>{r.label}</span>
                            <span className="text-[12px] text-[#6d7f8f]">{r.n}</span>
                            <span className="w-4 flex justify-end">{on && <Check className="h-4 w-4 text-[#8774e1]" />}</span>
                        </button>
                    );
                })}
            </div>
        </>
    );

    const menuRow = (icon: React.ReactNode, title: string, value: string | null, active: boolean, onClick: () => void) => (
        <button
            type="button"
            onClick={onClick}
            className="w-full flex items-center gap-3 px-4 min-h-[52px] text-left hover:bg-white/[0.06] transition-colors"
        >
            {icon}
            <span className="flex-1 min-w-0 py-2">
                <span className="block text-[15px] font-medium text-white">{title}</span>
                {value != null && (
                    <span className={`block truncate text-[13px] ${active ? 'text-[#8774e1]' : 'text-[#aaaaaa]'}`}>{value}</span>
                )}
            </span>
            {value != null && <ChevronRight className="h-4 w-4 text-[#6d7f8f] shrink-0" />}
        </button>
    );

    return (
        <div ref={boxRef} className="absolute right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30">
            {open && (
                <div className="absolute right-0 bottom-full mb-3 w-[280px] rounded-2xl bg-[#212121] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden animate-fade-in">
                    {view === 'main' && (
                        <div className="py-1">
                            {menuRow(<PenLine className="h-5 w-5 text-[#8774e1] shrink-0" />, t('listing_new'), null, false, () => {
                                setOpen(false);
                                onCompose();
                            })}
                            <div className="h-px bg-white/[0.06] ml-12" />
                            {menuRow(<MapPin className="h-5 w-5 text-white shrink-0" />, t('region_label'), regionText, regional, () =>
                                setView('region')
                            )}
                            <div className="h-px bg-white/[0.06] ml-12" />
                            {menuRow(<LayoutGrid className="h-5 w-5 text-white shrink-0" />, t('direction_label'), directionText, hasDirection, () =>
                                setView('direction')
                            )}
                        </div>
                    )}
                    {view === 'region' &&
                        optionList(
                            [
                                { code: 'all', label: t('region_all'), n: sum(facets.regions) },
                                ...REGIONS.map((r) => ({ code: r.code, label: r[language], n: facets.regions[r.code] ?? 0 })),
                            ],
                            region,
                            (c) => setRegion(c as typeof region),
                            t('region_pick')
                        )}
                    {view === 'direction' &&
                        optionList(
                            [
                                { code: 'all', label: t('direction_all'), n: sum(facets.directions) },
                                ...DIRECTIONS.map((d) => ({
                                    code: d.code,
                                    label: `${d.emoji}  ${d[language]}`,
                                    n: facets.directions[d.code] ?? 0,
                                })),
                            ],
                            direction,
                            (c) => setDirection(c as typeof direction),
                            t('direction_pick')
                        )}
                </div>
            )}
            <button
                type="button"
                onClick={toggle}
                className={`relative h-14 w-14 rounded-full text-white shadow-[0_4px_16px_rgba(0,0,0,0.4)] flex items-center justify-center transition-colors ${
                    open ? 'bg-[#3a3f4b] hover:bg-[#454b58]' : 'bg-[#8774e1] hover:bg-[#7a67d4]'
                }`}
                aria-label={t('listing_new')}
                aria-expanded={open}
                title={t('listing_new')}
            >
                {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                {!open && (regional || hasDirection) && (
                    <span className="absolute top-1 right-1 h-3 w-3 rounded-full bg-white border-2 border-[#8774e1]" />
                )}
            </button>
        </div>
    );
}

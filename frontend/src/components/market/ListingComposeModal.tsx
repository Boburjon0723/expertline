'use client';

import React, { useEffect, useRef, useState } from 'react';
import { LayoutGrid, MapPin, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import type { ListingSubType } from './ListingsFeed';
import { REGIONS, type RegionCode } from '@/lib/regions';
import { DIRECTIONS, type DirectionCode } from '@/lib/directions';
import { useListingFilters } from '@/hooks/useListingFilters';

const MIN_LEN = 20;
const MAX_LEN = 3000;

type Props = {
    initialType: ListingSubType;
    onClose: () => void;
    onPublished: (type: ListingSubType) => void;
};

/**
 * E'lon berish: tur + bitta matn maydoni + bitta tugma.
 * Placeholder'da to'liq namuna — foydalanuvchi shartlarini yoki o'zi haqida erkin yozadi.
 */
export default function ListingComposeModal({ initialType, onClose, onPublished }: Props) {
    const { t, language } = useLanguage();
    const [type, setType] = useState<ListingSubType>(initialType);
    // Ro'yxatda tanlangan viloyat va yo'nalish oldindan qo'yiladi
    const filters = useListingFilters();
    const [region, setRegion] = useState<RegionCode | ''>(filters.region !== 'all' ? filters.region : '');
    const [direction, setDirection] = useState<DirectionCode | ''>(filters.direction !== 'all' ? filters.direction : '');
    const [text, setText] = useState('');
    const [title, setTitle] = useState('');
    const [company, setCompany] = useState('');
    const titleRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const areaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        titleRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const len = text.trim().length;

    const publish = async () => {
        const cleanTitle = title.replace(/\s+/g, ' ').trim();
        if (cleanTitle.length < 5 || cleanTitle.length > 80) {
            setError(t('listing_title_required'));
            titleRef.current?.focus();
            return;
        }
        if (!region) {
            setError(t('region_required'));
            return;
        }
        if (!direction) {
            setError(t('direction_required'));
            return;
        }
        if (len < MIN_LEN) {
            setError(t('listing_text_too_short'));
            return;
        }
        setBusy(true);
        setError('');
        try {
            const res = await apiFetch('/api/jobs', {
                method: 'POST',
                body: JSON.stringify({
                    sub_type: type,
                    title: title.replace(/\s+/g, ' ').trim(),
                    short_text: text.trim(),
                    region,
                    direction,
                    company_name: type === 'employer' ? company.trim() : undefined,
                }),
            });
            if (!res.ok) {
                const err = (await res.json().catch(() => ({}))) as { message?: string };
                setError(err.message || t('server_error'));
                return;
            }
            onPublished(type);
        } catch {
            setError(t('server_error'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 lg:p-4 animate-fade-in"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                className="w-full h-full lg:h-auto lg:max-w-[480px] lg:max-h-[88vh] flex flex-col overflow-hidden rounded-none lg:rounded-2xl bg-[#212121] text-white border border-white/[0.06] shadow-[0_2px_16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex min-h-12 items-center gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1 shrink-0">
                    <h2 className="flex-1 min-w-0 truncate pl-3 text-[20px] font-medium">{t('listing_new')}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2.5 min-h-[44px] min-w-[44px] rounded-full text-[#aaaaaa] hover:bg-white/[0.08] hover:text-white flex items-center justify-center"
                        aria-label={t('cancel')}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="px-5 pb-3 shrink-0">
                    <div className="flex p-1 rounded-full bg-white/[0.06] border border-white/[0.08]">
                        {(['employer', 'seeker'] as ListingSubType[]).map((k) => (
                            <button
                                key={k}
                                type="button"
                                onClick={() => setType(k)}
                                className={`flex-1 h-9 rounded-full text-[14px] font-medium transition-colors ${
                                    type === k ? 'bg-[#8774e1] text-white' : 'text-[#aaaaaa] hover:text-white'
                                }`}
                            >
                                {k === 'employer' ? t('listing_type_employer') : t('listing_type_seeker')}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="px-5 pb-3 shrink-0 space-y-2.5">
                    <input
                        ref={titleRef}
                        value={title}
                        onChange={(e) => {
                            setTitle(e.target.value.slice(0, 80));
                            if (error) setError('');
                        }}
                        placeholder={type === 'employer' ? t('listing_title_ph_employer') : t('listing_title_ph_seeker')}
                        className="w-full h-11 rounded-xl bg-transparent border border-white/[0.12] focus:border-[#8774e1] px-4 text-[16px] font-medium text-white placeholder:text-[#6d7f8f] placeholder:font-normal focus:outline-none"
                    />
                    {type === 'employer' && (
                        <input
                            value={company}
                            onChange={(e) => setCompany(e.target.value.slice(0, 80))}
                            placeholder={t('listing_company_ph')}
                            className="w-full h-11 rounded-xl bg-transparent border border-white/[0.12] focus:border-[#8774e1] px-4 text-[15px] text-white placeholder:text-[#6d7f8f] focus:outline-none"
                        />
                    )}
                </div>

                <div className="px-5 pb-3 shrink-0">
                    <label className="relative flex items-center">
                        <MapPin className={`absolute left-3.5 h-4 w-4 pointer-events-none ${region ? 'text-[#8774e1]' : 'text-[#6d7f8f]'}`} />
                        <select
                            value={region}
                            onChange={(e) => {
                                setRegion(e.target.value as RegionCode);
                                if (error) setError('');
                            }}
                            className={`w-full h-11 rounded-xl bg-transparent border pl-10 pr-4 text-[15px] focus:outline-none focus:border-[#8774e1] ${
                                region ? 'text-white' : 'text-[#6d7f8f]'
                            } ${error && !region ? 'border-[#e53935]' : 'border-white/[0.12]'}`}
                            aria-label={t('region_pick')}
                        >
                            <option value="" disabled className="bg-[#212121]">
                                {t('region_pick')}
                            </option>
                            {REGIONS.map((r) => (
                                <option key={r.code} value={r.code} className="bg-[#212121] text-white">
                                    {r[language]}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="relative flex items-center mt-2.5">
                        <LayoutGrid className={`absolute left-3.5 h-4 w-4 pointer-events-none ${direction ? 'text-[#8774e1]' : 'text-[#6d7f8f]'}`} />
                        <select
                            value={direction}
                            onChange={(e) => {
                                setDirection(e.target.value as DirectionCode);
                                if (error) setError('');
                            }}
                            className={`w-full h-11 rounded-xl bg-transparent border pl-10 pr-4 text-[15px] focus:outline-none focus:border-[#8774e1] ${
                                direction ? 'text-white' : 'text-[#6d7f8f]'
                            } ${error && region && !direction ? 'border-[#e53935]' : 'border-white/[0.12]'}`}
                            aria-label={t('direction_pick')}
                        >
                            <option value="" disabled className="bg-[#212121]">
                                {t('direction_pick')}
                            </option>
                            {DIRECTIONS.map((d) => (
                                <option key={d.code} value={d.code} className="bg-[#212121] text-white">
                                    {d.emoji}  {d[language]}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="flex-1 min-h-0 px-5 flex flex-col">
                    <textarea
                        ref={areaRef}
                        value={text}
                        onChange={(e) => {
                            setText(e.target.value.slice(0, MAX_LEN));
                            if (error) setError('');
                        }}
                        placeholder={type === 'employer' ? t('listing_ph_employer') : t('listing_ph_seeker')}
                        className={`flex-1 min-h-[260px] lg:min-h-[320px] w-full resize-none rounded-xl bg-transparent border px-4 py-3 text-[15px] leading-relaxed text-white placeholder:text-[#6d7f8f] focus:outline-none transition-colors ${
                            error ? 'border-[#e53935]' : 'border-white/[0.12] focus:border-[#8774e1]'
                        }`}
                    />
                    <div className="flex items-center justify-between pt-1.5 pb-2 text-[12px]">
                        <span className="text-[#e53935]">{error}</span>
                        <span className={len < MIN_LEN ? 'text-[#6d7f8f]' : 'text-[#aaaaaa]'}>
                            {text.length}/{MAX_LEN}
                        </span>
                    </div>
                </div>

                <div className="shrink-0 px-5 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/[0.06]">
                    <button
                        type="button"
                        onClick={() => void publish()}
                        disabled={busy}
                        className="w-full py-3 rounded-xl text-[16px] font-medium text-white bg-[#8774e1] hover:bg-[#7a67d4] disabled:opacity-60 transition-colors"
                    >
                        {busy ? t('loading') : t('listing_publish')}
                    </button>
                </div>
            </div>
        </div>
    );
}

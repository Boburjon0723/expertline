'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import type { ListingSubType } from './ListingsFeed';

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
    const { t } = useLanguage();
    const [type, setType] = useState<ListingSubType>(initialType);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const areaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        areaRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const len = text.trim().length;

    const publish = async () => {
        if (len < MIN_LEN) {
            setError(t('listing_text_too_short'));
            return;
        }
        setBusy(true);
        setError('');
        try {
            const res = await apiFetch('/api/jobs', {
                method: 'POST',
                body: JSON.stringify({ sub_type: type, short_text: text.trim() }),
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

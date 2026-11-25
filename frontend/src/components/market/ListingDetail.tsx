'use client';

import React, { useState } from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import type { MarketplaceContactPayload } from '@/lib/marketplace-chat';
import { MarketAvatar, listingAuthor, listingParts, type ListingRow } from './marketUi';

type Props = {
    listing: ListingRow;
    currentUserId?: string | null;
    onBack: () => void;
    onContact: (payload: MarketplaceContactPayload) => void;
    onClosed: () => void;
};

/** E'lon: muallif, to'liq matn va bitta "Bog'lanish" tugmasi (asosiy oynada, chat o'rnida) */
export default function ListingDetail({ listing, currentUserId, onBack, onContact, onClosed }: Props) {
    const { t, language } = useLanguage();
    const [closing, setClosing] = useState(false);
    const { title, body } = listingParts(listing);
    const company = String(listing.company_name || '').trim();
    const author = listingAuthor(listing);
    const own = !!currentUserId && String(listing.user_id) === String(currentUserId);
    const created = listing.created_at ? new Date(listing.created_at) : null;
    const dateLabel =
        created && !Number.isNaN(created.getTime())
            ? created.toLocaleString(language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ', {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
              })
            : '';

    const contact = () => {
        onContact({
            id: String(listing.user_id),
            name: listing.user?.name || author,
            surname: listing.user?.surname,
            username: listing.user?.username,
            avatar_url: listing.user?.avatar_url || undefined,
            fromJobListing: true,
            jobId: String(listing.id),
            jobIntent: 'chat',
            jobTitle: title,
            jobCompany: company || author,
        });
    };

    const closeListing = async () => {
        setClosing(true);
        try {
            const res = await apiFetch(`/api/jobs/${listing.id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'closed' }),
            });
            if (res.ok) onClosed();
        } finally {
            setClosing(false);
        }
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full bg-[#212121] lg:bg-transparent text-white">
            <header className="shrink-0 flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 bg-[#212121] border-b border-white/[0.06]">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-2.5 min-h-[44px] min-w-[44px] rounded-full text-[#aaaaaa] hover:bg-white/[0.08] hover:text-white flex items-center justify-center"
                    aria-label={t('back')}
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <MarketAvatar src={listing.user?.avatar_url} name={author} seed={String(listing.user_id)} size={40} />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-medium">{author || title}</p>
                    <p className="truncate text-[13px] text-[#aaaaaa]">
                        {listing.sub_type === 'employer' ? t('listing_type_employer') : t('listing_type_seeker')}
                        {dateLabel ? ` · ${dateLabel}` : ''}
                    </p>
                </div>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <div className="mx-auto w-full max-w-[640px] px-4 py-5">
                    <div className="rounded-2xl bg-[#212121] border border-white/[0.06] px-5 py-4">
                        {title && <h2 className="text-[19px] font-semibold leading-snug text-white">{title}</h2>}
                        {company && <p className="mt-1 text-[14px] font-medium text-[#8774e1]">{company}</p>}
                        {body && (
                            <p className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white ${title || company ? 'mt-3' : ''}`}>
                                {body}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="shrink-0 border-t border-white/[0.06] bg-[#212121] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="mx-auto w-full max-w-[640px]">
                    {own ? (
                        <div className="flex items-center gap-3">
                            <span className="flex-1 text-[14px] text-[#8774e1]">{t('listing_yours')}</span>
                            <button
                                type="button"
                                onClick={() => void closeListing()}
                                disabled={closing}
                                className="px-4 py-2.5 rounded-xl text-[15px] text-[#e53935] hover:bg-[#e53935]/10 disabled:opacity-60 transition-colors"
                            >
                                {t('listing_close')}
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={contact}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[16px] font-medium text-white bg-[#8774e1] hover:bg-[#7a67d4] transition-colors"
                        >
                            <MessageCircle className="h-5 w-5" />
                            {t('listing_contact')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

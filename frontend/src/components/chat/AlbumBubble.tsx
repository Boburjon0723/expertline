"use client";

import React, { useEffect, useState } from 'react';
import type { ChatMessage, ChatMessageMetadata } from '@/types/chat-message';
import { resolveChatMediaUrl } from '@/lib/telegram-message-kind';
import { useClickToLoad } from '@/lib/click-to-load';

/** Xabar metadata'sini obyekt sifatida o'qiydi (ba'zan JSON satr bo'lib keladi). */
export function messageMeta(m: ChatMessage): ChatMessageMetadata & Record<string, unknown> {
    const md = m.metadata;
    if (!md) return {};
    if (typeof md === 'string') {
        try {
            return JSON.parse(md);
        } catch {
            return {};
        }
    }
    return md as ChatMessageMetadata & Record<string, unknown>;
}

/** Albom kaliti: bir xil albumId + yuboruvchi, faqat rasm/video. */
export function albumKeyOf(m: ChatMessage): string | null {
    const meta = messageMeta(m);
    const aid = meta.albumId;
    const typ = String(m.type || '').toLowerCase();
    if (!aid || (typ !== 'image' && typ !== 'video')) return null;
    return `${String(aid)}|${String(m.sender_id ?? m.sender ?? '')}`;
}

/** Telegram'ga o'xshash qatorlar: 2 → [2], 3 → [1,2], 4 → [2,2], 5 → [2,3], keyin 3 talik. */
function albumRows(n: number): number[] {
    if (n <= 2) return [n];
    if (n === 3) return [1, 2];
    if (n === 4) return [2, 2];
    const rows: number[] = [];
    let left = n;
    while (left > 0) {
        if (left === 4) {
            rows.unshift(2, 2);
            break;
        }
        const take = left === 2 ? 2 : 3;
        rows.unshift(take);
        left -= take;
    }
    return rows;
}

function Tile({
    m,
    progress,
    onMediaClick,
    selecting,
    selected,
    onToggleSelect,
    onContextMenu,
    isOwn = false,
}: {
    m: ChatMessage;
    progress?: number;
    onMediaClick?: (url: string, type: 'image' | 'video') => void;
    selecting?: boolean;
    selected?: boolean;
    onToggleSelect?: (id: string) => void;
    onContextMenu?: (e: React.MouseEvent, m: ChatMessage) => void;
    isOwn?: boolean;
}) {
    const meta = messageMeta(m);
    const url = resolveChatMediaUrl(String(meta.url || m.text || ''));
    const isVideo = String(m.type).toLowerCase() === 'video';
    // HEIC va boshqa brauzer ochmaydigan rasmlar: singan belgi o'rniga joy egasi.
    const [broken, setBroken] = useState(false);
    // Avtomatik yuklash o'chiq: qabul qilingan rasm bosilganda chatning o'zida yuklanadi.
    const [shown, load] = useClickToLoad(url, isOwn);
    return (
        <button
            type="button"
            data-msg-id={m.id}
            className="relative flex-1 min-w-0 h-full overflow-hidden bg-[#1f2a3a] cursor-pointer"
            onClick={() => {
                if (selecting) {
                    onToggleSelect?.(m.id);
                    return;
                }
                if (m.isUploading || !url || broken) return;
                if (!isVideo && !shown) {
                    load();
                    return;
                }
                onMediaClick?.(url, isVideo ? 'video' : 'image');
            }}
            onContextMenu={(e) => onContextMenu?.(e, m)}
        >
            {!isVideo && !m.isUploading && url && shown && !broken ? (
                <img
                    src={url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={() => setBroken(true)}
                    className="absolute inset-0 w-full h-full object-cover"
                />
            ) : null}
            {(!shown || isVideo) && typeof meta.thumb === 'string' && meta.thumb ? (
                <img
                    src={String(meta.thumb)}
                    alt=""
                    className={`absolute inset-0 w-full h-full object-cover ${isVideo ? 'blur-[1px]' : 'blur-lg scale-110'}`}
                />
            ) : null}
            {!isVideo && !m.isUploading && url && !shown ? (
                <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-11 h-11 rounded-full bg-black/55 flex items-center justify-center text-white">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14" /></svg>
                    </span>
                </span>
            ) : null}
            {broken ? (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-white/70 text-xs">
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {/\.hei[cf](\?|$)/i.test(url) ? "HEIC — brauzerda ochilmaydi" : 'Rasm ochilmadi'}
                </span>
            ) : null}
            {selecting ? (
                <span
                    className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        selected ? 'bg-[#8774e1] border-[#8774e1]' : 'bg-black/30 border-white/80'
                    }`}
                >
                    {selected ? (
                        <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    ) : null}
                </span>
            ) : null}
            {isVideo || m.isUploading ? (
                <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-11 h-11 rounded-full bg-black/45 flex items-center justify-center border border-white/20 text-white text-xs font-semibold">
                        {m.isUploading ? (
                            `${Math.round(progress ?? 0)}%`
                        ) : (
                            <svg className="h-5 w-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        )}
                    </span>
                </span>
            ) : null}
        </button>
    );
}

/** Albom: bir nechta rasm/video bitta xabarda to'r ko'rinishida (Telegram kabi). */
export function AlbumBubble({
    items,
    isOwn,
    timeLabel,
    uploadProgresses,
    onMediaClick,
    isSelecting,
    selectedIds,
    onToggleSelect,
    onSelectMany,
    onReply,
    onForward,
    onDelete,
}: {
    items: ChatMessage[];
    isOwn: boolean;
    timeLabel?: string;
    uploadProgresses?: Record<string, number>;
    onMediaClick?: (url: string, type: 'image' | 'video') => void;
    isSelecting?: boolean;
    selectedIds?: string[];
    onToggleSelect?: (id: string) => void;
    /** Belgilash rejimini yoqib, shu xabarlarni belgilaydi. */
    onSelectMany?: (ids: string[]) => void;
    onReply?: (m: ChatMessage) => void;
    onForward?: (m: ChatMessage) => void;
    onDelete?: (m: ChatMessage) => void;
}) {
    const [menu, setMenu] = useState<{ x: number; y: number; m: ChatMessage } | null>(null);
    useEffect(() => {
        if (!menu) return;
        const close = () => setMenu(null);
        window.addEventListener('click', close);
        window.addEventListener('scroll', close, true);
        return () => {
            window.removeEventListener('click', close);
            window.removeEventListener('scroll', close, true);
        };
    }, [menu]);
    const openMenu = (e: React.MouseEvent, m: ChatMessage) => {
        if (isSelecting || m.isUploading) return;
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY, m });
    };
    const caption = items.map((m) => messageMeta(m).caption).find((c) => typeof c === 'string' && c.trim());
    const rows = albumRows(items.length).reduce<ChatMessage[][]>((acc, count) => {
        const start = acc.reduce((n, r) => n + r.length, 0);
        acc.push(items.slice(start, start + count));
        return acc;
    }, []);
    return (
        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} my-1 px-1`}>
            <div className="w-[min(360px,75vw)] rounded-2xl overflow-hidden bg-black/20 border border-white/5">
                <div className="flex flex-col gap-[2px]">
                    {rows.map((rowItems, r) => {
                        const count = rowItems.length;
                        const h = count === 1 ? 'h-[220px]' : count === 2 ? 'h-[170px]' : 'h-[118px]';
                        return (
                            <div key={r} className={`flex gap-[2px] ${h}`}>
                                {rowItems.map((m) => (
                                    <Tile
                                        key={m.id}
                                        m={m}
                                        progress={uploadProgresses?.[m.id]}
                                        onMediaClick={onMediaClick}
                                        selecting={isSelecting}
                                        selected={!!selectedIds?.includes(m.id)}
                                        onToggleSelect={onToggleSelect}
                                        onContextMenu={openMenu}
                                        isOwn={isOwn}
                                    />
                                ))}
                            </div>
                        );
                    })}
                </div>
                {caption ? (
                    <div className="px-3 py-2 text-sm text-white/90 flex items-end gap-2">
                        <span className="flex-1 whitespace-pre-wrap break-words">{String(caption)}</span>
                        {timeLabel ? <span className="text-[11px] text-white/50 shrink-0">{timeLabel}</span> : null}
                    </div>
                ) : timeLabel ? (
                    <div className="relative">
                        <span className="absolute right-2 -top-7 px-1.5 py-0.5 rounded-full bg-black/45 text-[11px] text-white">
                            {timeLabel}
                        </span>
                    </div>
                ) : null}
            </div>
            {menu ? (
                <div
                    className="fixed z-[300] min-w-[190px] py-1 rounded-xl bg-[#212121] border border-white/10 shadow-2xl text-sm text-white"
                    style={{ left: Math.min(menu.x, window.innerWidth - 210), top: Math.min(menu.y, window.innerHeight - 200) }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {[
                        { label: 'Javob berish', run: () => onReply?.(menu.m), show: !!onReply },
                        { label: 'Forward', run: () => onForward?.(menu.m), show: !!onForward },
                        { label: 'Belgilash (albom)', run: () => onSelectMany?.(items.map((i) => i.id)), show: !!onSelectMany },
                        { label: "Shu rasmni o'chirish", run: () => onDelete?.(menu.m), show: !!onDelete, danger: true },
                    ]
                        .filter((a) => a.show)
                        .map((a) => (
                            <button
                                key={a.label}
                                type="button"
                                className={`w-full text-left px-3 py-2 hover:bg-white/10 ${a.danger ? 'text-red-400' : ''}`}
                                onClick={() => {
                                    setMenu(null);
                                    a.run();
                                }}
                            >
                                {a.label}
                            </button>
                        ))}
                </div>
            ) : null}
        </div>
    );
}

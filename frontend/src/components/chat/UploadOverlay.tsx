"use client";

import React from 'react';

function formatBytes(n: number): string {
    if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
    return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Telegram uslubidagi yuklanish qoplamasi: o'rtada halqa + ✕ (bekor qilish), xatoda ↻,
 * bayt ketishidan oldin foizsiz aylanuvchi chiziq ("Tayyorlanmoqda…"), chap tepada "1,0 / 3,1 MB".
 */
export function UploadOverlay({
    progress,
    size,
    error,
    onCancel,
    onRetry,
    compact = false,
}: {
    /** 0..100 */
    progress?: number;
    size?: number;
    error?: string | null;
    onCancel?: () => void;
    onRetry?: () => void;
    compact?: boolean;
}) {
    const p = Math.max(0, Math.min(100, progress ?? 0));
    const preparing = !error && p <= 0;
    const r = 22;
    const circ = 2 * Math.PI * r;
    const label = error
        ? 'Xato — qayta urinish'
        : preparing
          ? 'Tayyorlanmoqda…'
          : size
            ? `${formatBytes((size * p) / 100)} / ${formatBytes(size)}`
            : `${Math.round(p)}%`;
    return (
        <div className="absolute inset-0 z-10 bg-black/25 flex items-center justify-center">
            {!compact ? (
                <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/50 text-[11px] ${error ? 'text-red-300' : 'text-white'}`}>
                    {label}
                </span>
            ) : null}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    if (error) onRetry?.();
                    else onCancel?.();
                }}
                className="relative w-12 h-12 rounded-full bg-black/55 hover:bg-black/70 flex items-center justify-center text-white"
                aria-label={error ? 'Qayta urinish' : 'Bekor qilish'}
            >
                {!error ? (
                    <svg
                        className={`absolute inset-0 w-12 h-12 -rotate-90 ${preparing ? 'animate-spin' : ''}`}
                        viewBox="0 0 48 48"
                    >
                        <circle
                            cx="24"
                            cy="24"
                            r={r}
                            fill="none"
                            stroke="white"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeDasharray={preparing ? `${circ * 0.22} ${circ}` : `${circ}`}
                            strokeDashoffset={preparing ? 0 : circ * (1 - p / 100)}
                            style={{ transition: preparing ? undefined : 'stroke-dashoffset 0.3s' }}
                        />
                    </svg>
                ) : null}
                {error ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 4v5h5M20 20v-5h-5M5.6 15A7 7 0 0018.4 9M18.4 9H15m-9.8 6H9" /></svg>
                ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M6 6l12 12M18 6L6 18" /></svg>
                )}
            </button>
        </div>
    );
}

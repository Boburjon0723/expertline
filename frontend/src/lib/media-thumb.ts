"use client";

/**
 * Telegram uslubidagi kichik nusxa (thumbnail): yuborishdan oldin brauzerda yaratiladi va metadata ga
 * yoziladi (~1 KB data URI). Qabul qiluvchi rasm yuklanmaguncha uni xira holda ko'rsatadi.
 * Qo'shimcha kutubxonasiz — canvas orqali. Rasm uchun kadr o'zi, video uchun birinchi kadr.
 */
/** Rasm: 24 px (xira fon); video: 160 px birinchi kadr (deyarli tiniq preview, Telegram kabi). */
const IMAGE_EDGE = 24;
const VIDEO_EDGE = 160;

export interface MediaThumb {
    thumb: string;
    width: number;
    height: number;
    durationMs?: number;
}

function drawThumb(source: CanvasImageSource, w: number, h: number, edge: number): string | null {
    if (!w || !h) return null;
    const scale = edge / Math.max(w, h);
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, tw, th);
    try {
        return canvas.toDataURL('image/jpeg', 0.6);
    } catch {
        return null;
    }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
    return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

async function imageThumb(file: File): Promise<MediaThumb | null> {
    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
        await img.decode();
        const thumb = drawThumb(img, img.naturalWidth, img.naturalHeight, IMAGE_EDGE);
        return thumb ? { thumb, width: img.naturalWidth, height: img.naturalHeight } : null;
    } finally {
        URL.revokeObjectURL(url);
    }
}

async function videoThumb(file: File): Promise<MediaThumb | null> {
    const url = URL.createObjectURL(file);
    try {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.src = url;
        await new Promise<void>((resolve, reject) => {
            video.onloadeddata = () => resolve();
            video.onerror = () => reject(new Error('video'));
        });
        video.currentTime = Math.min(0.1, video.duration || 0);
        await new Promise<void>((resolve) => {
            video.onseeked = () => resolve();
            setTimeout(resolve, 800);
        });
        const thumb = drawThumb(video, video.videoWidth, video.videoHeight, VIDEO_EDGE);
        const durationMs = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : undefined;
        return thumb ? { thumb, width: video.videoWidth, height: video.videoHeight, durationMs } : null;
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** Rasm/video uchun kichik nusxa; boshqa turlar yoki xato — null (yuborishni to'xtatmaydi). */
export async function createMediaThumb(file: File): Promise<MediaThumb | null> {
    try {
        if (file.type.startsWith('image/')) return await withTimeout(imageThumb(file), 3000);
        if (file.type.startsWith('video/')) return await withTimeout(videoThumb(file), 4000);
    } catch {
        /* thumbnail ixtiyoriy */
    }
    return null;
}

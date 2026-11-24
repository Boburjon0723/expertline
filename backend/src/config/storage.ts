import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Fayl saqlash: Supabase Storage (public bucket).
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ixtiyoriy SUPABASE_STORAGE_BUCKET (default: chat-media).
 * Kalitlar bo'lmasa server ishga tushadi, faqat yuklash xato qaytaradi.
 */
let client: SupabaseClient | null | undefined;

function getClient(): SupabaseClient | null {
    if (client !== undefined) return client;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
    if (!client) {
        console.warn('[Storage] Not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). File uploads are disabled.');
    }
    return client;
}

export function storageBucketName(): string {
    return process.env.SUPABASE_STORAGE_BUCKET || 'chat-media';
}

export function isStorageConfigured(): boolean {
    return getClient() !== null;
}

/** Faylni bucket'ga yuklaydi va ochiq URL qaytaradi. */
export async function uploadObject(body: Buffer, objectKey: string, contentType: string): Promise<string> {
    const c = getClient();
    if (!c) {
        throw new Error('Fayl saqlash sozlanmagan (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
    }
    const bucket = c.storage.from(storageBucketName());
    const { error } = await bucket.upload(objectKey, body, {
        contentType,
        cacheControl: '31536000',
        upsert: false,
    });
    if (error) {
        throw new Error(`Faylni saqlab bo'lmadi: ${error.message}`);
    }
    return bucket.getPublicUrl(objectKey).data.publicUrl;
}

/** Chat media sifatida qabul qilinadigan hostlar: Supabase Storage + eski Firebase/GCS havolalari. */
export function isMediaStorageHost(hostname: string): boolean {
    const h = hostname.toLowerCase();
    return (
        h.endsWith('.supabase.co') ||
        h === 'storage.googleapis.com' ||
        h === 'firebasestorage.googleapis.com' ||
        h.endsWith('.firebasestorage.app')
    );
}

/** Matn ichidagi media URL ni aniqlash uchun (oxirgi xabar preview va h.k.). */
export const MEDIA_URL_RE = /\.supabase\.co\/storage\/|storage\.googleapis\.com|firebasestorage\.googleapis\.com|\.firebasestorage\.app/i;

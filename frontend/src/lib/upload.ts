import { getToken, getCsrfToken } from './auth-storage';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface UploadProgress {
    loaded: number;
    total: number;
    percent: number;
}

/** Yuborish paytida shuncha vaqt bir bayt ham ketmasa — ulanish osilgan, to'xtatamiz. */
const STALL_MS = 60_000;
/** Fayl to'liq yuborilgandan keyin server javobini kutish chegarasi (katta videoni saqlash vaqti bilan). */
const RESPONSE_TIMEOUT_MS = 180_000;

export const uploadFileWithProgress = (
    endpoint: string,
    formData: FormData,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal
): Promise<any> => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        // ✕ bosilganda yuklash to'xtatiladi.
        if (signal) {
            if (signal.aborted) {
                reject(Object.assign(new Error('Upload aborted'), { aborted: true }));
                return;
            }
            signal.addEventListener('abort', () => xhr.abort(), { once: true });
        }
        const token = typeof window !== 'undefined' ? getToken() : null;
        const csrf = getCsrfToken();

        xhr.open('POST', `${API_URL}${endpoint}`, true);
        xhr.withCredentials = true;
        if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        if (csrf) {
            xhr.setRequestHeader('X-CSRF-Token', csrf);
        }

        // Osilib qolgan ulanish "Yuklanmoqda..." ni abadiy qoldirmasin.
        let lastActivity = Date.now();
        let bodySentAt: number | null = null;
        const watchdog = setInterval(() => {
            const now = Date.now();
            const stalled = bodySentAt == null && now - lastActivity > STALL_MS;
            const noResponse = bodySentAt != null && now - bodySentAt > RESPONSE_TIMEOUT_MS;
            if (stalled || noResponse) {
                clearInterval(watchdog);
                xhr.abort();
                const err = new Error('Aloqa uzildi — fayl yuborilmadi. Qayta urinib ko\'ring.') as Error & { status?: number };
                err.status = 0;
                reject(err);
            }
        }, 5_000);
        xhr.addEventListener('loadend', () => clearInterval(watchdog));
        xhr.upload.onload = () => {
            bodySentAt = Date.now();
        };

        xhr.upload.onprogress = (event) => {
            lastActivity = Date.now();
            if (event.lengthComputable && onProgress) {
                const percent = Math.round((event.loaded / event.total) * 100);
                onProgress({
                    loaded: event.loaded,
                    total: event.total,
                    percent,
                });
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch {
                    resolve(xhr.responseText);
                }
                return;
            }
            let serverMsg = '';
            try {
                const parsed = JSON.parse(xhr.responseText);
                serverMsg = parsed?.message || parsed?.error || '';
            } catch { /* ignore */ }
            const err = new Error(serverMsg || `Upload failed with status ${xhr.status}`) as Error & { status?: number };
            err.status = xhr.status;
            reject(err);
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.onabort = () => reject(Object.assign(new Error('Upload aborted'), { aborted: !!signal?.aborted }));

        xhr.send(formData);
    });
};

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

/** 429 da 2 marta qayta urinadi. */
export async function uploadFileWithRetry(
    endpoint: string,
    formData: FormData,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal
): Promise<any> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            return await uploadFileWithProgress(endpoint, formData, onProgress, signal);
        } catch (err: any) {
            lastErr = err;
            if (err?.status !== 429 || attempt === 2) throw err;
            await sleep(1500 * (attempt + 1));
        }
    }
    throw lastErr;
}

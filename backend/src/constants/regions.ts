/**
 * E'lonlar uchun viloyat kodlari (jobs.location ustunida saqlanadi).
 * Mobil (mobile-app/src/lib/regions.ts) va web bilan bir xil bo'lishi kerak.
 */
export const REGION_CODES = [
    'tashkent_city',
    'tashkent',
    'andijan',
    'fergana',
    'namangan',
    'samarkand',
    'bukhara',
    'navoi',
    'kashkadarya',
    'surkhandarya',
    'jizzakh',
    'syrdarya',
    'khorezm',
    'karakalpakstan',
    'remote',
] as const;

export type RegionCode = (typeof REGION_CODES)[number];

export function isRegionCode(v: unknown): v is RegionCode {
    return typeof v === 'string' && (REGION_CODES as readonly string[]).includes(v);
}

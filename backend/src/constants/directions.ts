/**
 * E'lon yo'nalishlari (jobs.direction ustunida saqlanadi).
 * Mobil (mobile-app/src/lib/directions.ts) va web (frontend/src/lib/directions.ts) bilan bir xil.
 */
export const DIRECTION_CODES = [
    'it',
    'sales',
    'marketing',
    'finance',
    'education',
    'medicine',
    'construction',
    'manufacturing',
    'transport',
    'food',
    'beauty',
    'office',
    'legal',
    'design',
    'household',
    'agriculture',
    'other',
] as const;

export type DirectionCode = (typeof DIRECTION_CODES)[number];

export function isDirectionCode(v: unknown): v is DirectionCode {
    return typeof v === 'string' && (DIRECTION_CODES as readonly string[]).includes(v);
}

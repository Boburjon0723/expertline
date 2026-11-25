'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { isRegionCode, type RegionCode } from '@/lib/regions';
import { isDirectionCode, type DirectionCode } from '@/lib/directions';

export type RegionFilter = RegionCode | 'all';
export type DirectionFilter = DirectionCode | 'all';

const EVENT = 'el-listing-filter-change';

function subscribe(cb: () => void): () => void {
    window.addEventListener(EVENT, cb);
    window.addEventListener('storage', cb);
    return () => {
        window.removeEventListener(EVENT, cb);
        window.removeEventListener('storage', cb);
    };
}

function readKey(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeKey(key: string, v: string) {
    try {
        window.localStorage.setItem(key, v);
    } catch {
        /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
}

const REGION_KEY = 'el_listing_region';
const DIRECTION_KEY = 'el_listing_direction';

const readRegion = (): RegionFilter => {
    const v = readKey(REGION_KEY);
    return isRegionCode(v) ? v : 'all';
};
const readDirection = (): DirectionFilter => {
    const v = readKey(DIRECTION_KEY);
    return isDirectionCode(v) ? v : 'all';
};

/**
 * E'lonlar ro'yxati filtrlari (viloyat, yo'nalish). Brauzerda saqlanadi va bir sahifadagi
 * barcha joylar (ro'yxat, "+" menyusi, e'lon formasi) o'zaro sinxron bo'ladi.
 */
export function useListingFilters() {
    const region = useSyncExternalStore(subscribe, readRegion, () => 'all' as RegionFilter);
    const direction = useSyncExternalStore(subscribe, readDirection, () => 'all' as DirectionFilter);
    const setRegion = useCallback((v: RegionFilter) => writeKey(REGION_KEY, v), []);
    const setDirection = useCallback((v: DirectionFilter) => writeKey(DIRECTION_KEY, v), []);
    return { region, direction, setRegion, setDirection };
}

/** Android ilova paketlari — chatda yuborish taqiqlangan (zararli dastur tarqatish xavfi). Server ham rad etadi. */
const BLOCKED_EXT = /\.(apk|apks|xapk|apkm|aab)$/i;
const BLOCKED_MIME = new Set(['application/vnd.android.package-archive', 'application/vnd.apk']);

export function isBlockedAppPackage(file: Pick<File, 'name' | 'type'>): boolean {
    if (BLOCKED_EXT.test(file.name.trim())) return true;
    return BLOCKED_MIME.has(String(file.type || '').trim().toLowerCase());
}

/** Android ilova paketlari — chatda yuborish taqiqlangan (zararli dastur tarqatish xavfi). */
const BLOCKED_EXT = /\.(apk|apks|xapk|apkm|aab)$/i;
const BLOCKED_MIME = new Set([
  "application/vnd.android.package-archive",
  "application/vnd.apk",
]);

export function isBlockedAppPackage(name?: string | null, mime?: string | null): boolean {
  if (name && BLOCKED_EXT.test(name.trim())) return true;
  return !!mime && BLOCKED_MIME.has(mime.trim().toLowerCase());
}

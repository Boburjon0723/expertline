import type { AppLanguage } from "../features/auth/locale";

/** E'lon viloyatlari — backend/src/constants/regions.ts bilan bir xil kodlar */
export const REGIONS = [
  { code: "tashkent_city", uz: "Toshkent shahri", ru: "г. Ташкент", en: "Tashkent city" },
  { code: "tashkent", uz: "Toshkent viloyati", ru: "Ташкентская обл.", en: "Tashkent region" },
  { code: "andijan", uz: "Andijon", ru: "Андижан", en: "Andijan" },
  { code: "fergana", uz: "Farg'ona", ru: "Фергана", en: "Fergana" },
  { code: "namangan", uz: "Namangan", ru: "Наманган", en: "Namangan" },
  { code: "samarkand", uz: "Samarqand", ru: "Самарканд", en: "Samarkand" },
  { code: "bukhara", uz: "Buxoro", ru: "Бухара", en: "Bukhara" },
  { code: "navoi", uz: "Navoiy", ru: "Навои", en: "Navoi" },
  { code: "kashkadarya", uz: "Qashqadaryo", ru: "Кашкадарья", en: "Kashkadarya" },
  { code: "surkhandarya", uz: "Surxondaryo", ru: "Сурхандарья", en: "Surkhandarya" },
  { code: "jizzakh", uz: "Jizzax", ru: "Джизак", en: "Jizzakh" },
  { code: "syrdarya", uz: "Sirdaryo", ru: "Сырдарья", en: "Syrdarya" },
  { code: "khorezm", uz: "Xorazm", ru: "Хорезм", en: "Khorezm" },
  { code: "karakalpakstan", uz: "Qoraqalpog'iston", ru: "Каракалпакстан", en: "Karakalpakstan" },
  { code: "remote", uz: "Masofaviy / butun O'zbekiston", ru: "Удалённо / вся страна", en: "Remote / nationwide" },
] as const;

export type RegionCode = (typeof REGIONS)[number]["code"];

export function isRegionCode(v: unknown): v is RegionCode {
  return typeof v === "string" && REGIONS.some((r) => r.code === v);
}

export function regionLabel(code: string | null | undefined, lang: AppLanguage): string {
  const r = REGIONS.find((x) => x.code === code);
  return r ? r[lang] : "";
}

/** Qisqa nom (pill uchun): "Toshkent sh.", "Masofaviy" */
export function regionShortLabel(code: string | null | undefined, lang: AppLanguage): string {
  const full = regionLabel(code, lang);
  if (code === "remote") return full.split(" / ")[0];
  if (code === "tashkent_city") return lang === "uz" ? "Toshkent sh." : lang === "ru" ? "Ташкент" : "Tashkent";
  if (code === "tashkent") return lang === "uz" ? "Toshkent vil." : lang === "ru" ? "Ташкент. обл." : "Tashkent reg.";
  return full;
}

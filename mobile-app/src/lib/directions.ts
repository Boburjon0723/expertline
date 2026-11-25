import type { AppLanguage } from "../features/auth/locale";

/** E'lon yo'nalishlari — backend/src/constants/directions.ts bilan bir xil kodlar */
export const DIRECTIONS = [
  { code: "it", emoji: "💻", uz: "IT va dasturlash", ru: "IT и программирование", en: "IT & software" },
  { code: "sales", emoji: "🛒", uz: "Savdo va sotuv", ru: "Продажи и торговля", en: "Sales & retail" },
  { code: "marketing", emoji: "📣", uz: "Marketing va SMM", ru: "Маркетинг и SMM", en: "Marketing & SMM" },
  { code: "finance", emoji: "💰", uz: "Moliya va buxgalteriya", ru: "Финансы и бухгалтерия", en: "Finance & accounting" },
  { code: "education", emoji: "🎓", uz: "Ta'lim va repetitorlik", ru: "Образование и репетиторство", en: "Education & tutoring" },
  { code: "medicine", emoji: "🩺", uz: "Tibbiyot va farmatsevtika", ru: "Медицина и фармацевтика", en: "Medicine & pharmacy" },
  { code: "construction", emoji: "🏗", uz: "Qurilish va ta'mirlash", ru: "Строительство и ремонт", en: "Construction & repair" },
  { code: "manufacturing", emoji: "🏭", uz: "Ishlab chiqarish", ru: "Производство", en: "Manufacturing" },
  { code: "transport", emoji: "🚚", uz: "Transport, haydovchi, kuryer", ru: "Транспорт, водитель, курьер", en: "Transport, driver, courier" },
  { code: "food", emoji: "🍳", uz: "Restoran, oshpaz, mehmonxona", ru: "Ресторан, повар, гостиница", en: "Restaurant, cook, hotel" },
  { code: "beauty", emoji: "💇", uz: "Go'zallik va salomatlik", ru: "Красота и здоровье", en: "Beauty & wellness" },
  { code: "office", emoji: "🗂", uz: "Ofis, administrator, HR", ru: "Офис, администратор, HR", en: "Office, admin, HR" },
  { code: "legal", emoji: "⚖️", uz: "Yuridik xizmatlar", ru: "Юридические услуги", en: "Legal services" },
  { code: "design", emoji: "🎨", uz: "Dizayn, foto va video", ru: "Дизайн, фото и видео", en: "Design, photo & video" },
  { code: "household", emoji: "🧹", uz: "Maishiy xizmatlar", ru: "Бытовые услуги", en: "Household services" },
  { code: "agriculture", emoji: "🌾", uz: "Qishloq xo'jaligi", ru: "Сельское хозяйство", en: "Agriculture" },
  { code: "other", emoji: "📦", uz: "Boshqa", ru: "Другое", en: "Other" },
] as const;

export type DirectionCode = (typeof DIRECTIONS)[number]["code"];

export function isDirectionCode(v: unknown): v is DirectionCode {
  return typeof v === "string" && DIRECTIONS.some((d) => d.code === v);
}

export function directionLabel(code: string | null | undefined, lang: AppLanguage): string {
  const d = DIRECTIONS.find((x) => x.code === code);
  return d ? d[lang] : "";
}

export function directionEmoji(code: string | null | undefined): string {
  return DIRECTIONS.find((x) => x.code === code)?.emoji ?? "";
}

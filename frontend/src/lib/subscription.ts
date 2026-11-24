/** Mutaxassis oylik obunasi (so'm). Narx o'zgarsa — faqat shu yerda. */
export const EXPERT_SUBSCRIPTION_MONTHLY_UZS = 59_000;

/** 59000 → "59 000" */
export function formatUzs(amount: number): string {
    return amount.toLocaleString('ru-RU').replace(/ /g, ' ');
}

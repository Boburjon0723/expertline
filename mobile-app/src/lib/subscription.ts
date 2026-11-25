/** Mutaxassis oylik obunasi (so'm). Web: frontend/src/lib/subscription.ts bilan bir xil. */
export const EXPERT_SUBSCRIPTION_MONTHLY_UZS = 59_000;

/** 59000 → "59 000" (Hermes'da toLocaleString ishonchsiz, shuning uchun qo'lda) */
export function formatUzs(amount: number): string {
  return String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

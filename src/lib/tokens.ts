/**
 * Token / pricing constants (pay-per-use AI variation).
 *
 * Marketing concept: 1 token = 0,40 € (= 2,5 tokens / €).
 * Storage / API exchange: integer CENTS (€0.01) — no floats, no rounding bugs.
 *
 * ── Edit pricing here ─────────────────────────────────────────────────────
 *  • To change cost per image: edit IMAGE_COST_CENTS.
 *  • To change topup pack sizes: edit TOPUP_PACKS.
 *  • To change min topup: edit MIN_TOPUP_CENTS.
 *
 * The UI (admin page, billing page, AI lab) imports and displays these
 * values — single source of truth.
 */

/** 1 token = 40 cents (= 0.40 €). */
export const CENTS_PER_TOKEN = 40;

/** Cost in cents to generate one image, by user plan. */
export const IMAGE_COST_CENTS = {
  free: 110, // 1.10 € / 2.75 tokens — default tier (no subscription)
  solo: 90,  // 0.90 € / 2.25 tokens
  pro:  70,  // 0.70 € / 1.75 tokens
} as const;

/** Minimum topup amount in cents (prevents fee-only purchases). */
export const MIN_TOPUP_CENTS = 500; // 5 €

/**
 * Predefined topup packs.
 *  - `priceCents`: what Stripe charges the customer.
 *  - `creditCents`: what we add to their balance (≥ priceCents → bonus offered).
 * Bonus = creditCents - priceCents (in cents) → displayed as "+N tokens offerts".
 *
 * Custom amount is also allowed (no bonus, priceCents = creditCents).
 */
export type TopupPack = {
  id: string;
  priceCents: number;
  creditCents: number;
  label: string;
  highlight?: boolean;
};

export const TOPUP_PACKS: TopupPack[] = [
  // 25 tokens, no bonus
  { id: "starter",  priceCents: 1000,  creditCents: 1000,  label: "Starter" },
  // 110 tokens (100 paid + 10 bonus)
  { id: "standard", priceCents: 4000,  creditCents: 4400,  label: "Standard", highlight: true },
  // 280 tokens (250 paid + 30 bonus)
  { id: "power",    priceCents: 10000, creditCents: 11200, label: "Power" },
];

export function packBonusCents(pack: TopupPack): number {
  return Math.max(0, pack.creditCents - pack.priceCents);
}

// ── Display helpers ───────────────────────────────────────────────────────

export function centsToTokens(cents: number): number {
  return cents / CENTS_PER_TOKEN;
}

export function formatTokens(cents: number, digits = 2): string {
  return centsToTokens(cents).toFixed(digits);
}

/** Format a cent amount as a French-style EUR string ("12,50 €"). */
export function formatEur(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

/** Cost (in cents) of one image for the given plan. Falls back to Free. */
export function imageCostCents(plan: string | null | undefined): number {
  if (plan === "pro")  return IMAGE_COST_CENTS.pro;
  if (plan === "solo") return IMAGE_COST_CENTS.solo;
  return IMAGE_COST_CENTS.free;
}

/** How many images the user can afford with `cents` at the given plan tier. */
export function imagesAffordable(cents: number, plan: string | null | undefined): number {
  return Math.floor(cents / imageCostCents(plan));
}

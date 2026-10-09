import Stripe from "stripe";
import type { PaidPlan } from "@/lib/plans";

let _stripe: Stripe | null = null;

export type BillingInterval = "monthly" | "yearly";

/** Prix Stripe d'un plan pour un intervalle donné. Source unique : checkout,
 *  upgrade, downgrade et webhook doivent tous passer par ici pour qu'un prix
 *  annuel ne soit jamais confondu avec son mensuel. */
export function getPlanPriceId(plan: PaidPlan, interval: BillingInterval): string | undefined {
  if (interval === "yearly") {
    return plan === "agency"
      ? process.env.STRIPE_PRICE_ID_AGENCY_YEARLY
      : plan === "starter"
      ? process.env.STRIPE_PRICE_ID_STARTER_YEARLY
      : plan === "solo"
      ? process.env.STRIPE_PRICE_ID_SOLO_YEARLY
      : process.env.STRIPE_PRICE_ID_PRO_YEARLY;
  }
  return plan === "agency"
    ? process.env.STRIPE_PRICE_ID_AGENCY
    : plan === "starter"
    ? process.env.STRIPE_PRICE_ID_STARTER
    : plan === "solo"
    ? process.env.STRIPE_PRICE_ID_SOLO
    : process.env.STRIPE_PRICE_ID_PRO ?? process.env.STRIPE_PRICE_ID;
}

/** Nom de la variable d'env attendue — pour des messages d'erreur précis. */
export function planPriceEnvName(plan: PaidPlan, interval: BillingInterval): string {
  return `STRIPE_PRICE_ID_${plan.toUpperCase()}${interval === "yearly" ? "_YEARLY" : ""}`;
}

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiVersion: "2024-06-20" as any,
    });
  }
  return _stripe;
}

/** Prix Stripe → plan. Mensuels ET annuels, Starter inclus (abonnés existants).
 *  Renvoie null si le prix n'est pas reconnu — à chaque appelant son repli. */
export function planFromPriceId(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  const e = process.env;
  const table: Array<[string | undefined, PaidPlan]> = [
    [e.STRIPE_PRICE_ID_AGENCY, "agency"],
    [e.STRIPE_PRICE_ID_AGENCY_YEARLY, "agency"],
    [e.STRIPE_PRICE_ID_PRO, "pro"],
    [e.STRIPE_PRICE_ID, "pro"],
    [e.STRIPE_PRICE_ID_PRO_YEARLY, "pro"],
    [e.STRIPE_PRICE_ID_SOLO, "solo"],
    [e.STRIPE_PRICE_ID_SOLO_YEARLY, "solo"],
    [e.STRIPE_PRICE_ID_STARTER, "starter"],
    [e.STRIPE_PRICE_ID_STARTER_YEARLY, "starter"],
  ];
  for (const [id, plan] of table) if (id && id === priceId) return plan;
  return null;
}

/** Montants (centimes) → plan, filet quand un price ID n'est pas configuré. */
export function planFromAmount(unitAmount: number | null | undefined): PaidPlan | null {
  switch (unitAmount) {
    case 24900: case 211200: return "agency";
    case 9900: case 84000: return "pro";
    case 3900: case 33600: return "solo";
    case 1900: case 15600: return "starter";
    default: return null;
  }
}

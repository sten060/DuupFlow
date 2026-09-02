import Stripe from "stripe";

let _stripe: Stripe | null = null;

export type BillingInterval = "monthly" | "yearly";

/** Prix Stripe d'un plan pour un intervalle donné. Source unique : checkout,
 *  upgrade, downgrade et webhook doivent tous passer par ici pour qu'un prix
 *  annuel ne soit jamais confondu avec son mensuel. */
export function getPlanPriceId(plan: "starter" | "solo" | "pro", interval: BillingInterval): string | undefined {
  if (interval === "yearly") {
    return plan === "starter"
      ? process.env.STRIPE_PRICE_ID_STARTER_YEARLY
      : plan === "solo"
      ? process.env.STRIPE_PRICE_ID_SOLO_YEARLY
      : process.env.STRIPE_PRICE_ID_PRO_YEARLY;
  }
  return plan === "starter"
    ? process.env.STRIPE_PRICE_ID_STARTER
    : plan === "solo"
    ? process.env.STRIPE_PRICE_ID_SOLO
    : process.env.STRIPE_PRICE_ID_PRO ?? process.env.STRIPE_PRICE_ID;
}

/** Nom de la variable d'env attendue — pour des messages d'erreur précis. */
export function planPriceEnvName(plan: "starter" | "solo" | "pro", interval: BillingInterval): string {
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

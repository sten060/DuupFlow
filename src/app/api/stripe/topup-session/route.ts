/**
 * Create a Stripe Checkout session for a one-shot AI token topup.
 *
 * The webhook (api/stripe/webhook) credits `metadata.amount_cents` to the
 * user's `ai_balance_cents` once Stripe confirms the payment.
 *
 * Body — one of:
 *   { packId: "starter" | "standard" | "power" }   ← uses the pack's bonus
 *   { priceCents: number }                          ← custom amount, no bonus
 */
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { MIN_TOPUP_CENTS, TOPUP_PACKS, formatTokens, formatEur } from "@/lib/tokens";

export const runtime = "nodejs";

const ADMIN_PAGE = "/dashboard/tokens";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { packId?: unknown; priceCents?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Resolve priceCents (Stripe charge) and creditCents (balance increment).
  let priceCents: number;
  let creditCents: number;

  if (typeof body.packId === "string") {
    const pack = TOPUP_PACKS.find((p) => p.id === body.packId);
    if (!pack) return NextResponse.json({ error: "unknown_pack" }, { status: 400 });
    priceCents = pack.priceCents;
    creditCents = pack.creditCents;
  } else {
    const cents = Number(body.priceCents);
    if (!Number.isInteger(cents) || cents < MIN_TOPUP_CENTS) {
      return NextResponse.json(
        { error: "min_topup_cents", min: MIN_TOPUP_CENTS },
        { status: 400 },
      );
    }
    priceCents = cents;
    creditCents = cents; // No bonus on custom amounts.
  }

  const baseUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");

  const tokens = formatTokens(creditCents, 0);
  const eur = formatEur(priceCents);

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: user.email ?? undefined,
    client_reference_id: user.id,
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: priceCents, // what we charge
          product_data: {
            name: `DuupFlow — ${tokens} tokens IA (${eur})`,
            description: "Recharge ponctuelle pour la génération IA d'images.",
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "ai_topup",
      supabase_user_id: user.id,
      // amount_cents = what to credit (price + bonus). Webhook reads this.
      amount_cents: String(creditCents),
      price_cents: String(priceCents),
    },
    success_url: `${baseUrl}${ADMIN_PAGE}?topup=success`,
    cancel_url: `${baseUrl}${ADMIN_PAGE}?topup=cancel`,
  });

  return NextResponse.json({ url: session.url });
}

/**
 * One-shot backfill: populate profiles.subscription_status / trial_end /
 * cancel_at_period_end for every profile that already has a Stripe
 * subscription. The webhook + billing-sync only touch NEW events, so the
 * existing subscribers (and today's trial) stay null until this runs.
 *
 * Run (Node 20+):
 *   node --env-file=.env.local scripts/backfill-subscription-state.mjs
 *
 * Reads: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY
 * Idempotent — safe to re-run.
 */
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE || !STRIPE_KEY) {
  console.error(
    "Missing env — need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY.\n" +
      "Run: node --env-file=.env.local scripts/backfill-subscription-state.mjs",
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});
const stripe = new Stripe(STRIPE_KEY);

const { data: rows, error } = await admin
  .from("profiles")
  .select("id, stripe_subscription_id")
  .not("stripe_subscription_id", "is", null);

if (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}

console.log(`${rows.length} profiles avec un stripe_subscription_id\n`);

let ok = 0;
let missing = 0;
let failed = 0;

for (const row of rows) {
  try {
    const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
    const { error: upErr } = await admin
      .from("profiles")
      .update({
        subscription_status: sub.status,
        trial_end: sub.trial_end
          ? new Date(sub.trial_end * 1000).toISOString()
          : null,
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
      })
      .eq("id", row.id);

    if (upErr) {
      failed++;
      console.error(`  ✗ ${row.id}: ${upErr.message}`);
    } else {
      ok++;
      console.log(
        `  ✓ ${row.id} → ${sub.status}` +
          (sub.cancel_at_period_end ? " (résiliation prévue)" : "") +
          (sub.trial_end ? ` (trial→${new Date(sub.trial_end * 1000).toISOString().slice(0, 10)})` : ""),
      );
    }
  } catch (e) {
    // Subscription no longer exists at Stripe → it was canceled/deleted.
    if (e?.code === "resource_missing") {
      await admin
        .from("profiles")
        .update({ subscription_status: "canceled" })
        .eq("id", row.id);
      missing++;
      console.log(`  – ${row.id}: introuvable chez Stripe → subscription_status=canceled`);
    } else {
      failed++;
      console.error(`  ✗ ${row.id}: ${e?.message ?? e}`);
    }
  }
}

console.log(`\nTerminé — ok:${ok}  canceled/introuvable:${missing}  échecs:${failed}`);
process.exit(failed ? 1 : 0);

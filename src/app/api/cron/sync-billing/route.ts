// GET /api/cron/sync-billing
// Safety net for Stripe payment state. The webhook + the dashboard self-heal
// (src/lib/billing-sync.ts) cover most cases, but a user who never opens the
// dashboard — or whose webhook was missed — can stay past_due while keeping
// their plan. This sweep resyncs EVERY subscribed profile against Stripe, so
// past_due users get downgraded and recovered users get restored regardless
// of activity.
//
// Called by Railway's HTTP cron or any uptime monitor. Recommended: hourly.
// Secured by CRON_SECRET env var — requests must pass
//   Authorization: Bearer <CRON_SECRET>
//
// Params:
//   ?limit=N  — max profiles processed per run (default 300). The oldest-synced
//               profiles are processed first, so successive runs cover everyone.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncStripeStateIfStale } from "@/lib/billing-sync";

export const dynamic = "force-dynamic";

// Small concurrency so a large customer base doesn't serialize into a slow run
// nor burst past Stripe's rate limits.
const CONCURRENCY = 5;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const limit = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("limit") ?? "300"), 1),
    2000,
  );

  const admin = createAdminClient();
  // Oldest-synced first (nulls first) so repeated runs eventually cover all
  // subscribed profiles even when there are more than `limit` of them.
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id")
    .not("stripe_subscription_id", "is", null)
    .order("last_stripe_sync_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    console.error("[cron/sync-billing] query failed:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const ids = (profiles ?? []).map((p) => p.id as string);
  let processed = 0;
  let failed = 0;

  // Process in small concurrent batches — bypassCache forces a fresh Stripe
  // read regardless of the 6h per-user throttle.
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((id) => syncStripeStateIfStale(id, { bypassCache: true })),
    );
    for (const r of results) {
      if (r.status === "fulfilled") processed++;
      else failed++;
    }
  }

  console.log(
    `[cron/sync-billing] synced ${processed}/${ids.length} profiles (${failed} failed)`,
  );

  return NextResponse.json({ ok: true, total: ids.length, processed, failed });
}

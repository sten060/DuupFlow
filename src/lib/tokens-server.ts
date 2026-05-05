/**
 * Server-side helpers for the AI token balance.
 *
 * Uses the Supabase service-role client so writes bypass RLS — these
 * functions are only safe to call from server-side code (API routes,
 * server actions, webhook handlers).
 */
import { createAdminClient } from "@/lib/supabase/admin";

export type LedgerReason =
  | "topup"            // Stripe checkout success
  | "topup_admin"      // Manual credit (dev only)
  | "image_solo"       // Image generated for a Solo-plan user
  | "image_pro"        // Image generated for a Pro-plan user
  | "refund_failure"   // Generation failed → tokens refunded
  | "admin_adjust";    // Manual debug adjustment (dev only)

export type LedgerEntry = {
  id: string;
  user_id: string;
  delta_cents: number;
  reason: LedgerReason | string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function fetchBalanceCents(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("ai_balance_cents")
    .eq("id", userId)
    .single();
  return data?.ai_balance_cents ?? 0;
}

export async function fetchLedger(userId: string, limit = 50): Promise<LedgerEntry[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_token_ledger")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as LedgerEntry[];
}

/**
 * Apply a balance delta and write a ledger row.
 *
 * Refuses to debit below zero. Returns the new balance on success.
 *
 * NOTE: this is a non-atomic read-modify-write. For low traffic (admin
 * topups + on-demand image generation) it's fine. If we ever see
 * concurrent writes, replace with a Postgres function that does
 * `UPDATE … RETURNING` in a single transaction.
 */
export async function recordTransaction(opts: {
  userId: string;
  deltaCents: number;
  reason: LedgerReason | string;
  metadata?: Record<string, unknown>;
}): Promise<
  | { ok: true; balanceCents: number }
  | { ok: false; error: string; balanceCents: number }
> {
  const admin = createAdminClient();

  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("ai_balance_cents")
    .eq("id", opts.userId)
    .single();
  if (pErr || !profile) {
    return { ok: false, balanceCents: 0, error: pErr?.message ?? "user not found" };
  }

  const current = profile.ai_balance_cents ?? 0;
  const next = current + opts.deltaCents;
  if (next < 0) {
    return { ok: false, balanceCents: current, error: "insufficient_balance" };
  }

  const { error: uErr } = await admin
    .from("profiles")
    .update({
      ai_balance_cents: next,
      ai_balance_updated_at: new Date().toISOString(),
    })
    .eq("id", opts.userId);
  if (uErr) {
    return { ok: false, balanceCents: current, error: uErr.message };
  }

  const { error: lErr } = await admin.from("ai_token_ledger").insert({
    user_id: opts.userId,
    delta_cents: opts.deltaCents,
    reason: opts.reason,
    metadata: opts.metadata ?? null,
  });
  if (lErr) {
    // Best-effort; balance change already happened. Log for debugging but
    // don't roll back — the operation succeeded financially.
    console.error("[tokens-server] ledger insert failed:", lErr.message);
  }

  return { ok: true, balanceCents: next };
}

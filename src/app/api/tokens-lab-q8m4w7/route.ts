/**
 * GET /api/tokens-lab-q8m4w7
 *
 * Returns the authenticated user's AI balance + last ledger entries.
 * Used by the secret admin page to render its dashboard.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchBalanceCents, fetchLedger } from "@/lib/tokens-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Fetch profile (for plan) + balance + ledger in parallel.
  const [{ data: profile }, balanceCents, ledger] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", user.id).single(),
    fetchBalanceCents(user.id),
    fetchLedger(user.id, 100),
  ]);

  return NextResponse.json({
    plan: (profile?.plan as string | null) ?? null,
    balanceCents,
    ledger,
  });
}

/**
 * GET /api/tokens
 *
 * Returns the authenticated user's AI balance + last ledger entries.
 * Used by the secret admin page to render its dashboard.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchBalanceCents, fetchLedger, grantWelcomeBonusIfDue } from "@/lib/tokens-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Bonus de bienvenue (2 €) appliqué AVANT la lecture du solde. Idempotent —
  // offert une seule fois par utilisateur.
  await grantWelcomeBonusIfDue(user.id);

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

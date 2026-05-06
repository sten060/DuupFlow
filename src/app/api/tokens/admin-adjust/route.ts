/**
 * POST /api/tokens/admin-adjust
 *
 * DEV-ONLY endpoint to manually credit / debit tokens for testing the system
 * without going through Stripe. Hard-blocked in production (404).
 *
 * Body: { deltaCents: number, reason?: string }
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordTransaction } from "@/lib/tokens-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { deltaCents?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const deltaCents = Number(body.deltaCents);
  if (!Number.isInteger(deltaCents) || deltaCents === 0) {
    return NextResponse.json({ error: "deltaCents required (non-zero integer)" }, { status: 400 });
  }
  const reason = (typeof body.reason === "string" && body.reason.trim()) || "admin_adjust";

  const result = await recordTransaction({
    userId: user.id,
    deltaCents,
    reason,
    metadata: { dev: true },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, balanceCents: result.balanceCents }, { status: 400 });
  }
  return NextResponse.json({ ok: true, balanceCents: result.balanceCents });
}

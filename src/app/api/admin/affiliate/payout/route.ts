import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Enregistre un versement manuel à un partenaire. */
export async function POST(req: NextRequest) {
  const admin = createAdminClient();

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId || user.id !== adminUserId.trim()) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const { affiliate_code, amount_cents, note, paid_at } = await req.json();
  if (!affiliate_code || typeof amount_cents !== "number" || amount_cents <= 0) {
    return NextResponse.json({ error: "affiliate_code et amount_cents (>0) requis" }, { status: 400 });
  }

  const { error: dbError } = await admin.from("affiliate_payouts").insert({
    affiliate_code,
    amount_cents,
    note: note?.trim() ?? null,
    paid_at: paid_at ?? new Date().toISOString(),
  });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

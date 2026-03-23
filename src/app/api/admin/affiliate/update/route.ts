import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const admin = createAdminClient();

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId || user.id !== adminUserId.trim()) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const { code, commission_pct, discount_pct } = await req.json();
  if (!code) return NextResponse.json({ error: "code requis" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (typeof commission_pct === "number") updates.commission_pct = commission_pct;
  if (discount_pct === null || typeof discount_pct === "number") updates.discount_pct = discount_pct;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
  }

  const { error: dbError } = await admin
    .from("affiliates")
    .update(updates)
    .eq("code", code);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

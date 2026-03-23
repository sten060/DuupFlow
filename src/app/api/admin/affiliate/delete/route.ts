import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const admin = createAdminClient();

  // Vérification via Bearer token
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId || user.id !== adminUserId.trim()) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const { code } = await req.json();
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Code manquant" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Supprime les paiements affiliés liés (FK), puis l'affilié
  // affiliate_clicks supprimés automatiquement grâce au ON DELETE CASCADE
  await admin.from("affiliate_payments").delete().eq("affiliate_code", code);
  const { error } = await admin.from("affiliates").delete().eq("code", code);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

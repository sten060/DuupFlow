import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Sauvegarde les coordonnées de paiement d'un partenaire (IBAN, BIC, PayPal). */
export async function PATCH(req: NextRequest) {
  const admin = createAdminClient();

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Vérifier que l'utilisateur est bien un affilié
  const { data: affiliate } = await admin
    .from("affiliates")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!affiliate) return NextResponse.json({ error: "Partenaire introuvable" }, { status: 404 });

  const { iban, bic, account_name, paypal } = await req.json();

  // Construire l'objet payment_info (ne garder que les champs remplis)
  const payment_info: Record<string, string> = {};
  if (iban?.trim()) payment_info.iban = iban.trim().toUpperCase().replace(/\s/g, "");
  if (bic?.trim()) payment_info.bic = bic.trim().toUpperCase().replace(/\s/g, "");
  if (account_name?.trim()) payment_info.account_name = account_name.trim();
  if (paypal?.trim()) payment_info.paypal = paypal.trim().toLowerCase();

  const { error: dbError } = await admin
    .from("affiliates")
    .update({ payment_info: Object.keys(payment_info).length > 0 ? payment_info : null })
    .eq("id", affiliate.id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

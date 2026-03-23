import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/promo/validate?code=DAVID10
 * Valide un code promo partenaire et retourne les infos de réduction.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ valid: false, error: "Code manquant" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: affiliate } = await admin
    .from("affiliates")
    .select("code, name, stripe_promotion_code_id")
    .eq("code", code)
    .single();

  if (!affiliate || !affiliate.stripe_promotion_code_id) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({
    valid: true,
    code: affiliate.code,
    discount: "10€",
    message: `-10€ sur ton 1er mois grâce au code ${affiliate.code}`,
  });
}

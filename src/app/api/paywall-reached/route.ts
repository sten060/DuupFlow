import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/paywall-reached
 *
 * Stamps profiles.reached_paywall_at the first time the authenticated user
 * lands on the /checkout paywall. The `.is("reached_paywall_at", null)` filter
 * makes it write-once — a second call never overwrites the original timestamp.
 *
 * Best-effort: any failure returns 200 so the paywall never breaks.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: true });

    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({ reached_paywall_at: new Date().toISOString() })
      .eq("id", user.id)
      .is("reached_paywall_at", null); // write-once — never overwrite
  } catch {
    // Never block / never crash — analytics must not affect the paywall.
  }
  return NextResponse.json({ ok: true });
}

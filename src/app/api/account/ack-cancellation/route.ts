// POST /api/account/ack-cancellation
// Consumes the one-shot "subscription canceled" notice so it never shows again.
// Called (fire-and-forget) by SubscriptionCanceledModal on first render.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({ cancellation_notice_pending: false })
      .eq("id", user.id);
  } catch (err) {
    // Missing column (mig 050 not applied) or transient error — never hard-fail
    // the client; worst case the popup shows once more on the next load.
    console.error("[ack-cancellation] clear failed:", err);
  }

  return NextResponse.json({ ok: true });
}

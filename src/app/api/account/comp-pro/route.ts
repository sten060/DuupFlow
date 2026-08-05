// GET /api/account/comp-pro
// Returns whether the CURRENTLY AUTHENTICATED user's own email is on the
// comp-Pro allowlist. Never exposes the list itself — only a boolean for the
// caller. Used by the onboarding page to skip the pricing/checkout gate for
// offered-Pro accounts.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCompProEmail } from "@/lib/comp-pro";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ pro: false }, { status: 401 });
  return NextResponse.json({ pro: isCompProEmail(user.email) });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Dev-only sign-in: bypasses email/magic-link entirely.
// Returns a token_hash the client can verify directly with verifyOtp().
// Hard-blocked in production.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const { email } = await req.json().catch(() => ({}));
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error || !data?.properties?.hashed_token) {
    return NextResponse.json(
      { error: error?.message || "Could not generate link" },
      { status: 500 },
    );
  }

  // Make sure the profile exists & has access (so middleware paywall lets them in).
  if (data.user?.id) {
    await admin
      .from("profiles")
      .upsert(
        { id: data.user.id, has_paid: true },
        { onConflict: "id" },
      );
  }

  return NextResponse.json({ token_hash: data.properties.hashed_token });
}

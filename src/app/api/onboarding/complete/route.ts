import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moveToFreeUser } from "@/lib/brevo";
import { creditWelcomeTokens } from "@/lib/tokens-server";
import { getServerT } from "@/lib/i18n/server";

// Whitelists — keep DB writes constrained to known values even if a future
// front-end change ships a new option without updating the API.
const ALLOWED_PLATFORMS = new Set([
  "instagram", "threads", "reddit", "tiktok", "x",
  "youtube", "facebook", "linkedin", "snapchat", "other",
]);
const ALLOWED_SOURCES = new Set([
  "youtube", "telegram", "friend", "already_knew",
  "tiktok", "google", "other",
]);

export async function POST(req: NextRequest) {
  const t = await getServerT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });

  const { firstName, agencyName, affiliateCode, platforms, source } = await req.json();
  if (!firstName?.trim() || !agencyName?.trim()) {
    return NextResponse.json({ error: t("errors.support.fieldsRequired") }, { status: 400 });
  }

  // Sanitize platforms[] — must be a non-empty array of known slugs.
  const cleanPlatforms = Array.isArray(platforms)
    ? Array.from(new Set(
        platforms
          .filter((p: unknown): p is string => typeof p === "string")
          .map((p: string) => p.toLowerCase())
          .filter((p: string) => ALLOWED_PLATFORMS.has(p)),
      ))
    : [];

  // Sanitize source — must be a known slug. null is acceptable (skipped).
  const cleanSource =
    typeof source === "string" && ALLOWED_SOURCES.has(source.toLowerCase())
      ? source.toLowerCase()
      : null;

  const admin = createAdminClient();

  const profileData: Record<string, unknown> = {
    id: user.id,
    first_name: firstName.trim(),
    agency_name: agencyName.trim(),
    is_guest: false,
    plan: "free",                  // default tier; upgraded by Stripe webhook on subscription
    email_sequence: "free",
    email_sequence_updated_at: new Date().toISOString(),
    // New users skip the AI Variation launch announcement (it targets
    // legacy users with NULL). They get the regular onboarding tour instead.
    variation_ia_announced_at: new Date().toISOString(),
    onboarding_platforms: cleanPlatforms,
    onboarding_source: cleanSource,
  };

  if (affiliateCode && typeof affiliateCode === "string") {
    const code = affiliateCode.trim().toUpperCase();
    const { data: affiliate } = await admin
      .from("affiliates")
      .select("code")
      .eq("code", code)
      .single();
    if (affiliate) profileData.affiliate_code = code;
  }

  const { error } = await admin.from("profiles").upsert(profileData);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (user.email) {
    const email = user.email;
    const name = firstName.trim();
    moveToFreeUser(email, name).catch(console.error);
  }

  // Welcome tokens: give the Free user enough for 1 AI variation image.
  // Idempotent — safe to call again on re-onboarding.
  creditWelcomeTokens(user.id, "free").catch(console.error);

  return NextResponse.json({ ok: true });
}

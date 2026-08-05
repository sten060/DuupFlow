import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moveToFreeUser } from "@/lib/brevo";
import { creditWelcomeTokens } from "@/lib/tokens-server";
import { getServerT } from "@/lib/i18n/server";
import { isCompProEmail } from "@/lib/comp-pro";

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

  const { firstName, agencyName, affiliateCode, platforms, source, selectedPlan } = await req.json();
  if (!firstName?.trim() || !agencyName?.trim()) {
    return NextResponse.json({ error: t("errors.support.fieldsRequired") }, { status: 400 });
  }

  // Comp (offered) Pro accounts: full Pro without any Stripe subscription.
  // They bypass the paid-plan requirement below and are provisioned directly as
  // Pro further down. Keyed on the email allowlist COMP_PRO_EMAILS.
  const isComp = isCompProEmail(user.email);

  // Paid plan chosen on the pricing page — the account stays gated at checkout
  // until it's paid (see the dashboard-layout paywall).
  const pendingPlan = selectedPlan === "solo" || selectedPlan === "pro" ? selectedPlan : null;

  // The free tier is no longer offered to new signups: refuse to create an
  // account without a chosen paid plan (the client redirects to pricing on this
  // code). This closes the only path by which a NEW user could land on free
  // (reaching onboarding with no plan param). Existing free users are untouched
  // — they never re-run onboarding. Comp accounts are exempt (offered Pro).
  if (!pendingPlan && !isComp) {
    return NextResponse.json({ error: t("errors.planRequired"), code: "plan_required" }, { status: 402 });
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
    // Comp accounts are provisioned as Pro immediately (no Stripe). Everyone
    // else starts free and is upgraded by the Stripe webhook on subscription.
    plan: isComp ? "pro" : "free",
    has_paid: isComp ? true : false,
    payment_overdue: false,
    email_sequence: isComp ? "active" : "free",
    email_sequence_updated_at: new Date().toISOString(),
    // New users skip the AI Variation launch announcement (it targets
    // legacy users with NULL). They get the regular onboarding tour instead.
    variation_ia_announced_at: new Date().toISOString(),
    // NOTE: do NOT write tiktok_announce_seen_at here — that column comes from
    // migration 034, which is not applied in prod. Writing it makes the whole
    // upsert fail ("column not found in schema cache") and blocks signup. New
    // users are kept out of the TikTok pop-up by the dashboard-page fallback
    // instead (see src/app/dashboard/page.tsx).
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

  // Persist the pending paid plan in a SEPARATE update — never in the upsert
  // above — so that if the pending_plan column isn't applied yet (migration
  // 048), the error is contained here and can't break signup.
  if (pendingPlan && !isComp) {
    const { error: pendingErr } = await admin
      .from("profiles")
      .update({ pending_plan: pendingPlan })
      .eq("id", user.id);
    if (pendingErr) {
      console.error("[onboarding] pending_plan update failed (migration 048?):", pendingErr.message);
    }
  }

  if (user.email) {
    const email = user.email;
    const name = firstName.trim();
    moveToFreeUser(email, name).catch(console.error);
  }

  // Welcome tokens: give the Free user enough for 1 AI variation image.
  // Idempotent — safe to call again on re-onboarding.
  creditWelcomeTokens(user.id, isComp ? "pro" : "free").catch(console.error);

  return NextResponse.json({ ok: true });
}

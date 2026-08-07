import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DashboardHome from "./DashboardHome";

// Emails that always see the launch promo pop-up (testing / demo), regardless of
// the "used at least once" requirement.
const PROMO_ALLOWLIST = ["stv863624@gmail.com"];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: {
    first_name: string | null;
    agency_name: string | null;
    is_guest: boolean | null;
    host_user_id: string | null;
    plan: string | null;
    has_paid: boolean | null;
    variation_ia_announced_at: string | null;
  } | null = null;
  let hostAgency = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("first_name, agency_name, is_guest, host_user_id, plan, has_paid, variation_ia_announced_at")
      .eq("id", user.id)
      .single();

    profile = data;

    if (data?.is_guest && data.host_user_id) {
      const { data: host } = await supabase
        .from("profiles")
        .select("agency_name")
        .eq("id", data.host_user_id)
        .single();
      hostAgency = host?.agency_name ?? null;
    }
  }

  const firstName = profile?.first_name ?? null;
  const agencyName = profile?.is_guest ? hostAgency : profile?.agency_name ?? null;

  // The gamified onboarding tour is now mounted in dashboard/layout.tsx so
  // it persists across page navigations — no longer driven from this page.

  // One-shot AI Variation launch announcement: shown only to LEGACY users
  // (variation_ia_announced_at IS NULL after migration 021). New users get
  // the column auto-set at signup so they skip this and see the tour instead.
  const variationAnnouncementPending =
    profile != null && profile.variation_ia_announced_at == null;

  // One-shot TikTok launch pop-up. Read in a SEPARATE query so a missing column
  // (migration 034 not applied in prod) can't break the main profile fetch above.
  // When the column is absent / the query errors we default to "not pending"
  // (DON'T show it): the pop-up interrupts the gamified onboarding, so a missing
  // column must never resurface it — especially for new users. It only shows
  // when the column exists AND is explicitly NULL (legacy users).
  let tiktokAnnouncementPending = false;
  if (user) {
    try {
      const { data: tk, error } = await supabase
        .from("profiles")
        .select("tiktok_announce_seen_at")
        .eq("id", user.id)
        .single();
      tiktokAnnouncementPending = error ? false : (tk as { tiktok_announce_seen_at: string | null })?.tiktok_announce_seen_at == null;
    } catch {
      tiktokAnnouncementPending = false;
    }
  }
  // Effective plan for the announcement modal (drives bonus token wording).
  const effectivePlan = ((): "free" | "starter" | "solo" | "pro" => {
    if (profile?.plan === "starter") return "starter";
    if (profile?.plan === "solo") return "solo";
    if (profile?.plan === "pro") return "pro";
    if (profile?.plan === "free") return "free";
    return profile?.has_paid ? "pro" : "free"; // legacy fallback
  })();

  // -15% launch promo: shown only to ACTIVATED FREE users — free plan, not a
  // guest, and who have already used the product at least once (a usage_tracking
  // row with any count > 0). Read via the admin client so RLS can't hide it.
  let promoEligible = false;
  if (user && !profile?.is_guest && effectivePlan === "free") {
    try {
      const admin = createAdminClient();
      const { data: usage } = await admin
        .from("usage_tracking")
        .select("images_count, videos_count, ai_signatures_count")
        .eq("user_id", user.id)
        .maybeSingle();
      const u = usage as { images_count?: number; videos_count?: number; ai_signatures_count?: number } | null;
      const total = (u?.images_count ?? 0) + (u?.videos_count ?? 0) + (u?.ai_signatures_count ?? 0);
      promoEligible = total > 0 || (user.email ? PROMO_ALLOWLIST.includes(user.email.toLowerCase()) : false);
    } catch {
      promoEligible = false;
    }
  }

  return (
    <DashboardHome
      firstName={firstName}
      agencyName={agencyName}
      variationAnnouncementPending={variationAnnouncementPending}
      tiktokAnnouncementPending={tiktokAnnouncementPending}
      effectivePlan={effectivePlan}
      promoEligible={promoEligible}
      promoLoginKey={user?.last_sign_in_at ?? null}
    />
  );
}

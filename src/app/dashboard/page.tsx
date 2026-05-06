import { createClient } from "@/lib/supabase/server";
import DashboardHome from "./DashboardHome";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: {
    first_name: string | null;
    agency_name: string | null;
    is_guest: boolean | null;
    host_user_id: string | null;
    onboarded_at: string | null;
    plan: string | null;
    has_paid: boolean | null;
    variation_ia_announced_at: string | null;
  } | null = null;
  let hostAgency = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("first_name, agency_name, is_guest, host_user_id, onboarded_at, plan, has_paid, variation_ia_announced_at")
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
  // Auto-open the onboarding tour only for users with NULL onboarded_at.
  // Migration 020 backfilled all existing users with NOW() so they're
  // skipped — only signups going forward will see the tour.
  const needsOnboarding = profile != null && profile.onboarded_at == null;

  // One-shot AI Variation launch announcement: shown only to LEGACY users
  // (variation_ia_announced_at IS NULL after migration 021). New users get
  // the column auto-set at signup so they skip this and see the tour instead.
  const variationAnnouncementPending =
    profile != null && profile.variation_ia_announced_at == null;
  // Effective plan for the announcement modal (drives bonus token wording).
  const effectivePlan = ((): "free" | "solo" | "pro" => {
    if (profile?.plan === "solo") return "solo";
    if (profile?.plan === "pro") return "pro";
    if (profile?.plan === "free") return "free";
    return profile?.has_paid ? "pro" : "free"; // legacy fallback
  })();

  return (
    <DashboardHome
      firstName={firstName}
      agencyName={agencyName}
      needsOnboarding={needsOnboarding}
      variationAnnouncementPending={variationAnnouncementPending}
      effectivePlan={effectivePlan}
    />
  );
}

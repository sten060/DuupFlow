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
  // (migration 034 not yet applied) can't break the main profile fetch above.
  // When the column is absent we default to "pending" (show it) — the client also
  // keeps a localStorage guard so it never loops before the migration runs.
  let tiktokAnnouncementPending = false;
  if (user) {
    try {
      const { data: tk, error } = await supabase
        .from("profiles")
        .select("tiktok_announce_seen_at")
        .eq("id", user.id)
        .single();
      tiktokAnnouncementPending = error ? true : (tk as { tiktok_announce_seen_at: string | null })?.tiktok_announce_seen_at == null;
    } catch {
      tiktokAnnouncementPending = true;
    }
  }
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
      variationAnnouncementPending={variationAnnouncementPending}
      tiktokAnnouncementPending={tiktokAnnouncementPending}
      effectivePlan={effectivePlan}
    />
  );
}

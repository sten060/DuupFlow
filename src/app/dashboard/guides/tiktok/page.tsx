/**
 * TikTok guide — RESERVED for paying users (solo / pro).
 *
 * Server-gated so the content is never shipped to non-paying visitors. Uses the
 * same effective-plan resolution as the AI Detection module (guests inherit the
 * host's plan). Free / unauthenticated → redirected away (no public block page).
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import TikTokGuideClient from "./TikTokGuideClient";

export const dynamic = "force-dynamic";

export default async function TikTokGuidePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, has_paid, is_guest, host_user_id")
    .eq("id", user.id)
    .single();

  // Resolve effective plan — guests inherit the host's plan.
  let effectivePlan = (profile?.plan as string | null) ?? null;
  if (profile?.is_guest && profile?.host_user_id) {
    const { data: hostProfile } = await admin
      .from("profiles")
      .select("plan, has_paid")
      .eq("id", profile.host_user_id)
      .single();
    effectivePlan = hostProfile?.plan ?? (hostProfile?.has_paid ? "pro" : "free");
  }
  if (!effectivePlan) {
    effectivePlan = profile?.has_paid ? "pro" : "free";
  }

  // Reserved for paying plans. Free → upsell page.
  if (effectivePlan !== "solo" && effectivePlan !== "pro") {
    redirect("/dashboard/abonnement");
  }

  return <TikTokGuideClient />;
}

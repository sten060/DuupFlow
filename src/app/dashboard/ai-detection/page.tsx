/**
 * Server entry — gates the AI Detection module by plan.
 *
 *   • Free  → renders <UpgradeRequired />  (lock screen + module explainer)
 *   • Solo  → renders <AiDetectionClient />
 *   • Pro   → renders <AiDetectionClient />
 *
 * Guests inherit the host's plan (resolved client-side via /api/usage if needed).
 * The same plan-fallback logic as src/lib/usage.ts is used here:
 *   has_paid + null plan  → 'pro' (legacy)
 *   !has_paid + null plan → 'free' (default)
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AiDetectionClient from "./AiDetectionClient";
import UpgradeRequired from "./UpgradeRequired";

export const dynamic = "force-dynamic";

export default async function AiDetectionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, has_paid, is_guest, host_user_id")
    .eq("id", user.id)
    .single();

  // Resolve effective plan — guests inherit host plan
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

  if (effectivePlan === "free") {
    return <UpgradeRequired />;
  }

  return <AiDetectionClient />;
}

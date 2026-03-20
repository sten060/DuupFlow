import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SettingsClient from "./SettingsClient";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Load profile (including plan)
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, agency_name, is_guest, plan, stripe_customer_id")
    .eq("id", user.id)
    .single();

  const isGuest = profile?.is_guest ?? false;
  const plan = (profile?.plan as "solo" | "pro" | null) ?? null;
  const hasStripePortal = !!profile?.stripe_customer_id;

  // Load usage for Solo plan users
  let usage: { images: number; videos: number; ai_signatures: number } | null = null;
  if (plan === "solo" && !isGuest) {
    const { data: usageRow } = await admin
      .from("usage_tracking")
      .select("images_count, videos_count, ai_signatures_count")
      .eq("user_id", user.id)
      .single();

    usage = {
      images: usageRow?.images_count ?? 0,
      videos: usageRow?.videos_count ?? 0,
      ai_signatures: usageRow?.ai_signatures_count ?? 0,
    };
  }

  // Load invitations (only for Pro hosts)
  let invitations: {
    id: string;
    guest_email: string;
    status: string;
    guest_name?: string;
  }[] = [];

  if (!isGuest && plan === "pro" && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data: invs } = await admin
      .from("team_invitations")
      .select("id, guest_email, status, guest_user_id")
      .eq("host_user_id", user.id)
      .order("created_at", { ascending: true });

    if (invs) {
      const enriched = await Promise.all(
        invs.map(async (inv) => {
          if (inv.guest_user_id) {
            const { data: gp } = await admin
              .from("profiles")
              .select("first_name")
              .eq("id", inv.guest_user_id)
              .single();
            return { ...inv, guest_name: gp?.first_name };
          }
          return inv;
        })
      );
      invitations = enriched;
    }
  }

  return (
    <SettingsClient
      initialFirstName={profile?.first_name ?? ""}
      initialAgencyName={profile?.agency_name ?? ""}
      isGuest={isGuest}
      plan={plan}
      usage={usage}
      hasStripePortal={hasStripePortal}
      invitations={invitations}
      userEmail={user.email}
    />
  );
}

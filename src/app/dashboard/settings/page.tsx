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

  // Load full profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, agency_name, is_guest, plan")
    .eq("id", user.id)
    .single();

  const isGuest = profile?.is_guest ?? false;
  const plan = (profile?.plan as "starter" | "solo" | "pro" | null) ?? null;

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
      invitations={invitations}
      userEmail={user.email}
    />
  );
}

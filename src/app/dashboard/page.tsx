import { createClient } from "@/lib/supabase/server";
import DashboardHome from "./DashboardHome";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  let hostAgency = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("first_name, agency_name, is_guest, host_user_id")
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

  return <DashboardHome firstName={firstName} agencyName={agencyName} />;
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AffiliateDashboardClient from "./AffiliateDashboardClient";

export const dynamic = "force-dynamic";

export default async function AffiliateDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/affiliate-login");

  const admin = createAdminClient();

  // Lookup par user_id, ou par email en fallback
  let { data: affiliate } = await admin
    .from("affiliates")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!affiliate && user.email) {
    const { data: byEmail } = await admin
      .from("affiliates")
      .select("*")
      .eq("email", user.email.toLowerCase())
      .single();
    if (byEmail) {
      affiliate = byEmail;
      if (!byEmail.user_id) {
        await admin.from("affiliates").update({ user_id: user.id }).eq("id", byEmail.id);
      }
    }
  }

  if (!affiliate) redirect("/affiliate-login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { data: payments },
    { data: payouts },
    { data: clicks },
    { data: referrals },
  ] = await Promise.all([
    admin.from("affiliate_payments")
      .select("amount_cents, commission_cents, plan, billing_reason, paid_at, commission_paid_at")
      .eq("affiliate_code", affiliate.code)
      .order("paid_at", { ascending: false }),
    admin.from("affiliate_payouts")
      .select("id, amount_cents, note, paid_at")
      .eq("affiliate_code", affiliate.code)
      .order("paid_at", { ascending: false }),
    admin.from("affiliate_clicks")
      .select("affiliate_code")
      .eq("affiliate_code", affiliate.code),
    admin.from("profiles")
      .select("id, has_paid")
      .eq("affiliate_code", affiliate.code),
  ]);

  const allPayments = payments ?? [];
  const allPayouts = payouts ?? [];
  const clickCount = (clicks ?? []).length;
  const allReferrals = referrals ?? [];

  const freeSignups = allReferrals.filter((r) => !r.has_paid).length;
  const payingClients = allReferrals.filter((r) => r.has_paid).length;

  const monthCommissionCents = allPayments
    .filter((p) => p.paid_at >= monthStart)
    .reduce((s, p) => s + p.commission_cents, 0);

  const totalEarnedCents = allPayments.reduce((s, p) => s + p.commission_cents, 0);

  const totalPaidCents = allPayments
    .filter((p) => p.commission_paid_at)
    .reduce((s, p) => s + p.commission_cents, 0);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.duupflow.com").replace(/\/$/, "");

  return (
    <AffiliateDashboardClient
      affiliate={{
        name: affiliate.name,
        code: affiliate.code,
        commission_pct: affiliate.commission_pct,
        discount_pct: affiliate.discount_pct ?? null,
        stripe_promotion_code_id: affiliate.stripe_promotion_code_id ?? null,
        payment_info: affiliate.payment_info ?? null,
      }}
      affiliateLink={`${appUrl}/?ref=${affiliate.code}`}
      payments={allPayments}
      payouts={allPayouts}
      clicks={clickCount}
      freeSignups={freeSignups}
      payingClients={payingClients}
      monthCommissionCents={monthCommissionCents}
      totalEarnedCents={totalEarnedCents}
      totalPaidCents={totalPaidCents}
    />
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AddAffiliateForm from "./AddAffiliateForm";
import AddSimpleLinkForm from "./AddSimpleLinkForm";
import AdminAffiliatesNav from "./AdminAffiliatesNav";

export const dynamic = "force-dynamic";

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(10,14,40,0.55)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <p className="text-xs font-medium text-white/40 mb-2">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-white/30 mt-1">{sub}</p>}
    </div>
  );
}

export default async function AdminAffiliates() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId || user.id !== adminUserId) redirect("/dashboard");

  const admin = createAdminClient();

  const [
    { data: affiliates },
    { data: referrals },
    { data: allPayments },
    { data: allClicks },
    { data: allPayouts },
  ] = await Promise.all([
    admin.from("affiliates").select("id, code, name").order("created_at", { ascending: false }),
    admin.from("profiles").select("id, affiliate_code, has_paid").not("affiliate_code", "is", null),
    admin.from("affiliate_payments").select("affiliate_code, amount_cents, commission_cents, paid_at"),
    admin.from("affiliate_clicks").select("affiliate_code"),
    admin.from("affiliate_payouts").select("affiliate_code, amount_cents"),
  ]);

  const rows = affiliates ?? [];
  const allReferrals = referrals ?? [];
  const paymentRows = allPayments ?? [];
  const clickRows = allClicks ?? [];
  const payoutRows = allPayouts ?? [];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const totalInscrits = allReferrals.length;
  const totalConvertis = allReferrals.filter((r) => r.has_paid).length;
  const totalClicks = clickRows.length;
  const totalRevenueCents = paymentRows.reduce((s, p) => s + p.amount_cents, 0);
  const totalCommissionCents = paymentRows.reduce((s, p) => s + p.commission_cents, 0);
  const totalMonthCommissionCents = paymentRows
    .filter((p) => p.paid_at >= monthStart)
    .reduce((s, p) => s + p.commission_cents, 0);
  const totalPayedOut = payoutRows.reduce((s, p) => s + p.amount_cents, 0);
  const totalBalanceDue = totalCommissionCents - totalPayedOut;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #060918 0%, #0D0B2E 50%, #060C1F 100%)" }}>
      <AdminAffiliatesNav />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Add affiliate buttons */}
        <div className="flex flex-wrap gap-2 justify-end">
          <AddSimpleLinkForm />
          <AddAffiliateForm />
        </div>

        {/* Global stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Partenaires actifs" value={rows.length} color="rgba(255,255,255,0.85)" />
          <StatCard label="Clics sur les liens" value={totalClicks} color="#F59E0B" />
          <StatCard
            label="Total inscrits"
            value={totalInscrits}
            sub={`${totalConvertis} payants · ${totalInscrits - totalConvertis} free`}
            color="#10B981"
          />
          <StatCard
            label="CA affilié total (Stripe)"
            value={`${(totalRevenueCents / 100).toFixed(2)}€`}
            sub={`Commission : ${(totalCommissionCents / 100).toFixed(2)}€`}
            color="#38BDF8"
          />
        </div>

        {/* Commission summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(16,185,129,0.15)" }}>
          {[
            { label: "Commission ce mois", value: `${(totalMonthCommissionCents / 100).toFixed(2)}€`, color: "#818CF8" },
            { label: "Total commission Stripe", value: `${(totalCommissionCents / 100).toFixed(2)}€`, color: "#38BDF8" },
            { label: "Total versé", value: `${(totalPayedOut / 100).toFixed(2)}€`, color: "#10B981" },
            { label: "Solde total à verser", value: `${(totalBalanceDue / 100).toFixed(2)}€`, color: totalBalanceDue > 0 ? "#F59E0B" : "#10B981" },
          ].map(({ label, value, color }) => (
            <div key={label} className="px-5 py-4" style={{ background: "rgba(8,12,35,0.90)" }}>
              <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-white/20 text-center">
          Commissions calculées sur les paiements Stripe réels · versement manuel en fin de mois
        </p>
      </div>
    </div>
  );
}

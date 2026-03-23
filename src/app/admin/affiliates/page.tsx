import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DeleteAffiliateButton from "./DeleteAffiliateButton";
import AddAffiliateForm from "./AddAffiliateForm";
import AddSimpleLinkForm from "./AddSimpleLinkForm";
import EditAffiliatePanel from "./EditAffiliatePanel";
import PaymentsDetailModal, { type PaymentDetail } from "./PaymentsDetailModal";
import AccountingPanel, { type PayoutRow } from "./AccountingPanel";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "rgba(10,14,40,0.55)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <p className="text-xs font-medium text-white/40 mb-2">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
      {sub && <p className="text-xs text-white/30 mt-1">{sub}</p>}
    </div>
  );
}

type AffiliateRow = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  commission_pct: number;
  user_id: string | null;
  stripe_promotion_code_id: string | null;
  discount_pct: number | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  affiliate_code: string | null;
  has_paid: boolean;
  plan: string | null;
  created_at: string;
  first_name: string | null;
  agency_name: string | null;
};

type PaymentRow = {
  id?: string;
  affiliate_code: string;
  user_id: string | null;
  amount_cents: number;
  commission_cents: number;
  commission_pct: number;
  plan: string | null;
  billing_reason: string | null;
  paid_at: string;
  stripe_invoice_id?: string;
};

type PayoutDbRow = {
  id: string;
  affiliate_code: string;
  amount_cents: number;
  note: string | null;
  paid_at: string;
};

export default async function AdminAffiliates() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    admin.from("affiliates").select("*").order("created_at", { ascending: false }),
    admin.from("profiles").select("id, affiliate_code, has_paid, plan, created_at, first_name, agency_name").not("affiliate_code", "is", null),
    admin.from("affiliate_payments").select("affiliate_code, user_id, amount_cents, commission_cents, commission_pct, plan, billing_reason, paid_at").order("paid_at", { ascending: false }),
    admin.from("affiliate_clicks").select("affiliate_code"),
    admin.from("affiliate_payouts").select("id, affiliate_code, amount_cents, note, paid_at").order("paid_at", { ascending: false }),
  ]);

  const rows = (affiliates ?? []) as AffiliateRow[];
  const allReferrals = (referrals ?? []) as ProfileRow[];
  const paymentRows = (allPayments ?? []) as PaymentRow[];
  const clickRows = allClicks ?? [];
  const payoutRows = (allPayouts ?? []) as PayoutDbRow[];

  // Mois en cours
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Construire une map user_id → nom client (depuis profiles)
  const profileMap = new Map<string, string>();
  for (const p of allReferrals) {
    const name = [p.first_name, p.agency_name].filter(Boolean).join(" — ") || "Client";
    profileMap.set(p.id, name);
  }

  const stats = rows.map((a) => {
    const myPayments = paymentRows.filter((p) => p.affiliate_code === a.code);
    const myPayouts = payoutRows.filter((p) => p.affiliate_code === a.code);
    const myReferrals = allReferrals.filter((p) => p.affiliate_code === a.code);
    const clicks = clickRows.filter((c) => c.affiliate_code === a.code).length;

    const inscrits_free = myReferrals.filter((p) => !p.has_paid).length;
    const convertis = myReferrals.filter((p) => p.has_paid).length;
    const soloCount = myReferrals.filter((p) => p.plan === "solo").length;
    const proCount = myReferrals.filter((p) => p.plan === "pro").length;

    // Revenus et commissions réels (Stripe)
    const totalRevenueCents = myPayments.reduce((s, p) => s + p.amount_cents, 0);
    const totalCommissionCents = myPayments.reduce((s, p) => s + p.commission_cents, 0);
    const monthCommissionCents = myPayments
      .filter((p) => p.paid_at >= monthStart)
      .reduce((s, p) => s + p.commission_cents, 0);
    const monthRevenueCents = myPayments
      .filter((p) => p.paid_at >= monthStart)
      .reduce((s, p) => s + p.amount_cents, 0);

    // Détail paiements pour la modale (enrichi avec nom client)
    const paymentDetails: PaymentDetail[] = myPayments.map((p) => ({
      paid_at: p.paid_at,
      amount_cents: p.amount_cents,
      commission_cents: p.commission_cents,
      plan: p.plan ?? "solo",
      billing_reason: p.billing_reason ?? "",
      client_name: p.user_id ? (profileMap.get(p.user_id) ?? "Client") : "Client",
    }));

    // Payouts pour AccountingPanel
    const payoutDetails: PayoutRow[] = myPayouts.map((p) => ({
      id: p.id,
      amount_cents: p.amount_cents,
      note: p.note,
      paid_at: p.paid_at,
    }));

    return {
      ...a,
      inscrits: myReferrals.length,
      inscrits_free,
      convertis,
      soloCount,
      proCount,
      clicks,
      totalRevenueCents,
      totalCommissionCents,
      monthCommissionCents,
      monthRevenueCents,
      paymentDetails,
      payoutDetails,
    };
  });

  // Totaux globaux
  const totalInscrits = stats.reduce((s, a) => s + a.inscrits, 0);
  const totalConvertis = stats.reduce((s, a) => s + a.convertis, 0);
  const totalRevenueCents = stats.reduce((s, a) => s + a.totalRevenueCents, 0);
  const totalCommissionCents = stats.reduce((s, a) => s + a.totalCommissionCents, 0);
  const totalMonthCommissionCents = stats.reduce((s, a) => s + a.monthCommissionCents, 0);
  const totalPayedOut = payoutRows.reduce((s, p) => s + p.amount_cents, 0);
  const totalBalanceDue = totalCommissionCents - totalPayedOut;
  const totalClicks = stats.reduce((s, a) => s + a.clicks, 0);

  return (
    <main
      className="min-h-screen px-6 py-10"
      style={{
        background: "linear-gradient(135deg, #060918 0%, #0D0B2E 50%, #060C1F 100%)",
      }}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-white/25 tracking-[0.14em] uppercase mb-1">
              Administration
            </p>
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Partenariats affiliés
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <AddSimpleLinkForm />
            <AddAffiliateForm />
          </div>
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

        {/* Global accounting summary */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(16,185,129,0.15)" }}
        >
          <div
            className="px-6 py-4"
            style={{ background: "rgba(16,185,129,0.05)", borderBottom: "1px solid rgba(16,185,129,0.10)" }}
          >
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
              Tableau comptabilité global — tous partenaires
            </p>
          </div>
          <div style={{ background: "rgba(8,12,35,0.80)" }}>
            {/* Summary row */}
            <div className="grid grid-cols-4 gap-px" style={{ background: "rgba(255,255,255,0.04)" }}>
              {[
                { label: "Commission mois en cours", value: `${(totalMonthCommissionCents / 100).toFixed(2)}€`, color: "#818CF8" },
                { label: "Commission totale gagnée", value: `${(totalCommissionCents / 100).toFixed(2)}€`, color: "#38BDF8" },
                { label: "Total versé aux partenaires", value: `${(totalPayedOut / 100).toFixed(2)}€`, color: "#10B981" },
                { label: "Solde total à verser", value: `${(totalBalanceDue / 100).toFixed(2)}€`, color: totalBalanceDue > 0 ? "#F59E0B" : "#10B981" },
              ].map(({ label, value, color }) => (
                <div key={label} className="px-5 py-4" style={{ background: "rgba(8,12,35,0.90)" }}>
                  <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Per-partner accounting table */}
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  {["Partenaire", "Commission ce mois", "Total gagné", "Total versé", "Solde à verser", "Dernier versement"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left font-semibold text-white/30 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((a, i) => {
                  const totalPaidOut = a.payoutDetails.reduce((s, p) => s + p.amount_cents, 0);
                  const balance = a.totalCommissionCents - totalPaidOut;
                  const lastPayout = a.payoutDetails[0];
                  return (
                    <tr
                      key={a.id}
                      style={{
                        borderBottom: i < stats.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                        background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                      }}
                    >
                      <td className="px-5 py-3">
                        <p className="font-semibold text-white">{a.name}</p>
                        <p className="text-white/30 font-mono mt-0.5">{a.code}</p>
                      </td>
                      <td className="px-5 py-3 font-semibold tabular-nums" style={{ color: "#818CF8" }}>
                        {(a.monthCommissionCents / 100).toFixed(2)}€
                      </td>
                      <td className="px-5 py-3 font-semibold tabular-nums" style={{ color: "#38BDF8" }}>
                        {(a.totalCommissionCents / 100).toFixed(2)}€
                      </td>
                      <td className="px-5 py-3 font-semibold tabular-nums" style={{ color: "#10B981" }}>
                        {(totalPaidOut / 100).toFixed(2)}€
                      </td>
                      <td className="px-5 py-3 font-bold tabular-nums" style={{ color: balance > 0 ? "#F59E0B" : "#10B981" }}>
                        {(balance / 100).toFixed(2)}€
                      </td>
                      <td className="px-5 py-3 text-white/40">
                        {lastPayout
                          ? new Date(lastPayout.paid_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Affiliates detail */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="px-6 py-4"
            style={{ background: "rgba(10,14,40,0.70)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
              Détail par partenaire
            </p>
          </div>

          {stats.length === 0 ? (
            <div className="px-6 py-10 text-center" style={{ background: "rgba(10,14,40,0.55)" }}>
              <p className="text-sm text-white/30">Aucun partenaire enregistré.</p>
            </div>
          ) : (
            <div style={{ background: "rgba(10,14,40,0.55)" }}>
              {stats.map((a, i) => {
                const convRate = a.inscrits > 0 ? Math.round((a.convertis / a.inscrits) * 100) : 0;
                const clickToInscrit = a.clicks > 0 ? Math.round((a.inscrits / a.clicks) * 100) : 0;
                const hasAccount = !!a.user_id;

                return (
                  <div
                    key={a.id}
                    className="px-6 py-5"
                    style={{ borderBottom: i < stats.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                  >
                    {/* Top row */}
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.20)", color: "#818CF8" }}
                        >
                          {a.code.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{a.name}</p>
                          <p className="text-xs text-white/35">
                            {a.email ?? "—"} · <code className="text-indigo-400/70">code: {a.code}</code>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.20)", color: "#818CF8" }}
                        >
                          {a.commission_pct}% commission
                        </span>
                        {a.discount_pct != null ? (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono"
                            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.20)", color: "#34D399" }}
                          >
                            Lien -{a.discount_pct}% auto
                          </span>
                        ) : (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono"
                            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.20)", color: "#F59E0B" }}
                          >
                            Code promo · {a.code}
                          </span>
                        )}
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={
                            a.stripe_promotion_code_id
                              ? { background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.20)", color: "#10B981" }
                              : { background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "rgba(248,113,113,0.60)" }
                          }
                        >
                          {a.stripe_promotion_code_id ? "Stripe ✓" : "Stripe manquant"}
                        </span>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={
                            hasAccount
                              ? { background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.20)", color: "#10B981" }
                              : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.30)" }
                          }
                        >
                          {hasAccount ? "Compte lié" : "Sans compte"}
                        </span>
                        <DeleteAffiliateButton code={a.code} name={a.name} />
                      </div>
                    </div>

                    {/* Edit + Accounting buttons */}
                    <div className="flex gap-2 mb-4">
                      <EditAffiliatePanel
                        code={a.code}
                        name={a.name}
                        commission_pct={a.commission_pct}
                        discount_pct={a.discount_pct}
                        stripe_promotion_code_id={a.stripe_promotion_code_id}
                      />
                      <AccountingPanel
                        code={a.code}
                        name={a.name}
                        monthCommissionCents={a.monthCommissionCents}
                        totalEarnedCents={a.totalCommissionCents}
                        payouts={a.payoutDetails}
                      />
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      {[
                        {
                          label: "Clics sur le lien",
                          value: a.clicks,
                          sub: a.clicks > 0 ? `${clickToInscrit}% → inscrit` : undefined,
                          color: "#F59E0B",
                        },
                        {
                          label: "Inscrits free",
                          value: a.inscrits_free,
                          color: "rgba(255,255,255,0.60)",
                        },
                        {
                          label: "Inscrits payants",
                          value: `${a.convertis} (${convRate}%)`,
                          color: "#10B981",
                        },
                        {
                          label: "CA réel Stripe",
                          value: `${(a.totalRevenueCents / 100).toFixed(2)}€`,
                          sub: `${a.soloCount} Solo · ${a.proCount} Pro`,
                          color: "#38BDF8",
                          hasDetail: true,
                        },
                      ].map(({ label, value, sub, color, hasDetail }) => (
                        <div
                          key={label}
                          className="rounded-xl px-3 py-2.5 relative"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                        >
                          <p className="text-[10px] text-white/35 mb-1">{label}</p>
                          <p className="text-sm font-semibold" style={{ color }}>{value}</p>
                          {sub && <p className="text-[10px] text-white/25 mt-0.5">{sub}</p>}
                          {hasDetail && (
                            <PaymentsDetailModal
                              payments={a.paymentDetails}
                              commissionPct={a.commission_pct}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Commission + earnings row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div
                        className="flex items-center justify-between rounded-xl px-4 py-2.5"
                        style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)" }}
                      >
                        <p className="text-xs text-white/50">Commission ce mois (réelle)</p>
                        <p className="text-sm font-bold tabular-nums" style={{ color: "#F59E0B" }}>
                          {(a.monthCommissionCents / 100).toFixed(2)}€
                        </p>
                      </div>
                      <div
                        className="flex items-center justify-between rounded-xl px-4 py-2.5"
                        style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}
                      >
                        <p className="text-xs text-white/50">Total commission (Stripe)</p>
                        <p className="text-sm font-bold tabular-nums" style={{ color: "#10B981" }}>
                          {(a.totalCommissionCents / 100).toFixed(2)}€
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-white/20 text-center">
          Commissions calculées sur les paiements Stripe réels · versement manuel en fin de mois
        </p>
      </div>
    </main>
  );
}

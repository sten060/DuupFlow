import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  created_at: string;
};

type ProfileRow = {
  affiliate_code: string | null;
  has_paid: boolean;
  plan: string | null;
  created_at: string;
};

function computeStats(affiliate: AffiliateRow, referrals: ProfileRow[]) {
  const mine = referrals.filter((p) => p.affiliate_code === affiliate.code);
  const convertis = mine.filter((p) => p.has_paid).length;
  const soloCount = mine.filter((p) => p.plan === "solo").length;
  const proCount = mine.filter((p) => p.plan === "pro").length;
  const mrr = soloCount * 39 + proCount * 99;
  const commission = Math.round((mrr * affiliate.commission_pct) / 100);
  return { inscrits: mine.length, convertis, soloCount, proCount, mrr, commission };
}

export default async function AdminAffiliates() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Protection CEO : seul l'admin peut accéder
  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId || user.id !== adminUserId) redirect("/dashboard");

  const admin = createAdminClient();

  const [{ data: affiliates }, { data: referrals }, { data: allPayments }] =
    await Promise.all([
      admin.from("affiliates").select("*").order("created_at", { ascending: false }),
      admin
        .from("profiles")
        .select("affiliate_code, has_paid, plan, created_at")
        .not("affiliate_code", "is", null),
      admin
        .from("affiliate_payments")
        .select("affiliate_code, commission_cents, paid_at"),
    ]);

  const rows = (affiliates ?? []) as AffiliateRow[];
  const allReferrals = (referrals ?? []) as ProfileRow[];

  const paymentRows = allPayments ?? [];

  const stats = rows.map((a) => {
    const earned = Math.round(
      paymentRows
        .filter((p) => p.affiliate_code === a.code)
        .reduce((s, p) => s + p.commission_cents, 0) / 100
    );
    return { ...a, ...computeStats(a, allReferrals), earned };
  });

  const totalInscrits = stats.reduce((s, a) => s + a.inscrits, 0);
  const totalConvertis = stats.reduce((s, a) => s + a.convertis, 0);
  const totalMrr = stats.reduce((s, a) => s + a.mrr, 0);
  const totalCommission = stats.reduce((s, a) => s + a.commission, 0);
  const totalEarned = stats.reduce((s, a) => s + a.earned, 0);

  return (
    <main
      className="min-h-screen px-6 py-10"
      style={{
        background: "linear-gradient(135deg, #060918 0%, #0D0B2E 50%, #060C1F 100%)",
      }}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs font-medium text-white/25 tracking-[0.14em] uppercase mb-1">
            Administration
          </p>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Partenariats affiliés
          </h1>
        </div>

        {/* Global stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Partenaires actifs"
            value={rows.length}
            color="rgba(255,255,255,0.85)"
          />
          <StatCard
            label="Total inscrits"
            value={totalInscrits}
            sub={`${totalConvertis} convertis`}
            color="#10B981"
          />
          <StatCard
            label="MRR généré par affiliation"
            value={`${totalMrr}€`}
            color="#38BDF8"
          />
          <StatCard
            label="Commission ce mois (MRR)"
            value={`${totalCommission}€`}
            sub="Sur abonnés actifs actuels"
            color="#F59E0B"
          />
        </div>

        {/* Real Stripe total */}
        {paymentRows.length > 0 && (
          <div
            className="rounded-2xl p-5 flex items-center justify-between"
            style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.18)" }}
          >
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Commission totale générée (réel Stripe)
              </p>
              <p className="text-xs text-white/25 mt-0.5">
                {paymentRows.length} paiement{paymentRows.length > 1 ? "s" : ""} trackés depuis l&apos;activation du système
              </p>
            </div>
            <p className="text-3xl font-bold" style={{ color: "#10B981" }}>
              {totalEarned}€
            </p>
          </div>
        )}

        {/* Affiliates table */}
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
            <div
              className="px-6 py-10 text-center"
              style={{ background: "rgba(10,14,40,0.55)" }}
            >
              <p className="text-sm text-white/30">Aucun partenaire enregistré.</p>
              <p className="text-xs text-white/20 mt-1">
                INSERT INTO affiliates (code, name, email) VALUES (...)
              </p>
            </div>
          ) : (
            <div style={{ background: "rgba(10,14,40,0.55)" }}>
              {stats.map((a, i) => {
                const convRate =
                  a.inscrits > 0 ? Math.round((a.convertis / a.inscrits) * 100) : 0;
                const hasAccount = !!a.user_id;
                return (
                  <div
                    key={a.id}
                    className="px-6 py-5"
                    style={{
                      borderBottom:
                        i < stats.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    }}
                  >
                    {/* Top row */}
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                          style={{
                            background: "rgba(99,102,241,0.12)",
                            border: "1px solid rgba(99,102,241,0.20)",
                            color: "#818CF8",
                          }}
                        >
                          {a.code.slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{a.name}</p>
                          <p className="text-xs text-white/35">
                            {a.email ?? "—"} ·{" "}
                            <code className="text-indigo-400/70">?ref={a.code}</code>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: "rgba(99,102,241,0.10)",
                            border: "1px solid rgba(99,102,241,0.20)",
                            color: "#818CF8",
                          }}
                        >
                          {a.commission_pct}% commission
                        </span>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={
                            hasAccount
                              ? {
                                  background: "rgba(16,185,129,0.08)",
                                  border: "1px solid rgba(16,185,129,0.20)",
                                  color: "#10B981",
                                }
                              : {
                                  background: "rgba(255,255,255,0.04)",
                                  border: "1px solid rgba(255,255,255,0.10)",
                                  color: "rgba(255,255,255,0.30)",
                                }
                          }
                        >
                          {hasAccount ? "Compte lié" : "Pas de compte"}
                        </span>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {[
                        { label: "Inscrits", value: a.inscrits, color: "rgba(255,255,255,0.70)" },
                        {
                          label: "Convertis",
                          value: `${a.convertis} (${convRate}%)`,
                          color: "#10B981",
                        },
                        {
                          label: "Solo actifs",
                          value: a.soloCount,
                          color: "#A78BFA",
                        },
                        { label: "Pro actifs", value: a.proCount, color: "#38BDF8" },
                        {
                          label: "MRR généré",
                          value: `${a.mrr}€`,
                          color: "rgba(255,255,255,0.60)",
                        },
                      ].map(({ label, value, color }) => (
                        <div
                          key={label}
                          className="rounded-xl px-3 py-2.5"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                        >
                          <p className="text-[10px] text-white/35 mb-1">{label}</p>
                          <p className="text-sm font-semibold" style={{ color }}>
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Commission due + earned */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div
                        className="flex items-center justify-between rounded-xl px-4 py-2.5"
                        style={{
                          background: "rgba(245,158,11,0.05)",
                          border: "1px solid rgba(245,158,11,0.15)",
                        }}
                      >
                        <p className="text-xs text-white/50">Commission ce mois</p>
                        <p className="text-sm font-bold" style={{ color: "#F59E0B" }}>
                          {a.commission}€
                        </p>
                      </div>
                      <div
                        className="flex items-center justify-between rounded-xl px-4 py-2.5"
                        style={{
                          background: "rgba(16,185,129,0.05)",
                          border: "1px solid rgba(16,185,129,0.15)",
                        }}
                      >
                        <p className="text-xs text-white/50">Total généré (Stripe)</p>
                        <p className="text-sm font-bold" style={{ color: "#10B981" }}>
                          {a.earned}€
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
          Commissions calculées sur les abonnés actifs · paiement manuel en fin de mois
        </p>
      </div>
    </main>
  );
}

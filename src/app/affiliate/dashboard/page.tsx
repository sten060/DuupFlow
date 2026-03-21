import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CopyButton from "./CopyButton";

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

export default async function AffiliateDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: affiliate } = await admin
    .from("affiliates")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!affiliate) redirect("/dashboard");

  const [{ data: referrals }, { data: payments }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, has_paid, plan, created_at")
      .eq("affiliate_code", affiliate.code)
      .order("created_at", { ascending: false }),
    admin
      .from("affiliate_payments")
      .select("amount_cents, commission_cents, plan, billing_reason, paid_at")
      .eq("affiliate_code", affiliate.code)
      .order("paid_at", { ascending: false }),
  ]);

  const inscrits = referrals?.length ?? 0;
  const convertis = referrals?.filter((p) => p.has_paid).length ?? 0;
  const soloCount = referrals?.filter((p) => p.plan === "solo").length ?? 0;
  const proCount = referrals?.filter((p) => p.plan === "pro").length ?? 0;
  const mrr = soloCount * 39 + proCount * 99;
  const commission = Math.round((mrr * affiliate.commission_pct) / 100);
  const conversionRate = inscrits > 0 ? Math.round((convertis / inscrits) * 100) : 0;

  const totalEarned = Math.round(
    (payments?.reduce((s, p) => s + p.commission_cents, 0) ?? 0) / 100
  );

  const appUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://duupflow.com").replace(/\/$/, "");
  const affiliateLink = `${appUrl}/checkout?ref=${affiliate.code}`;

  const conversions = referrals?.filter((p) => p.has_paid) ?? [];

  return (
    <main
      className="min-h-screen px-6 py-10"
      style={{
        background: "linear-gradient(135deg, #060918 0%, #0D0B2E 50%, #060C1F 100%)",
      }}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-white/25 tracking-[0.14em] uppercase mb-1">
              Programme partenaire
            </p>
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Bonjour, {affiliate.name}
            </h1>
          </div>
          <span
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.25)",
              color: "#818CF8",
            }}
          >
            {affiliate.commission_pct}% de commission
          </span>
        </div>

        {/* Affiliate link */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "rgba(10,14,40,0.55)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
            Votre lien d&apos;affiliation
          </p>
          <div className="flex items-center gap-3">
            <code
              className="flex-1 rounded-xl px-4 py-2.5 text-sm text-indigo-300 truncate"
              style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}
            >
              {affiliateLink}
            </code>
            <CopyButton text={affiliateLink} />
          </div>
          <p className="text-xs text-white/25 mt-3">
            Partagez ce lien — les inscriptions et conversions sont automatiquement tracées.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Inscrits via votre lien" value={inscrits} color="rgba(255,255,255,0.85)" />
          <StatCard
            label="Abonnés convertis"
            value={convertis}
            sub={`${conversionRate}% de conversion`}
            color="#10B981"
          />
          <StatCard
            label="MRR généré"
            value={`${mrr}€`}
            sub={`${soloCount} Solo · ${proCount} Pro`}
            color="#38BDF8"
          />
          <StatCard
            label="Commission mensuelle"
            value={`${commission}€`}
            sub={`${affiliate.commission_pct}% du MRR`}
            color="#818CF8"
          />
        </div>

        {/* Total earned (real Stripe data) */}
        {(payments?.length ?? 0) > 0 && (
          <div
            className="rounded-2xl p-5 flex items-center justify-between"
            style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.18)" }}
          >
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Commission totale générée
              </p>
              <p className="text-xs text-white/25 mt-0.5">
                Basé sur les paiements Stripe réels · {payments?.length} transaction{(payments?.length ?? 0) > 1 ? "s" : ""}
              </p>
            </div>
            <p className="text-3xl font-bold" style={{ color: "#10B981" }}>
              {totalEarned}€
            </p>
          </div>
        )}

        {/* Plan breakdown */}
        {convertis > 0 && (
          <div
            className="rounded-2xl p-5"
            style={{ background: "rgba(10,14,40,0.55)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">
              Répartition des abonnés actifs
            </p>
            <div className="flex gap-6">
              <div>
                <p className="text-xl font-bold" style={{ color: "#A78BFA" }}>
                  {soloCount}
                </p>
                <p className="text-xs text-white/40 mt-0.5">Plan Solo — 39€/mois</p>
              </div>
              <div
                className="w-px self-stretch"
                style={{ background: "rgba(255,255,255,0.07)" }}
              />
              <div>
                <p className="text-xl font-bold" style={{ color: "#38BDF8" }}>
                  {proCount}
                </p>
                <p className="text-xs text-white/40 mt-0.5">Plan Pro — 99€/mois</p>
              </div>
            </div>
          </div>
        )}

        {/* Recent conversions */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "rgba(10,14,40,0.55)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">
            Conversions récentes
          </p>
          {conversions.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-6">
              Aucune conversion pour le moment — partagez votre lien !
            </p>
          ) : (
            <div className="space-y-2">
              {conversions.slice(0, 10).map((p, i) => {
                const date = new Date(p.created_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                });
                const planColor = p.plan === "pro" ? "#38BDF8" : "#A78BFA";
                const planLabel = p.plan === "pro" ? "Pro — 99€/mois" : "Solo — 39€/mois";
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl px-4 py-2.5"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: `${planColor}18`, color: planColor }}
                      >
                        {i + 1}
                      </div>
                      <span className="text-sm text-white/60">Abonné #{i + 1}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                        style={{
                          background: `${planColor}15`,
                          border: `1px solid ${planColor}30`,
                          color: planColor,
                        }}
                      >
                        {planLabel}
                      </span>
                      <span className="text-xs text-white/30 tabular-nums hidden sm:block">
                        {date}
                      </span>
                    </div>
                  </div>
                );
              })}
              {conversions.length > 10 && (
                <p className="text-xs text-white/25 text-center pt-2">
                  + {conversions.length - 10} autres conversions
                </p>
              )}
            </div>
          )}
        </div>

        {/* Payment history */}
        {(payments?.length ?? 0) > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div
              className="px-6 py-4"
              style={{ background: "rgba(10,14,40,0.70)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Historique des paiements Stripe
              </p>
            </div>
            <div style={{ background: "rgba(10,14,40,0.55)" }}>
              {payments?.slice(0, 12).map((p, i) => {
                const date = new Date(p.paid_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
                const isRenewal = p.billing_reason === "subscription_cycle";
                const planColor = p.plan === "pro" ? "#38BDF8" : "#A78BFA";
                const commission = (p.commission_cents / 100).toFixed(2);
                const amount = (p.amount_cents / 100).toFixed(2);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between px-6 py-3"
                    style={{
                      borderBottom:
                        i < (payments?.length ?? 0) - 1
                          ? "1px solid rgba(255,255,255,0.04)"
                          : "none",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: `${planColor}12`,
                          border: `1px solid ${planColor}25`,
                          color: planColor,
                        }}
                      >
                        {p.plan === "pro" ? "Pro" : "Solo"}
                      </span>
                      <span className="text-xs text-white/35">{date}</span>
                      {isRenewal && (
                        <span className="text-[10px] text-white/20 hidden sm:block">
                          renouvellement
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <span className="text-xs text-white/25 hidden sm:block">
                        {amount}€ encaissé
                      </span>
                      <span className="text-sm font-semibold" style={{ color: "#10B981" }}>
                        +{commission}€
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-white/20 text-center">
          La commission est versée manuellement en fin de mois par virement.
          Pour toute question : <span className="text-white/35">hello@duupflow.com</span>
        </p>
      </div>
    </main>
  );
}

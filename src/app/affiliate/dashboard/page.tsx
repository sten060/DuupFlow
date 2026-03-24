import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CopyButton from "./CopyButton";
import PaymentInfoForm from "./PaymentInfoForm";

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

  if (!user) redirect("/affiliate-login");

  const admin = createAdminClient();

  // Lookup par user_id, ou par email en fallback (partenaire créé avant la liaison)
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
      // Stocker le user_id pour les prochaines connexions
      if (!byEmail.user_id) {
        await admin.from("affiliates").update({ user_id: user.id }).eq("id", byEmail.id);
      }
    }
  }

  if (!affiliate) redirect("/affiliate-login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: payments } = await admin
    .from("affiliate_payments")
    .select("amount_cents, commission_cents, plan, billing_reason, paid_at, commission_paid_at")
    .eq("affiliate_code", affiliate.code)
    .order("paid_at", { ascending: false });

  const allPayments = payments ?? [];

  // Affiliés payants = lignes distinctes dans affiliate_payments
  const uniquePayingClients = allPayments.filter(
    (p) => p.billing_reason === "subscription_create"
  ).length;

  // Commission ce mois (réelle, identique au calcul CEO)
  const monthCommissionCents = allPayments
    .filter((p) => p.paid_at >= monthStart)
    .reduce((s, p) => s + p.commission_cents, 0);

  // Commission totale gagnée
  const totalEarnedCents = allPayments.reduce((s, p) => s + p.commission_cents, 0);

  // Commissions déjà versées
  const totalPaidCents = allPayments
    .filter((p) => p.commission_paid_at)
    .reduce((s, p) => s + p.commission_cents, 0);

  const balanceCents = totalEarnedCents - totalPaidCents;

  const appUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.duupflow.com").replace(/\/$/, "");
  const affiliateLink = `${appUrl}/?ref=${affiliate.code}`;

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
          {affiliate.stripe_promotion_code_id && affiliate.discount_pct === null && (
            <p className="text-xs text-white/25 mt-3">
              Code promo : <span className="text-yellow-400/70 font-mono font-semibold">{affiliate.code}</span>
              {" "}— vos filleuls peuvent aussi saisir ce code à la caisse.
            </p>
          )}
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Affiliés payants"
            value={uniquePayingClients}
            sub="via votre lien/code"
            color="#10B981"
          />
          <StatCard
            label="Commission ce mois"
            value={`${(monthCommissionCents / 100).toFixed(2)}€`}
            sub={`${affiliate.commission_pct}% des achats réels`}
            color="#818CF8"
          />
          <StatCard
            label="Total gagné (Stripe)"
            value={`${(totalEarnedCents / 100).toFixed(2)}€`}
            sub={`${allPayments.length} transaction${allPayments.length > 1 ? "s" : ""}`}
            color="#38BDF8"
          />
          <StatCard
            label="Solde à verser"
            value={`${(balanceCents / 100).toFixed(2)}€`}
            sub={balanceCents === 0 ? "Tout est à jour ✓" : "En attente de virement"}
            color={balanceCents === 0 ? "#10B981" : "#F59E0B"}
          />
        </div>

        {/* Payments history (Stripe) */}
        {allPayments.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div
              className="px-6 py-4"
              style={{ background: "rgba(10,14,40,0.70)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Historique des paiements affiliés
              </p>
            </div>
            <div style={{ background: "rgba(10,14,40,0.55)" }}>
              {allPayments.map((p, i) => {
                const date = new Date(p.paid_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
                const isRenewal = p.billing_reason === "subscription_cycle";
                const planColor = p.plan === "pro" ? "#38BDF8" : "#A78BFA";
                const commission = (p.commission_cents / 100).toFixed(2);
                const amount = (p.amount_cents / 100).toFixed(2);

                // Commission status
                const now15dAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
                const stripeDate = new Date(p.paid_at);
                let statusLabel: string;
                let statusColor: string;
                let statusBg: string;
                if (p.commission_paid_at) {
                  const paidDate = new Date(p.commission_paid_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
                  statusLabel = `Versée le ${paidDate}`;
                  statusColor = "#10B981";
                  statusBg = "rgba(16,185,129,0.10)";
                } else if (stripeDate < now15dAgo) {
                  statusLabel = "Validée";
                  statusColor = "#818CF8";
                  statusBg = "rgba(99,102,241,0.10)";
                } else {
                  const daysLeft = 15 - Math.floor((Date.now() - stripeDate.getTime()) / (24 * 60 * 60 * 1000));
                  statusLabel = `En attente (${daysLeft}j)`;
                  statusColor = "#F59E0B";
                  statusBg = "rgba(245,158,11,0.10)";
                }

                return (
                  <div
                    key={i}
                    className="flex items-center justify-between px-6 py-3"
                    style={{
                      borderBottom:
                        i < allPayments.length - 1
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
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full hidden sm:inline-block"
                        style={{ background: statusBg, color: statusColor }}
                      >
                        {statusLabel}
                      </span>
                      <span className="text-xs text-white/25 hidden sm:block">
                        {amount}€ encaissé
                      </span>
                      <span className="text-sm font-semibold tabular-nums" style={{ color: "#10B981" }}>
                        +{commission}€
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Payment info */}
        <PaymentInfoForm initial={affiliate.payment_info ?? null} />

        <p className="text-xs text-white/20 text-center">
          La commission est versée manuellement en fin de mois par virement.
          Pour toute question : <span className="text-white/35">hello@duupflow.com</span>
        </p>
      </div>
    </main>
  );
}

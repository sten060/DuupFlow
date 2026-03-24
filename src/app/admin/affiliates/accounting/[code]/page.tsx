import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminAffiliatesNav from "../../AdminAffiliatesNav";
import AddPayoutForm from "./AddPayoutForm";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function fmt(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString("fr-FR", opts ?? { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateFull(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "long", year: "numeric" });
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

// ─────────────────────────────────────────────────────────

export default async function AffiliateAccountingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId || user.id !== adminUserId) redirect("/dashboard");

  const admin = createAdminClient();

  const [
    { data: affiliateRaw },
    { data: paymentsRaw },
    { data: payoutsRaw },
  ] = await Promise.all([
    admin.from("affiliates").select("*").eq("code", code.toUpperCase()).single(),
    admin
      .from("affiliate_payments")
      .select("id, stripe_invoice_id, user_id, amount_cents, commission_cents, commission_pct, plan, billing_reason, paid_at, commission_paid_at")
      .eq("affiliate_code", code.toUpperCase())
      .order("paid_at", { ascending: false }),
    admin
      .from("affiliate_payouts")
      .select("id, amount_cents, note, paid_at")
      .eq("affiliate_code", code.toUpperCase())
      .order("paid_at", { ascending: false }),
  ]);

  if (!affiliateRaw) notFound();

  const affiliate = affiliateRaw as {
    id: string; code: string; name: string; email: string | null;
    commission_pct: number; discount_pct: number | null;
    stripe_promotion_code_id: string | null; user_id: string | null;
    payment_info: { iban?: string; bic?: string; account_name?: string; paypal?: string } | null;
  };

  const payments = (paymentsRaw ?? []) as {
    id: string; stripe_invoice_id: string; user_id: string | null;
    amount_cents: number; commission_cents: number; commission_pct: number;
    plan: string | null; billing_reason: string | null;
    paid_at: string; commission_paid_at: string | null;
  }[];

  const payouts = (payoutsRaw ?? []) as {
    id: string; amount_cents: number; note: string | null; paid_at: string;
  }[];

  // Fetch client profiles for name display
  const userIds = [...new Set(payments.map((p) => p.user_id).filter(Boolean) as string[])];
  let profileMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, first_name, agency_name, email")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      const label = [p.first_name, p.agency_name].filter(Boolean).join(" · ") || p.email || "Client";
      profileMap.set(p.id, label);
    }
  }

  // ── Compute statuses ──
  const now = Date.now();
  const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

  type Status = "pending" | "validated" | "paid";
  function getStatus(p: typeof payments[0]): Status {
    if (p.commission_paid_at) return "paid";
    if (now - new Date(p.paid_at).getTime() > FIFTEEN_DAYS_MS) return "validated";
    return "pending";
  }

  // ── Global totals ──
  const totalRevenueCents = payments.reduce((s, p) => s + p.amount_cents, 0);
  const totalCommissionCents = payments.reduce((s, p) => s + p.commission_cents, 0);
  const totalPaidOutCents = payouts.reduce((s, p) => s + p.amount_cents, 0);
  const balanceCents = totalCommissionCents - totalPaidOutCents;

  const pendingCents = payments
    .filter((p) => getStatus(p) === "pending")
    .reduce((s, p) => s + p.commission_cents, 0);
  const validatedCents = payments
    .filter((p) => getStatus(p) === "validated")
    .reduce((s, p) => s + p.commission_cents, 0);
  const paidCents = payments
    .filter((p) => getStatus(p) === "paid")
    .reduce((s, p) => s + p.commission_cents, 0);

  // Group payments by month
  const grouped = new Map<string, typeof payments>();
  for (const p of payments) {
    const k = monthKey(p.paid_at);
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(p);
  }

  const pi = affiliate.payment_info;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #060918 0%, #0D0B2E 50%, #060C1F 100%)" }}>
      <AdminAffiliatesNav />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Back + header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link
              href="/admin/affiliates/partners"
              className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition mb-3"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Retour aux partenaires
            </Link>
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold"
                style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)", color: "#818CF8" }}
              >
                {affiliate.code.slice(0, 2)}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{affiliate.name}</h1>
                <p className="text-xs text-white/35 mt-0.5">
                  <code className="text-indigo-400/70">{affiliate.code}</code>
                  {affiliate.email && <> · {affiliate.email}</>}
                  <span className="ml-2 text-indigo-300/60">{affiliate.commission_pct}% commission</span>
                </p>
              </div>
            </div>
          </div>

          {/* Payment info summary */}
          {pi && (pi.iban || pi.paypal) && (
            <div
              className="rounded-2xl px-5 py-3 space-y-1.5 shrink-0"
              style={{ background: "rgba(8,12,35,0.80)", border: "1px solid rgba(99,102,241,0.15)" }}
            >
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">Coordonnées de paiement</p>
              {pi.account_name && <p className="text-xs text-white/70 font-medium">{pi.account_name}</p>}
              {pi.iban && <p className="text-xs font-mono text-white/80 tracking-wide">{pi.iban}</p>}
              {pi.bic && <p className="text-[10px] text-white/40">BIC : <span className="font-mono">{pi.bic}</span></p>}
              {pi.paypal && <p className="text-xs text-blue-300">PayPal : {pi.paypal}</p>}
            </div>
          )}
          {(!pi || (!pi.iban && !pi.paypal)) && (
            <div
              className="rounded-2xl px-5 py-3 shrink-0"
              style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.20)" }}
            >
              <p className="text-xs text-amber-400/70">⚠ Coordonnées de paiement manquantes</p>
              <p className="text-[10px] text-white/30 mt-1">Le partenaire doit les renseigner depuis son dashboard</p>
            </div>
          )}
        </div>

        {/* ── Summary strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "CA Stripe total", value: fmt(totalRevenueCents), sub: `${payments.length} transaction${payments.length !== 1 ? "s" : ""}`, color: "rgba(255,255,255,0.75)" },
            { label: "Commission due (total)", value: fmt(totalCommissionCents), sub: `${affiliate.commission_pct}% appliqué`, color: "#818CF8" },
            { label: "Déjà versé", value: fmt(totalPaidOutCents), sub: `${payouts.length} virement${payouts.length !== 1 ? "s" : ""}`, color: "#10B981" },
            {
              label: "Solde restant dû",
              value: fmt(balanceCents),
              sub: balanceCents <= 0 ? "Tout est à jour ✓" : "À verser",
              color: balanceCents <= 0 ? "#10B981" : "#F59E0B",
            },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="rounded-2xl p-5" style={{ background: "rgba(10,14,40,0.55)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[10px] font-medium text-white/40 mb-2 uppercase tracking-wider">{label}</p>
              <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
              {sub && <p className="text-[10px] text-white/30 mt-1">{sub}</p>}
            </div>
          ))}
        </div>

        {/* ── Status breakdown ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="px-6 py-3"
            style={{ background: "rgba(10,14,40,0.70)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Répartition des commissions par statut</p>
          </div>
          <div className="grid grid-cols-3 gap-px" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="px-6 py-4" style={{ background: "rgba(8,12,35,0.90)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="h-2 w-2 rounded-full" style={{ background: "#F59E0B" }} />
                <p className="text-[10px] text-white/40 uppercase tracking-wider">En attente (&lt;15j)</p>
              </div>
              <p className="text-lg font-bold tabular-nums" style={{ color: "#F59E0B" }}>{fmt(pendingCents)}</p>
              <p className="text-[10px] text-white/25 mt-0.5">{payments.filter((p) => getStatus(p) === "pending").length} commission{payments.filter((p) => getStatus(p) === "pending").length !== 1 ? "s" : ""}</p>
            </div>
            <div className="px-6 py-4" style={{ background: "rgba(8,12,35,0.90)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="h-2 w-2 rounded-full" style={{ background: "#818CF8" }} />
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Validées (à verser)</p>
              </div>
              <p className="text-lg font-bold tabular-nums" style={{ color: "#818CF8" }}>{fmt(validatedCents)}</p>
              <p className="text-[10px] text-white/25 mt-0.5">{payments.filter((p) => getStatus(p) === "validated").length} commission{payments.filter((p) => getStatus(p) === "validated").length !== 1 ? "s" : ""}</p>
            </div>
            <div className="px-6 py-4" style={{ background: "rgba(8,12,35,0.90)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="h-2 w-2 rounded-full" style={{ background: "#10B981" }} />
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Versées</p>
              </div>
              <p className="text-lg font-bold tabular-nums" style={{ color: "#10B981" }}>{fmt(paidCents)}</p>
              <p className="text-[10px] text-white/25 mt-0.5">{payments.filter((p) => getStatus(p) === "paid").length} commission{payments.filter((p) => getStatus(p) === "paid").length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>

        {/* ── Main: commissions + payouts side by side ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Left: commissions table (2/3) */}
          <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="px-6 py-4" style={{ background: "rgba(10,14,40,0.70)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                Journal des commissions ({payments.length})
              </p>
            </div>

            {payments.length === 0 ? (
              <div className="px-6 py-12 text-center" style={{ background: "rgba(10,14,40,0.55)" }}>
                <p className="text-sm text-white/25">Aucune commission enregistrée pour ce partenaire.</p>
              </div>
            ) : (
              <div style={{ background: "rgba(10,14,40,0.55)" }}>
                {/* Table header */}
                <div
                  className="grid gap-2 px-5 py-2.5 text-[10px] font-semibold text-white/25 uppercase tracking-wider"
                  style={{
                    gridTemplateColumns: "1fr 80px 70px 80px 100px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span>Client · date</span>
                  <span>Plan</span>
                  <span className="text-right">CA</span>
                  <span className="text-right">Commission</span>
                  <span className="text-right">Statut</span>
                </div>

                {/* Grouped by month */}
                {[...grouped.entries()].map(([mKey, mPayments]) => {
                  const mTotal = mPayments.reduce((s, p) => s + p.commission_cents, 0);
                  return (
                    <div key={mKey}>
                      {/* Month separator */}
                      <div
                        className="flex items-center justify-between px-5 py-2"
                        style={{ background: "rgba(255,255,255,0.025)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                          {monthLabel(mKey)}
                        </p>
                        <p className="text-[10px] font-semibold text-white/35 tabular-nums">
                          {mPayments.length} transaction{mPayments.length !== 1 ? "s" : ""} · {fmt(mTotal)}
                        </p>
                      </div>

                      {mPayments.map((p, i) => {
                        const status = getStatus(p);
                        const clientName = p.user_id ? (profileMap.get(p.user_id) ?? "Client inconnu") : "Client inconnu";
                        const isFirst = p.billing_reason === "subscription_create";
                        const planColor = p.plan === "pro" ? "#38BDF8" : "#A78BFA";

                        let statusLabel: string, statusColor: string, statusBg: string;
                        if (status === "paid") {
                          statusLabel = `Versée ${fmtDate(p.commission_paid_at!, { day: "2-digit", month: "short" })}`;
                          statusColor = "#10B981"; statusBg = "rgba(16,185,129,0.10)";
                        } else if (status === "validated") {
                          statusLabel = "Validée ✓";
                          statusColor = "#818CF8"; statusBg = "rgba(99,102,241,0.10)";
                        } else {
                          const dLeft = 15 - Math.floor((now - new Date(p.paid_at).getTime()) / 86400000);
                          statusLabel = `Attente ${dLeft}j`;
                          statusColor = "#F59E0B"; statusBg = "rgba(245,158,11,0.10)";
                        }

                        return (
                          <div
                            key={p.id}
                            className="grid gap-2 px-5 py-3 items-center text-xs"
                            style={{
                              gridTemplateColumns: "1fr 80px 70px 80px 100px",
                              borderBottom: i < mPayments.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                            }}
                          >
                            {/* Client + date */}
                            <div className="min-w-0">
                              <p className="text-white/75 truncate font-medium">{clientName}</p>
                              <p className="text-[10px] text-white/30 mt-0.5 tabular-nums">
                                {fmtDate(p.paid_at, { day: "2-digit", month: "short", year: "numeric" })}
                                {isFirst && (
                                  <span className="ml-1.5 text-emerald-400/60">1er paiement</span>
                                )}
                              </p>
                              <p className="text-[9px] text-white/15 font-mono mt-0.5 truncate">{p.stripe_invoice_id}</p>
                            </div>

                            {/* Plan */}
                            <div>
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: `${planColor}15`, border: `1px solid ${planColor}25`, color: planColor }}
                              >
                                {p.plan === "pro" ? "Pro" : "Solo"}
                              </span>
                            </div>

                            {/* CA encaissé */}
                            <div className="text-right">
                              <p className="text-white/55 tabular-nums">{fmt(p.amount_cents)}</p>
                              <p className="text-[10px] text-white/25">{p.commission_pct}%</p>
                            </div>

                            {/* Commission */}
                            <div className="text-right">
                              <p className="font-semibold tabular-nums" style={{ color: "#10B981" }}>
                                {fmt(p.commission_cents)}
                              </p>
                            </div>

                            {/* Status */}
                            <div className="text-right">
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: statusBg, color: statusColor }}
                              >
                                {statusLabel}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Footer: total */}
                <div
                  className="grid gap-2 px-5 py-3 text-xs font-bold"
                  style={{
                    gridTemplateColumns: "1fr 80px 70px 80px 100px",
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <span className="text-white/50">TOTAL</span>
                  <span />
                  <span className="text-right text-white/50 tabular-nums">{fmt(totalRevenueCents)}</span>
                  <span className="text-right tabular-nums" style={{ color: "#818CF8" }}>{fmt(totalCommissionCents)}</span>
                  <span />
                </div>
              </div>
            )}
          </div>

          {/* Right: payouts (1/3) */}
          <div className="space-y-4">
            {/* Add payout */}
            <AddPayoutForm affiliateCode={affiliate.code} />

            {/* Payouts history */}
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-5 py-3" style={{ background: "rgba(10,14,40,0.70)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                  Versements ({payouts.length})
                </p>
              </div>
              <div style={{ background: "rgba(10,14,40,0.55)" }}>
                {payouts.length === 0 ? (
                  <p className="text-xs text-white/25 text-center py-8">Aucun versement enregistré.</p>
                ) : (
                  <>
                    {payouts.map((p, i) => (
                      <div
                        key={p.id}
                        className="flex items-start justify-between gap-3 px-5 py-3.5"
                        style={{ borderBottom: i < payouts.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white/70">{fmtDateFull(p.paid_at)}</p>
                          {p.note && <p className="text-[10px] text-white/35 mt-0.5 truncate">{p.note}</p>}
                        </div>
                        <p className="text-sm font-bold tabular-nums shrink-0" style={{ color: "#10B981" }}>
                          {fmt(p.amount_cents)}
                        </p>
                      </div>
                    ))}
                    {/* Total */}
                    <div
                      className="flex items-center justify-between px-5 py-3"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}
                    >
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Total versé</p>
                      <p className="text-sm font-bold tabular-nums" style={{ color: "#10B981" }}>
                        {fmt(totalPaidOutCents)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Balance recap */}
            <div
              className="rounded-2xl p-5 space-y-2.5"
              style={{
                background: balanceCents > 0 ? "rgba(245,158,11,0.05)" : "rgba(16,185,129,0.05)",
                border: `1px solid ${balanceCents > 0 ? "rgba(245,158,11,0.20)" : "rgba(16,185,129,0.20)"}`,
              }}
            >
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Récapitulatif</p>
              {[
                { label: "Commission totale due", value: fmt(totalCommissionCents), color: "#818CF8" },
                { label: "Total déjà versé", value: `- ${fmt(totalPaidOutCents)}`, color: "#10B981" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <p className="text-xs text-white/45">{label}</p>
                  <p className="text-xs font-semibold tabular-nums" style={{ color }}>{value}</p>
                </div>
              ))}
              <div className="h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-white/60">Solde dû</p>
                <p className="text-base font-bold tabular-nums" style={{ color: balanceCents > 0 ? "#F59E0B" : "#10B981" }}>
                  {fmt(balanceCents)}
                </p>
              </div>
              {validatedCents > 0 && (
                <p className="text-[10px] text-indigo-300/60 mt-1">
                  dont <strong className="text-indigo-300/80">{fmt(validatedCents)}</strong> validés et prêts à verser
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";
import PaymentInfoForm, { type PaymentInfo } from "./PaymentInfoForm";
import LogoutButton from "./LogoutButton";

type Payment = {
  amount_cents: number;
  commission_cents: number;
  plan: string | null;
  billing_reason: string | null;
  paid_at: string;
  commission_paid_at: string | null;
};

type Payout = {
  id: string;
  amount_cents: number;
  note: string | null;
  paid_at: string;
};

type Props = {
  affiliate: {
    name: string;
    code: string;
    commission_pct: number;
    discount_pct: number | null;
    stripe_promotion_code_id: string | null;
    payment_info: PaymentInfo;
  };
  affiliateLink: string;
  payments: Payment[];
  payouts: Payout[];
  clicks: number;
  freeSignups: number;
  payingClients: number;
  monthCommissionCents: number;
  totalEarnedCents: number;
  totalPaidCents: number;
};

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(10,14,40,0.55)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <p className="text-[10px] font-medium text-white/40 mb-1.5 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-white/30 mt-1">{sub}</p>}
    </div>
  );
}

export default function AffiliateDashboardClient({
  affiliate,
  affiliateLink,
  payments,
  payouts,
  clicks,
  freeSignups,
  payingClients,
  monthCommissionCents,
  totalEarnedCents,
  totalPaidCents,
}: Props) {
  const [tab, setTab] = useState<"dashboard" | "payout">("dashboard");
  const balanceCents = totalEarnedCents - totalPaidCents;

  const tabs = [
    { id: "dashboard" as const, label: "Tableau de bord" },
    { id: "payout" as const, label: "Payout" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #060918 0%, #0D0B2E 50%, #060C1F 100%)" }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-10"
        style={{ background: "rgba(6,9,24,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          {/* Left: name + commission */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-semibold text-white truncate">{affiliate.name}</span>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", color: "#818CF8" }}
            >
              {affiliate.commission_pct}%
            </span>
          </div>

          {/* Center: tabs */}
          <nav className="flex items-center gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold transition"
                style={
                  tab === t.id
                    ? { background: "rgba(99,102,241,0.18)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.30)" }
                    : { background: "transparent", color: "rgba(255,255,255,0.35)", border: "1px solid transparent" }
                }
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Right: logout */}
          <LogoutButton />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* ── DASHBOARD TAB ── */}
        {tab === "dashboard" && (
          <>
            {/* Affiliate link */}
            <div className="rounded-2xl p-5" style={{ background: "rgba(10,14,40,0.55)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">Votre lien d&apos;affiliation</p>
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

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Clics sur le lien" value={clicks} color="#F59E0B" />
              <StatCard label="Inscrits (free)" value={freeSignups} color="rgba(255,255,255,0.65)" />
              <StatCard label="Abonnés payants" value={payingClients} color="#10B981" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label="Commission ce mois"
                value={`${(monthCommissionCents / 100).toFixed(2)}€`}
                sub={`${affiliate.commission_pct}% des achats`}
                color="#818CF8"
              />
              <StatCard
                label="Total gagné"
                value={`${(totalEarnedCents / 100).toFixed(2)}€`}
                sub={`${payments.length} transaction${payments.length > 1 ? "s" : ""}`}
                color="#38BDF8"
              />
              <StatCard
                label="Solde à verser"
                value={`${(balanceCents / 100).toFixed(2)}€`}
                sub={balanceCents === 0 ? "Tout est à jour ✓" : "En attente de virement"}
                color={balanceCents === 0 ? "#10B981" : "#F59E0B"}
              />
            </div>

            {/* Payment history */}
            {payments.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="px-6 py-4" style={{ background: "rgba(10,14,40,0.70)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Historique des commissions</p>
                </div>
                <div style={{ background: "rgba(10,14,40,0.55)" }}>
                  {payments.map((p, i) => {
                    const date = new Date(p.paid_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
                    const planColor = p.plan === "pro" ? "#38BDF8" : "#A78BFA";
                    const commission = (p.commission_cents / 100).toFixed(2);
                    const amount = (p.amount_cents / 100).toFixed(2);
                    const now15dAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
                    const stripeDate = new Date(p.paid_at);
                    let statusLabel: string, statusColor: string, statusBg: string;
                    if (p.commission_paid_at) {
                      const d = new Date(p.commission_paid_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
                      statusLabel = `Versée le ${d}`; statusColor = "#10B981"; statusBg = "rgba(16,185,129,0.10)";
                    } else if (stripeDate < now15dAgo) {
                      statusLabel = "Validée"; statusColor = "#818CF8"; statusBg = "rgba(99,102,241,0.10)";
                    } else {
                      const dLeft = 15 - Math.floor((Date.now() - stripeDate.getTime()) / 86400000);
                      statusLabel = `En attente (${dLeft}j)`; statusColor = "#F59E0B"; statusBg = "rgba(245,158,11,0.10)";
                    }
                    return (
                      <div key={i} className="flex items-center justify-between px-6 py-3" style={{ borderBottom: i < payments.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${planColor}12`, border: `1px solid ${planColor}25`, color: planColor }}>
                            {p.plan === "pro" ? "Pro" : "Solo"}
                          </span>
                          <span className="text-xs text-white/35">{date}</span>
                          {p.billing_reason === "subscription_cycle" && (
                            <span className="text-[10px] text-white/20 hidden sm:block">renouvellement</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full hidden sm:inline-block" style={{ background: statusBg, color: statusColor }}>
                            {statusLabel}
                          </span>
                          <span className="text-xs text-white/25 hidden sm:block">{amount}€ encaissé</span>
                          <span className="text-sm font-semibold tabular-nums" style={{ color: "#10B981" }}>+{commission}€</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {payments.length === 0 && (
              <p className="text-sm text-white/25 text-center py-8">Aucune commission enregistrée pour l&apos;instant.</p>
            )}

            <p className="text-xs text-white/20 text-center">
              La commission est versée manuellement en fin de mois.
              Questions : <span className="text-white/35">hello@duupflow.com</span>
            </p>
          </>
        )}

        {/* ── PAYOUT TAB ── */}
        {tab === "payout" && (
          <>
            <PaymentInfoForm initial={affiliate.payment_info} />

            {/* Payout history */}
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-6 py-4" style={{ background: "rgba(10,14,40,0.70)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Virements reçus</p>
              </div>
              <div style={{ background: "rgba(10,14,40,0.55)" }}>
                {payouts.length === 0 ? (
                  <p className="text-xs text-white/25 text-center py-10">Aucun virement reçu pour l&apos;instant.</p>
                ) : (
                  <>
                    {payouts.map((p, i) => {
                      const date = new Date(p.paid_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
                      return (
                        <div key={p.id} className="flex items-center justify-between px-6 py-4" style={{ borderBottom: i < payouts.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                          <div>
                            <p className="text-sm text-white/70">{date}</p>
                            {p.note && <p className="text-xs text-white/30 mt-0.5">{p.note}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
                              <svg className="h-3 w-3 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className="text-base font-bold tabular-nums" style={{ color: "#10B981" }}>
                              {(p.amount_cents / 100).toFixed(2)}€
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between px-6 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                      <p className="text-xs font-semibold text-white/40">Total reçu</p>
                      <p className="text-sm font-bold tabular-nums" style={{ color: "#10B981" }}>
                        {(payouts.reduce((s, p) => s + p.amount_cents, 0) / 100).toFixed(2)}€
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

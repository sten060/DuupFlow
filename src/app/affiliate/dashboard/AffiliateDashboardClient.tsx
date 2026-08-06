"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";
import PaymentInfoForm, { type PaymentInfo } from "./PaymentInfoForm";
import LogoutButton from "./LogoutButton";
import { Brand, CTA_GRAD } from "@/components/landing/shell";

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
  filleulDiscountPct: number | null;
  payments: Payment[];
  payouts: Payout[];
  clicks: number;
  freeSignups: number;
  payingClients: number;
  monthCommissionCents: number;
  totalEarnedCents: number;
  totalPaidCents: number;
};

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5 shadow-[0_10px_30px_rgba(10,30,90,0.05)]">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: accent }} />
        <p className="text-[11px] font-medium text-[#605f5f] uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-2xl font-bold tracking-tight text-[#1a1a1a] tabular-nums">{value}</p>
      {sub && <p className="text-xs text-[#9aa2b2] mt-1">{sub}</p>}
    </div>
  );
}

export default function AffiliateDashboardClient({
  affiliate,
  affiliateLink,
  filleulDiscountPct,
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
    <div className="min-h-screen bg-[#f6f7f9] text-[#1a1a1a]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-black/5 bg-white/85 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Left: brand + name + commission */}
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo-mark.png" alt="" className="h-7 w-7 object-contain shrink-0" />
            <div className="min-w-0 leading-tight">
              <Brand className="block text-[15px] font-bold tracking-tight" />
              <span className="block text-xs text-[#605f5f] truncate">{affiliate.name}</span>
            </div>
            <span
              className="text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0 text-white"
              style={{ background: CTA_GRAD }}
            >
              {affiliate.commission_pct}%
            </span>
          </div>

          {/* Right: tabs + logout */}
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1 rounded-full bg-black/[0.04] p-1 ring-1 ring-black/5">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition"
                  style={
                    tab === t.id
                      ? { background: CTA_GRAD, color: "#fff", boxShadow: "0 6px 16px rgba(90,90,240,0.25)" }
                      : { background: "transparent", color: "#605f5f" }
                  }
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <LogoutButton />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* ── DASHBOARD TAB ── */}
        {tab === "dashboard" && (
          <>
            {/* Affiliate link */}
            <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5 shadow-[0_10px_30px_rgba(10,30,90,0.05)]">
              <p className="text-[11px] font-semibold text-[#605f5f] uppercase tracking-wider mb-3">Votre lien d&apos;affiliation</p>
              <div className="flex items-center gap-3">
                <code className="flex-1 rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] truncate bg-black/[0.03] ring-1 ring-black/5">
                  {affiliateLink}
                </code>
                <CopyButton text={affiliateLink} />
              </div>
              <p className="text-xs text-[#9aa2b2] mt-3">
                Sert à tracker vos filleuls et votre commission.
              </p>
            </div>

            {/* Code promo filleuls */}
            {affiliate.stripe_promotion_code_id && (
              <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5 shadow-[0_10px_30px_rgba(10,30,90,0.05)]">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-[11px] font-semibold text-[#605f5f] uppercase tracking-wider">Code promo filleuls</p>
                  {filleulDiscountPct != null && (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: CTA_GRAD }}>
                      -{filleulDiscountPct}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <code className="flex-1 rounded-xl px-4 py-2.5 text-base font-mono font-bold tracking-wider text-[#1a1a1a] bg-black/[0.03] ring-1 ring-black/5">
                    {affiliate.code}
                  </code>
                  <CopyButton text={affiliate.code} />
                </div>
                <p className="text-xs text-[#605f5f] mt-3">
                  {filleulDiscountPct != null ? (
                    <>Vos filleuls obtiennent <span className="font-semibold text-[#1a1a1a]">-{filleulDiscountPct}%</span> sur leur 1<sup>er</sup> mois en saisissant ce code au checkout.</>
                  ) : (
                    <>Vos filleuls saisissent ce code au checkout pour bénéficier de la réduction.</>
                  )}
                </p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Clics sur le lien" value={clicks} accent="#F59E0B" />
              <StatCard label="Inscrits (free)" value={freeSignups} accent="#94a3b8" />
              <StatCard label="Abonnés payants" value={payingClients} accent="#10B981" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label="Commission ce mois"
                value={`${(monthCommissionCents / 100).toFixed(2)}€`}
                sub={`${affiliate.commission_pct}% des achats`}
                accent="#6366F1"
              />
              <StatCard
                label="Total gagné"
                value={`${(totalEarnedCents / 100).toFixed(2)}€`}
                sub={`${payments.length} transaction${payments.length > 1 ? "s" : ""}`}
                accent="#38BDF8"
              />
              <StatCard
                label="Solde à verser"
                value={`${(balanceCents / 100).toFixed(2)}€`}
                sub={balanceCents === 0 ? "Tout est à jour ✓" : "En attente de virement"}
                accent={balanceCents === 0 ? "#10B981" : "#F59E0B"}
              />
            </div>

            {/* Payment history */}
            {payments.length > 0 && (
              <div className="rounded-2xl overflow-hidden bg-white ring-1 ring-black/5 shadow-[0_10px_30px_rgba(10,30,90,0.05)]">
                <div className="px-6 py-4 border-b border-black/5">
                  <p className="text-[11px] font-semibold text-[#605f5f] uppercase tracking-wider">Historique des commissions</p>
                </div>
                <div>
                  {payments.map((p, i) => {
                    const date = new Date(p.paid_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
                    const planColor = p.plan === "pro" ? "#0284c7" : "#7c3aed";
                    const commission = (p.commission_cents / 100).toFixed(2);
                    const amount = (p.amount_cents / 100).toFixed(2);
                    const now15dAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
                    const stripeDate = new Date(p.paid_at);
                    let statusLabel: string, statusColor: string, statusBg: string;
                    if (p.commission_paid_at) {
                      const d = new Date(p.commission_paid_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
                      statusLabel = `Versée le ${d}`; statusColor = "#059669"; statusBg = "rgba(16,185,129,0.10)";
                    } else if (stripeDate < now15dAgo) {
                      statusLabel = "Validée"; statusColor = "#4f46e5"; statusBg = "rgba(99,102,241,0.10)";
                    } else {
                      const dLeft = 15 - Math.floor((Date.now() - stripeDate.getTime()) / 86400000);
                      statusLabel = `En attente (${dLeft}j)`; statusColor = "#b45309"; statusBg = "rgba(245,158,11,0.12)";
                    }
                    return (
                      <div key={i} className="flex items-center justify-between px-6 py-3.5" style={{ borderBottom: i < payments.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${planColor}14`, color: planColor }}>
                            {p.plan === "pro" ? "Pro" : "Solo"}
                          </span>
                          <span className="text-xs text-[#605f5f]">{date}</span>
                          {p.billing_reason === "subscription_cycle" && (
                            <span className="text-[10px] text-[#9aa2b2] hidden sm:block">renouvellement</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full hidden sm:inline-block" style={{ background: statusBg, color: statusColor }}>
                            {statusLabel}
                          </span>
                          <span className="text-xs text-[#9aa2b2] hidden sm:block">{amount}€ encaissé</span>
                          <span className="text-sm font-semibold tabular-nums text-[#059669]">+{commission}€</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {payments.length === 0 && (
              <p className="text-sm text-[#9aa2b2] text-center py-8">Aucune commission enregistrée pour l&apos;instant.</p>
            )}

            <p className="text-xs text-[#9aa2b2] text-center">
              La commission est versée manuellement en fin de mois.
              Questions : <span className="text-[#605f5f] font-medium">hello@duupflow.com</span>
            </p>
          </>
        )}

        {/* ── PAYOUT TAB ── */}
        {tab === "payout" && (
          <>
            <PaymentInfoForm initial={affiliate.payment_info} />

            {/* Payout history */}
            <div className="rounded-2xl overflow-hidden bg-white ring-1 ring-black/5 shadow-[0_10px_30px_rgba(10,30,90,0.05)]">
              <div className="px-6 py-4 border-b border-black/5">
                <p className="text-[11px] font-semibold text-[#605f5f] uppercase tracking-wider">Virements reçus</p>
              </div>
              <div>
                {payouts.length === 0 ? (
                  <p className="text-xs text-[#9aa2b2] text-center py-10">Aucun virement reçu pour l&apos;instant.</p>
                ) : (
                  <>
                    {payouts.map((p, i) => {
                      const date = new Date(p.paid_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
                      return (
                        <div key={p.id} className="flex items-center justify-between px-6 py-4" style={{ borderBottom: i < payouts.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}>
                          <div>
                            <p className="text-sm text-[#1a1a1a]">{date}</p>
                            {p.note && <p className="text-xs text-[#9aa2b2] mt-0.5">{p.note}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.14)" }}>
                              <svg className="h-3 w-3 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className="text-base font-bold tabular-nums text-[#059669]">
                              {(p.amount_cents / 100).toFixed(2)}€
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between px-6 py-3.5 border-t border-black/5 bg-black/[0.02]">
                      <p className="text-xs font-semibold text-[#605f5f]">Total reçu</p>
                      <p className="text-sm font-bold tabular-nums text-[#059669]">
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

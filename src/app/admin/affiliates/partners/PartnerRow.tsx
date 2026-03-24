"use client";

import { useState } from "react";
import EditAffiliatePanel from "../EditAffiliatePanel";
import AccountingPanel, { type PayoutRow, type PaymentInfo } from "../AccountingPanel";
import PaymentsDetailModal, { type PaymentDetail } from "../PaymentsDetailModal";
import DeleteAffiliateButton from "../DeleteAffiliateButton";

type Props = {
  affiliate: {
    id: string;
    code: string;
    name: string;
    email: string | null;
    commission_pct: number;
    discount_pct: number | null;
    stripe_promotion_code_id: string | null;
    user_id: string | null;
    payment_info: PaymentInfo;
  };
  clicks: number;
  freeSignups: number;
  convertis: number;
  totalRevenueCents: number;
  totalCommissionCents: number;
  monthCommissionCents: number;
  balanceCents: number;
  lastPayoutDate: string | null;
  payoutDetails: PayoutRow[];
  paymentDetails: PaymentDetail[];
};

export default function PartnerRow({
  affiliate,
  clicks,
  freeSignups,
  convertis,
  totalRevenueCents,
  totalCommissionCents,
  monthCommissionCents,
  balanceCents,
  lastPayoutDate,
  payoutDetails,
  paymentDetails,
}: Props) {
  const [open, setOpen] = useState(false);

  // Urgency: balance > 0 and no payout in last 35 days
  const isUrgent = balanceCents > 500 && (!lastPayoutDate || new Date(lastPayoutDate) < new Date(Date.now() - 35 * 86400000));
  const isPaid = balanceCents <= 0;

  const convRate = (freeSignups + convertis) > 0 ? Math.round((convertis / (freeSignups + convertis)) * 100) : 0;

  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      {/* ── Compact row ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.02] transition"
      >
        {/* Avatar */}
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.20)", color: "#818CF8" }}
        >
          {affiliate.code.slice(0, 2).toUpperCase()}
        </div>

        {/* Name + code */}
        <div className="min-w-0 w-36 shrink-0">
          <p className="text-sm font-semibold text-white truncate">{affiliate.name}</p>
          <p className="text-[10px] text-white/30 font-mono">{affiliate.code}</p>
        </div>

        {/* Status icons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Payout urgency */}
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={
              isUrgent
                ? { background: "rgba(239,68,68,0.12)", color: "#F87171", border: "1px solid rgba(239,68,68,0.25)" }
                : isPaid
                ? { background: "rgba(16,185,129,0.10)", color: "#34D399", border: "1px solid rgba(16,185,129,0.20)" }
                : { background: "rgba(245,158,11,0.10)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.20)" }
            }
          >
            {isUrgent ? "⚡ À payer" : isPaid ? "✓ À jour" : "En cours"}
          </span>
        </div>

        {/* Stats inline */}
        <div className="flex items-center gap-5 flex-1 min-w-0">
          <div className="text-center hidden sm:block">
            <p className="text-[10px] text-white/30">Clics</p>
            <p className="text-xs font-semibold text-white/70">{clicks}</p>
          </div>
          <div className="text-center hidden sm:block">
            <p className="text-[10px] text-white/30">Inscrits</p>
            <p className="text-xs font-semibold text-white/70">{freeSignups + convertis}</p>
          </div>
          <div className="text-center hidden md:block">
            <p className="text-[10px] text-white/30">Payants</p>
            <p className="text-xs font-semibold" style={{ color: "#10B981" }}>{convertis} ({convRate}%)</p>
          </div>
          <div className="text-center hidden md:block">
            <p className="text-[10px] text-white/30">MRR 30j</p>
            <p className="text-xs font-semibold" style={{ color: "#38BDF8" }}>{(monthCommissionCents / 100).toFixed(0)}€</p>
          </div>
          <div className="text-center hidden lg:block">
            <p className="text-[10px] text-white/30">CA total</p>
            <p className="text-xs font-semibold" style={{ color: "#818CF8" }}>{(totalRevenueCents / 100).toFixed(0)}€</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-white/30">Solde</p>
            <p className="text-xs font-bold" style={{ color: balanceCents > 0 ? "#F59E0B" : "#10B981" }}>
              {(balanceCents / 100).toFixed(2)}€
            </p>
          </div>
        </div>

        {/* Chevron */}
        <svg
          className="h-4 w-4 text-white/30 shrink-0 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Expanded detail ── */}
      {open && (
        <div className="px-5 pb-6 space-y-5" style={{ background: "rgba(6,9,24,0.40)" }}>
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.20)", color: "#818CF8" }}>
              {affiliate.commission_pct}% commission
            </span>
            {affiliate.discount_pct != null ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.20)", color: "#34D399" }}>
                Lien -{affiliate.discount_pct}% auto
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.20)", color: "#F59E0B" }}>
                Code promo · {affiliate.code}
              </span>
            )}
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={
                affiliate.stripe_promotion_code_id
                  ? { background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.20)", color: "#10B981" }
                  : { background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "rgba(248,113,113,0.60)" }
              }
            >
              {affiliate.stripe_promotion_code_id ? "Stripe ✓" : "Stripe manquant"}
            </span>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={
                affiliate.user_id
                  ? { background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.20)", color: "#10B981" }
                  : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.30)" }
              }
            >
              {affiliate.user_id ? "Compte lié" : "Sans compte"}
            </span>
            <p className="text-xs text-white/30 ml-auto">{affiliate.email ?? ""}</p>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Clics", value: clicks, sub: clicks > 0 ? `${(freeSignups + convertis) > 0 ? Math.round(((freeSignups + convertis) / clicks) * 100) : 0}% → inscrit` : undefined, color: "#F59E0B" },
              { label: "Inscrits free", value: freeSignups, color: "rgba(255,255,255,0.60)" },
              { label: "Inscrits payants", value: `${convertis} (${convRate}%)`, color: "#10B981" },
              { label: "CA réel Stripe", value: `${(totalRevenueCents / 100).toFixed(2)}€`, color: "#38BDF8", hasDetail: true },
            ].map(({ label, value, sub, color, hasDetail }) => (
              <div key={label} className="rounded-xl px-3 py-2.5 relative" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-[10px] text-white/35 mb-1">{label}</p>
                <p className="text-sm font-semibold" style={{ color }}>{value}</p>
                {sub && <p className="text-[10px] text-white/25 mt-0.5">{sub}</p>}
                {hasDetail && <PaymentsDetailModal payments={paymentDetails} commissionPct={affiliate.commission_pct} />}
              </div>
            ))}
          </div>

          {/* Commission row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)" }}>
              <p className="text-xs text-white/50">Commission ce mois</p>
              <p className="text-sm font-bold tabular-nums" style={{ color: "#F59E0B" }}>{(monthCommissionCents / 100).toFixed(2)}€</p>
            </div>
            <div className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}>
              <p className="text-xs text-white/50">Total commission (Stripe)</p>
              <p className="text-sm font-bold tabular-nums" style={{ color: "#10B981" }}>{(totalCommissionCents / 100).toFixed(2)}€</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <EditAffiliatePanel
              code={affiliate.code}
              name={affiliate.name}
              commission_pct={affiliate.commission_pct}
              discount_pct={affiliate.discount_pct}
              stripe_promotion_code_id={affiliate.stripe_promotion_code_id}
            />
            <AccountingPanel
              code={affiliate.code}
              name={affiliate.name}
              monthCommissionCents={monthCommissionCents}
              totalEarnedCents={totalCommissionCents}
              payouts={payoutDetails}
              paymentInfo={affiliate.payment_info}
            />
            <DeleteAffiliateButton code={affiliate.code} name={affiliate.name} />
          </div>
        </div>
      )}
    </div>
  );
}

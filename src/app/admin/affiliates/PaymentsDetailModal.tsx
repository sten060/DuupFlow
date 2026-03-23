"use client";

import { useState } from "react";

export type PaymentDetail = {
  paid_at: string;
  amount_cents: number;
  commission_cents: number;
  plan: string;
  billing_reason: string;
  client_name: string;
};

type Props = {
  payments: PaymentDetail[];
  commissionPct: number;
};

export default function PaymentsDetailModal({ payments, commissionPct }: Props) {
  const [open, setOpen] = useState(false);

  const totalAmount = payments.reduce((s, p) => s + p.amount_cents, 0);
  const totalCommission = payments.reduce((s, p) => s + p.commission_cents, 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute top-2 right-2 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md transition hover:opacity-80"
        style={{
          background: "rgba(56,189,248,0.12)",
          border: "1px solid rgba(56,189,248,0.20)",
          color: "#7DD3FC",
        }}
        title="Voir le détail des paiements"
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
        </svg>
        Détail
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.70)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg,#080C24,#0D0B2E)",
              border: "1px solid rgba(99,102,241,0.20)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div>
                <p className="text-sm font-semibold text-white">Détail des paiements Stripe</p>
                <p className="text-[11px] text-white/35 mt-0.5">
                  {payments.length} transaction{payments.length > 1 ? "s" : ""} · Commission {commissionPct}%
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/30 hover:text-white/60 transition text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Summary row */}
            <div
              className="grid grid-cols-2 gap-4 px-6 py-4"
              style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div>
                <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">CA total encaissé</p>
                <p className="text-xl font-bold" style={{ color: "#38BDF8" }}>
                  {(totalAmount / 100).toFixed(2)}€
                </p>
              </div>
              <div>
                <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Commission totale due</p>
                <p className="text-xl font-bold" style={{ color: "#10B981" }}>
                  {(totalCommission / 100).toFixed(2)}€
                </p>
              </div>
            </div>

            {/* Payments list */}
            <div className="overflow-y-auto flex-1">
              {payments.length === 0 ? (
                <p className="text-sm text-white/30 text-center py-10">Aucun paiement enregistré.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      {["Date", "Client", "Plan", "Montant réel", "Commission", "Type"].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-3 text-left font-semibold text-white/30 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p, i) => {
                      const planColor = p.plan === "pro" ? "#38BDF8" : "#A78BFA";
                      const date = new Date(p.paid_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      });
                      return (
                        <tr
                          key={i}
                          style={{
                            borderBottom: i < payments.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                            background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                          }}
                        >
                          <td className="px-5 py-3 text-white/50 tabular-nums">{date}</td>
                          <td className="px-5 py-3 text-white/70 truncate max-w-[120px]">{p.client_name}</td>
                          <td className="px-5 py-3">
                            <span
                              className="font-semibold px-2 py-0.5 rounded-full text-[10px]"
                              style={{
                                background: `${planColor}15`,
                                border: `1px solid ${planColor}25`,
                                color: planColor,
                              }}
                            >
                              {p.plan === "pro" ? "Pro" : "Solo"}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-semibold tabular-nums" style={{ color: "#38BDF8" }}>
                            {(p.amount_cents / 100).toFixed(2)}€
                          </td>
                          <td className="px-5 py-3 font-semibold tabular-nums" style={{ color: "#10B981" }}>
                            +{(p.commission_cents / 100).toFixed(2)}€
                          </td>
                          <td className="px-5 py-3 text-white/25">
                            {p.billing_reason === "subscription_cycle" ? "Renouvellement" : "1er paiement"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

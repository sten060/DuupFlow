"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type PayoutRow = {
  id: string;
  amount_cents: number;
  note: string | null;
  paid_at: string;
};

type Props = {
  code: string;
  name: string;
  monthCommissionCents: number;
  totalEarnedCents: number;
  payouts: PayoutRow[];
};

export default function AccountingPanel({
  code,
  name,
  monthCommissionCents,
  totalEarnedCents,
  payouts,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const totalPayedOut = payouts.reduce((s, p) => s + p.amount_cents, 0);
  const balanceDue = totalEarnedCents - totalPayedOut;

  async function handlePayout(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      setError("Montant invalide");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/admin/affiliate/payout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        affiliate_code: code,
        amount_cents: amountCents,
        note: note.trim() || null,
        paid_at: new Date(date).toISOString(),
      }),
    });

    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Erreur"); return; }

    setAmount("");
    setNote("");
    setDate(new Date().toISOString().slice(0, 10));
    setShowForm(false);
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition"
        style={{
          background: open ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)",
          border: open ? "1px solid rgba(16,185,129,0.30)" : "1px solid rgba(255,255,255,0.10)",
          color: open ? "#34D399" : "rgba(255,255,255,0.40)",
        }}
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8v2m0 8v2" />
          <circle cx="12" cy="12" r="10" />
        </svg>
        Comptabilité
      </button>

      {open && (
        <div
          className="mt-3 rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(16,185,129,0.15)" }}
        >
          {/* Header */}
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ background: "rgba(16,185,129,0.05)", borderBottom: "1px solid rgba(16,185,129,0.10)" }}
          >
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Comptabilité — {name}
            </p>
            <button onClick={() => setOpen(false)} className="text-white/25 hover:text-white/50 transition text-lg leading-none">×</button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-px" style={{ background: "rgba(255,255,255,0.04)" }}>
            {[
              { label: "Commission ce mois", value: (monthCommissionCents / 100).toFixed(2) + "€", color: "#818CF8" },
              { label: "Total gagné (Stripe)", value: (totalEarnedCents / 100).toFixed(2) + "€", color: "#38BDF8" },
              {
                label: "Solde à verser",
                value: (balanceDue / 100).toFixed(2) + "€",
                color: balanceDue > 0 ? "#F59E0B" : "#10B981",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="px-5 py-4"
                style={{ background: "rgba(8,12,35,0.90)" }}
              >
                <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-lg font-bold tabular-nums" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Payouts history */}
          <div style={{ background: "rgba(8,12,35,0.85)" }}>
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">
                Versements effectués ({payouts.length})
              </p>
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition"
                style={{
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.25)",
                  color: "#34D399",
                }}
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Enregistrer un versement
              </button>
            </div>

            {/* Add payout form */}
            {showForm && (
              <form
                onSubmit={handlePayout}
                className="px-5 py-4 space-y-3"
                style={{ background: "rgba(16,185,129,0.03)", borderBottom: "1px solid rgba(16,185,129,0.10)" }}
              >
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">Montant versé (€) *</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="ex: 19.80"
                      className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:ring-1 focus:ring-emerald-500/50"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">Date du virement *</label>
                    <input
                      required
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500/50"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", colorScheme: "dark" }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">Note (optionnel)</label>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Virement mars 2026…"
                      className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:ring-1 focus:ring-emerald-500/50"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
                    />
                  </div>
                </div>
                {error && (
                  <p className="text-xs text-red-400">{error}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#059669,#10B981)" }}
                  >
                    {loading ? "Enregistrement…" : "Confirmer le versement"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-white/40"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    Annuler
                  </button>
                </div>
              </form>
            )}

            {/* Payouts list */}
            {payouts.length === 0 ? (
              <p className="text-xs text-white/25 text-center py-6">Aucun versement enregistré pour ce partenaire.</p>
            ) : (
              <div>
                {payouts.map((p, i) => {
                  const date = new Date(p.paid_at).toLocaleDateString("fr-FR", {
                    day: "numeric", month: "long", year: "numeric",
                  });
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-5 py-3"
                      style={{
                        borderBottom: i < payouts.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-6 w-6 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(16,185,129,0.12)" }}
                        >
                          <svg className="h-3 w-3 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs text-white/60">{date}</p>
                          {p.note && <p className="text-[10px] text-white/30 mt-0.5">{p.note}</p>}
                        </div>
                      </div>
                      <p className="text-sm font-bold tabular-nums" style={{ color: "#10B981" }}>
                        {(p.amount_cents / 100).toFixed(2)}€
                      </p>
                    </div>
                  );
                })}
                <div
                  className="flex items-center justify-between px-5 py-3"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
                >
                  <p className="text-xs font-semibold text-white/40">Total versé</p>
                  <p className="text-sm font-bold tabular-nums" style={{ color: "#10B981" }}>
                    {(totalPayedOut / 100).toFixed(2)}€
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

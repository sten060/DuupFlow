"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AddPayoutForm({ affiliateCode }: { affiliateCode: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
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
        affiliate_code: affiliateCode,
        amount_cents: amountCents,
        note: note.trim() || null,
        paid_at: new Date(date + "T12:00:00").toISOString(),
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erreur");
      return;
    }

    setAmount("");
    setNote("");
    setDate(new Date().toISOString().slice(0, 10));
    setOpen(false);
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition"
        style={{ background: "linear-gradient(135deg,#059669,#10B981)" }}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Enregistrer un versement
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-2xl p-5 space-y-4"
          style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.20)" }}
        >
          <p className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider">Nouveau versement</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-white/40 block mb-1.5">Montant versé (€) *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="ex: 45.60"
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-emerald-500/50 font-mono"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 block mb-1.5">Date du virement *</label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500/50"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", colorScheme: "dark" }}
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 block mb-1.5">Référence / Note</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Virement SEPA mars…"
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-emerald-500/50"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#059669,#10B981)" }}
            >
              {loading ? "Enregistrement…" : "Confirmer le versement"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-white/40"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

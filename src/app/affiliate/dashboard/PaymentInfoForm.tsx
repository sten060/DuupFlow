"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PaymentInfo = {
  iban?: string;
  bic?: string;
  account_name?: string;
  paypal?: string;
} | null;

export default function PaymentInfoForm({ initial }: { initial: PaymentInfo }) {
  const [iban, setIban] = useState(initial?.iban ?? "");
  const [bic, setBic] = useState(initial?.bic ?? "");
  const [account_name, setAccountName] = useState(initial?.account_name ?? "");
  const [paypal, setPaypal] = useState(initial?.paypal ?? "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSaved(false);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const res = await fetch("/api/affiliate/payment-info", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ iban, bic, account_name, paypal }),
    });

    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Erreur"); return; }
    setSaved(true);
  }

  const hasInfo = initial?.iban || initial?.paypal;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ background: "rgba(10,14,40,0.70)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div>
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
            Coordonnées de virement
          </p>
          {hasInfo && (
            <p className="text-[10px] text-emerald-400/70 mt-0.5">✓ Coordonnées enregistrées</p>
          )}
        </div>
        {!hasInfo && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(245,158,11,0.10)", color: "#F59E0B" }}
          >
            À renseigner
          </span>
        )}
      </div>

      <form
        onSubmit={handleSave}
        className="px-6 py-5 space-y-4"
        style={{ background: "rgba(10,14,40,0.55)" }}
      >
        <p className="text-xs text-white/30">
          Ces informations sont utilisées pour vous virer votre commission chaque mois. Elles ne sont visibles que par nous.
        </p>

        {/* IBAN section */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Virement SEPA</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/40 block mb-1">IBAN</label>
              <input
                type="text"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="FR76 3000 6000 0112 3456 7890 189"
                className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-indigo-500/50 font-mono"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 block mb-1">BIC / SWIFT</label>
              <input
                type="text"
                value={bic}
                onChange={(e) => setBic(e.target.value)}
                placeholder="BNPAFRPPXXX"
                className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-indigo-500/50 font-mono"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Titulaire du compte</label>
            <input
              type="text"
              value={account_name}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Jean Dupont ou SARL Agence…"
              className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-indigo-500/50"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
            />
          </div>
        </div>

        {/* Separator */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          <span className="text-[10px] text-white/25">ou</span>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>

        {/* PayPal */}
        <div>
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">PayPal</p>
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Email PayPal</label>
            <input
              type="email"
              value={paypal}
              onChange={(e) => setPaypal(e.target.value)}
              placeholder="votre@email.com"
              className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-indigo-500/50"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50 transition"
          style={{ background: "linear-gradient(135deg,#4F46E5,#6366F1)" }}
        >
          {loading ? "Enregistrement…" : saved ? "Enregistré ✓" : "Sauvegarder mes coordonnées"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CTA_GRAD } from "@/components/landing/shell";

export type PaymentInfo = {
  iban?: string;
  bic?: string;
  account_name?: string;
  paypal?: string;
} | null;

const inputClass =
  "w-full rounded-xl px-3 py-2.5 text-sm text-[#1a1a1a] placeholder-[#9aa2b2] outline-none bg-black/[0.03] ring-1 ring-black/5 transition focus:ring-2 focus:ring-[#4f7bff]/40 focus:bg-white";

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
    <div className="rounded-2xl overflow-hidden bg-white ring-1 ring-black/5 shadow-[0_10px_30px_rgba(10,30,90,0.05)]">
      <div className="px-6 py-4 flex items-center justify-between border-b border-black/5">
        <div>
          <p className="text-xs font-semibold text-[#605f5f] uppercase tracking-wider">
            Coordonnées de virement
          </p>
          {hasInfo && (
            <p className="text-[11px] text-emerald-600 mt-0.5">✓ Coordonnées enregistrées</p>
          )}
        </div>
        {!hasInfo && (
          <span
            className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
            style={{ background: "rgba(245,158,11,0.12)", color: "#b45309" }}
          >
            À renseigner
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
        <p className="text-xs text-[#605f5f]">
          Ces informations sont utilisées pour vous virer votre commission chaque mois. Elles ne sont visibles que par nous.
        </p>

        {/* IBAN section */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-[#605f5f] uppercase tracking-wider">Virement SEPA</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#605f5f] block mb-1">IBAN</label>
              <input
                type="text"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="FR76 3000 6000 0112 3456 7890 189"
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="text-[11px] text-[#605f5f] block mb-1">BIC / SWIFT</label>
              <input
                type="text"
                value={bic}
                onChange={(e) => setBic(e.target.value)}
                placeholder="BNPAFRPPXXX"
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-[#605f5f] block mb-1">Titulaire du compte</label>
            <input
              type="text"
              value={account_name}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Jean Dupont ou SARL Agence…"
              className={inputClass}
            />
          </div>
        </div>

        {/* Separator */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-black/10" />
          <span className="text-[11px] text-[#9aa2b2]">ou</span>
          <div className="flex-1 h-px bg-black/10" />
        </div>

        {/* PayPal */}
        <div>
          <p className="text-[11px] font-semibold text-[#605f5f] uppercase tracking-wider mb-2">PayPal</p>
          <div>
            <label className="text-[11px] text-[#605f5f] block mb-1">Email PayPal</label>
            <input
              type="email"
              value={paypal}
              onChange={(e) => setPaypal(e.target.value)}
              placeholder="votre@email.com"
              className={inputClass}
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 rounded-full text-xs font-bold text-white disabled:opacity-50 transition hover:opacity-90"
          style={{ background: saved ? "#059669" : CTA_GRAD, boxShadow: "0 6px 16px rgba(90,90,240,0.25)" }}
        >
          {loading ? "Enregistrement…" : saved ? "Enregistré ✓" : "Sauvegarder mes coordonnées"}
        </button>
      </form>
    </div>
  );
}

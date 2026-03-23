"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AddAffiliateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [commission, setCommission] = useState("20");
  const [discount, setDiscount] = useState("20");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const res = await fetch("/api/admin/affiliate/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        email: email.trim() || undefined,
        commission_pct: Number(commission),
        discount_pct: Number(discount),
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erreur inconnue");
      return;
    }

    setSuccess(`✓ Partenaire ${data.code} créé — code promo Stripe généré`);
    setCode("");
    setName("");
    setEmail("");
    setCommission("20");
    setDiscount("20");
    router.refresh();

    setTimeout(() => {
      setSuccess("");
      setOpen(false);
    }, 3000);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition"
        style={{
          background: "rgba(99,102,241,0.15)",
          border: "1px solid rgba(99,102,241,0.35)",
          color: "#818CF8",
        }}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Ajouter un partenaire
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl p-6 space-y-4"
      style={{
        background: "rgba(10,14,40,0.80)",
        border: "1px solid rgba(99,102,241,0.25)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-white">Nouveau partenaire affilié</p>
          <p className="text-[11px] text-white/35 mt-0.5">Avec code promo visible que l'utilisateur saisit</p>
        </div>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(""); }}
          className="text-white/30 hover:text-white/60 transition text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Code promo */}
        <div>
          <label className="text-xs text-white/40 mb-1 block">Code promo *</label>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
            placeholder="ex: DAVID20"
            className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:ring-1 focus:ring-indigo-500/50 transition"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          />
          <p className="text-[10px] text-white/25 mt-1">Code unique, sans espaces</p>
        </div>

        {/* Nom */}
        <div>
          <label className="text-xs text-white/40 mb-1 block">Nom du partenaire *</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: David YouTube"
            className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:ring-1 focus:ring-indigo-500/50 transition"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          />
        </div>

        {/* Email */}
        <div>
          <label className="text-xs text-white/40 mb-1 block">Email (optionnel)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="david@example.com"
            className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:ring-1 focus:ring-indigo-500/50 transition"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          />
        </div>

        {/* Réduction offerte aux filleuls */}
        <div>
          <label className="text-xs text-white/40 mb-1 block">
            Réduction du code promo — <span className="text-yellow-400">{discount}%</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="flex-1 accent-yellow-500"
            />
            <span className="text-sm font-bold text-white w-10 text-right">{discount}%</span>
          </div>
          <div className="flex justify-between text-[10px] text-white/20 mt-0.5">
            <span>5%</span><span>50%</span>
          </div>
        </div>

        {/* Commission partenaire */}
        <div className="sm:col-span-2">
          <label className="text-xs text-white/40 mb-1 block">
            Commission partenaire (renouvellements) — <span className="text-indigo-400">{commission}%</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="5"
              max="40"
              step="5"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              className="flex-1 accent-indigo-500"
            />
            <span className="text-sm font-bold text-white w-10 text-right">{commission}%</span>
          </div>
          <div className="flex justify-between text-[10px] text-white/20 mt-0.5">
            <span>5%</span><span>40%</span>
          </div>
        </div>
      </div>

      {/* Résumé */}
      {code && name && (
        <div
          className="rounded-xl px-4 py-3 text-xs space-y-1"
          style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}
        >
          <p className="text-white/50">
            Code promo : <span className="text-indigo-300 font-mono font-bold">{code}</span>
            {" "}→ <span className="text-white/70">-{discount}% sur le 1er mois</span>
          </p>
          <p className="text-white/50">
            Commission : <span className="text-white/70">{commission}% sur chaque renouvellement mensuel</span>
          </p>
          <p className="text-white/50">
            Lien direct : <span className="text-indigo-300/70 font-mono">duupflow.com/checkout?ref={code}</span>
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-500/[0.08] border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-lg px-3 py-2">
          {success}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#4F46E5,#6366F1)" }}
        >
          {loading ? "Création en cours…" : "Créer le partenaire"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(""); }}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "rgba(255,255,255,0.40)",
          }}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

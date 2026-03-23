"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  code: string;
  name: string;
  commission_pct: number;
  discount_pct: number | null;
  stripe_promotion_code_id: string | null;
};

export default function EditAffiliatePanel({
  code,
  name,
  commission_pct,
  discount_pct,
  stripe_promotion_code_id,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Paramètres
  const [commission, setCommission] = useState(String(commission_pct));
  const [hasDiscount, setHasDiscount] = useState(discount_pct != null);
  const [discount, setDiscount] = useState(String(discount_pct ?? 20));
  const [savingParams, setSavingParams] = useState(false);
  const [paramsError, setParamsError] = useState("");
  const [paramsSuccess, setParamsSuccess] = useState("");

  // Ajout code promo
  const [promoCode, setPromoCode] = useState(code);
  const [promoDiscount, setPromoDiscount] = useState("20");
  const [savingPromo, setSavingPromo] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promoSuccess, setPromoSuccess] = useState("");

  async function getToken() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function saveParams(e: React.FormEvent) {
    e.preventDefault();
    setSavingParams(true);
    setParamsError("");
    setParamsSuccess("");

    const token = await getToken();
    const res = await fetch("/api/admin/affiliate/update", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        code,
        commission_pct: Number(commission),
        discount_pct: hasDiscount ? Number(discount) : null,
      }),
    });

    const data = await res.json();
    setSavingParams(false);

    if (!res.ok) {
      setParamsError(data.error ?? "Erreur inconnue");
      return;
    }

    setParamsSuccess("Paramètres mis à jour ✓");
    router.refresh();
    setTimeout(() => setParamsSuccess(""), 3000);
  }

  async function addPromoCode(e: React.FormEvent) {
    e.preventDefault();
    setSavingPromo(true);
    setPromoError("");
    setPromoSuccess("");

    const token = await getToken();
    const res = await fetch("/api/admin/affiliate/add-promo-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        affiliate_code: code,
        promo_code: promoCode.trim().toUpperCase(),
        discount_pct: Number(promoDiscount),
      }),
    });

    const data = await res.json();
    setSavingPromo(false);

    if (!res.ok) {
      setPromoError(data.error ?? "Erreur inconnue");
      return;
    }

    setPromoSuccess(`Code promo ${data.promo_code} créé sur Stripe ✓`);
    router.refresh();
    setTimeout(() => {
      setPromoSuccess("");
      setOpen(false);
    }, 3000);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition"
        style={{
          background: open ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
          border: open ? "1px solid rgba(99,102,241,0.35)" : "1px solid rgba(255,255,255,0.10)",
          color: open ? "#818CF8" : "rgba(255,255,255,0.40)",
        }}
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
          <path d="M17.586 3.586a2 2 0 112.828 2.828L12 15l-4 1 1-4 9.586-9.414z" />
        </svg>
        Modifier
      </button>

      {open && (
        <div
          className="mt-3 rounded-2xl p-5 space-y-5"
          style={{
            background: "rgba(8,12,35,0.90)",
            border: "1px solid rgba(99,102,241,0.20)",
          }}
        >
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Modifier — {name}
          </p>

          {/* ── Paramètres ── */}
          <form onSubmit={saveParams} className="space-y-4">
            <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Paramètres</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Commission */}
              <div>
                <label className="text-xs text-white/40 mb-1 block">
                  Commission partenaire — <span className="text-indigo-400">{commission}%</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min="5" max="40" step="5"
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

              {/* Réduction lien */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-white/40">
                    Réduction lien auto{hasDiscount ? ` — ` : ""}
                    {hasDiscount && <span className="text-emerald-400">{discount}%</span>}
                  </label>
                  <button
                    type="button"
                    onClick={() => setHasDiscount((v) => !v)}
                    className="text-[10px] px-2 py-0.5 rounded-md transition"
                    style={{
                      background: hasDiscount ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.10)",
                      border: hasDiscount ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(239,68,68,0.25)",
                      color: hasDiscount ? "#34D399" : "#F87171",
                    }}
                  >
                    {hasDiscount ? "Activée" : "Désactivée"}
                  </button>
                </div>
                {hasDiscount ? (
                  <>
                    <div className="flex items-center gap-3">
                      <input
                        type="range" min="5" max="50" step="5"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        className="flex-1 accent-emerald-500"
                      />
                      <span className="text-sm font-bold text-white w-10 text-right">{discount}%</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-white/20 mt-0.5">
                      <span>5%</span><span>50%</span>
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-red-400/60 italic mt-1">Aucune réduction auto via le lien</p>
                )}
              </div>
            </div>

            {paramsError && (
              <p className="text-xs text-red-400 bg-red-500/[0.08] border border-red-500/20 rounded-lg px-3 py-2">
                {paramsError}
              </p>
            )}
            {paramsSuccess && (
              <p className="text-xs text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-lg px-3 py-2">
                {paramsSuccess}
              </p>
            )}

            <button
              type="submit"
              disabled={savingParams}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#4F46E5,#6366F1)" }}
            >
              {savingParams ? "Enregistrement…" : "Enregistrer les paramètres"}
            </button>
          </form>

          {/* ── Ajouter un code promo ── */}
          {!stripe_promotion_code_id && (
            <form
              onSubmit={addPromoCode}
              className="space-y-3 pt-4"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
            >
              <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">
                Ajouter un code promo pour sa communauté
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Code promo visible *</label>
                  <input
                    required
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                    className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:ring-1 focus:ring-indigo-500/50 transition"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.10)",
                    }}
                  />
                  <p className="text-[10px] text-white/25 mt-1">Code que les filleuls saisiront</p>
                </div>

                <div>
                  <label className="text-xs text-white/40 mb-1 block">
                    Réduction du code — <span className="text-yellow-400">{promoDiscount}%</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min="5" max="50" step="5"
                      value={promoDiscount}
                      onChange={(e) => setPromoDiscount(e.target.value)}
                      className="flex-1 accent-yellow-500"
                    />
                    <span className="text-sm font-bold text-white w-10 text-right">{promoDiscount}%</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-white/20 mt-0.5">
                    <span>5%</span><span>50%</span>
                  </div>
                </div>
              </div>

              <div
                className="rounded-xl px-4 py-3 text-xs space-y-1"
                style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)" }}
              >
                <p className="text-white/50">
                  Code : <span className="text-yellow-300 font-mono font-bold">{promoCode || "…"}</span>
                  {" "}→ <span className="text-white/70">-{promoDiscount}% sur le 1er mois</span>
                </p>
                <p className="text-white/35 text-[10px]">Un coupon + code promo Stripe seront créés automatiquement</p>
              </div>

              {promoError && (
                <p className="text-xs text-red-400 bg-red-500/[0.08] border border-red-500/20 rounded-lg px-3 py-2">
                  {promoError}
                </p>
              )}
              {promoSuccess && (
                <p className="text-xs text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-lg px-3 py-2">
                  {promoSuccess}
                </p>
              )}

              <button
                type="submit"
                disabled={savingPromo}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#B45309,#D97706)" }}
              >
                {savingPromo ? "Création Stripe…" : "Créer le code promo"}
              </button>
            </form>
          )}

          {stripe_promotion_code_id && (
            <div
              className="pt-4 text-xs text-white/30"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
            >
              <p>Code promo Stripe actif — <code className="text-indigo-400/60">{stripe_promotion_code_id}</code></p>
              <p className="mt-0.5 text-white/20">Pour modifier le code promo, supprimez ce partenaire et recréez-le.</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-white/25 hover:text-white/50 transition"
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";

/**
 * Reusable Solo / Pro upgrade modal for Free users.
 *
 * Renders 2 plan cards (Solo €39, Pro €99). On click, POSTs to
 * /api/stripe/checkout and redirects to Stripe Checkout. The webhook
 * handler flips `has_paid + plan` and credits welcome tokens automatically
 * once payment confirms — no further client work needed.
 *
 * Used from:
 *   • /dashboard/abonnement     (Free user clicks "Passer en Solo ou Pro")
 *   • /dashboard/ai-detection   (Free user lands on locked module)
 */
export default function UpgradePlanModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState<"solo" | "pro" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function startCheckout(targetPlan: "solo" | "pro") {
    setLoading(targetPlan);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Erreur réseau. Réessaie.");
        setLoading(null);
      }
    } catch {
      setError("Erreur réseau. Réessaie.");
      setLoading(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={() => loading === null && onClose()}
    >
      <div
        className="w-full max-w-2xl rounded-2xl p-6 space-y-5"
        style={{ background: "#0b0e1a", border: "1px solid rgba(255,255,255,0.10)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Choisis ton plan</h2>
            <p className="text-sm text-white/50 mt-1">
              Paiement immédiat via Stripe. Tes limites s&apos;appliquent dès la confirmation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loading === null && onClose()}
            disabled={loading !== null}
            className="text-white/40 hover:text-white/80 transition disabled:opacity-30 shrink-0"
            aria-label="Fermer"
          >
            <svg viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Solo card */}
          <div
            className="relative rounded-2xl overflow-hidden flex flex-col p-5"
            style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.20)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/45 mb-1">Plan Solo</p>
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-3xl font-bold text-white">39 €</span>
              <span className="text-white/40 text-xs">/ mois</span>
            </div>
            <ul className="space-y-1.5 text-xs text-white/65 mb-5 flex-1">
              <li>• 400 duplications images / mois</li>
              <li>• 300 duplications vidéos / mois</li>
              <li>• 200 signatures IA / mois</li>
              <li>• Variation IA : 2,25 tokens / image</li>
              <li>• 3 images offertes au démarrage</li>
              <li>• Support email + Telegram</li>
            </ul>
            <button
              type="button"
              onClick={() => startCheckout("solo")}
              disabled={loading !== null}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#7C3AED,#6366F1)" }}
            >
              {loading === "solo" ? "Redirection vers Stripe…" : "Choisir Solo"}
            </button>
          </div>

          {/* Pro card */}
          <div
            className="relative rounded-2xl overflow-hidden flex flex-col p-5"
            style={{ background: "rgba(99,102,241,0.06)", border: "1.5px solid rgba(99,102,241,0.40)" }}
          >
            <span className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 uppercase tracking-wide">
              Populaire
            </span>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/45 mb-1">Plan Pro</p>
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-3xl font-bold text-white">99 €</span>
              <span className="text-white/40 text-xs">/ mois</span>
            </div>
            <ul className="space-y-1.5 text-xs text-white/65 mb-5 flex-1">
              <li>• Duplications images illimitées</li>
              <li>• Duplications vidéos illimitées</li>
              <li>• Signatures IA illimitées</li>
              <li>• Variation IA : 1,75 tokens / image</li>
              <li>• 3 images offertes au démarrage</li>
              <li>• 3 membres dans ton workspace</li>
              <li>• Support prioritaire 7j/7</li>
            </ul>
            <button
              type="button"
              onClick={() => startCheckout("pro")}
              disabled={loading !== null}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
            >
              {loading === "pro" ? "Redirection vers Stripe…" : "Choisir Pro"}
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-white/30">
          Paiement sécurisé via Stripe. Tu peux résilier à tout moment.
        </p>
      </div>
    </div>
  );
}

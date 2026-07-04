"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/lib/i18n/context";

/**
 * Reusable Solo / Pro plan picker.
 *
 * Renders 2 plan cards (Solo €39, Pro €99). For a Free user, clicking POSTs to
 * /api/stripe/checkout and redirects to Stripe Checkout. For a Solo user the
 * Pro card routes through /api/stripe/upgrade (prorated, same subscription) so
 * we never create a duplicate subscription. The current plan shows "Plan actuel".
 *
 * Rendered through a portal on document.body so the backdrop covers the whole
 * viewport. Used from /dashboard/abonnement, /dashboard/ai-detection, and the
 * image/video limit-reached modals.
 */
export default function UpgradePlanModal({
  open,
  onClose,
  currentPlan = "free",
}: {
  open: boolean;
  onClose: () => void;
  /** The user's current plan — drives "Plan actuel" + safe routing for paid users. */
  currentPlan?: "free" | "solo" | "pro";
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<"solo" | "pro" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Promo-code step: clicking a plan opens this sub-view (like the checkout page)
  // where the user can enter a partner/promo code before paying.
  const [promoFor, setPromoFor] = useState<"solo" | "pro" | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoState, setPromoState] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [promoMessage, setPromoMessage] = useState("");

  if (!open || !mounted) return null;

  function openPromo(plan: "solo" | "pro") {
    setPromoFor(plan);
    setPromoInput("");
    setPromoState("idle");
    setPromoMessage("");
    setError(null);
  }

  async function validatePromoCode(code: string) {
    const c = code.trim().toUpperCase();
    if (!c) { setPromoState("idle"); setPromoMessage(""); return; }
    setPromoState("validating");
    try {
      const res = await fetch(`/api/promo/validate?code=${encodeURIComponent(c)}`);
      const data = await res.json();
      if (data.valid) {
        setPromoState("valid");
        setPromoMessage(data.message ?? t("dashboard.plans.promoValid"));
      } else {
        setPromoState("invalid");
        setPromoMessage(t("dashboard.plans.promoInvalid"));
      }
    } catch {
      setPromoState("idle");
    }
  }

  // Solo → Pro must use the dedicated upgrade endpoint (prorated, keeps the
  // same subscription). Going through checkout would create a 2nd subscription.
  async function upgradeExisting() {
    setLoading("pro");
    setError(null);
    try {
      const res = await fetch("/api/stripe/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        window.location.reload();
      } else {
        setError(data.error ?? t("dashboard.plans.errorGeneric"));
        setLoading(null);
      }
    } catch {
      setError(t("dashboard.plans.errorNetwork"));
      setLoading(null);
    }
  }

  async function startCheckout(targetPlan: "solo" | "pro", promoCode?: string) {
    setLoading(targetPlan);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan, ...(promoCode ? { promo_code: promoCode } : {}) }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? t("dashboard.plans.errorNetwork"));
        setLoading(null);
      }
    } catch {
      setError(t("dashboard.plans.errorNetwork"));
      setLoading(null);
    }
  }

  const soloFeatures = [
    t("dashboard.plans.soloFeat1"),
    t("dashboard.plans.soloFeat2"),
    t("dashboard.plans.soloFeat3"),
    t("dashboard.plans.soloFeat4"),
    t("dashboard.plans.soloFeat5"),
    t("dashboard.plans.soloFeat6"),
  ];
  const proFeatures = [
    t("dashboard.plans.proFeat1"),
    t("dashboard.plans.proFeat2"),
    t("dashboard.plans.proFeat3"),
    t("dashboard.plans.proFeat4"),
    t("dashboard.plans.proFeat5"),
    t("dashboard.plans.proFeat6"),
    t("dashboard.plans.proFeat7"),
    t("dashboard.plans.proFeat8"),
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={() => loading === null && onClose()}
    >
      <div
        className="w-full max-w-3xl rounded-2xl p-7 space-y-6"
        style={{ background: "#0b0e1a", border: "1px solid rgba(255,255,255,0.10)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{t("dashboard.plans.title")}</h2>
            <p className="text-sm text-white/50 mt-1">
              {t("dashboard.plans.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => loading === null && onClose()}
            disabled={loading !== null}
            className="text-white/40 hover:text-white/80 transition disabled:opacity-30 shrink-0"
            aria-label={t("dashboard.plans.closeAria")}
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

        {promoFor === null ? (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Solo card */}
          <div
            className="relative rounded-2xl overflow-hidden flex flex-col p-6"
            style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.20)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/45 mb-1">{t("dashboard.plans.soloName")}</p>
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-3xl font-bold text-white">39 €</span>
              <span className="text-white/40 text-xs">{t("dashboard.plans.perMonth")}</span>
            </div>
            <ul className="space-y-2.5 text-sm text-white/70 mb-6 flex-1 leading-relaxed">
              {soloFeatures.map((f, i) => (
                <li key={i}>• {f}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => openPromo("solo")}
              disabled={loading !== null || currentPlan === "solo"}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#7C3AED,#6366F1)" }}
            >
              {currentPlan === "solo"
                ? t("dashboard.plans.currentPlan")
                : loading === "solo"
                ? t("dashboard.plans.redirecting")
                : t("dashboard.plans.chooseSolo")}
            </button>
          </div>

          {/* Pro card */}
          <div
            className="relative rounded-2xl overflow-hidden flex flex-col p-6"
            style={{ background: "rgba(99,102,241,0.06)", border: "1.5px solid rgba(99,102,241,0.40)" }}
          >
            <span className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 uppercase tracking-wide">
              {t("dashboard.plans.popular")}
            </span>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/45 mb-1">{t("dashboard.plans.proName")}</p>
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-3xl font-bold text-white">99 €</span>
              <span className="text-white/40 text-xs">{t("dashboard.plans.perMonth")}</span>
            </div>
            <ul className="space-y-2.5 text-sm text-white/70 mb-6 flex-1 leading-relaxed">
              {proFeatures.map((f, i) => (
                <li key={i}>• {f}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => (currentPlan === "solo" ? upgradeExisting() : openPromo("pro"))}
              disabled={loading !== null || currentPlan === "pro"}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
            >
              {currentPlan === "pro"
                ? t("dashboard.plans.currentPlan")
                : loading === "pro"
                ? (currentPlan === "solo" ? t("dashboard.plans.upgrading") : t("dashboard.plans.redirecting"))
                : t("dashboard.plans.choosePro")}
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-white/30">
          {t("dashboard.plans.secure")}
        </p>
        </>
        ) : (
        <div className="space-y-4">
          {/* Selected plan summary */}
          <div
            className="rounded-xl px-4 py-3 flex items-center justify-between"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                {promoFor === "solo" ? t("dashboard.plans.soloName") : t("dashboard.plans.proName")}
              </p>
              <p className="text-sm text-white/70 mt-0.5">{t("dashboard.plans.promoTitle")}</p>
            </div>
            <div className="flex items-baseline gap-1 shrink-0">
              <span className="text-2xl font-bold text-white">{promoFor === "solo" ? "39 €" : "99 €"}</span>
              <span className="text-white/40 text-xs">{t("dashboard.plans.perMonth")}</span>
            </div>
          </div>

          <p className="text-xs text-white/50">{t("dashboard.plans.promoSubtitle")}</p>

          {/* Promo code input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={promoInput}
              onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoState("idle"); setPromoMessage(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); validatePromoCode(promoInput); } }}
              placeholder={t("dashboard.plans.promoPlaceholder")}
              className="flex-1 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: promoState === "valid"
                  ? "1px solid rgba(52,211,153,0.5)"
                  : promoState === "invalid"
                  ? "1px solid rgba(239,68,68,0.4)"
                  : "1px solid rgba(255,255,255,0.10)",
              }}
            />
            <button
              type="button"
              onClick={() => validatePromoCode(promoInput)}
              disabled={promoState === "validating" || !promoInput.trim()}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-40"
              style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#818CF8" }}
            >
              {promoState === "validating" ? "..." : t("dashboard.plans.promoApply")}
            </button>
          </div>
          {promoMessage && (
            <p className={`text-xs ${promoState === "valid" ? "text-emerald-400" : "text-red-400"}`}>
              {promoState === "valid" && "✓ "}{promoMessage}
            </p>
          )}

          {/* Continue to Stripe */}
          <button
            type="button"
            onClick={() => startCheckout(promoFor, promoInput.trim() ? promoInput.trim().toUpperCase() : undefined)}
            disabled={loading !== null}
            className="w-full rounded-xl py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: promoFor === "solo" ? "linear-gradient(135deg,#7C3AED,#6366F1)" : "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            {loading !== null ? t("dashboard.plans.redirecting") : t("dashboard.plans.promoContinue")}
          </button>

          <button
            type="button"
            onClick={() => setPromoFor(null)}
            disabled={loading !== null}
            className="w-full text-center text-xs text-white/40 hover:text-white/70 transition disabled:opacity-40"
          >
            ← {t("dashboard.plans.promoBack")}
          </button>

          <p className="text-center text-[11px] text-white/30">{t("dashboard.plans.secure")}</p>
        </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

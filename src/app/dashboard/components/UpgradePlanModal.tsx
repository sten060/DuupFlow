"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/lib/i18n/context";
import { planRank } from "@/lib/plans";

type PaidPlan = "starter" | "solo" | "pro";

/**
 * Reusable Starter / Solo / Pro plan picker.
 *
 * Renders 3 plan cards (Starter €19, Solo €39, Pro €99). For a Free user,
 * clicking POSTs to /api/stripe/checkout (with an optional promo code) and
 * redirects to Stripe Checkout. For a paying user, moving to a higher tier
 * routes through /api/stripe/upgrade (prorated, same subscription) and moving
 * to a lower tier through /api/stripe/downgrade (applied next cycle) — so we
 * never create a duplicate subscription. The current plan shows "Plan actuel".
 *
 * Rendered through a portal on document.body. Used from /dashboard/abonnement,
 * /dashboard/ai-detection, and the image/video limit-reached modals.
 */
export default function UpgradePlanModal({
  open,
  onClose,
  currentPlan = "free",
}: {
  open: boolean;
  onClose: () => void;
  /** The user's current plan — drives "Plan actuel" + safe routing for paid users. */
  currentPlan?: "free" | "starter" | "solo" | "pro";
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<PaidPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Promo-code step (Free users only): clicking a plan opens this sub-view where
  // the user can enter a partner/promo code before paying.
  const [promoFor, setPromoFor] = useState<PaidPlan | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoState, setPromoState] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [promoMessage, setPromoMessage] = useState("");

  if (!open || !mounted) return null;

  const isFree = currentPlan === "free";

  const PLANS: {
    id: PaidPlan;
    name: string;
    price: string;
    features: string[];
    cardBg: string;
    cardBorder: string;
    btnBg: string;
    popular?: boolean;
  }[] = [
    {
      id: "starter",
      name: t("dashboard.plans.starterName"),
      price: "19 €",
      features: [
        t("dashboard.plans.starterFeat1"),
        t("dashboard.plans.starterFeat2"),
        t("dashboard.plans.starterFeat3"),
        t("dashboard.plans.starterFeat4"),
        t("dashboard.plans.starterFeat5"),
      ],
      cardBg: "rgba(159,122,234,0.04)",
      cardBorder: "1px solid rgba(159,122,234,0.20)",
      btnBg: "linear-gradient(135deg,#9F7AEA,#7C3AED)",
    },
    {
      id: "solo",
      name: t("dashboard.plans.soloName"),
      price: "39 €",
      features: [
        t("dashboard.plans.soloFeat1"),
        t("dashboard.plans.soloFeat2"),
        t("dashboard.plans.soloFeat3"),
        t("dashboard.plans.soloFeat4"),
        t("dashboard.plans.soloFeat6"),
      ],
      cardBg: "rgba(167,139,250,0.04)",
      cardBorder: "1.5px solid rgba(167,139,250,0.45)",
      btnBg: "linear-gradient(135deg,#7C3AED,#6366F1)",
      popular: true,
    },
    {
      id: "pro",
      name: t("dashboard.plans.proName"),
      price: "99 €",
      features: [
        t("dashboard.plans.proFeat1"),
        t("dashboard.plans.proFeat2"),
        t("dashboard.plans.proFeat3"),
        t("dashboard.plans.proFeat4"),
        t("dashboard.plans.proFeat6"),
        t("dashboard.plans.proFeat7"),
        t("dashboard.plans.proFeat8"),
      ],
      cardBg: "rgba(99,102,241,0.06)",
      cardBorder: "1px solid rgba(99,102,241,0.22)",
      btnBg: "linear-gradient(135deg,#6366F1,#38BDF8)",
    },
  ];

  function openPromo(plan: PaidPlan) {
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

  // Paid user changing tier — prorated upgrade or next-cycle downgrade, keeping
  // the same subscription (going through checkout would create a 2nd one).
  async function changePlan(target: PaidPlan) {
    const isUpgrade = planRank(target) > planRank(currentPlan);
    setLoading(target);
    setError(null);
    try {
      const res = await fetch(isUpgrade ? "/api/stripe/upgrade" : "/api/stripe/downgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: target }),
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

  async function startCheckout(targetPlan: PaidPlan, promoCode?: string) {
    setLoading(targetPlan);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // noTrial: this is an in-app upgrade by an existing (free) user — the
        // 3-day trial is a new-signup acquisition offer only.
        body: JSON.stringify({ plan: targetPlan, noTrial: true, ...(promoCode ? { promo_code: promoCode } : {}) }),
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

  function chooseLabel(id: PaidPlan): string {
    if (id === currentPlan) return t("dashboard.plans.currentPlan");
    if (loading === id) {
      return planRank(id) > planRank(currentPlan) && !isFree
        ? t("dashboard.plans.upgrading")
        : t("dashboard.plans.redirecting");
    }
    if (!isFree && planRank(id) < planRank(currentPlan)) return t("dashboard.plans.downgradeTo");
    return id === "starter"
      ? t("dashboard.plans.chooseStarter")
      : id === "solo"
      ? t("dashboard.plans.chooseSolo")
      : t("dashboard.plans.choosePro");
  }

  function onCardClick(id: PaidPlan) {
    if (id === currentPlan) return;
    if (isFree) openPromo(id);
    else changePlan(id);
  }

  const promoMeta = promoFor ? PLANS.find((p) => p.id === promoFor)! : null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={() => loading === null && onClose()}
    >
      <div
        className="w-full max-w-4xl rounded-2xl p-7 space-y-6"
        style={{ background: "var(--app-bg)", border: "1px solid var(--app-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--app-text)]">{t("dashboard.plans.title")}</h2>
            <p className="text-sm text-[var(--app-text-muted)] mt-1">
              {t("dashboard.plans.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => loading === null && onClose()}
            disabled={loading !== null}
            className="text-[var(--app-text-faint)] hover:text-[var(--app-text-muted)] transition disabled:opacity-30 shrink-0"
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className="relative rounded-2xl overflow-hidden flex flex-col p-6"
              style={{ background: p.cardBg, border: p.cardBorder }}
            >
              {p.popular && (
                <span className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 uppercase tracking-wide">
                  {t("dashboard.plans.popular")}
                </span>
              )}
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-faint)] mb-1">{p.name}</p>
              <div className="flex items-baseline gap-1.5 mb-3">
                <span className="text-3xl font-bold text-[var(--app-text)]">{p.price}</span>
                <span className="text-[var(--app-text-faint)] text-xs">{t("dashboard.plans.perMonth")}</span>
              </div>
              <ul className="space-y-2.5 text-sm text-[var(--app-text-muted)] mb-6 flex-1 leading-relaxed">
                {p.features.map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => onCardClick(p.id)}
                disabled={loading !== null || p.id === currentPlan}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: p.btnBg }}
              >
                {chooseLabel(p.id)}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-[11px] text-[var(--app-text-faint)]">
          {t("dashboard.plans.secure")}
        </p>
        </>
        ) : (
        <div className="space-y-4">
          {/* Selected plan summary */}
          <div
            className="rounded-xl px-4 py-3 flex items-center justify-between"
            style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-faint)]">
                {promoMeta?.name}
              </p>
              <p className="text-sm text-[var(--app-text-muted)] mt-0.5">{t("dashboard.plans.promoTitle")}</p>
            </div>
            <div className="flex items-baseline gap-1 shrink-0">
              <span className="text-2xl font-bold text-[var(--app-text)]">{promoMeta?.price}</span>
              <span className="text-[var(--app-text-faint)] text-xs">{t("dashboard.plans.perMonth")}</span>
            </div>
          </div>

          <p className="text-xs text-[var(--app-text-muted)]">{t("dashboard.plans.promoSubtitle")}</p>

          {/* Promo code input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={promoInput}
              onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoState("idle"); setPromoMessage(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); validatePromoCode(promoInput); } }}
              placeholder={t("dashboard.plans.promoPlaceholder")}
              className="flex-1 rounded-lg px-3 py-2 text-sm text-[var(--app-text)] placeholder-[var(--app-text-faint)] outline-none transition"
              style={{
                background: "var(--app-surface)",
                border: promoState === "valid"
                  ? "1px solid rgba(52,211,153,0.5)"
                  : promoState === "invalid"
                  ? "1px solid rgba(239,68,68,0.4)"
                  : "1px solid var(--app-border)",
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
            style={{ background: promoMeta?.btnBg }}
          >
            {loading !== null ? t("dashboard.plans.redirecting") : t("dashboard.plans.promoContinue")}
          </button>

          <button
            type="button"
            onClick={() => setPromoFor(null)}
            disabled={loading !== null}
            className="w-full text-center text-xs text-[var(--app-text-faint)] hover:text-[var(--app-text-muted)] transition disabled:opacity-40"
          >
            ← {t("dashboard.plans.promoBack")}
          </button>

          <p className="text-center text-[11px] text-[var(--app-text-faint)]">{t("dashboard.plans.secure")}</p>
        </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

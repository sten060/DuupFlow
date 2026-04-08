"use client";

import { useState } from "react";
import Link from "next/link";
import { PLAN_LIMITS } from "@/lib/plans";
import { useTranslation } from "@/lib/i18n/context";

function getRenewalDate(periodStart: string | null): string | null {
  if (!periodStart) return null;
  const renewal = new Date(periodStart);
  renewal.setMonth(renewal.getMonth() + 1);
  return renewal.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function getDaysUntilRenewal(periodStart: string | null): number | null {
  if (!periodStart) return null;
  const renewal = new Date(periodStart);
  renewal.setMonth(renewal.getMonth() + 1);
  return Math.max(0, Math.ceil((renewal.getTime() - Date.now()) / 86400000));
}

function UsageBar({
  label, icon, current, limit, unlimited, color, usedText,
}: {
  label: string;
  icon: React.ReactNode;
  current: number;
  limit: number;
  unlimited?: boolean;
  color: string;
  usedText?: string;
}) {
  const pct = unlimited ? 100 : Math.min(100, Math.round((current / limit) * 100));
  const isNearLimit = !unlimited && pct >= 80;
  const isAtLimit = !unlimited && pct >= 100;
  const barColor = isAtLimit ? "#EF4444" : isNearLimit ? "#F59E0B" : color;
  const barStyle = unlimited
    ? { background: `linear-gradient(90deg, ${color}, ${color}99)` }
    : { background: barColor };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${color}18`, border: `1px solid ${color}30` }}
          >
            {icon}
          </div>
          <span className="text-xs font-medium text-white/70">{label}</span>
        </div>
        <span
          className="text-xs font-semibold tabular-nums"
          style={{ color: isAtLimit ? "#EF4444" : "rgba(255,255,255,0.65)" }}
        >
          {unlimited ? (
            <span className="flex items-center gap-1">
              <span className="text-white/40 text-[10px]">{current} {usedText}</span>
              <span className="text-white/25 text-[10px] mx-0.5">·</span>
              <span style={{ color }}>∞</span>
            </span>
          ) : (
            `${current} / ${limit}`
          )}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, ...barStyle }}
        />
      </div>
    </div>
  );
}

export default function AbonnementClient({
  plan,
  usage,
  hasStripePortal,
  subscriptionPeriodStart,
  cancelAtPeriodEnd,
  cancelAt,
}: {
  plan: "solo" | "pro" | null;
  usage: { images: number; videos: number; ai_signatures: number } | null;
  hasStripePortal: boolean;
  subscriptionPeriodStart: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: number | null;
}) {
  const { t } = useTranslation();
  const [portalPaymentLoading, setPortalPaymentLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [downgradeLoading, setDowngradeLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(cancelAtPeriodEnd);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [showCancelStep1, setShowCancelStep1] = useState(false);
  const [showCancelStep2, setShowCancelStep2] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState("");

  const cancelEndDate = cancelAt
    ? new Date(cancelAt * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const renewalDate = getRenewalDate(subscriptionPeriodStart);
  const daysLeft = getDaysUntilRenewal(subscriptionPeriodStart);
  const isUnlimited = plan === "pro";
  const planColor = plan === "solo" ? "#A78BFA" : "#818CF8";
  const planBg = plan === "solo" ? "rgba(167,139,250,0.10)" : "rgba(99,102,241,0.10)";
  const planBorder = plan === "solo" ? "rgba(167,139,250,0.22)" : "rgba(99,102,241,0.22)";

  async function openPortal(flow: "payment") {
    setPortalPaymentLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setMsg({ type: "err", text: data.error ?? t("dashboard.subscription.portalError") });
      }
    } catch {
      setMsg({ type: "err", text: t("dashboard.subscription.networkError") });
    }
    setPortalPaymentLoading(false);
  }

  async function cancelSubscription() {
    setShowCancelStep2(false);
    setCancelLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/stripe/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: cancelFeedback }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsCancelling(true);
        setCancelFeedback("");
        setMsg({ type: "ok", text: t("dashboard.subscription.cancelSuccess") });
      } else {
        setMsg({ type: "err", text: data.error ?? t("dashboard.subscription.cancelError") });
      }
    } catch {
      setMsg({ type: "err", text: t("dashboard.subscription.networkError") });
    }
    setCancelLoading(false);
  }

  async function downgradeToSolo() {
    setShowDowngradeModal(false);
    setDowngradeLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/stripe/downgrade", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        window.location.reload();
      } else {
        setMsg({ type: "err", text: data.error ?? t("dashboard.subscription.downgradeError") });
      }
    } catch {
      setMsg({ type: "err", text: t("dashboard.subscription.networkError") });
    }
    setDowngradeLoading(false);
  }

  async function upgradeToProCheckout() {
    setUpgradeLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/stripe/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Reload to reflect the new Pro plan immediately
        window.location.reload();
      } else {
        setMsg({ type: "err", text: data.error ?? t("dashboard.subscription.upgradeError") });
      }
    } catch {
      setMsg({ type: "err", text: t("dashboard.subscription.networkError") });
    }
    setUpgradeLoading(false);
  }

  if (!plan) {
    return (
      <main className="p-8 max-w-2xl">
        <div className="mb-8">
          <p className="text-xs font-medium text-white/25 tracking-[0.14em] uppercase mb-1.5">Dashboard</p>
          <h1 className="text-2xl font-semibold text-white tracking-tight">{t("dashboard.subscription.title")}</h1>
        </div>
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: "rgba(10,14,40,0.55)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p className="text-white/50 mb-4">{t("dashboard.subscription.noSubscription")}</p>
          <Link
            href="/checkout"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            {t("dashboard.subscription.choosePlan")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
    <main className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium text-white/25 tracking-[0.14em] uppercase mb-1.5">Dashboard</p>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-white tracking-tight">{t("dashboard.subscription.title")}</h1>
          <span
            className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
            style={{ background: planBg, border: `1px solid ${planBorder}`, color: planColor }}
          >
            Plan {plan === "solo" ? "Solo" : "Pro"}
          </span>
        </div>
      </div>

      <div className="space-y-5">
        {/* Plan card */}
        <div
          className="rounded-2xl p-6"
          style={{ background: "rgba(10,14,40,0.55)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {/* Plan header */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: planBg, border: `1px solid ${planBorder}` }}
              >
                {plan === "solo" ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={planColor} strokeWidth="1.8">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={planColor} strokeWidth="1.8">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-base font-semibold text-white leading-tight">
                  Plan {plan === "solo" ? "Solo" : "Pro"}
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  {plan === "solo" ? "39€ / mois" : "99€ / mois"}
                </p>
              </div>
            </div>
            <span
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1.5"
              style={{ background: planBg, border: `1px solid ${planBorder}`, color: planColor }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              {t("dashboard.subscription.active")}
            </span>
          </div>

          {/* Cancellation banner */}
          {isCancelling && (
            <div
              className="flex items-start gap-3 rounded-xl px-4 py-3 mb-5"
              style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)" }}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 mt-0.5" fill="none" stroke="#F59E0B" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <div>
                <p className="text-xs font-semibold" style={{ color: "#F59E0B" }}>{t("dashboard.subscription.cancelScheduled")}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(245,158,11,0.75)" }}>
                  {cancelEndDate
                    ? t("dashboard.subscription.cancelScheduledDesc", { date: cancelEndDate })
                    : t("dashboard.subscription.cancelScheduledDescGeneric")}
                </p>
              </div>
            </div>
          )}

          {/* Renewal date */}
          {renewalDate && !isCancelling && (
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3 mb-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/30 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                <div>
                  <p className="text-xs text-white/50">{t("dashboard.subscription.nextRenewal")}</p>
                  <p className="text-xs font-semibold text-white/80 mt-0.5">{renewalDate}</p>
                </div>
              </div>
              {daysLeft !== null && (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full tabular-nums"
                  style={
                    daysLeft <= 3
                      ? { background: "rgba(245,158,11,0.10)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.20)" }
                      : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.08)" }
                  }
                >
                  J-{daysLeft}
                </span>
              )}
            </div>
          )}

          {/* Usage */}
          <div className="mb-5">
            <p className="text-xs font-semibold tracking-[0.12em] uppercase text-white/25 mb-4">
              {isUnlimited ? t("dashboard.subscription.usageUnlimited") : t("dashboard.subscription.usageThisMonth")}
            </p>
            <div className="space-y-4">
              <UsageBar
                label={t("dashboard.subscription.imagesDuplication")}
                icon={
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke={planColor} strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                }
                current={usage?.images ?? 0}
                limit={PLAN_LIMITS.solo.images}
                unlimited={isUnlimited}
                color={planColor}
                usedText={t("dashboard.subscription.used")}
              />
              <UsageBar
                label={t("dashboard.subscription.videosDuplication")}
                icon={
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="#38BDF8" strokeWidth="2">
                    <rect x="2" y="5" width="14" height="14" rx="2" />
                    <path d="M16 9l5-3v12l-5-3V9z" />
                  </svg>
                }
                current={usage?.videos ?? 0}
                limit={PLAN_LIMITS.solo.videos}
                unlimited={isUnlimited}
                color="#38BDF8"
                usedText={t("dashboard.subscription.used")}
              />
              <UsageBar
                label={t("dashboard.subscription.aiSignatures")}
                icon={
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="#10B981" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                }
                current={usage?.ai_signatures ?? 0}
                limit={PLAN_LIMITS.solo.ai_signatures}
                unlimited={isUnlimited}
                color="#10B981"
                usedText={t("dashboard.subscription.used")}
              />
            </div>
            {!isUnlimited && (
              <p className="mt-3 text-[11px] text-white/25 leading-relaxed">
                Remise à zéro le {renewalDate ?? "prochain renouvellement"}.
              </p>
            )}
          </div>

          <div className="h-px bg-white/[0.06] mb-5" />

          {/* Feedback */}
          {msg && (
            <p
              className={`text-xs px-3 py-2 rounded-lg mb-4 ${
                msg.type === "ok"
                  ? "text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20"
                  : "text-red-400 bg-red-500/[0.08] border border-red-500/20"
              }`}
            >
              {msg.text}
            </p>
          )}

          {/* Actions */}
          <div className="space-y-2.5">
            {plan === "solo" && (
              <button
                onClick={() => setShowUpgradeModal(true)}
                disabled={upgradeLoading}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
              >
                {upgradeLoading ? (
                  t("dashboard.subscription.redirecting")
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M8 2l4 4H9v6H7V6H4l4-4z" />
                    </svg>
                    {t("dashboard.subscription.upgradeToProPrice")}
                  </>
                )}
              </button>
            )}

            {plan === "pro" && !isCancelling && (
              <button
                onClick={() => setShowDowngradeModal(true)}
                disabled={downgradeLoading}
                className="w-full rounded-xl py-2.5 text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: "rgba(255,255,255,0.50)",
                }}
              >
                {downgradeLoading ? (
                  t("dashboard.subscription.changingPlan")
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M8 14l-4-4h3V4h2v6h3l-4 4z" />
                    </svg>
                    {t("dashboard.subscription.downgradeToSoloPrice")}
                  </>
                )}
              </button>
            )}

            {hasStripePortal && (
              <button
                onClick={() => openPortal("payment")}
                disabled={portalPaymentLoading}
                className="w-full rounded-xl py-2.5 text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.60)",
                }}
              >
                {portalPaymentLoading ? (
                  t("dashboard.subscription.opening")
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="1" y="4" width="14" height="9" rx="2" />
                      <path d="M1 7h14" />
                    </svg>
                    {t("dashboard.subscription.managePayment")}
                  </>
                )}
              </button>
            )}

            {hasStripePortal && !isCancelling && (
              <button
                onClick={() => setShowCancelStep1(true)}
                disabled={cancelLoading}
                className="w-full rounded-xl py-2.5 text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-red-500/[0.06] hover:border-red-500/20 hover:text-red-400/80"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "rgba(255,255,255,0.35)",
                }}
              >
                {cancelLoading ? (
                  t("dashboard.subscription.cancellingInProgress")
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="8" cy="8" r="6" />
                      <path d="M5 8h6" />
                    </svg>
                    {t("dashboard.subscription.cancelSubscription")}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Pro feature highlight for Solo */}
        {plan === "solo" && (
          <div
            className="rounded-2xl p-5"
            style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)" }}
          >
            <p className="text-xs font-semibold text-indigo-300/70 uppercase tracking-wider mb-3">Plan Pro — avantages</p>
            <ul className="space-y-2 text-sm text-white/55">
              <li className="flex items-center gap-2">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M2 8l4 4 8-8" />
                </svg>
                Duplications images, vidéos et signatures IA illimitées
              </li>
              <li className="flex items-center gap-2">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M2 8l4 4 8-8" />
                </svg>
                Jusqu&apos;à 3 membres dans ton workspace
              </li>
              <li className="flex items-center gap-2">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M2 8l4 4 8-8" />
                </svg>
                Priorité sur les nouvelles fonctionnalités
              </li>
            </ul>
          </div>
        )}
      </div>
    </main>

    {/* Upgrade confirmation modal */}
    {showUpgradeModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        onClick={() => setShowUpgradeModal(false)}
      >
        <div
          className="w-full max-w-md rounded-2xl p-6 space-y-5"
          style={{ background: "#13131a", border: "1px solid rgba(255,255,255,0.10)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">Passer au plan Pro</h2>
            <p className="text-sm text-white/50">
              Vous êtes sur le point de passer au plan Pro à 99€/mois.
            </p>
          </div>
          <ul className="space-y-2 text-sm text-white/60">
            <li className="flex items-start gap-2">
              <svg viewBox="0 0 16 16" className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M2 8l4 4 8-8" />
              </svg>
              Paiement immédiat du prorata pour les jours restants du mois
            </li>
            <li className="flex items-start gap-2">
              <svg viewBox="0 0 16 16" className="h-4 w-4 text-green-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M2 8l4 4 8-8" />
              </svg>
              Accès illimité (images, vidéos, signatures IA) activé immédiatement
            </li>
            <li className="flex items-start gap-2">
              <svg viewBox="0 0 16 16" className="h-4 w-4 text-green-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M2 8l4 4 8-8" />
              </svg>
              Jusqu&apos;à 3 membres dans votre workspace
            </li>
          </ul>
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white/60 transition hover:text-white/80"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              {t("dashboard.subscription.cancelButton")}
            </button>
            <button
              onClick={() => { setShowUpgradeModal(false); upgradeToProCheckout(); }}
              disabled={upgradeLoading}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
            >
              {upgradeLoading ? t("dashboard.subscription.redirecting") : t("dashboard.subscription.confirmUpgrade")}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Cancel — Step 1 modal: are you sure? */}
    {showCancelStep1 && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        onClick={() => setShowCancelStep1(false)}
      >
        <div
          className="w-full max-w-md rounded-2xl p-6 space-y-5"
          style={{ background: "#13131a", border: "1px solid rgba(255,255,255,0.10)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">Résilier l&apos;abonnement</h2>
            <p className="text-sm text-white/50">
              Vous êtes sur le point de résilier votre abonnement DuupFlow.
            </p>
          </div>
          <ul className="space-y-2 text-sm text-white/60">
            <li className="flex items-start gap-2">
              <svg viewBox="0 0 16 16" className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M8 2v5l3 3" /><circle cx="8" cy="8" r="6" />
              </svg>
              Votre accès reste actif jusqu&apos;à la fin de la période en cours
            </li>
            <li className="flex items-start gap-2">
              <svg viewBox="0 0 16 16" className="h-4 w-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
              Toutes vos données et copies seront inaccessibles après l&apos;expiration
            </li>
          </ul>
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setShowCancelStep1(false)}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white/60 transition hover:text-white/80"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              {t("dashboard.subscription.cancelButton")}
            </button>
            <button
              onClick={() => { setShowCancelStep1(false); setShowCancelStep2(true); }}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium transition"
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.30)", color: "#FCA5A5" }}
            >
              {t("dashboard.subscription.continueButton")}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Cancel — Step 2 modal: feedback required */}
    {showCancelStep2 && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        onClick={() => setShowCancelStep2(false)}
      >
        <div
          className="w-full max-w-md rounded-2xl p-6 space-y-5"
          style={{ background: "#13131a", border: "1px solid rgba(255,255,255,0.10)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">Avant de partir…</h2>
            <p className="text-sm text-white/50">
              Dites-nous pourquoi vous résiliez. Votre avis nous aide à améliorer DuupFlow.
            </p>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-2">Votre avis <span className="text-red-400">*</span></label>
            <textarea
              value={cancelFeedback}
              onChange={(e) => setCancelFeedback(e.target.value)}
              placeholder="Ex: Trop cher, fonctionnalité manquante, je n'utilise plus le service…"
              rows={4}
              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-indigo-500/40 transition resize-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCancelStep2(false)}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white/60 transition hover:text-white/80"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              {t("dashboard.subscription.cancelButton")}
            </button>
            <button
              onClick={cancelSubscription}
              disabled={!cancelFeedback.trim() || cancelLoading}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium transition disabled:opacity-40"
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.30)", color: "#FCA5A5" }}
            >
              {cancelLoading ? t("dashboard.subscription.cancelling") : t("dashboard.subscription.confirmCancel")}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Downgrade confirmation modal */}
    {showDowngradeModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        onClick={() => setShowDowngradeModal(false)}
      >
        <div
          className="w-full max-w-md rounded-2xl p-6 space-y-5"
          style={{ background: "#13131a", border: "1px solid rgba(255,255,255,0.10)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">Passer au plan Solo</h2>
            <p className="text-sm text-white/50">
              Votre abonnement Stripe sera mis à jour immédiatement.
            </p>
          </div>

          <ul className="space-y-2 text-sm text-white/60">
            <li className="flex items-start gap-2">
              <svg viewBox="0 0 16 16" className="h-4 w-4 text-green-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M2 8l4 4 8-8" />
              </svg>
              Vous gardez l&apos;accès Pro jusqu&apos;à la fin de votre période en cours
            </li>
            <li className="flex items-start gap-2">
              <svg viewBox="0 0 16 16" className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M8 2v5l3 3" /><circle cx="8" cy="8" r="6" />
              </svg>
              Votre prochain paiement sera de 39€ (plan Solo)
            </li>
            <li className="flex items-start gap-2">
              <svg viewBox="0 0 16 16" className="h-4 w-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
              Les limites Solo s&apos;activeront au début du prochain cycle
            </li>
          </ul>

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setShowDowngradeModal(false)}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white/60 transition hover:text-white/80"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              {t("dashboard.subscription.cancelButton")}
            </button>
            <button
              onClick={downgradeToSolo}
              disabled={downgradeLoading}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium transition disabled:opacity-50"
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.30)", color: "#FCA5A5" }}
            >
              {downgradeLoading ? t("dashboard.subscription.changingPlan") : t("dashboard.subscription.confirmDowngrade")}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPlanLimits } from "@/lib/plans";
import { useTranslation } from "@/lib/i18n/context";
import UpgradePlanModal from "../components/UpgradePlanModal";
import TokensPanel from "./TokensPanel";

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

// Stripe gives the exact end-of-period timestamp (in seconds). During a trial
// this is the FIRST charge date (trial_end), not a month out — so we prefer it
// over the period_start + 1 month estimate whenever it's available.
function formatUnixDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function getDaysUntilUnix(ts: number): number {
  return Math.max(0, Math.ceil((ts * 1000 - Date.now()) / 86400000));
}

function UsageStatCard({
  label, icon, current, limit, unlimited, color,
}: {
  label: string;
  icon: React.ReactNode;
  current: number;
  limit: number;
  unlimited?: boolean;
  color: string;
}) {
  const pct = unlimited ? 100 : Math.min(100, Math.round((current / limit) * 100));
  const isNearLimit = !unlimited && pct >= 80;
  const isAtLimit = !unlimited && pct >= 100;
  const barColor = isAtLimit ? "#EF4444" : isNearLimit ? "#F59E0B" : color;

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <div
          className="h-5 w-5 rounded-md flex items-center justify-center shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
        >
          {icon}
        </div>
        <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[var(--app-text-faint)]">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-[var(--app-text)] tabular-nums leading-none">
        {current}
        <span className="text-sm font-medium text-[var(--app-text-faint)] ml-1.5">
          / {unlimited ? "∞" : limit}
        </span>
      </p>
      <div
        className="mt-3 h-1.5 w-full rounded-full overflow-hidden"
        style={{ background: "var(--app-surface-2)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={
            unlimited
              ? { width: "100%", background: `linear-gradient(90deg, ${color}, ${color}55)` }
              : { width: `${pct}%`, background: barColor }
          }
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
  currentPeriodEnd,
  isTrialing,
  billingInterval,
}: {
  plan: "free" | "starter" | "solo" | "pro" | null;
  usage: { images: number; videos: number; ai_signatures: number } | null;
  hasStripePortal: boolean;
  subscriptionPeriodStart: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: number | null;
  currentPeriodEnd: number | null;
  isTrialing: boolean;
  /** Intervalle Stripe en cours — le sélecteur de plans s'ouvre dessus. */
  billingInterval: "monthly" | "yearly";
}) {
  const { t, locale } = useTranslation();
  const [portalPaymentLoading, setPortalPaymentLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(cancelAtPeriodEnd);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showCancelStep1, setShowCancelStep1] = useState(false);
  const [showCancelStep2, setShowCancelStep2] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState("");
  // Le sélecteur de plans (Starter / Solo / Pro + bascule annuelle) : c'est la
  // SEULE porte de changement de plan, quel que soit le plan en cours. Avant,
  // « Changer son plan » ouvrait trois modales différentes selon l'abonnement —
  // un abonné Solo ne pouvait qu'aller vers Pro, un abonné Pro que redescendre
  // vers Solo, et personne ne pouvait passer au paiement annuel.
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [view, setView] = useState<"plan" | "tokens">("plan");

  const cancelEndDate = cancelAt
    ? new Date(cancelAt * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  // Prefer Stripe's exact period end (accurate during a trial → first-charge
  // date); fall back to the period_start + 1 month estimate if it's missing.
  const renewalDate = currentPeriodEnd != null
    ? formatUnixDate(currentPeriodEnd)
    : getRenewalDate(subscriptionPeriodStart);
  const daysLeft = currentPeriodEnd != null
    ? getDaysUntilUnix(currentPeriodEnd)
    : getDaysUntilRenewal(subscriptionPeriodStart);
  const isUnlimited = plan === "pro";
  const isFree = plan === "free" || plan === null;

  // Auto-open the plan picker when arriving with ?upgrade=1 (e.g. from the API
  // page's "Passer au plan Pro" CTA). Same routing as the "Changer son plan"
  // button, then clean the URL so it doesn't re-open on refresh.
  useEffect(() => {
    let params: URLSearchParams | null = null;
    try { params = new URLSearchParams(window.location.search); } catch {}
    if (!params) return;
    // ?view=tokens → land directly on the Tokens tab (e.g. from the docs CTA).
    if (params.get("view") === "tokens") setView("tokens");
    // ?upgrade=1 → auto-open the plan picker (e.g. from the API "Passer au Pro" CTA).
    if (params.get("upgrade") === "1") setShowPlanPicker(true);
    if (params.get("view") || params.get("upgrade")) {
      try { window.history.replaceState({}, "", window.location.pathname); } catch {}
    }
  }, [isFree, plan]);

  // Per-plan visual identity + display strings
  const planMeta = {
    free:    { color: "#10B981", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.22)",  label: "Free",    price: "0 € / mois" },
    starter: { color: "#C4B5FD", bg: "rgba(196,181,253,0.12)", border: "rgba(196,181,253,0.28)", label: "Starter", price: "19 € / mois" },
    solo:    { color: "#A78BFA", bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.22)", label: "Solo",    price: "39 € / mois" },
    pro:     { color: "#818CF8", bg: "rgba(99,102,241,0.10)",  border: "rgba(99,102,241,0.22)",  label: "Pro",     price: "99 € / mois" },
  } as const;
  const meta = planMeta[(plan ?? "free") as "free" | "starter" | "solo" | "pro"];
  const { color: planColor, bg: planBg, border: planBorder } = meta;

  // Quotas to display (Pro shows ∞; Starter/Solo/Free from PLAN_LIMITS)
  const quotaLimits = getPlanLimits(plan);

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

  if (!plan) {
    return (
      <main className="p-8 max-w-2xl">
        <div className="mb-8">
          <p className="text-xs font-medium text-[var(--app-text-faint)] tracking-[0.14em] uppercase mb-1.5">{t("dashboard.home.dashboard")}</p>
          <h1 className="text-2xl font-semibold text-[var(--app-text)] tracking-tight">{t("dashboard.subscription.title")}</h1>
        </div>
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
        >
          <p className="text-[var(--app-text-muted)] mb-4">{t("dashboard.subscription.noSubscription")}</p>
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
    <main className="px-4 py-6 sm:px-8 sm:py-8 2xl:px-12">
      {/* Header — screenshot style */}
      <div className="mb-8">
        <p className="text-xs font-medium text-[var(--app-text-faint)] tracking-[0.14em] uppercase mb-2">
          {t("dashboard.subscription.eyebrow")}
        </p>
        <h1 className="text-3xl font-semibold text-[var(--app-text)] tracking-tight">
          {t("dashboard.subscription.pageHeading")}
        </h1>
        <p className="text-sm text-[var(--app-text-faint)] mt-2 max-w-xl leading-relaxed">
          {t("dashboard.subscription.pageSubtitle")}
        </p>
      </div>

      {/* Segmented toggle — switch the page between the plan view and the token view. */}
      <div
        className="inline-flex items-center gap-1 p-1 rounded-xl mb-6"
        style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
      >
        {(["plan", "tokens"] as const).map((v) => {
          const active = view === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={[
                "px-4 py-1.5 text-sm font-semibold rounded-lg transition-all",
                active ? "text-white" : "text-[var(--app-text-faint)] hover:text-[var(--app-text-muted)]",
              ].join(" ")}
              style={active ? { background: "linear-gradient(135deg,#6366F1,#38BDF8)" } : undefined}
            >
              {v === "plan" ? t("dashboard.subscription.tabPlan") : t("dashboard.subscription.tabTokens")}
            </button>
          );
        })}
      </div>

      {view === "plan" && (
      <div className="space-y-5">
        {/* Plan card */}
        <div
          className="rounded-2xl p-6"
          style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
        >
          {/* Plan header — screenshot style: "Plan actuel" badge, plan name
              (no price, per spec), and the "Changer son plan" CTA beside it. */}
          <span
            className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full mb-4"
            style={{ background: planBg, border: `1px solid ${planBorder}`, color: planColor }}
          >
            {t("dashboard.subscription.currentPlan")}
          </span>
          <div className="flex flex-col items-start gap-3 mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div className="flex items-center gap-3">
              <p className="text-4xl font-bold text-[var(--app-text)] leading-none">{meta.label}</p>
              {isTrialing && (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.28)", color: "#34D399" }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {t("dashboard.subscription.trialBadge")}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowPlanPicker(true)}
              className="shrink-0 w-full sm:w-auto justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 flex items-center gap-2"
              style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              {t("dashboard.subscription.changePlan")}
            </button>
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
              style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
            >
              <div className="flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--app-text-faint)] shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                <div>
                  <p className="text-xs text-[var(--app-text-muted)]">
                    {isTrialing ? t("dashboard.subscription.firstPayment") : t("dashboard.subscription.nextRenewal")}
                  </p>
                  <p className="text-xs font-semibold text-[var(--app-text-muted)] mt-0.5">{renewalDate}</p>
                </div>
              </div>
              {daysLeft !== null && (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full tabular-nums"
                  style={
                    daysLeft <= 3
                      ? { background: "rgba(245,158,11,0.10)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.20)" }
                      : { background: "var(--app-surface)", color: "var(--app-text-faint)", border: "1px solid var(--app-border)" }
                  }
                >
                  {locale === "en" ? `${daysLeft}d left` : `J-${daysLeft}`}
                </span>
              )}
            </div>
          )}

          {/* Usage — screenshot style: 3 stat cards side by side */}
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] uppercase text-[var(--app-text-faint)] mb-4">
              {isUnlimited ? t("dashboard.subscription.usageUnlimited") : t("dashboard.subscription.usageThisMonth")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <UsageStatCard
                label={t("dashboard.subscription.imagesDuplication")}
                icon={
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke={planColor} strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                }
                current={usage?.images ?? 0}
                limit={quotaLimits.images}
                unlimited={isUnlimited}
                color={planColor}
              />
              <UsageStatCard
                label={t("dashboard.subscription.videosDuplication")}
                icon={
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="#38BDF8" strokeWidth="2">
                    <rect x="2" y="5" width="14" height="14" rx="2" />
                    <path d="M16 9l5-3v12l-5-3V9z" />
                  </svg>
                }
                current={usage?.videos ?? 0}
                limit={quotaLimits.videos}
                unlimited={isUnlimited}
                color="#38BDF8"
              />
              <UsageStatCard
                label={t("dashboard.subscription.aiSignatures")}
                icon={
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="#10B981" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                }
                current={usage?.ai_signatures ?? 0}
                limit={quotaLimits.ai_signatures}
                unlimited={isUnlimited}
                color="#10B981"
              />
            </div>
            {!isUnlimited && renewalDate && (
              <p className="mt-3 text-[11px] text-[var(--app-text-faint)] leading-relaxed">
                {t("dashboard.subscription.resetDate", { date: renewalDate })}
              </p>
            )}
          </div>

          {/* Billing controls exist only for users with a Stripe customer
              (paid plans). Free users have none — so we skip the divider and
              the whole block to avoid an empty gap at the bottom of the card. */}
          {(hasStripePortal || msg) && (
            <>
              <div className="h-px bg-[var(--app-border)] my-5" />

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

              {hasStripePortal && (
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => openPortal("payment")}
                    disabled={portalPaymentLoading}
                    className="rounded-xl px-5 py-2.5 text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{
                      background: "var(--app-surface)",
                      border: "1px solid var(--app-border)",
                      color: "var(--app-text-muted)",
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

                  {!isCancelling && (
                    <button
                      onClick={() => setShowCancelStep1(true)}
                      disabled={cancelLoading}
                      className="rounded-xl px-5 py-2.5 text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-red-500/[0.06] hover:border-red-500/20 hover:text-red-400/80"
                      style={{
                        background: "var(--app-surface)",
                        border: "1px solid var(--app-border)",
                        color: "var(--app-text-faint)",
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
              )}
            </>
          )}
        </div>

        {/* Pro feature highlight for Solo */}
        {plan === "solo" && (
          <div
            className="rounded-2xl p-5"
            style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)" }}
          >
            <p className="text-xs font-semibold text-indigo-300/70 uppercase tracking-wider mb-3">{t("dashboard.subscription.proAdvantages")}</p>
            <ul className="space-y-2 text-sm text-[var(--app-text-muted)]">
              <li className="flex items-center gap-2">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M2 8l4 4 8-8" />
                </svg>
                {t("dashboard.subscription.proAdvUnlimited")}
              </li>
              <li className="flex items-center gap-2">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M2 8l4 4 8-8" />
                </svg>
                {t("dashboard.subscription.proAdvMembers")}
              </li>
              <li className="flex items-center gap-2">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M2 8l4 4 8-8" />
                </svg>
                {t("dashboard.subscription.proAdvPriority")}
              </li>
            </ul>
          </div>
        )}
      </div>
      )}

      {/* Tokens — merged in from the former /dashboard/tokens module so the
          unified "Plan & token" page shows subscription + token balance. */}
      {view === "tokens" && <TokensPanel />}
    </main>

    <UpgradePlanModal
      open={showPlanPicker}
      onClose={() => setShowPlanPicker(false)}
      currentPlan={plan ?? "free"}
      currentInterval={billingInterval}
    />
    </>
  );
}

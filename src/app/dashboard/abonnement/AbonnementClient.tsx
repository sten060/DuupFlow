"use client";

import { useState } from "react";
import Link from "next/link";
import { PLAN_LIMITS } from "@/lib/plans";

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
              <span className="text-white/40 text-[10px]">{current} utilisé</span>
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
  const [portalPaymentLoading, setPortalPaymentLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [downgradeLoading, setDowngradeLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(cancelAtPeriodEnd);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

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
        setMsg({ type: "err", text: data.error ?? "Erreur lors de l'ouverture du portail." });
      }
    } catch {
      setMsg({ type: "err", text: "Erreur réseau." });
    }
    setPortalPaymentLoading(false);
  }

  async function cancelSubscription() {
    setCancelLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/stripe/cancel", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsCancelling(true);
        setMsg({ type: "ok", text: "Résiliation programmée. Vous garderez l'accès jusqu'à la fin de votre période." });
      } else {
        setMsg({ type: "err", text: data.error ?? "Erreur lors de la résiliation." });
      }
    } catch {
      setMsg({ type: "err", text: "Erreur réseau." });
    }
    setCancelLoading(false);
  }

  async function downgradeToSolo() {
    setDowngradeLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/stripe/downgrade", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        window.location.reload();
      } else {
        setMsg({ type: "err", text: data.error ?? "Erreur lors du changement de plan." });
      }
    } catch {
      setMsg({ type: "err", text: "Erreur réseau." });
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
        setMsg({ type: "err", text: data.error ?? "Erreur lors de la mise à niveau." });
      }
    } catch {
      setMsg({ type: "err", text: "Erreur réseau." });
    }
    setUpgradeLoading(false);
  }

  if (!plan) {
    return (
      <main className="p-8 max-w-2xl">
        <div className="mb-8">
          <p className="text-xs font-medium text-white/25 tracking-[0.14em] uppercase mb-1.5">Dashboard</p>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Abonnement</h1>
        </div>
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: "rgba(10,14,40,0.55)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p className="text-white/50 mb-4">Aucun abonnement actif.</p>
          <Link
            href="/checkout"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            Choisir un plan
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium text-white/25 tracking-[0.14em] uppercase mb-1.5">Dashboard</p>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-white tracking-tight">Abonnement</h1>
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
              Actif
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
                <p className="text-xs font-semibold" style={{ color: "#F59E0B" }}>Résiliation programmée</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(245,158,11,0.75)" }}>
                  {cancelEndDate
                    ? `Accès garanti jusqu'au ${cancelEndDate}. Après cette date, votre compte sera désactivé.`
                    : "Votre abonnement ne sera pas renouvelé. Vous gardez l'accès jusqu'à la fin de la période."}
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
                  <p className="text-xs text-white/50">Prochain renouvellement</p>
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
              Utilisation {isUnlimited ? "— Illimitée" : "ce mois"}
            </p>
            <div className="space-y-4">
              <UsageBar
                label="Duplication images"
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
              />
              <UsageBar
                label="Duplication vidéos"
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
              />
              <UsageBar
                label="Signature IA"
                icon={
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="#10B981" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                }
                current={usage?.ai_signatures ?? 0}
                limit={PLAN_LIMITS.solo.ai_signatures}
                unlimited={isUnlimited}
                color="#10B981"
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
                onClick={upgradeToProCheckout}
                disabled={upgradeLoading}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
              >
                {upgradeLoading ? (
                  "Redirection…"
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M8 2l4 4H9v6H7V6H4l4-4z" />
                    </svg>
                    Passer au plan Pro — 99€/mois
                  </>
                )}
              </button>
            )}

            {plan === "pro" && !isCancelling && (
              <button
                onClick={downgradeToSolo}
                disabled={downgradeLoading}
                className="w-full rounded-xl py-2.5 text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: "rgba(255,255,255,0.50)",
                }}
              >
                {downgradeLoading ? (
                  "Changement en cours…"
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M8 14l-4-4h3V4h2v6h3l-4 4z" />
                    </svg>
                    Passer au plan Solo — 39€/mois
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
                  "Ouverture…"
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="1" y="4" width="14" height="9" rx="2" />
                      <path d="M1 7h14" />
                    </svg>
                    Changer le moyen de paiement
                  </>
                )}
              </button>
            )}

            {hasStripePortal && !isCancelling && (
              <button
                onClick={cancelSubscription}
                disabled={cancelLoading}
                className="w-full rounded-xl py-2.5 text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-red-500/[0.06] hover:border-red-500/20 hover:text-red-400/80"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "rgba(255,255,255,0.35)",
                }}
              >
                {cancelLoading ? (
                  "Résiliation en cours…"
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="8" cy="8" r="6" />
                      <path d="M5 8h6" />
                    </svg>
                    Résilier l&apos;abonnement
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
  );
}

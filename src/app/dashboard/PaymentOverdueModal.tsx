"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/context";

/**
 * Blocking modal shown to users whose Stripe payment is in `past_due`
 * (set by the webhook via `pauseUserForOverduePayment`).
 *
 * Behavior:
 *  • Auto-mounts on every dashboard load while `payment_overdue = true`.
 *  • The X button closes it for the current session only — re-mounts on
 *    the next page navigation.
 *  • Primary CTA opens the Stripe Customer Portal so the user can update
 *    their card. Stripe will retry the payment automatically; on success
 *    the webhook (`invoice.paid`) clears the flag and restores the plan.
 */
export default function PaymentOverdueModal({
  since,
  pausedPlan,
}: {
  /** ISO timestamp of the first failure, for display only. */
  since: string | null;
  /** Plan the user is paused from (Solo or Pro). */
  pausedPlan: string | null;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  async function openPortal() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow: "payment" }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setErr(data?.error ?? t("dashboard.paymentOverdue.networkError"));
    } catch {
      setErr(t("dashboard.paymentOverdue.networkError"));
    } finally {
      setBusy(false);
    }
  }

  const sinceLabel = since
    ? new Date(since).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const planLabel = pausedPlan === "pro" ? "Pro" : pausedPlan === "solo" ? "Solo" : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: "rgba(6,9,24,0.92)", backdropFilter: "blur(12px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-7 relative"
        style={{
          background: "rgba(10,14,40,0.98)",
          border: "1px solid rgba(239,68,68,0.40)",
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(239,68,68,0.15)",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute top-3 right-3 h-8 w-8 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/70"
          aria-label="Fermer"
        >
          ×
        </button>

        <div
          className="mx-auto mb-5 h-14 w-14 rounded-2xl flex items-center justify-center"
          style={{
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.35)",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7 text-red-300"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <path d="M2 10h20M6 14h4" />
            <path d="M18 14l4 4M22 14l-4 4" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-white text-center mb-2 tracking-tight">
          {t("dashboard.paymentOverdue.title")}
        </h2>

        <p className="text-sm text-white/65 text-center leading-relaxed mb-5">
          {planLabel
            ? t("dashboard.paymentOverdue.bodyWithPlan", { plan: planLabel })
            : t("dashboard.paymentOverdue.body")}
        </p>

        {sinceLabel && (
          <p className="text-[11px] text-white/35 text-center mb-5">
            {t("dashboard.paymentOverdue.since", { date: sinceLabel })}
          </p>
        )}

        <div
          className="rounded-xl px-4 py-3 mb-5"
          style={{
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.20)",
          }}
        >
          <p className="text-xs text-red-200/85 leading-relaxed">
            {t("dashboard.paymentOverdue.notice")}
          </p>
        </div>

        {err && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs text-red-300">
            {err}
          </div>
        )}

        <button
          type="button"
          onClick={openPortal}
          disabled={busy}
          className="w-full rounded-xl py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#EF4444,#F97316)" }}
        >
          {busy
            ? t("dashboard.paymentOverdue.opening")
            : t("dashboard.paymentOverdue.cta")}
        </button>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="w-full mt-2 py-2.5 text-xs font-medium text-white/40 hover:text-white/70 transition"
        >
          {t("dashboard.paymentOverdue.dismiss")}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";

/**
 * One-shot popup shown after a subscription is fully canceled (Stripe
 * `customer.subscription.deleted` → markUserChurned sets
 * `cancellation_notice_pending = true`).
 *
 * Behavior:
 *  • Mounts only while the flag is true (read server-side in the layout).
 *  • Consumes the flag on first render (POST /api/account/ack-cancellation),
 *    so it appears exactly ONCE — never again on later loads/navigations.
 *  • CTA routes to the plans page so the user can re-subscribe. The dismiss
 *    button simply closes it (they stay on Free).
 */
export default function SubscriptionCanceledModal() {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const acked = useRef(false);

  // Consume the flag as soon as the popup is shown. Fire-and-forget: even if
  // this fails the UX is only "shows once more next time", never a hard error.
  useEffect(() => {
    if (acked.current) return;
    acked.current = true;
    fetch("/api/account/ack-cancellation", { method: "POST" }).catch(() => {});
  }, []);

  if (!open) return null;

  function goToPlans() {
    setOpen(false);
    router.push("/dashboard/abonnement");
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: "rgba(6,9,24,0.92)", backdropFilter: "blur(12px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-7 relative"
        style={{
          background: "rgba(10,14,40,0.98)",
          border: "1px solid rgba(129,140,248,0.40)",
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(99,102,241,0.15)",
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
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(129,140,248,0.35)",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7 text-indigo-300"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M9 12h6" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-white text-center mb-2 tracking-tight">
          {t("dashboard.subscriptionCanceled.title")}
        </h2>

        <p className="text-sm text-white/65 text-center leading-relaxed mb-5">
          {t("dashboard.subscriptionCanceled.body")}
        </p>

        <div
          className="rounded-xl px-4 py-3 mb-5"
          style={{
            background: "rgba(99,102,241,0.06)",
            border: "1px solid rgba(129,140,248,0.20)",
          }}
        >
          <p className="text-xs text-indigo-200/85 leading-relaxed">
            {t("dashboard.subscriptionCanceled.notice")}
          </p>
        </div>

        <button
          type="button"
          onClick={goToPlans}
          className="w-full rounded-xl py-3 text-sm font-bold text-white transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}
        >
          {t("dashboard.subscriptionCanceled.cta")}
        </button>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="w-full mt-2 py-2.5 text-xs font-medium text-white/40 hover:text-white/70 transition"
        >
          {t("dashboard.subscriptionCanceled.dismiss")}
        </button>
      </div>
    </div>
  );
}

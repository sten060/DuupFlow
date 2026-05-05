"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import UpgradePlanModal from "../components/UpgradePlanModal";

/**
 * Lock screen shown to Free users on /dashboard/ai-detection.
 * Explains what the module does and opens an in-page Stripe Checkout
 * modal when the user clicks "upgrade".
 */
export default function UpgradeRequired() {
  const { t } = useTranslation();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  return (
    <div className="p-8 w-full">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium text-white/30 tracking-[0.14em] uppercase mb-2">
          {t("dashboard.aiDetectionLock.eyebrow")}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          <span className="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
            {t("dashboard.aiDetectionLock.title")}
          </span>
        </h1>
      </div>

      {/* Lock card */}
      <div
        className="max-w-2xl rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-500/[0.06] to-orange-500/[0.04] p-8"
      >
        <div className="flex items-start gap-4 mb-6">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.30)",
            }}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-amber-300" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 1 1 8 0v4" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300/80 mb-1">
              {t("dashboard.aiDetectionLock.lockBadge")}
            </p>
            <h2 className="text-xl font-semibold text-white tracking-tight">
              {t("dashboard.aiDetectionLock.headline")}
            </h2>
          </div>
        </div>

        <div className="space-y-4 text-sm leading-relaxed text-white/65">
          <section>
            <h3 className="text-white/95 font-semibold mb-1.5">
              {t("dashboard.aiDetectionLock.whatTitle")}
            </h3>
            <p>{t("dashboard.aiDetectionLock.whatBody")}</p>
          </section>

          <section>
            <h3 className="text-white/95 font-semibold mb-1.5">
              {t("dashboard.aiDetectionLock.useCaseTitle")}
            </h3>
            <p>{t("dashboard.aiDetectionLock.useCaseBody")}</p>
          </section>

          <ul className="space-y-1.5 text-xs text-white/60 pl-1 mt-3">
            <li className="flex items-start gap-2">
              <span className="text-amber-300 mt-0.5">✓</span>
              {t("dashboard.aiDetectionLock.bullet1")}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-300 mt-0.5">✓</span>
              {t("dashboard.aiDetectionLock.bullet2")}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-300 mt-0.5">✓</span>
              {t("dashboard.aiDetectionLock.bullet3")}
            </li>
          </ul>
        </div>

        <div className="mt-7 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => setShowUpgradeModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#7C3AED,#6366F1)" }}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M8 2l4 4H9v6H7V6H4l4-4z" />
            </svg>
            {t("dashboard.aiDetectionLock.ctaUpgrade")}
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/70 hover:bg-white/[0.08] transition"
          >
            {t("dashboard.aiDetectionLock.ctaBack")}
          </Link>
        </div>
      </div>

      <UpgradePlanModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}

"use client";

import { useTranslation } from "@/lib/i18n/context";

// Public-facing placeholder for the Variation IA feature.
// The real feature lives at a secret URL; this page only shows a
// "Coming Soon" notice to users who land here from the sidebar.
export default function VariationIAComingSoonPage() {
  const { t } = useTranslation();

  return (
    <div className="relative min-h-screen bg-[#0b0e1a] text-white overflow-hidden">
      <div
        className="absolute inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(6,9,24,0.82)", backdropFilter: "blur(12px)" }}
      >
        <div
          className="text-center max-w-sm mx-4 rounded-2xl px-8 py-10"
          style={{
            background: "rgba(10,14,40,0.96)",
            border: "1px solid rgba(99,102,241,0.30)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(99,102,241,0.10)",
          }}
        >
          <div
            className="mx-auto mb-6 h-16 w-16 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(99,102,241,0.15)",
              border: "1px solid rgba(99,102,241,0.30)",
            }}
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-3 tracking-tight">
            {t("dashboard.generate.comingSoonTitle")}
          </h2>
          <p className="text-sm text-white/50 leading-relaxed mb-5">
            {t("dashboard.generate.comingSoonDesc")}
          </p>
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold"
            style={{
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.25)",
              color: "#818CF8",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            {t("dashboard.generate.comingSoonBadge")}
          </div>
        </div>
      </div>
    </div>
  );
}

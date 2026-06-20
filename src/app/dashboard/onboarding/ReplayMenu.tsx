"use client";

/**
 * "Revoir la visite" — lets the user replay the overview or re-open any
 * module's coach on demand. Replaces the old Guide/Chapitres pickers.
 *
 * Picking the overview re-opens the welcome card; picking a module navigates
 * to it and forces its coach back open (see OnboardingProvider).
 */

import { useTranslation } from "@/lib/i18n/context";
import { ONBOARDING_MODULES } from "./modules";
import { useOnboarding } from "./OnboardingProvider";

export default function ReplayMenu({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { replayOverview, replayModule } = useOnboarding();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(6,9,24,0.78)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden"
        style={{
          background: "rgba(10,14,40,0.98)",
          border: "1px solid rgba(99,102,241,0.25)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(99,102,241,0.10)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-7 pt-6 pb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">
              {t("onb.replayTitle")}
            </h2>
            <p className="text-sm text-white/45 mt-1">{t("onb.replaySubtitle")}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/60 transition h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/5 shrink-0"
            aria-label={t("common.close")}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-7 pb-7 space-y-3">
          {/* Overview */}
          <button
            onClick={() => {
              replayOverview();
              onClose();
            }}
            className="group w-full rounded-xl p-4 text-left transition-all flex items-center gap-3"
            style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.20)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,102,241,0.45)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,102,241,0.20)"; }}
          >
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.30)", color: "#818CF8" }}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white/90">{t("onb.replayOverview")}</h3>
              <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{t("onb.replayOverviewDesc")}</p>
            </div>
            <span className="ml-auto text-sm opacity-0 group-hover:opacity-100 transition text-indigo-300">→</span>
          </button>

          {/* Per-module */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ONBOARDING_MODULES.map((m) => (
              <button
                key={m.key}
                onClick={() => {
                  replayModule(m.key);
                  onClose();
                }}
                className="group rounded-xl p-4 text-left transition-all"
                style={{ background: m.accentBg.replace("0.10", "0.05"), border: `1px solid ${m.accentBorder.replace("0.30", "0.18")}` }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = m.accentBorder; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = m.accentBorder.replace("0.30", "0.18"); }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: m.accentBg, border: `1px solid ${m.accentBorder}`, color: m.accent }}
                  >
                    {m.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white/90">{t(`onb.modules.${m.i18n}.name`)}</h3>
                    <p className="text-xs text-white/45 mt-1 leading-relaxed">{t(`onb.modules.${m.i18n}.tagline`)}</p>
                  </div>
                  <span className="text-sm opacity-0 group-hover:opacity-100 transition shrink-0 mt-1" style={{ color: m.accent }}>→</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

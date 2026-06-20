"use client";

/**
 * App overview — the one-time welcome card on the dashboard home.
 *
 * Presents DuupFlow and lists every module with a one-line function, then
 * gets out of the way. No forced actions: the per-module coach explains each
 * tool when the user actually opens it.
 *
 * Shows when: enabled, on /dashboard, overview not yet seen — or forced via
 * the "Revoir la visite" menu. Closing it marks "overview" seen (unless forced).
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";
import { ONBOARDING_MODULES } from "./modules";
import { useOnboarding } from "./OnboardingProvider";

export default function AppOverview() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { enabled, isSeen, markSeen, forcedOverview, clearForcedOverview } = useOnboarding();

  const autoShow = enabled && pathname === "/dashboard" && !isSeen("overview");
  const open = autoShow || forcedOverview;

  // Drives the entrance transition (fade + lift). Reset whenever we reopen.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  function close() {
    if (forcedOverview) clearForcedOverview();
    else markSeen("overview");
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: "rgba(5,8,22,0.66)", backdropFilter: "blur(6px)" }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl overflow-hidden"
        style={{
          background: "rgba(10,14,40,0.985)",
          border: "1px solid rgba(99,102,241,0.28)",
          boxShadow: "0 30px 90px rgba(0,0,0,0.6), 0 0 70px rgba(99,102,241,0.12)",
          opacity: shown ? 1 : 0,
          transform: shown ? "translateY(0) scale(1)" : "translateY(10px) scale(0.985)",
          transition: "opacity .4s ease, transform .4s cubic-bezier(.16,1,.3,1)",
        }}
      >
        {/* Glow header */}
        <div className="relative px-8 pt-9 pb-6 text-center">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-32"
            style={{ background: "radial-gradient(420px at 50% -10%, rgba(99,102,241,0.22), transparent 70%)" }}
          />
          <h2 className="relative text-2xl font-semibold tracking-tight text-white">
            {t("onb.overview.title")}
          </h2>
          <p className="relative mt-2 text-sm leading-relaxed text-white/55 mx-auto max-w-sm">
            {t("onb.overview.subtitle")}
          </p>
        </div>

        {/* Module list */}
        <div className="px-6 pb-2 space-y-2">
          {ONBOARDING_MODULES.map((m, i) => (
            <div
              key={m.key}
              className="flex items-center gap-3.5 rounded-2xl px-4 py-3"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
                opacity: shown ? 1 : 0,
                transform: shown ? "translateY(0)" : "translateY(6px)",
                transition: "opacity .45s ease, transform .45s cubic-bezier(.16,1,.3,1)",
                transitionDelay: `${120 + i * 70}ms`,
              }}
            >
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: m.accentBg, border: `1px solid ${m.accentBorder}`, color: m.accent }}
              >
                {m.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white/90 leading-tight">
                  {t(`onb.modules.${m.i18n}.name`)}
                </p>
                <p className="text-xs text-white/45 mt-0.5 leading-snug">
                  {t(`onb.modules.${m.i18n}.tagline`)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-8 pt-5 pb-8">
          <button
            onClick={close}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            {t("onb.overview.cta")}
          </button>
          <p className="mt-3 text-center text-[11px] text-white/35">
            {t("onb.overview.foot")}
          </p>
        </div>
      </div>
    </div>
  );
}

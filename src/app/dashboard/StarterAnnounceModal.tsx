"use client";

import { useTranslation } from "@/lib/i18n/context";

/** CTA destination: the subscription page, which auto-opens the 3-plan picker
 *  (?upgrade=1) for a Free user. */
export const STARTER_DEST = "/dashboard/abonnement?upgrade=1";

/** localStorage guard key — also read by DashboardHome to avoid re-showing.
 *  Purely client-side (no DB migration): the pop-up shows once per browser. */
export const STARTER_SEEN_KEY = "duupflow_starter_announce_seen";

/**
 * One-shot "Starter plan is available" pop-up — shown to FREE users only.
 *
 * Strict close: the overlay has no click handler; the only ways out are the X
 * or the CTA, both of which persist the "seen" flag so it never re-opens. The
 * CTA hard-navigates (location.assign) after persisting so the redirect can't be
 * cancelled by a same-click React state update.
 */
export default function StarterAnnounceModal({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();

  const persist = () => {
    try { localStorage.setItem(STARTER_SEEN_KEY, "1"); } catch {}
  };

  const closeViaX = () => {
    persist();
    onDone();
  };

  const goToPlans = () => {
    persist();
    window.location.assign(STARTER_DEST);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-4"
      style={{ background: "rgba(6,9,24,0.88)", backdropFilter: "blur(10px)" }}
    >
      {/* Overlay intentionally has NO onClick → clicking outside does nothing. */}
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-[20px]"
        style={{
          background: "var(--app-surface)",
          border: "1px solid rgba(159,122,234,0.34)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(159,122,234,0.14)",
        }}
      >
        {/* soft gradient glow at the top */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{ background: "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(159,122,234,0.18), transparent 70%)" }}
        />

        <button
          type="button"
          onClick={closeViaX}
          aria-label={t("dashboard.videosCommon.close")}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-text-faint)] transition hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="relative p-8">
          {/* Icon + pill */}
          <div className="mb-5 flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg"
              style={{ background: "linear-gradient(135deg,#9F7AEA,#7C3AED)", boxShadow: "0 8px 24px rgba(124,58,237,0.35)" }}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
              </svg>
            </div>
            <span
              className="text-[10px] font-extrabold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full"
              style={{ background: "rgba(159,122,234,0.14)", color: "#C4B5FD", border: "1px solid rgba(159,122,234,0.30)" }}
            >
              {t("dashboard.starterAnnounce.pill")}
            </span>
          </div>

          <h2 className="text-[28px] sm:text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em]">
            <span className="bg-gradient-to-r from-violet-300 via-purple-300 to-fuchsia-200 bg-clip-text text-transparent">
              {t("dashboard.starterAnnounce.title")}
            </span>
          </h2>

          <p className="mt-3.5 text-[15px] font-light leading-relaxed text-[var(--app-text-muted)]">
            {t("dashboard.starterAnnounce.lead")}
          </p>

          <ul className="mt-6 space-y-2.5">
            {[
              t("dashboard.starterAnnounce.bullet1"),
              t("dashboard.starterAnnounce.bullet2"),
              t("dashboard.starterAnnounce.bullet3"),
            ].map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-[14px] text-[var(--app-text-muted)]">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#9F7AEA,#7C3AED)" }}
                >
                  ✓
                </span>
                <span className="font-normal">{b}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={goToPlans}
            className="mt-7 block w-full rounded-xl py-3.5 text-center text-[15px] font-bold tracking-tight text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#9F7AEA,#7C3AED)", boxShadow: "0 10px 30px rgba(124,58,237,0.35)" }}
          >
            {t("dashboard.starterAnnounce.cta")}
          </button>
        </div>
      </div>
    </div>
  );
}

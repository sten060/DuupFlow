"use client";

import { useTranslation } from "@/lib/i18n/context";

/** CTA destination: the FirstPromoter affiliate signup page (external portal). */
export const AFFILIATE_DEST = "https://duupflow.firstpromoter.com/signup";

/** localStorage guard key — the pop-up shows once per browser. */
export const AFFILIATE_SEEN_KEY = "duupflow_affiliate_announce_seen";

/**
 * One-shot "Affiliate program is live" pop-up — shown once to EXISTING users
 * only (gated upstream by account-creation date, see dashboard/page.tsx). New
 * signups never see it.
 *
 * Strict close: the overlay has no click handler; the only ways out are the X
 * or the CTA, both of which persist the "seen" flag so it never re-opens. The
 * CTA opens the FirstPromoter portal in a new tab (external) so the user stays
 * on the dashboard.
 */
export default function AffiliateAnnounceModal({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();

  const persist = () => {
    try { localStorage.setItem(AFFILIATE_SEEN_KEY, "1"); } catch {}
  };

  const closeViaX = () => {
    persist();
    onDone();
  };

  const goToProgram = () => {
    persist();
    window.open(AFFILIATE_DEST, "_blank", "noopener,noreferrer");
    onDone();
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
          border: "1px solid rgba(56,189,248,0.34)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(56,189,248,0.14)",
        }}
      >
        {/* soft gradient glow at the top */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{ background: "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(99,102,241,0.20), transparent 70%)" }}
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
              style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)", boxShadow: "0 8px 24px rgba(56,189,248,0.35)" }}
            >
              {/* réseau : 3 cercles reliés (comme l'icône Affiliation de la sidebar) */}
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </div>
            <span
              className="text-[10px] font-extrabold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full"
              style={{ background: "rgba(56,189,248,0.14)", color: "#7DD3FC", border: "1px solid rgba(56,189,248,0.30)" }}
            >
              {t("dashboard.affiliateAnnounce.pill")}
            </span>
          </div>

          <h2 className="text-[28px] sm:text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em]">
            <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-cyan-200 bg-clip-text text-transparent">
              {t("dashboard.affiliateAnnounce.title")}
            </span>
          </h2>

          <p className="mt-3.5 text-[15px] font-light leading-relaxed text-[var(--app-text-muted)]">
            {t("dashboard.affiliateAnnounce.lead")}
          </p>

          <ul className="mt-6 space-y-2.5">
            {[
              t("dashboard.affiliateAnnounce.bullet1"),
              t("dashboard.affiliateAnnounce.bullet2"),
              t("dashboard.affiliateAnnounce.bullet3"),
            ].map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-[14px] text-[var(--app-text-muted)]">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
                >
                  ✓
                </span>
                <span className="font-normal">{b}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={goToProgram}
            className="mt-7 block w-full rounded-xl py-3.5 text-center text-[15px] font-bold tracking-tight text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)", boxShadow: "0 10px 30px rgba(56,189,248,0.35)" }}
          >
            {t("dashboard.affiliateAnnounce.cta")}
          </button>

          <button
            type="button"
            onClick={closeViaX}
            className="mt-3 block w-full text-center text-[13px] font-medium text-[var(--app-text-faint)] transition hover:text-[var(--app-text-muted)]"
          >
            {t("dashboard.affiliateAnnounce.later")}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useTranslation } from "@/lib/i18n/context";
import { acknowledgeTikTokAnnouncement } from "./actions/onboarding";

/** Shared destination for all 3 announcement surfaces: advanced mode + auto-scroll
 *  to the TikTok templates / "Mouvement poussé" section. */
export const TIKTOK_DEST = "/dashboard/videos/advanced#tiktok-templates";

/** localStorage guard key — also read by DashboardHome to avoid re-showing. */
export const TIKTOK_SEEN_KEY = "duupflow_tiktok_announce_seen";

/** TikTok glyph (monochrome, currentColor). */
function TikTokLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M16.6 3c.27 2.07 1.43 3.3 3.4 3.43v2.32c-1.14.11-2.14-.26-3.3-.96v6.13c0 3.12-2.27 5.55-5.3 5.55-2.93 0-5.0-2.26-5.0-4.92 0-2.94 2.35-4.92 5.49-4.62v2.55c-.46-.1-.95-.16-1.43-.08-1.15.18-1.9.96-1.82 2.2.08 1.15.95 1.94 2.11 1.94.9 0 1.65-.58 1.87-1.45.06-.27.08-.62.08-.94V3h3.43z" />
    </svg>
  );
}

/**
 * One-shot TikTok launch announcement pop-up.
 *
 * Strict close: the overlay has NO click handler and there is NO Escape handler,
 * so the ONLY ways to dismiss are the X button or the CTA — both persist the
 * "seen" state so it never re-opens.
 *
 * The CTA navigates with a full `location.assign` AFTER persisting (capped wait),
 * so the redirect can't be cancelled by React state updates (a known App-Router
 * gotcha with <Link> + setState in the same click).
 */
export default function TikTokAnnouncementModal({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();

  const persist = () => {
    acknowledgeTikTokAnnouncement().catch(() => {});
    try { localStorage.setItem(TIKTOK_SEEN_KEY, "1"); } catch {}
  };

  // X / overlay-less close.
  const closeViaX = () => {
    persist();
    onDone();
  };

  // CTA — persist (await, capped) then hard-navigate so it always lands + scrolls.
  const goToSolution = async () => {
    try { localStorage.setItem(TIKTOK_SEEN_KEY, "1"); } catch {}
    try {
      await Promise.race([
        acknowledgeTikTokAnnouncement(),
        new Promise((r) => setTimeout(r, 1200)),
      ]);
    } catch {}
    window.location.assign(TIKTOK_DEST);
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
          background: "rgba(10,14,40,0.98)",
          border: "1px solid rgba(56,189,248,0.30)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(56,189,248,0.12)",
        }}
      >
        {/* soft gradient glow at the top */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{ background: "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(56,189,248,0.16), transparent 70%)" }}
        />

        <button
          type="button"
          onClick={closeViaX}
          aria-label={t("dashboard.videosCommon.close")}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="relative p-8">
          {/* Logo + pill */}
          <div className="mb-5 flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg"
              style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)", boxShadow: "0 8px 24px rgba(56,189,248,0.35)" }}
            >
              <TikTokLogo className="h-6 w-6" />
            </div>
            <span
              className="text-[10px] font-extrabold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full"
              style={{ background: "rgba(56,189,248,0.12)", color: "#7DD3FC", border: "1px solid rgba(56,189,248,0.30)" }}
            >
              {t("dashboard.tiktokAnnounce.pill")}
            </span>
          </div>

          <h2 className="text-[28px] sm:text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em]">
            <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-sky-200 bg-clip-text text-transparent">
              {t("dashboard.tiktokAnnounce.title")}
            </span>
          </h2>

          <p className="mt-3.5 text-[15px] font-light leading-relaxed text-white/65">
            {t("dashboard.tiktokAnnounce.lead")}
          </p>

          <ul className="mt-6 space-y-2.5">
            {[
              t("dashboard.tiktokAnnounce.bullet1"),
              t("dashboard.tiktokAnnounce.bullet2"),
              t("dashboard.tiktokAnnounce.bullet3"),
            ].map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-[14px] text-white/75">
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
            onClick={goToSolution}
            className="mt-7 block w-full rounded-xl py-3.5 text-center text-[15px] font-bold tracking-tight text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)", boxShadow: "0 10px 30px rgba(99,102,241,0.35)" }}
          >
            {t("dashboard.tiktokAnnounce.cta")}
          </button>
        </div>
      </div>
    </div>
  );
}

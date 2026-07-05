"use client";

// Launch promo for activated free users. Slides in from the right (not centered).
// A real 24h countdown starts on first view (stored in localStorage) — once it
// expires the pop-up never shows again. Shows once per browser session (a close
// hides it for the session; a fresh login shows it again until the deadline).
// Rendered only when the server says the user is an activated free user.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";

// Bump the suffix to restart the 24h window for everyone (fresh deadline on the
// next visit). Once the deadline passes, the pop-up never shows again.
const DEADLINE_KEY = "duupflow_promo_flow15_deadline_v2";
const SESSION_DISMISS_KEY = "duupflow_promo_flow15_dismissed";
const OFFER_MS = 24 * 60 * 60 * 1000; // 24h
const PROMO_CODE = "FLOW15";

// The dismiss flag is scoped to the current sign-in (last_sign_in_at) so a fresh
// login re-shows the pop-up even in the same tab, where sessionStorage alone
// would keep it hidden until the tab is closed.
export default function PromoPopup({ loginKey = null }: { loginKey?: string | null }) {
  const { t } = useTranslation();
  const dismissKey = `${SESSION_DISMISS_KEY}_${loginKey ?? "0"}`;
  const [mounted, setMounted] = useState(false); // in the DOM
  const [shown, setShown] = useState(false);      // slid into view (drives the transition)
  const [remaining, setRemaining] = useState(0);
  const [copied, setCopied] = useState(false);
  const deadlineRef = useRef(0);

  useEffect(() => {
    // Already dismissed this session → stay quiet until the next login.
    try { if (sessionStorage.getItem(dismissKey)) return; } catch {}

    let deadline = 0;
    try {
      const raw = localStorage.getItem(DEADLINE_KEY);
      deadline = raw ? parseInt(raw, 10) : 0;
      if (!deadline || Number.isNaN(deadline)) {
        deadline = Date.now() + OFFER_MS;
        localStorage.setItem(DEADLINE_KEY, String(deadline));
      }
    } catch {
      deadline = Date.now() + OFFER_MS;
    }

    if (Date.now() >= deadline) return; // countdown over → never again

    deadlineRef.current = deadline;
    setRemaining(deadline - Date.now());
    setMounted(true);
    const raf = requestAnimationFrame(() => window.setTimeout(() => setShown(true), 80));

    const iv = window.setInterval(() => {
      const rem = deadlineRef.current - Date.now();
      if (rem <= 0) {
        setRemaining(0);
        setShown(false);
        window.setTimeout(() => setMounted(false), 500);
        window.clearInterval(iv);
      } else {
        setRemaining(rem);
      }
    }, 1000);

    return () => { cancelAnimationFrame(raf); window.clearInterval(iv); };
  }, []);

  if (!mounted) return null;

  function close() {
    setShown(false);
    try { sessionStorage.setItem(dismissKey, "1"); } catch {}
    window.setTimeout(() => setMounted(false), 450);
  }

  function copyCode() {
    try { navigator.clipboard.writeText(PROMO_CODE); } catch {}
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const totalSec = Math.max(0, Math.floor(remaining / 1000));
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");

  return (
    <>
      {/* Slight blur/dim over the rest of the screen (to the left of the panel) */}
      <div
        onClick={close}
        className="fixed inset-0 z-[88]"
        style={{
          backdropFilter: "blur(2.5px)",
          WebkitBackdropFilter: "blur(2.5px)",
          background: "rgba(6,8,20,0.28)",
          opacity: shown ? 1 : 0,
          transition: "opacity 500ms ease",
          pointerEvents: shown ? "auto" : "none",
        }}
      />
      <div
        className="fixed top-0 right-0 bottom-0 z-[90] w-[92vw] max-w-[380px]"
        style={{
          transform: `translateX(${shown ? "0" : "118%"})`,
          transition: "transform 620ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
      <div
        className="relative h-full flex flex-col gap-6 overflow-y-auto rounded-l-lg border border-indigo-500/25 px-6 py-9"
        style={{ background: "linear-gradient(160deg,#141a42,#0b0e1f)", boxShadow: "0 22px 60px rgba(0,0,0,0.55), 0 0 40px rgba(99,102,241,0.12)" }}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          className="absolute top-3 right-3 text-white/40 hover:text-white/85 transition"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>

        <h3 className="text-xl font-extrabold text-white leading-snug pr-6">{t("promoPopup.title")}</h3>

        <div className="flex-1 flex flex-col justify-center pb-20 space-y-4">
        <p className="text-base text-white/75 leading-relaxed">{t("promoPopup.intro")}</p>

        <ul className="space-y-3.5 text-base text-white/80">
          <li className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/app/icons8-google-drive-96.png" alt="" className="h-5 w-5 shrink-0" />
            {t("promoPopup.feat1")}
          </li>
          <li className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-indigo-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
            </svg>
            {t("promoPopup.feat2")}
          </li>
          <li className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-indigo-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
            {t("promoPopup.feat3")}
          </li>
        </ul>
        </div>

        <div className="space-y-4 mb-5">
          {/* Offer line — sits right above the promo code */}
          <div className="space-y-5">
            <p className="text-sm font-semibold text-white/90">{t("promoPopup.offer")}</p>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">{t("promoPopup.codeLabel")}</p>
              <button
                type="button"
                onClick={copyCode}
                className="mt-1.5 w-full rounded-xl border border-dashed px-4 py-3 text-center transition hover:bg-indigo-500/[0.18]"
                style={{ borderColor: "rgba(129,140,248,0.55)", background: "rgba(99,102,241,0.12)" }}
              >
                <span className="text-xl font-extrabold tracking-[0.22em] text-white">{PROMO_CODE}</span>
                <span className="block mt-0.5 text-[11px] font-medium text-indigo-300">
                  {copied ? t("promoPopup.copied") : t("promoPopup.clickToCopy")}
                </span>
              </button>
            </div>
          </div>

          {/* Real countdown */}
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-white/50">{t("promoPopup.countdownLabel")}</span>
            <span className="font-mono font-bold text-white tabular-nums">{hh}:{mm}:{ss}</span>
          </div>

          <Link
            href="/dashboard/abonnement?upgrade=1"
            onClick={close}
            className="block w-full rounded-xl py-3 text-center text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            {t("promoPopup.cta")}
          </Link>
        </div>
      </div>
      </div>
    </>
  );
}

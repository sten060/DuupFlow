"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import Header from "@/components/Header";
import { LanguageProvider, type Locale } from "@/lib/i18n/context";
import { captureAcquisition, trackClickIfUTM } from "@/lib/acquisition";
import { track, startAutocapture, surfaceFor } from "@/lib/web-tracking";


function AffiliateRefTracker() {
  const searchParams = useSearchParams();
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      const code = ref.toUpperCase();
      localStorage.setItem("duupflow_ref", code);
      fetch("/api/affiliate/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }).catch(() => {});
    }
  }, [searchParams]);
  return null;
}

/**
 * Acquisition tracker — runs three side-effects on mount:
 *   1. captureAcquisition() — first-touch snapshot in localStorage
 *      (no-op if already captured), used at signup to write user_acquisition.
 *   2. trackClickIfUTM()    — sends a click ping to /api/track-click for
 *      the CURRENT URL's UTMs (throttled per UTM-combo per browser).
 *   3. Pushes UTM values to Microsoft Clarity as custom tags so the user
 *      can filter sessions/recordings by source / medium / campaign.
 */
function AcquisitionTracker() {
  const pathname = usePathname();
  useEffect(() => {
    // Acquisition is a MARKETING-site concern only — never record it on the
    // app (/dashboard, /admin, /affiliate). Keeps acquisition_clicks free of
    // logged-in /dashboard navigation that was inflating the "(direct)" bucket.
    if (surfaceFor(pathname) === "app") return;
    captureAcquisition();
    trackClickIfUTM();
  }, [pathname]);
  return null;
}

/**
 * Web behaviour tracker — all surfaces.
 * On every page view: emits page_viewed with the right surface
 * ("app" on /dashboard*, "marketing" on the LP) and starts the autocapture
 * listeners once (scroll_depth / click; their surface is computed per-event).
 * All events carry the same visitor_id as acquisition_clicks.
 */
function WebTracker() {
  const pathname = usePathname();
  useEffect(() => {
    startAutocapture(track);
    track("page_viewed", { path: pathname, surface: surfaceFor(pathname) });
  }, [pathname]);
  return null;
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Normalize a locale-prefixed pathname so the existing flags keep working.
  // "/fr/login" → "/login", "/en" → "/", "/dashboard/x" → "/dashboard/x"
  const stripLocale = (p: string): string => {
    const m = p.match(/^\/(fr|en)(\/.*)?$/);
    return m ? (m[2] ?? "/") : p;
  };
  const normalized = stripLocale(pathname);

  // The marketing Header is rendered here in ClientLayout — OUTSIDE the
  // [locale] route segment — so it must take its language from the URL.
  // Without this it falls back to the storage-driven provider and can show
  // FR nav labels on an /en page (and vice-versa). Non-locale routes
  // (/dashboard, /checkout, …) yield `undefined` → storage-driven mode,
  // which is what the dashboard's manual language toggle relies on.
  const localeMatch = pathname.match(/^\/(fr|en)(\/.*)?$/);
  const urlLocale: Locale | undefined = localeMatch ? (localeMatch[1] as Locale) : undefined;

  const isDashboard = normalized.startsWith("/dashboard");
  const isAuthPage = normalized.startsWith("/login") || normalized.startsWith("/register");
  const isAffiliatePage = pathname.startsWith("/affiliate") || pathname.startsWith("/admin");
  // Onboarding (multi-step wizard + welcome transition) is a standalone flow
  // — the marketing Header would crowd the centered card and break the
  // "fixed inset-0 / no-scroll" layout the wizard expects.
  const isOnboardingPage = normalized.startsWith("/onboarding");
  // Le studio (prototype générateur de reels) est un écran plein applicatif :
  // pas de header marketing ni de spacer.
  const isStudioPage = normalized.startsWith("/studio");
  // Checkout / paiement (Stripe launch + page de succès) : écran plein autonome,
  // pas de header marketing (l'ancienne navbar sombre).
  const isCheckout = normalized.startsWith("/checkout");
  // Les pages "Lunera" (thème clair) ont leur propre nav (pilule) + footer : pas de header global.
  const isLandingHome = normalized === "/";
  const isLunera = isLandingHome || normalized.startsWith("/blog") || normalized.startsWith("/capcut-alternative") || normalized.startsWith("/submagic-alternative") || normalized.startsWith("/demo-request") || normalized.startsWith("/pricing") || normalized.startsWith("/login") || normalized.startsWith("/register") || normalized.startsWith("/onboarding") || normalized.startsWith("/partners");
  const showHeader = !isDashboard && !isAuthPage && !isAffiliatePage && !isOnboardingPage && !isStudioPage && !isCheckout && !isLunera;

  return (
    <LanguageProvider initialLocale={urlLocale}>
    <>
      {/* ── Fixed background ── */}

      {/* La landing "Lunera" est un thème clair : base blanche, aucun fond sombre. */}
      {isLunera ? (
        <div className="fixed inset-0 -z-20 pointer-events-none" style={{ background: "#ffffff" }} />
      ) : (
        <>
          {/* Base: noir absolu partout (fixe, ne scrolle pas) */}
          <div className="fixed inset-0 -z-20 pointer-events-none" style={{ background: "#000000" }} />

          {/* Gradient fixe: noir absolu (haut) → bleu clair (bas), partie basse inchangée */}
          <div className="fixed inset-0 -z-20 pointer-events-none"
            style={{ background: "linear-gradient(180deg, #000000 0%, #000000 42%, #0c1c80 68%, #1535c0 80%, #2d6ae8 92%, #70b0f8 100%)" }} />

          {/* Grid overlay — hidden in top 35% */}
          <div className="fixed inset-0 -z-20 pointer-events-none"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "46px 46px",
              mask: "linear-gradient(180deg, transparent 0%, transparent 35%, black 55%)",
              WebkitMask: "linear-gradient(180deg, transparent 0%, transparent 35%, black 55%)",
            }} />

          {/* Dark overlay — bottom only */}
          <div className="fixed inset-0 -z-20 pointer-events-none"
            style={{ background: "linear-gradient(180deg, transparent 0%, transparent 40%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.55) 100%)" }} />
        </>
      )}


      <Suspense fallback={null}>
        <AffiliateRefTracker />
      </Suspense>
      <AcquisitionTracker />
      <WebTracker />
      {showHeader && <Header />}
      {/* Spacer clears the fixed header. */}
      {showHeader && <div className="h-16 sm:h-20" />}
      {children}
    </>
    </LanguageProvider>
  );
}

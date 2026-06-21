"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/Header";
import AnnouncementBar from "@/components/AnnouncementBar";
import { LanguageProvider, type Locale } from "@/lib/i18n/context";
import { captureAcquisition, trackClickIfUTM } from "@/lib/acquisition";

const LightPillar = dynamic(() => import("@/components/LightPillar"), { ssr: false });
const LogoPreloader = dynamic(() => import("@/components/LogoPreloader"), { ssr: false });

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
  useEffect(() => {
    captureAcquisition();
    trackClickIfUTM();
  }, []);
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
  const showHeader = !isDashboard && !isAuthPage && !isAffiliatePage && !isOnboardingPage;
  const isLanding = normalized === "/";

  return (
    <LanguageProvider initialLocale={urlLocale}>
    <>
      {/* ── Fixed background ── */}

      {/* Base: dark background everywhere */}
      <div className="fixed inset-0 -z-20 pointer-events-none" style={{ background: "#060c1e" }} />

      {/* Gradient: background gradient */}
      <div className="fixed inset-0 -z-20 pointer-events-none"
        style={{ background: "linear-gradient(180deg, transparent 0%, transparent 30%, #060c1e 50%, #0c1c80 68%, #1535c0 80%, #2d6ae8 92%, #70b0f8 100%)" }} />

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

      {/* Light Pillar — fixed, full viewport, only on landing page */}
      {isLanding && (
        <div className="fixed inset-0 -z-10 pointer-events-none"
          style={{
            mask: "linear-gradient(180deg, black 0%, black 40%, transparent 70%)",
            WebkitMask: "linear-gradient(180deg, black 0%, black 40%, transparent 70%)",
          }}>
          <LightPillar
            topColor="#818CF8"
            bottomColor="#6366F1"
            intensity={0.6}
            rotationSpeed={0.3}
            glowAmount={0.004}
            pillarWidth={3}
            pillarHeight={0.4}
            noiseIntensity={0.5}
            pillarRotation={-35}
            quality="medium"
            mixBlendMode="screen"
          />
        </div>
      )}

      <Suspense fallback={null}>
        <AffiliateRefTracker />
      </Suspense>
      <AcquisitionTracker />
      {showHeader && isLanding && <AnnouncementBar />}
      {showHeader && <Header />}
      {/* Spacer clears the fixed header (+ the announcement bar on the landing page). */}
      {showHeader && <div className={isLanding ? "h-[116px] sm:h-[132px]" : "h-20 sm:h-24"} />}
      {children}

      {/* Logo preloader — only on landing page */}
      {isLanding && <LogoPreloader duration={1.8} logoSize={90} />}
    </>
    </LanguageProvider>
  );
}

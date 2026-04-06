"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/Header";

const LightPillar = dynamic(() => import("@/components/LightPillar"), { ssr: false });
const LogoPreloader = dynamic(() => import("@/components/LogoPreloader"), { ssr: false });

const PROMO_TEXT = "À l'occasion de la nouvelle version plus optimale de DuupFlow mise à jour récemment — Profite de -15% sur ton abonnement avec le code FLOW15";

function PromoBar() {
  // Duplicate text for seamless infinite loop
  const items = Array(6).fill(PROMO_TEXT);
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] h-11 flex items-center overflow-hidden select-none"
      style={{ background: "linear-gradient(90deg,#4f46e5,#6366f1,#818cf8,#6366f1,#4f46e5)" }}
    >
      <div
        className="flex items-center gap-0 whitespace-nowrap"
        style={{
          animation: "promo-scroll 45s linear infinite",
          willChange: "transform",
        }}
      >
        {items.map((text, i) => (
          <span key={i} className="inline-flex items-center gap-3 px-10 text-[13.5px] font-medium text-white/90">
            <span className="text-white/40">✦</span>
            {text}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes promo-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

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

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isAffiliatePage = pathname.startsWith("/affiliate") || pathname.startsWith("/admin");
  const showHeader = !isDashboard && !isAuthPage && !isAffiliatePage;
  const isLanding = pathname === "/";

  return (
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
      {showHeader && <div className="hidden md:block"><PromoBar /></div>}
      {showHeader && <Header />}
      {showHeader && <div className="h-16 md:h-[calc(50px+5rem)]" />}
      {children}

      {/* Logo preloader — only on landing page */}
      {isLanding && <LogoPreloader duration={1.8} logoSize={90} />}
    </>
  );
}

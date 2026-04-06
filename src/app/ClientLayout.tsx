"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import Header from "@/components/Header";

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

  return (
    <>
      {/* ── Fixed background ── */}

      {/* Base: dark background everywhere */}
      <div className="fixed inset-0 -z-20 pointer-events-none" style={{ background: "#060c1e" }} />

      {/* Hero animated background — liquid pink/purple/magenta effect */}
      <div className="fixed inset-0 -z-20 pointer-events-none overflow-hidden">
        <style>{`
          @keyframes hero-spin{0%{transform:rotate(0deg) scale(1.5)}100%{transform:rotate(360deg) scale(1.5)}}
          @keyframes hero-drift-a{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(60px,-80px) scale(1.15)}66%{transform:translate(-50px,60px) scale(.9)}}
          @keyframes hero-drift-b{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(-70px,50px) scale(1.2)}66%{transform:translate(50px,-60px) scale(.85)}}
        `}</style>
        {/* Slowly rotating conic gradient — creates the streaked liquid bands */}
        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%]"
          style={{
            background: "conic-gradient(from 0deg at 50% 50%, #000 0deg, #ff1493 50deg, #000 100deg, #8b00ff 150deg, #ff00ff 200deg, #000 250deg, #d946ef 300deg, #000 360deg)",
            animation: "hero-spin 25s linear infinite",
            filter: "blur(60px)",
            opacity: 0.85,
          }} />
        {/* Pink glow overlay */}
        <div className="absolute top-[-10%] left-[5%] w-[60vw] h-[60vw] max-w-[750px] max-h-[750px] rounded-full"
          style={{ background:"radial-gradient(circle, rgba(255,20,147,0.7), transparent 60%)", filter:"blur(70px)", animation:"hero-drift-a 18s ease-in-out infinite" }} />
        {/* Purple glow overlay */}
        <div className="absolute top-[5%] right-[-5%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full"
          style={{ background:"radial-gradient(circle, rgba(139,0,255,0.6), transparent 55%)", filter:"blur(80px)", animation:"hero-drift-b 22s ease-in-out infinite 2s" }} />
        {/* White/bright intersection highlight */}
        <div className="absolute top-[0%] left-[25%] w-[35vw] h-[35vw] max-w-[420px] max-h-[420px] rounded-full"
          style={{ background:"radial-gradient(circle, rgba(255,255,255,0.4), transparent 50%)", filter:"blur(40px)", animation:"hero-drift-a 15s ease-in-out infinite 3s", mixBlendMode:"overlay" }} />
        {/* Magenta accent blob */}
        <div className="absolute top-[15%] left-[45%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full"
          style={{ background:"radial-gradient(circle, rgba(236,72,153,0.5), transparent 55%)", filter:"blur(75px)", animation:"hero-drift-b 20s ease-in-out infinite 4s" }} />
      </div>

      {/* Gradient: blobs fade into original gradient at ~50% */}
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

      <Suspense fallback={null}>
        <AffiliateRefTracker />
      </Suspense>
      {showHeader && <div className="hidden md:block"><PromoBar /></div>}
      {showHeader && <Header />}
      {showHeader && <div className="h-16 md:h-[calc(50px+5rem)]" />}
      {children}
    </>
  );
}

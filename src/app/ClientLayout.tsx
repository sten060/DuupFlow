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

      {/* Animated blobs — covers full viewport including behind header */}
      <div className="fixed inset-0 -z-20 pointer-events-none overflow-hidden">
        <style>{`
          @keyframes lg-a{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(50px,-70px) scale(1.1)}66%{transform:translate(-40px,50px) scale(.93)}}
          @keyframes lg-b{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(-60px,40px) scale(1.15)}66%{transform:translate(40px,-50px) scale(.9)}}
        `}</style>
        <div className="absolute top-[-15%] left-[0%] w-[65vw] h-[65vw] max-w-[800px] max-h-[800px] rounded-full blur-[80px]"
          style={{ background:"radial-gradient(circle,#1a3aab,transparent 70%)", animation:"lg-a 14s ease-in-out infinite" }} />
        <div className="absolute top-[0%] right-[-10%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full blur-[70px]"
          style={{ background:"radial-gradient(circle,#7c3aed,transparent 70%)", animation:"lg-b 18s ease-in-out infinite" }} />
        <div className="absolute top-[20%] left-[20%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] rounded-full blur-[90px]"
          style={{ background:"radial-gradient(circle,#2d5ce8,transparent 70%)", animation:"lg-a 20s ease-in-out infinite 2s" }} />
        <div className="absolute top-[-10%] left-[40%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full blur-[60px]"
          style={{ background:"radial-gradient(circle,rgba(112,176,248,0.8),transparent 70%)", animation:"lg-b 12s ease-in-out infinite 1s" }} />
        <div className="absolute top-[10%] left-[55%] w-[45vw] h-[45vw] max-w-[550px] max-h-[550px] rounded-full blur-[80px]"
          style={{ background:"radial-gradient(circle,rgba(99,102,241,0.9),transparent 70%)", animation:"lg-a 16s ease-in-out infinite 3s" }} />
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

"use client";

import { useEffect, useState } from "react";

interface LogoPreloaderProps {
  /** Duration in seconds the logo stays visible before animating out */
  duration?: number;
  /** Logo size in pixels */
  logoSize?: number;
  /** Background color */
  backgroundColor?: string;
}

export default function LogoPreloader({
  duration = 1.8,
  logoSize = 90,
  backgroundColor = "#060c1e",
}: LogoPreloaderProps) {
  // init → loading (logo slides up into view) → logoOut (logo slides up & fades) → done (unmount)
  const [phase, setPhase] = useState<"init" | "loading" | "logoOut" | "done">("init");

  useEffect(() => {
    const t0 = setTimeout(() => setPhase("loading"), 50);
    const t1 = setTimeout(() => setPhase("logoOut"), duration * 1000 + 50);
    const t2 = setTimeout(() => setPhase("done"), duration * 1000 + 800);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [duration]);

  if (phase === "done") return null;

  // Logo transform & opacity per phase
  let logoTranslateY = 0;
  let logoOpacity = 1;
  let logoScale = 1;
  if (phase === "init") {
    logoTranslateY = 60;
    logoOpacity = 0;
    logoScale = 0.9;
  } else if (phase === "loading") {
    logoTranslateY = 0;
    logoOpacity = 1;
    logoScale = 1;
  } else if (phase === "logoOut") {
    logoTranslateY = -50;
    logoOpacity = 0;
    logoScale = 0.95;
  }

  // Background fades out with logo
  const bgOpacity = phase === "logoOut" ? 0 : 1;

  // Glow intensity
  const glowOpacity = phase === "loading" ? 1 : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: backgroundColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "opacity 0.7s cubic-bezier(.7,.2,.2,1)",
        opacity: bgOpacity,
        pointerEvents: phase === "done" ? "none" : "all",
        zIndex: 99999,
        overflow: "hidden",
      }}
      aria-label="Loading"
      role="status"
    >
      {/* Glow effect behind logo */}
      <div
        style={{
          position: "absolute",
          width: logoSize * 3,
          height: logoSize * 3,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.35) 0%, rgba(129,140,248,0.15) 40%, transparent 70%)",
          filter: "blur(30px)",
          transition: "opacity 1s cubic-bezier(.7,.2,.2,1)",
          opacity: glowOpacity,
          pointerEvents: "none",
        }}
      />

      {/* Second glow layer — purple accent */}
      <div
        style={{
          position: "absolute",
          width: logoSize * 2.5,
          height: logoSize * 2.5,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,58,237,0.25) 0%, rgba(99,102,241,0.1) 50%, transparent 70%)",
          filter: "blur(20px)",
          transition: "opacity 1s cubic-bezier(.7,.2,.2,1)",
          opacity: glowOpacity,
          pointerEvents: "none",
        }}
      />

      {/* Logo image */}
      <img
        src="/logo.svg"
        alt="DuupFlow"
        style={{
          width: logoSize,
          height: logoSize,
          objectFit: "contain",
          transition: "all 0.7s cubic-bezier(.7,.2,.2,1)",
          transform: `translateY(${logoTranslateY}px) scale(${logoScale})`,
          opacity: logoOpacity,
          willChange: "transform, opacity",
          userSelect: "none",
          position: "relative",
          zIndex: 1,
        }}
        draggable={false}
      />
    </div>
  );
}

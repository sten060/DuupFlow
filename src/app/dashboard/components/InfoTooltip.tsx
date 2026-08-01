// src/app/dashboard/components/InfoTooltip.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Infobulle qui s’ouvre UNIQUEMENT au survol du “i”
 * et se rend dans <body> (portail) en position fixed
 * => toujours au-dessus de tout (aucun stacking context).
 */
export default function InfoTooltip({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const iconRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // calcule la position quand on ouvre / quand on scroll/resize
  useEffect(() => {
    if (!open || !iconRef.current) return;
    const compute = () => {
      const r = iconRef.current!.getBoundingClientRect();
      setPos({
        x: r.right,        // bulle alignée à droite du “i”
        y: r.bottom + 8,   // 8px sous le “i”
      });
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [open]);

  return (
    <span className={`relative inline-flex ${className}`}>
      {/* Icône “i” — seule zone réactive */}
      <span
        ref={iconRef}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="ml-2 inline-flex h-5 w-5 cursor-default select-none items-center justify-center
                   rounded-full border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] text-[10px] text-[var(--app-text-muted)]
                   hover:bg-[var(--app-surface-2)] transition"
      >
        i
      </span>

      {/* Bulle rendue dans <body> pour passer AU-DESSUS DE TOUT */}
      {mounted && open && pos
        ? createPortal(
            <div
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => setOpen(false)}
              style={{ left: pos.x, top: pos.y }}
              className="fixed z-[2147483647] w-[320px] -translate-x-full rounded-xl border border-[var(--app-border)]
                         bg-[var(--app-surface)] p-3 text-[12px] leading-relaxed text-[var(--app-text-muted)]
                         shadow-[0_10px_30px_rgba(0,0,0,.45)] backdrop-blur-md pointer-events-auto"
            >
              {children}
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
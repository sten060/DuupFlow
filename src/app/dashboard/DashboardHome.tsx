"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const G = "bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent";

const MODULES = [
  {
    href: "/dashboard/images",
    title: "Duplication Images",
    desc: "Génère des copies uniques de chaque image — métadonnées EXIF/XMP, micro-variations visuelles, export en lot.",
    badge: null,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
    color: "#C026D3",
    colorBg: "rgba(192,38,211,0.10)",
    colorBorder: "rgba(192,38,211,0.22)",
  },
  {
    href: "/dashboard/videos",
    title: "Duplication Vidéos",
    desc: "Ré-encode chaque copie vidéo avec des paramètres uniques — FPS, GOP, bitrate, codec. Indétectable.",
    badge: null,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="5" width="14" height="14" rx="2" />
        <path d="M16 9l5-3v12l-5-3V9z" />
      </svg>
    ),
    color: "#6366F1",
    colorBg: "rgba(99,102,241,0.10)",
    colorBorder: "rgba(99,102,241,0.22)",
  },
  {
    href: "/dashboard/similarity",
    title: "Comparateur",
    desc: "Mesure la similarité visuelle entre deux fichiers. Score précis pour valider l'indétectabilité.",
    badge: null,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
    color: "#10B981",
    colorBg: "rgba(16,185,129,0.10)",
    colorBorder: "rgba(16,185,129,0.22)",
  },
  {
    href: "/dashboard/generate",
    title: "Variation IA",
    desc: "Crée des variantes automatiques de tes contenus grâce à l'intelligence artificielle.",
    badge: "BETA",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
      </svg>
    ),
    color: "#38BDF8",
    colorBg: "rgba(56,189,248,0.10)",
    colorBorder: "rgba(56,189,248,0.22)",
  },
  {
    href: "/dashboard/ai-detection",
    title: "Détection IA",
    desc: "Masque la signature IA dans les métadonnées. Aucune modification visuelle du fichier.",
    badge: null,
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    color: "#F59E0B",
    colorBg: "rgba(245,158,11,0.10)",
    colorBorder: "rgba(245,158,11,0.22)",
  },
];

function ModuleCard({ mod, index, revealed }: {
  mod: typeof MODULES[0];
  index: number;
  revealed: boolean;
}) {
  return (
    <div
      className="group rounded-2xl p-5 flex flex-col gap-4 transition-all duration-300 hover:translate-y-[-2px]"
      style={{
        background: "rgba(10,14,40,0.55)",
        border: "1px solid rgba(255,255,255,0.07)",
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateY(0)" : "translateY(12px)",
        transitionDelay: `${index * 70}ms`,
        transitionProperty: "opacity, transform, box-shadow",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = mod.colorBorder;
        (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${mod.colorBg}`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Icon + badge */}
      <div className="flex items-start justify-between">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center"
          style={{ background: mod.colorBg, border: `1px solid ${mod.colorBorder}`, color: mod.color }}
        >
          {mod.icon}
        </div>
        {mod.badge && (
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-md tracking-wide"
            style={{ background: "rgba(56,189,248,0.10)", color: "#38BDF8", border: "1px solid rgba(56,189,248,0.22)" }}
          >
            {mod.badge}
          </span>
        )}
      </div>

      {/* Text */}
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-white mb-1.5">{mod.title}</h3>
        <p className="text-xs text-white/45 leading-relaxed">{mod.desc}</p>
      </div>

      {/* CTA */}
      <Link
        href={mod.href}
        className="inline-flex items-center gap-1.5 self-start text-xs font-semibold transition-all group-hover:gap-2"
        style={{ color: mod.color }}
      >
        Ouvrir
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      </Link>
    </div>
  );
}

export default function DashboardHome({
  firstName,
  agencyName,
}: {
  firstName: string | null;
  agencyName: string | null;
}) {
  const [revealed, setRevealed] = useState(false);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    // Stagger reveal
    const t = setTimeout(() => setRevealed(true), 80);

    // Show tour overlay only on first visit
    const key = `duupflow_toured`;
    if (!localStorage.getItem(key)) {
      setShowTour(true);
    }
    return () => clearTimeout(t);
  }, []);

  function dismissTour() {
    localStorage.setItem("duupflow_toured", "1");
    setShowTour(false);
  }

  return (
    <div className="p-8 max-w-5xl">

      {/* Header */}
      <div
        className="mb-8 transition-all duration-500"
        style={{ opacity: revealed ? 1 : 0, transform: revealed ? "none" : "translateY(8px)" }}
      >
        <p className="text-xs font-medium text-white/30 tracking-[0.14em] uppercase mb-2">
          {agencyName ?? "Dashboard"}
        </p>
        <h1 className="text-3xl font-semibold text-white tracking-tight">
          {firstName ? (
            <>Bonjour, <span className={G}>{firstName}</span> 👋</>
          ) : (
            <>Tableau de bord</>
          )}
        </h1>
        <p className="text-sm text-white/40 mt-1.5">
          Choisis un module pour travailler tes contenus.
        </p>
      </div>

      {/* Separator */}
      <div className="mb-7" style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />

      {/* Section label */}
      <p
        className="text-[11px] font-semibold tracking-[0.14em] uppercase text-white/25 mb-4 transition-all duration-500"
        style={{ opacity: revealed ? 1 : 0, transitionDelay: "100ms" }}
      >
        Modules disponibles
      </p>

      {/* Module grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {MODULES.map((mod, i) => (
          <ModuleCard key={mod.href} mod={mod} index={i} revealed={revealed} />
        ))}
      </div>

      {/* First-visit tour overlay */}
      {showTour && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(6,9,24,0.85)", backdropFilter: "blur(8px)" }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-8 text-center"
            style={{
              background: "rgba(10,14,40,0.97)",
              border: "1px solid rgba(99,102,241,0.25)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(99,102,241,0.10)",
            }}
          >
            {/* Icon */}
            <div
              className="mx-auto mb-5 h-14 w-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.30)" }}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>

            <h2 className="text-xl font-semibold text-white mb-2 tracking-tight">
              Bienvenue dans DuupFlow
            </h2>
            <p className="text-sm text-white/50 mb-6 leading-relaxed">
              Tu as accès à <strong className="text-white/70">5 modules</strong> pour dupliquer,
              analyser et masquer tes contenus. Commence par le module de ton choix.
            </p>

            {/* Mini module list */}
            <div className="space-y-2 mb-7 text-left">
              {MODULES.map((m) => (
                <div key={m.href} className="flex items-center gap-3 text-xs text-white/55">
                  <span style={{ color: m.color }}>{m.icon}</span>
                  <span className="font-medium text-white/70">{m.title}</span>
                  <span className="text-white/30">—</span>
                  <span className="truncate">{m.desc.split(".")[0]}</span>
                </div>
              ))}
            </div>

            <button
              onClick={dismissTour}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
            >
              C&apos;est parti →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

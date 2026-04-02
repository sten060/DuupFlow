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

/* ─── Guide steps ─── */
const GUIDE_STEPS = [
  {
    id: "intro",
    title: "Bienvenue dans DuupFlow 🚀",
    subtitle: "Guide de démarrage",
    content:
      "En 2 minutes, découvre les 5 modules qui vont transformer ta stratégie de contenu. Tu peux revenir sur ce guide à tout moment.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    iconBg: "rgba(99,102,241,0.15)",
    iconBorder: "rgba(99,102,241,0.30)",
    moduleIndex: null,
    cta: { label: "Commencer →", href: null },
  },
  {
    id: "images",
    title: "Duplication Images",
    subtitle: "Étape 1 / 5 — Le cœur de DuupFlow",
    content:
      "Génère des copies uniques avec métadonnées EXIF/XMP aléatoires. Active la Priorité d'algorithme pour injecter des EXIF Apple authentiques (appareil, GPS, focale). Ajoute une localisation pays pour un réalisme total.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
    iconBg: "rgba(192,38,211,0.15)",
    iconBorder: "rgba(192,38,211,0.30)",
    moduleIndex: 0,
    cta: { label: "Essayer maintenant →", href: "/dashboard/images" },
  },
  {
    id: "videos",
    title: "Duplication Vidéos",
    subtitle: "Étape 2 / 5 — Vos vidéos rendues uniques",
    content:
      "Ré-encode chaque copie avec des paramètres uniques. Nouveautés : Priorité d'algorithme (métadonnées iPhone .mov), Pixel magique (hash unique par frame), Métadonnées technique (bitrate, GOP, FPS, profil H.264). Qualité 4K préservée.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="5" width="14" height="14" rx="2" />
        <path d="M16 9l5-3v12l-5-3V9z" />
      </svg>
    ),
    iconBg: "rgba(99,102,241,0.15)",
    iconBorder: "rgba(99,102,241,0.30)",
    moduleIndex: 1,
    cta: { label: "Essayer maintenant →", href: "/dashboard/videos" },
  },
  {
    id: "comparateur",
    title: "Comparateur de similarité",
    subtitle: "Étape 3 / 5 — Valide tes copies",
    content:
      "Compare deux fichiers côte à côte avec analyse ffprobe complète. Score de similarité en pourcentage, différences surlignées en vert. Glisse tes fichiers en drag & drop pour une vérification instantanée.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
    iconBg: "rgba(16,185,129,0.15)",
    iconBorder: "rgba(16,185,129,0.30)",
    moduleIndex: 2,
    cta: { label: "Essayer maintenant →", href: "/dashboard/similarity" },
  },
  {
    id: "ia",
    title: "Variation IA & Détection IA",
    subtitle: "Étapes 4 & 5 / 5 — La puissance de l'IA",
    content:
      "La Détection IA efface toutes les signatures IA (EXIF, XMP, IPTC, C2PA) et les remplace par une identité humaine réaliste. Ton contenu IA passe pour un contenu créé par un humain. Le module Variation IA arrive bientôt.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7 text-sky-400" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
      </svg>
    ),
    iconBg: "rgba(56,189,248,0.15)",
    iconBorder: "rgba(56,189,248,0.30)",
    moduleIndex: 3,
    cta: { label: "Explorer l'IA →", href: "/dashboard/generate" },
  },
  {
    id: "invite",
    title: "Inviter un collaborateur",
    subtitle: "Bonus — Travaille en équipe",
    content:
      "Depuis les Paramètres, invite jusqu'à 3 collaborateurs dans ton workspace. Ils accèdent à tous les modules sans frais supplémentaires.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7 text-amber-400" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    iconBg: "rgba(245,158,11,0.15)",
    iconBorder: "rgba(245,158,11,0.30)",
    moduleIndex: null,
    cta: { label: "Gérer l'équipe →", href: "/dashboard/settings" },
  },
];

const GUIDE_KEY = "duupflow_guide_v2";

function ModuleCard({ mod }: { mod: typeof MODULES[0] }) {
  return (
    <Link
      href={mod.href}
      className="group relative rounded-2xl p-5 transition-all overflow-hidden"
      style={{
        background: mod.colorBg.replace("0.10", "0.04"),
        border: `1px solid ${mod.colorBorder.replace("0.22", "0.15")}`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = mod.colorBorder;
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${mod.colorBg}`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = mod.colorBorder.replace("0.22", "0.15");
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Radial glow on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
           style={{ background: `radial-gradient(400px at 30% 20%, ${mod.colorBg}, transparent 70%)` }} />

      <div className="relative flex items-start gap-4">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: mod.colorBg, border: `1px solid ${mod.colorBorder}`, color: mod.color }}
        >
          {mod.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white/90">{mod.title}</h3>
            {mod.badge && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide"
                style={{ background: "rgba(56,189,248,0.10)", color: "#38BDF8", border: "1px solid rgba(56,189,248,0.22)" }}
              >
                {mod.badge}
              </span>
            )}
          </div>
          <p className="text-xs text-white/45 mt-1 leading-relaxed">{mod.desc}</p>
        </div>
        <span className="text-sm opacity-0 group-hover:opacity-100 transition shrink-0 mt-1" style={{ color: mod.color }}>→</span>
      </div>
    </Link>
  );
}

/* ─── Guide Modal ─── */
function GuideModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = GUIDE_STEPS[step];
  const isLast = step === GUIDE_STEPS.length - 1;
  const progress = ((step) / (GUIDE_STEPS.length - 1)) * 100;

  function next() {
    if (isLast) {
      onClose();
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(6,9,24,0.88)", backdropFilter: "blur(10px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: "rgba(10,14,40,0.98)",
          border: "1px solid rgba(99,102,241,0.25)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(99,102,241,0.10)",
        }}
      >
        {/* Progress bar */}
        <div className="h-0.5 w-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg,#6366F1,#38BDF8)",
            }}
          />
        </div>

        <div className="p-8">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-white/30">
              {current.subtitle}
            </span>
            <button
              onClick={onClose}
              className="text-xs text-white/30 hover:text-white/60 transition"
            >
              Passer ×
            </button>
          </div>

          {/* Icon */}
          <div
            className="mb-5 h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: current.iconBg, border: `1px solid ${current.iconBorder}` }}
          >
            {current.icon}
          </div>

          {/* Content */}
          <h2 className="text-xl font-semibold text-white mb-3 tracking-tight">
            {current.title}
          </h2>
          <p className="text-sm text-white/55 leading-relaxed mb-7">
            {current.content}
          </p>

          {/* Step dots */}
          <div className="flex items-center gap-1.5 mb-6">
            {GUIDE_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === step ? "20px" : "6px",
                  height: "6px",
                  background: i === step
                    ? "linear-gradient(90deg,#6366F1,#38BDF8)"
                    : i < step
                    ? "rgba(99,102,241,0.5)"
                    : "rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {current.cta.href ? (
              <Link
                href={current.cta.href}
                onClick={onClose}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white text-center transition hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
              >
                {current.cta.label}
              </Link>
            ) : null}
            <button
              onClick={next}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition"
              style={{
                background: current.cta.href ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#6366F1,#38BDF8)",
                border: current.cta.href ? "1px solid rgba(255,255,255,0.10)" : "none",
                color: current.cta.href ? "rgba(255,255,255,0.65)" : "white",
              }}
            >
              {isLast ? "Terminer ✓" : "Étape suivante →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── News Modal ─── */
const NEWS_SECTIONS = [
  {
    title: "Duplication Vidéo",
    color: "#6366F1",
    items: [
      { name: "Priorité d'algorithme", desc: "Simule un iPhone réel (métadonnées Apple, .mov)" },
      { name: "Pixel magique", desc: "Bruit imperceptible pour hash unique" },
      { name: "Métadonnées technique", desc: "Bitrate, GOP, FPS, profil H.264 aléatoires" },
      { name: "Localisation pays", desc: "Injecte le pays dans les métadonnées" },
      { name: "Qualité originale préservée", desc: "Plus de cap 1920px, 4K reste 4K" },
    ],
  },
  {
    title: "Duplication Image",
    color: "#C026D3",
    items: [
      { name: "Priorité d'algorithme", desc: "EXIF Apple authentiques (appareil, GPS, focale)" },
      { name: "Localisation pays", desc: "Pays injecté dans l'EXIF" },
    ],
  },
  {
    title: "Comparateur",
    color: "#10B981",
    items: [
      { name: "Analyse ffprobe", desc: "Compare les métadonnées exactes de deux fichiers" },
      { name: "Score de similarité", desc: "Pourcentage de ressemblance" },
      { name: "Drag & drop", desc: "Glisse tes fichiers directement" },
    ],
  },
  {
    title: "Support",
    color: "#F59E0B",
    items: [
      { name: "Chatbot intelligent", desc: "Assistance instantanée avec FAQ complète" },
      { name: "Page Support", desc: "Telegram + Email en un clic" },
    ],
  },
];

function NewsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(6,9,24,0.88)", backdropFilter: "blur(10px)" }}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "rgba(10,14,40,0.98)",
          border: "1px solid rgba(56,189,248,0.25)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(56,189,248,0.10)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-7 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">Nouveautés</h2>
            <p className="text-xs text-white/40 mt-1">Les dernières fonctionnalités de DuupFlow</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/60 transition h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/5"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6">
          {NEWS_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3
                className="text-sm font-semibold mb-3 flex items-center gap-2"
                style={{ color: section.color }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: section.color }}
                />
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div
                    key={item.name}
                    className="rounded-lg px-4 py-2.5 text-sm"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <span className="font-medium text-white/85">{item.name}</span>
                    <span className="text-white/40"> — {item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
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
  const [showGuide, setShowGuide] = useState(false);
  const [showNews, setShowNews] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(GUIDE_KEY)) {
      setShowGuide(true);
    }
  }, []);

  function closeGuide() {
    localStorage.setItem(GUIDE_KEY, "1");
    setShowGuide(false);
  }

  return (
    <div className="p-8 w-full">

      {/* Header */}
      <div className="mb-8">
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
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-sm text-white/40">
            Choisis un module pour travailler tes contenus.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNews(true)}
              className="text-xs text-sky-400/70 hover:text-sky-400 transition flex items-center gap-1"
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zM5 5h6M5 8h6M5 11h3" />
              </svg>
              Nouveautés
            </button>
            <button
              onClick={() => setShowGuide(true)}
              className="text-xs text-indigo-400/70 hover:text-indigo-400 transition flex items-center gap-1"
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 7v4M8 5.5v.5" />
              </svg>
              Guide
            </button>
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="mb-7" style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />

      {/* Section label */}
      <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-white/25 mb-4">
        Modules disponibles
      </p>

      {/* Module grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((mod) => (
          <ModuleCard key={mod.href} mod={mod} />
        ))}
      </div>

      {/* Guide modal */}
      {showGuide && <GuideModal onClose={closeGuide} />}

      {/* News modal */}
      {showNews && <NewsModal onClose={() => setShowNews(false)} />}
    </div>
  );
}

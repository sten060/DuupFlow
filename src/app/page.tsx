"use client";

import Link from "next/link";
import { useState } from "react";

/* ─── tiny helpers ─── */
const G = "bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent";

/* ═══════════════════════════════════════════════════════
 * SECTION 1 — HERO
 * ═══════════════════════════════════════════════════════ */
function Hero() {
  return (
    <section className="relative flex flex-col items-center text-center px-6 pt-28 pb-24 overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full opacity-20"
          style={{ background: "radial-gradient(ellipse, #5B5BEA 0%, transparent 70%)" }} />
        <div className="absolute top-20 right-1/4 w-[400px] h-[300px] rounded-full opacity-10"
          style={{ background: "radial-gradient(ellipse, #38BDF8 0%, transparent 70%)" }} />
      </div>

      {/* Badge pill */}
      <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-1.5 text-sm text-white/70">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Nouveau — Module Détection IA disponible
        <span className="text-white/40">→</span>
      </div>

      {/* Headline */}
      <h1 className="max-w-3xl text-5xl md:text-[4rem] font-bold leading-[1.08] tracking-tight text-white mb-5">
        Le seul outil pour dupliquer ton contenu{" "}
        <span className={G}>en illimité.</span>
      </h1>

      {/* Sub headline */}
      <p className="max-w-xl text-white/55 text-lg mb-9 leading-relaxed">
        DuupFlow modifie automatiquement les métadonnées de tes images et vidéos.
        Réutilise le même contenu, encore et encore — chaque fichier est unique aux yeux des plateformes.
      </p>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-3 mb-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 font-semibold text-white text-sm transition hover:opacity-90 hover:-translate-y-0.5"
          style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
        >
          Accéder à DuupFlow →
        </Link>
        <a
          href="#features"
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-7 py-3.5 font-medium text-sm text-white/80 hover:bg-white/[0.08] transition"
        >
          Voir les fonctionnalités
        </a>
      </div>

      {/* Social proof */}
      <p className="text-xs text-white/30 tracking-wide uppercase">
        Utilisé par 500+ agences marketing &amp; créateurs de contenu
      </p>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
 * SECTION 2 — FEATURE TABS (large dashboard mockup)
 * ═══════════════════════════════════════════════════════ */
const TABS = [
  { id: "images", label: "Duplication Images" },
  { id: "videos", label: "Duplication Vidéos" },
  { id: "comparator", label: "Comparateur" },
  { id: "ai", label: "Détection IA" },
];

function MockupImages() {
  const files = [
    { name: "DuupFlow_20240312_dup1_47.jpg", size: "2.4 MB", color: "bg-fuchsia-500/20 border-fuchsia-500/30" },
    { name: "DuupFlow_20240312_dup2_83.jpg", size: "2.4 MB", color: "bg-indigo-500/20 border-indigo-500/30" },
    { name: "DuupFlow_20240312_dup3_12.jpg", size: "2.4 MB", color: "bg-pink-500/20 border-pink-500/30" },
    { name: "DuupFlow_20240312_dup4_55.jpg", size: "2.4 MB", color: "bg-violet-500/20 border-violet-500/30" },
  ];
  return (
    <div className="space-y-3">
      {/* top bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-white/50">4 copies générées</span>
        </div>
        <span className="text-xs text-white/30">original.jpg → 4 duplicates</span>
      </div>
      {/* source file */}
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-white/[0.08] flex items-center justify-center text-lg">🖼️</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/80 font-medium truncate">photo_instagram.jpg</p>
          <p className="text-xs text-white/35">Fichier source · 2.4 MB</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/[0.04] text-white/50">Source</span>
      </div>
      {/* arrow */}
      <div className="flex justify-center py-1">
        <svg className="h-5 w-5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
      </div>
      {/* duplicates */}
      {files.map((f) => (
        <div key={f.name} className={`rounded-xl border p-3 flex items-center gap-3 ${f.color}`}>
          <div className="h-10 w-10 rounded-lg bg-white/[0.08] flex items-center justify-center text-sm">📄</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/70 font-mono truncate">{f.name}</p>
            <p className="text-xs text-white/35">Métadonnées modifiées · {f.size}</p>
          </div>
          <svg className="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
      ))}
    </div>
  );
}

function MockupVideos() {
  const steps = [
    { label: "Import", pct: 100, color: "bg-indigo-500" },
    { label: "Ré-encodage", pct: 100, color: "bg-fuchsia-500" },
    { label: "Métadonnées", pct: 100, color: "bg-emerald-500" },
    { label: "Export ZIP", pct: 85, color: "bg-amber-500" },
  ];
  const files = [
    "SIMPLE_DuupFlow_20240312_vid1_c01_r8f2p__reel.mp4",
    "SIMPLE_DuupFlow_20240312_vid1_c02_r9a3k__reel.mp4",
    "SIMPLE_DuupFlow_20240312_vid1_c03_r2x7m__reel.mp4",
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
        <p className="text-xs text-white/40 uppercase tracking-wider">Pipeline d'encodage</p>
        {steps.map((s) => (
          <div key={s.label} className="space-y-1">
            <div className="flex justify-between text-xs text-white/50">
              <span>{s.label}</span>
              <span>{s.pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {files.map((f, i) => (
          <div key={f} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 flex items-center gap-2">
            <span className="text-base">🎬</span>
            <p className="text-xs text-white/50 font-mono flex-1 min-w-0 truncate">{f}</p>
            <span className="text-xs text-emerald-400">✓</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockupComparator() {
  return (
    <div className="space-y-4">
      {/* two file cards */}
      <div className="grid grid-cols-2 gap-3">
        {["contenu_A.mp4", "contenu_B.mp4"].map((name, i) => (
          <div key={name} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
            <div className="h-16 rounded-lg bg-white/[0.06] flex items-center justify-center text-2xl mb-2">
              {i === 0 ? "🎬" : "📹"}
            </div>
            <p className="text-xs text-white/50 truncate">{name}</p>
          </div>
        ))}
      </div>
      {/* result */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5 text-center">
        <div className="text-4xl font-bold text-emerald-400 mb-1">18%</div>
        <p className="text-sm text-white/60 mb-3">de similarité détectée</p>
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 w-[18%]" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[["pHash", "12%"], ["Couleur", "24%"], ["Méta", "18%"]].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
            <p className="text-xs text-white/35">{k}</p>
            <p className="text-sm font-semibold text-white/70">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockupAI() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-4">
        <p className="text-xs text-amber-400 font-medium mb-3 flex items-center gap-1.5">
          <span>⚡</span> Signature IA injectée
        </p>
        <div className="space-y-2">
          {[
            ["Software", "Midjourney v6.1"],
            ["Artist", "Midjourney Bot"],
            ["Creator", "midjourney.com"],
            ["DigitalSourceType", "trainedAlgorithmicMedia"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs">
              <span className="text-white/40 font-mono">{k}</span>
              <span className="text-amber-300 font-mono">{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] p-4">
        <p className="text-xs text-emerald-400 font-medium mb-3 flex items-center gap-1.5">
          <span>🛡️</span> Signature IA masquée
        </p>
        <div className="space-y-2">
          {[
            ["Software", "Adobe Lightroom 7.2"],
            ["Make", "Sony"],
            ["Model", "A7 IV"],
            ["Artist", "Sophie Renaud"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs">
              <span className="text-white/40 font-mono">{k}</span>
              <span className="text-emerald-300 font-mono">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const MOCKUPS: Record<string, React.ReactNode> = {
  images: <MockupImages />,
  videos: <MockupVideos />,
  comparator: <MockupComparator />,
  ai: <MockupAI />,
};

const TAB_DESCS: Record<string, { title: string; desc: string }> = {
  images: {
    title: "Duplication d'images sans limite",
    desc: "Importe n'importe quelle image, choisis le nombre de copies, et DuupFlow génère autant de fichiers uniques que tu veux — avec des métadonnées différentes à chaque fois.",
  },
  videos: {
    title: "Vidéos ré-encodées, indétectables",
    desc: "Chaque copie est ré-encodée avec des paramètres légèrement différents (FPS, GOP, bitrate, codec). Aux yeux d'Instagram ou TikTok, c'est un nouveau fichier.",
  },
  comparator: {
    title: "Mesure la différence entre deux contenus",
    desc: "Compare deux fichiers et obtiens un score de similarité précis. Plus le % est bas, plus les contenus sont différents — et plus tu es protégé contre les filtres de duplication.",
  },
  ai: {
    title: "Contrôle la signature IA de ton contenu",
    desc: "Masque les traces d'une génération IA pour faire paraître un contenu humain. Ou injecte les métadonnées d'une plateforme IA connue. Uniquement dans les métadonnées — aucune modification visuelle.",
  },
};

function FeatureTabs() {
  const [active, setActive] = useState("images");
  const desc = TAB_DESCS[active];

  return (
    <section className="px-6 pb-24">
      <div className="max-w-5xl mx-auto">
        {/* Tab bar */}
        <div className="flex overflow-x-auto gap-1 p-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] mb-8 scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={[
                "flex-1 min-w-max rounded-xl px-4 py-2.5 text-sm font-medium transition whitespace-nowrap",
                active === t.id
                  ? "bg-white/[0.10] text-white border border-white/15"
                  : "text-white/45 hover:text-white/70",
              ].join(" ")}
            >
              {t.label}
              {t.id === "ai" && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/25 font-semibold">NEW</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="grid md:grid-cols-[1fr_360px] gap-8 items-start">
          {/* Left - description */}
          <div className="py-4">
            <h3 className="text-2xl font-bold text-white mb-3">{desc.title}</h3>
            <p className="text-white/55 leading-relaxed mb-6">{desc.desc}</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition"
            >
              Essayer maintenant →
            </Link>
          </div>

          {/* Right - mockup */}
          <div className="rounded-2xl border border-white/[0.10] bg-white/[0.025] p-5 backdrop-blur-sm">
            {MOCKUPS[active]}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
 * SECTION 3 — CORE FEATURES GRID
 * ═══════════════════════════════════════════════════════ */
function FeatureCard({
  icon,
  title,
  desc,
  mockup,
  accent,
}: {
  icon: string;
  title: string;
  desc: string;
  mockup: React.ReactNode;
  accent: string;
}) {
  return (
    <div className={`rounded-2xl border bg-white/[0.025] overflow-hidden flex flex-col ${accent}`}>
      {/* Visual mockup area */}
      <div className="p-5 border-b border-white/[0.06] bg-white/[0.02] min-h-[200px] flex items-center justify-center">
        <div className="w-full">{mockup}</div>
      </div>
      {/* Text */}
      <div className="p-5">
        <div className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.05] flex items-center justify-center text-lg mb-3">
          {icon}
        </div>
        <h3 className="font-semibold text-white text-base mb-1.5">{title}</h3>
        <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function MiniMetaMockup() {
  return (
    <div className="space-y-2 text-xs font-mono">
      <div className="flex gap-2 items-center">
        <span className="text-red-400 line-through opacity-60">Software: higgsfield.ai/v2.1</span>
      </div>
      <div className="flex gap-2 items-center">
        <span className="text-emerald-400">Software: Adobe Lightroom 7.2</span>
        <span className="text-[10px] text-white/30 ml-auto">↺ remplacé</span>
      </div>
      <div className="h-px bg-white/[0.06] my-2" />
      <div className="flex gap-2 items-center">
        <span className="text-red-400 line-through opacity-60">Artist: Runway ML</span>
      </div>
      <div className="flex gap-2 items-center">
        <span className="text-emerald-400">Artist: Sophie Renaud</span>
        <span className="text-[10px] text-white/30 ml-auto">↺ remplacé</span>
      </div>
    </div>
  );
}

function MiniSimilarityMockup() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {["A.jpg", "B.jpg"].map((n) => (
          <div key={n} className="rounded-lg border border-white/[0.08] bg-white/[0.04] h-16 flex items-center justify-center text-2xl">
            🖼️
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-3 text-center">
        <span className="text-2xl font-bold text-emerald-400">12%</span>
        <p className="text-xs text-white/40 mt-0.5">de similarité · Très différents</p>
      </div>
    </div>
  );
}

function MiniVideoDupMockup() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-3 flex items-center gap-2">
        <span className="text-base">🎬</span>
        <div className="flex-1">
          <div className="text-xs text-white/60">reel_original.mp4</div>
          <div className="h-1 rounded bg-white/[0.06] mt-1.5 overflow-hidden">
            <div className="h-full w-full bg-indigo-500 rounded" />
          </div>
        </div>
        <span className="text-xs text-white/30">Source</span>
      </div>
      {["c01", "c02", "c03"].map((c) => (
        <div key={c} className="rounded-lg border border-indigo-500/20 bg-indigo-500/[0.04] p-3 flex items-center gap-2">
          <span className="text-base">📹</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white/50 font-mono truncate">SIMPLE_DuupFlow_.._{c}.mp4</div>
          </div>
          <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
      ))}
    </div>
  );
}

function MiniImageDupMockup() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-3 flex items-center gap-2">
        <span className="text-base">🖼️</span>
        <div className="flex-1">
          <div className="text-xs text-white/60">photo_feed.jpg</div>
        </div>
        <span className="text-xs text-white/30">Source</span>
      </div>
      {[
        { tag: "dup1", color: "border-fuchsia-500/25 bg-fuchsia-500/[0.04]" },
        { tag: "dup2", color: "border-pink-500/25 bg-pink-500/[0.04]" },
        { tag: "dup3", color: "border-violet-500/25 bg-violet-500/[0.04]" },
      ].map(({ tag, color }) => (
        <div key={tag} className={`rounded-lg border p-3 flex items-center gap-2 ${color}`}>
          <span className="text-base">📸</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white/50 font-mono truncate">DuupFlow_20240312_{tag}_47.jpg</div>
          </div>
          <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
      ))}
    </div>
  );
}

function CoreFeatures() {
  return (
    <section id="features" className="px-6 pb-28">
      <div className="max-w-5xl mx-auto">
        {/* Label */}
        <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3">
          Fonctionnalités clés
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
          Tout ce dont tu as besoin pour scaler<br className="hidden md:block" /> ton contenu sans jamais être détecté.
        </h2>
        <p className="text-white/45 text-base mb-14 max-w-xl">
          DuupFlow réunit en un seul outil la duplication d'images, de vidéos, la comparaison de similarité et le contrôle des métadonnées IA.
        </p>

        {/* 2×2 grid */}
        <div className="grid md:grid-cols-2 gap-5">
          <FeatureCard
            icon="🖼️"
            title="Duplication d'images illimitée"
            desc="Charge une image, génère autant de copies que tu veux avec des métadonnées EXIF/XMP uniques, des micro-variations visuelles imperceptibles et un ICC profile différent. Chaque fichier est détecté comme nouveau par les algorithmes."
            mockup={<MiniImageDupMockup />}
            accent="border-fuchsia-500/20"
          />
          <FeatureCard
            icon="🎬"
            title="Duplication vidéo avancée"
            desc="Ré-encode tes vidéos avec des paramètres différents à chaque copie — FPS, GOP, bitrate, codec, couleur. Le contenu visuel reste identique, mais la signature numérique du fichier est entièrement distincte."
            mockup={<MiniVideoDupMockup />}
            accent="border-indigo-500/20"
          />
          <FeatureCard
            icon="🔍"
            title="Comparateur de similarité"
            desc="Mesure la distance perceptuelle entre deux fichiers grâce à 5 algorithmes combinés (pHash, dHash, histogramme couleur, texture, métadonnées). Un score proche de 0% signifie deux contenus quasi-indétectables."
            mockup={<MiniSimilarityMockup />}
            accent="border-emerald-500/20"
          />
          <FeatureCard
            icon="🤖"
            title="Détection IA — Métadonnées"
            desc="Masque la signature d'un contenu généré par IA (Midjourney, Runway, Higgsfield…) en remplaçant ses métadonnées par une identité humaine réaliste. Ou injecte les métadonnées d'une plateforme IA dans n'importe quel fichier."
            mockup={<MiniMetaMockup />}
            accent="border-amber-500/20"
          />
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
 * SECTION 4 — HOW IT WORKS
 * ═══════════════════════════════════════════════════════ */
const STEPS = [
  {
    num: "01",
    title: "Importe ton contenu",
    desc: "Glisse-dépose ton image ou ta vidéo dans DuupFlow. JPG, PNG, WEBP, MP4, MOV, MKV — tous les formats sont acceptés, même en lot.",
  },
  {
    num: "02",
    title: "Duplique en illimité",
    desc: "Choisis le nombre de copies et les options (visuel, semi-visuel, métadonnées). DuupFlow modifie chaque fichier pour qu'il soit unique aux yeux des algorithmes de détection.",
  },
  {
    num: "03",
    title: "Télécharge et publie",
    desc: "Exporte tes contenus en ZIP ou un par un. Chaque fichier est prêt à être publié sur Instagram, TikTok, YouTube, Twitter/X ou n'importe quelle plateforme.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="px-6 pb-28">
      <div className="max-w-5xl mx-auto">
        <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3">
          Comment ça marche
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-16 tracking-tight">
          DuupFlow s'intègre dans ton workflow<br className="hidden md:block" /> en 3 étapes.
        </h2>

        {/* Steps row */}
        <div className="relative">
          {/* connector line */}
          <div className="hidden md:block absolute top-[22px] left-[22px] right-[22px] h-px bg-white/[0.08]" />

          <div className="grid md:grid-cols-3 gap-10">
            {STEPS.map((s) => (
              <div key={s.num}>
                {/* Number bubble */}
                <div
                  className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold text-white mb-5 relative z-10"
                  style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
                >
                  {s.num}
                </div>
                <h3 className="font-semibold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
 * SECTION 5 — STATS BANNER
 * ═══════════════════════════════════════════════════════ */
const STATS = [
  { val: "∞", label: "Copies par contenu" },
  { val: "5", label: "Algorithmes de détection" },
  { val: "10+", label: "Formats supportés" },
  { val: "500+", label: "Agences utilisatrices" },
];

function StatsBanner() {
  return (
    <section className="px-6 pb-28">
      <div className="max-w-5xl mx-auto">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className={`text-3xl font-extrabold mb-1 ${G}`}>{s.val}</div>
              <div className="text-xs text-white/40 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
 * SECTION 6 — FAQ
 * ═══════════════════════════════════════════════════════ */
const FAQS = [
  {
    q: "Est-ce que DuupFlow modifie la qualité visuelle de mes contenus ?",
    a: "Non. Par défaut, les transformations sont imperceptibles à l'œil humain. Les modifications légères (micro-zoom, saturation ±2%) sont optionnelles. Le mode 'Métadonnées uniquement' ne touche jamais au contenu visuel.",
  },
  {
    q: "Comment Instagram ou TikTok détectent-ils les doublons ?",
    a: "Les plateformes utilisent des algorithmes de hachage perceptuel (pHash) et d'empreinte numérique sur les métadonnées du fichier. DuupFlow modifie ces deux couches pour que chaque copie soit reconnue comme un nouveau fichier unique.",
  },
  {
    q: "Combien de copies puis-je créer d'un seul contenu ?",
    a: "Il n'y a aucune limite technique. Tu peux générer autant de copies que tu veux en une seule opération. Les managers d'agences l'utilisent généralement pour créer 5 à 50 variantes par contenu.",
  },
  {
    q: "Quels formats de fichiers sont supportés ?",
    a: "Pour les images : JPG, JPEG, PNG, WEBP, HEIC. Pour les vidéos : MP4, MOV, MKV, AVI, WebM. L'export se fait toujours en JPG/PNG pour les images et MP4 pour les vidéos.",
  },
  {
    q: "Est-ce légal d'utiliser DuupFlow ?",
    a: "DuupFlow est un outil de modification de métadonnées et de ré-encodage. Il ne crée pas de faux contenus ni ne viole les droits d'auteur — il modifie techniquement les fichiers que tu possèdes déjà. L'utilisation reste sous ta responsabilité selon les conditions des plateformes.",
  },
  {
    q: "Le module Détection IA fonctionne-t-il aussi pour les vidéos ?",
    a: "Oui. Le module Détection IA manipule les métadonnées EXIF/XMP de tous les formats supportés, y compris les vidéos MP4, MOV et MKV.",
  },
  {
    q: "DuupFlow fonctionne-t-il sur tous les réseaux sociaux ?",
    a: "Oui — Instagram, TikTok, YouTube, Twitter/X, Threads, Pinterest, Facebook et tout réseau qui analyse les empreintes numériques des fichiers. DuupFlow n'est pas limité à un seul réseau.",
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="px-6 pb-28">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3 text-center">
          FAQ
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-12 tracking-tight text-center">
          Questions fréquentes
        </h2>

        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.025] overflow-hidden"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left text-sm font-medium text-white/85 hover:text-white transition"
              >
                <span>{faq.q}</span>
                <svg
                  className={`h-4 w-4 shrink-0 text-white/30 transition-transform ${open === i ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                >
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {open === i && (
                <div className="px-6 pb-5 text-sm text-white/50 leading-relaxed border-t border-white/[0.06] pt-4">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
 * SECTION 7 — CTA BOTTOM BANNER
 * ═══════════════════════════════════════════════════════ */
function CTABanner() {
  return (
    <section className="px-6 pb-28">
      <div className="max-w-5xl mx-auto">
        <div
          className="relative rounded-3xl overflow-hidden p-12 text-center"
          style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(56,189,248,0.08) 100%)" }}
        >
          <div className="pointer-events-none absolute inset-0 border border-white/[0.10] rounded-3xl" />
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
            Prêt à scaler ton contenu ?
          </h2>
          <p className="text-white/50 mb-8 max-w-md mx-auto">
            Accède à tous les modules DuupFlow et commence à dupliquer en illimité dès maintenant.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 font-semibold text-white text-sm transition hover:opacity-90 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            Accéder à DuupFlow →
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
 * FOOTER
 * ═══════════════════════════════════════════════════════ */
function Footer() {
  return (
    <footer className="px-6 pb-10 border-t border-white/[0.06]">
      <div className="max-w-5xl mx-auto pt-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-sm font-bold tracking-tight">
          <span style={{ color: "#818CF8" }}>Duup</span>
          <span className="text-white/50">Flow</span>
        </div>
        <p className="text-xs text-white/25">© 2025 DuupFlow — Tous droits réservés.</p>
        <div className="flex gap-5 text-xs text-white/30">
          <Link href="/legal" className="hover:text-white/60 transition">Mentions légales</Link>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════
 * ROOT PAGE
 * ═══════════════════════════════════════════════════════ */
export default function LandingPage() {
  return (
    <div>
      <Hero />
      <FeatureTabs />
      <CoreFeatures />
      <HowItWorks />
      <StatsBanner />
      <FAQ />
      <CTABanner />
      <Footer />
    </div>
  );
}

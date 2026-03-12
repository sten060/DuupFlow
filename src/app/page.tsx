"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";

/* ─── tiny helpers ─── */
const G = "bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent";

/* ─── Scroll Reveal (curtain effect) ─── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <div
        style={{
          transform: visible ? "translateY(0)" : "translateY(72px)",
          opacity: visible ? 1 : 0,
          transition: `transform 0.85s cubic-bezier(0.16,1,0.3,1) ${delay}ms, opacity 0.75s ease-out ${delay}ms`,
          willChange: "transform, opacity",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
 * SECTION 1 — HERO
 * ═══════════════════════════════════════════════════════ */
function Hero() {
  return (
    <section className="relative flex flex-col items-center text-center px-6 pt-20 pb-32 overflow-hidden bg-[#0B0F1A]">
      {/* Texture background — dot grid */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* Subtle light rays */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px]"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(99,102,241,0.18) 0%, transparent 80%)" }}
        />
        <div
          className="absolute top-1/4 left-1/4 w-[500px] h-[400px]"
          style={{ background: "radial-gradient(ellipse, rgba(56,189,248,0.07) 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-10 right-1/4 w-[300px] h-[300px]"
          style={{ background: "radial-gradient(ellipse, rgba(139,92,246,0.08) 0%, transparent 70%)" }}
        />
      </div>

      <Reveal>
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

        {/* Single-line sub headline */}
        <p className="text-white/55 text-lg mb-9">
          Métadonnées modifiées automatiquement — chaque fichier unique aux yeux des plateformes.
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
      </Reveal>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
 * SECTION 2 — FEATURE TABS (auto-rotating with progress bar)
 * ═══════════════════════════════════════════════════════ */
const TABS = [
  { id: "images", label: "Duplication Images" },
  { id: "videos", label: "Duplication Vidéos" },
  { id: "comparator", label: "Comparateur" },
  { id: "ai", label: "Détection IA" },
];

const TAB_IDS = TABS.map((t) => t.id);
const TAB_DURATION = 4000;
const TICK = 50;

function MockupImages() {
  const files = [
    { name: "DuupFlow_20240312_dup1_47.jpg", size: "2.4 MB", color: "bg-fuchsia-500/20 border-fuchsia-500/30" },
    { name: "DuupFlow_20240312_dup2_83.jpg", size: "2.4 MB", color: "bg-indigo-500/20 border-indigo-500/30" },
    { name: "DuupFlow_20240312_dup3_12.jpg", size: "2.4 MB", color: "bg-pink-500/20 border-pink-500/30" },
    { name: "DuupFlow_20240312_dup4_55.jpg", size: "2.4 MB", color: "bg-violet-500/20 border-violet-500/30" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-white/50">4 copies générées</span>
        </div>
        <span className="text-xs text-white/30">original.jpg → 4 duplicates</span>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-white/[0.08] flex items-center justify-center text-lg">🖼️</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/80 font-medium truncate">photo_instagram.jpg</p>
          <p className="text-xs text-white/35">Fichier source · 2.4 MB</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/[0.04] text-white/50">Source</span>
      </div>
      <div className="flex justify-center py-1">
        <svg className="h-5 w-5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
      </div>
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
        <p className="text-xs text-white/40 uppercase tracking-wider">Pipeline d&apos;encodage</p>
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
        {files.map((f) => (
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
  const [progress, setProgress] = useState(0);
  const activeRef = useRef("images");
  const progressRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      progressRef.current += (TICK / TAB_DURATION) * 100;
      if (progressRef.current >= 100) {
        progressRef.current = 0;
        const idx = TAB_IDS.indexOf(activeRef.current);
        const next = TAB_IDS[(idx + 1) % TAB_IDS.length];
        activeRef.current = next;
        setActive(next);
      }
      setProgress(progressRef.current);
    }, TICK);
    return () => clearInterval(timer);
  }, []);

  const handleTab = (id: string) => {
    activeRef.current = id;
    progressRef.current = 0;
    setActive(id);
    setProgress(0);
  };

  const desc = TAB_DESCS[active];

  return (
    <section className="px-6 pb-36 bg-[#0E1325]">
      <div className="max-w-5xl mx-auto pt-20">
        <Reveal>
          {/* Tab bar */}
          <div className="flex overflow-x-auto gap-1 p-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] mb-8 scrollbar-none">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTab(t.id)}
                className="flex-1 min-w-max rounded-xl px-4 py-2.5 text-sm font-medium transition whitespace-nowrap relative overflow-hidden"
                style={{
                  color: active === t.id ? "white" : "rgba(255,255,255,0.45)",
                  background: active === t.id ? "rgba(255,255,255,0.10)" : "transparent",
                  border: active === t.id ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
                }}
              >
                {t.label}
                {t.id === "ai" && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/25 font-semibold">NEW</span>
                )}
                {/* Progress bar under active tab */}
                {active === t.id && (
                  <span
                    className="absolute bottom-0 left-0 h-[2px] rounded-full"
                    style={{
                      width: `${progress}%`,
                      background: "linear-gradient(90deg,#6366F1,#38BDF8)",
                      transition: "width 50ms linear",
                    }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="grid md:grid-cols-[1fr_360px] gap-8 items-start">
            <div className="py-4">
              <h3 className="text-2xl font-bold text-white mb-3">{desc.title}</h3>
              <p className="text-white/55 leading-relaxed mb-6">{desc.desc}</p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition"
              >
                Essayer maintenant →
              </Link>
            </div>
            {/* Fixed-height mockup panel — prevents layout shift on tab change */}
            <div className="rounded-2xl border border-white/[0.10] bg-white/[0.025] p-5 backdrop-blur-sm overflow-hidden" style={{ minHeight: "480px" }}>
              {MOCKUPS[active]}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
 * SECTION 3 — CORE FEATURES GRID
 * ═══════════════════════════════════════════════════════ */
function FeatureCard({
  icon, title, desc, mockup, accent,
}: {
  icon: string; title: string; desc: string; mockup: React.ReactNode; accent: string;
}) {
  return (
    <div className={`rounded-2xl border bg-white/[0.025] overflow-hidden flex flex-col ${accent}`}>
      <div className="p-5 border-b border-white/[0.06] bg-white/[0.02] min-h-[200px] flex items-center justify-center">
        <div className="w-full">{mockup}</div>
      </div>
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
    <section id="features" className="px-6 pb-36 bg-[#0B0F1A]">
      <div className="max-w-5xl mx-auto pt-20">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3">
            Fonctionnalités clés
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
            Tout ce dont tu as besoin pour scaler<br className="hidden md:block" /> ton contenu sans jamais être détecté.
          </h2>
          <p className="text-white/45 text-base mb-14 max-w-xl">
            DuupFlow réunit en un seul outil la duplication d&apos;images, de vidéos, la comparaison de similarité et le contrôle des métadonnées IA.
          </p>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-5">
          <Reveal delay={0}>
            <FeatureCard
              icon="🖼️"
              title="Duplication d'images illimitée"
              desc="Charge une image, génère autant de copies que tu veux avec des métadonnées EXIF/XMP uniques, des micro-variations visuelles imperceptibles et un ICC profile différent. Chaque fichier est détecté comme nouveau par les algorithmes."
              mockup={<MiniImageDupMockup />}
              accent="border-fuchsia-500/20"
            />
          </Reveal>
          <Reveal delay={80}>
            <FeatureCard
              icon="🎬"
              title="Duplication vidéo avancée"
              desc="Ré-encode tes vidéos avec des paramètres différents à chaque copie — FPS, GOP, bitrate, codec, couleur. Le contenu visuel reste identique, mais la signature numérique du fichier est entièrement distincte."
              mockup={<MiniVideoDupMockup />}
              accent="border-indigo-500/20"
            />
          </Reveal>
          <Reveal delay={160}>
            <FeatureCard
              icon="🔍"
              title="Comparateur de similarité"
              desc="Mesure la distance perceptuelle entre deux fichiers grâce à 5 algorithmes combinés (pHash, dHash, histogramme couleur, texture, métadonnées). Un score proche de 0% signifie deux contenus quasi-indétectables."
              mockup={<MiniSimilarityMockup />}
              accent="border-emerald-500/20"
            />
          </Reveal>
          <Reveal delay={240}>
            <FeatureCard
              icon="🤖"
              title="Détection IA — Métadonnées"
              desc="Masque la signature d'un contenu généré par IA (Midjourney, Runway, Higgsfield…) en remplaçant ses métadonnées par une identité humaine réaliste. Ou injecte les métadonnées d'une plateforme IA dans n'importe quel fichier."
              mockup={<MiniMetaMockup />}
              accent="border-amber-500/20"
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
 * SECTION 4 — STATS BANNER
 * ═══════════════════════════════════════════════════════ */
const STATS = [
  { val: "∞", label: "Copies par contenu" },
  { val: "5", label: "Algorithmes de détection" },
  { val: "10+", label: "Formats supportés" },
  { val: "500+", label: "Agences utilisatrices" },
];

function StatsBanner() {
  return (
    <section className="px-6 pb-36 bg-[#0E1325]">
      <div className="max-w-5xl mx-auto pt-20">
        <Reveal>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className={`text-3xl font-extrabold mb-1 ${G}`}>{s.val}</div>
                <div className="text-xs text-white/40 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
 * SECTION 5 — FAQ  (Base44 layout: left title + right accordion)
 * ═══════════════════════════════════════════════════════ */
const FAQS = [
  {
    q: "Est-ce que mes contenus seront vraiment uniques pour les plateformes ?",
    a: "Oui. DuupFlow modifie les métadonnées EXIF/XMP, les paramètres d'encodage et optionnellement des micro-variations visuelles imperceptibles. Chaque fichier possède une empreinte numérique différente, reconnue comme nouveau fichier par les algorithmes de détection d'Instagram, TikTok, YouTube et autres.",
  },
  {
    q: "Est-ce que DuupFlow modifie la qualité visuelle de mes contenus ?",
    a: "Non. Par défaut, les transformations sont imperceptibles à l'œil humain. Le mode 'Métadonnées uniquement' ne touche jamais au contenu visuel. Les micro-variations (micro-zoom, saturation ±2%) sont entièrement optionnelles.",
  },
  {
    q: "Combien de copies puis-je créer d'un seul contenu ?",
    a: "Il n'y a aucune limite technique. Tu peux générer autant de copies que tu veux en une seule opération. La plupart des agences l'utilisent pour créer entre 5 et 50 variantes par contenu.",
  },
  {
    q: "Est-ce légal d'utiliser DuupFlow ?",
    a: "DuupFlow modifie techniquement les fichiers que tu possèdes déjà — il ne crée pas de faux contenus et ne viole pas les droits d'auteur. L'outil est légal ; l'utilisation reste sous ta responsabilité selon les conditions générales de chaque plateforme.",
  },
  {
    q: "Quels formats de fichiers sont supportés ?",
    a: "Images : JPG, JPEG, PNG, WEBP, HEIC. Vidéos : MP4, MOV, MKV, AVI, WebM. L'export se fait en JPG/PNG pour les images et MP4 pour les vidéos.",
  },
  {
    q: "Le module Détection IA fonctionne-t-il aussi pour les vidéos ?",
    a: "Oui. Le module Détection IA manipule les métadonnées de tous les formats supportés, y compris MP4, MOV et MKV. Il peut masquer ou injecter des signatures IA dans n'importe quel fichier.",
  },
  {
    q: "DuupFlow fonctionne-t-il sur tous les réseaux sociaux ?",
    a: "Oui — Instagram, TikTok, YouTube, Twitter/X, Threads, Pinterest, Facebook et tout réseau qui analyse les empreintes numériques des fichiers. DuupFlow n'est pas limité à un seul réseau.",
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="px-6 pb-36 bg-[#0B0F1A]">
      <div className="max-w-5xl mx-auto pt-20">
        <Reveal>
          <div className="grid md:grid-cols-[2fr_3fr] gap-16">
            {/* Left — title */}
            <div className="md:sticky md:top-28 self-start">
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3">FAQ</p>
              <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-[1.1]">
                Questions fréquentes
              </h2>
              <p className="text-white/40 text-sm mt-4 leading-relaxed">
                Tu as d&apos;autres questions ? Contacte-nous par email ou via le chat intégré.
              </p>
            </div>

            {/* Right — accordion */}
            <div className="divide-y divide-white/[0.08]">
              {FAQS.map((faq, i) => (
                <div key={i}>
                  <button
                    onClick={() => setOpen(open === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 py-5 text-left text-sm font-medium text-white/80 hover:text-white transition"
                  >
                    <span>{faq.q}</span>
                    <span
                      className="shrink-0 h-6 w-6 rounded-full border border-white/15 flex items-center justify-center text-white/50 transition-transform"
                      style={{ transform: open === i ? "rotate(45deg)" : "rotate(0deg)" }}
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </button>
                  {open === i && (
                    <div className="pb-5 text-sm text-white/50 leading-relaxed">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
 * SECTION 6 — CTA BOTTOM BANNER
 * ═══════════════════════════════════════════════════════ */
function CTABanner() {
  return (
    <section className="px-6 pb-36 bg-[#0E1325]">
      <div className="max-w-5xl mx-auto pt-20">
        <Reveal>
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
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 font-semibold text-white text-sm transition hover:opacity-90 hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
              >
                S&apos;inscrire gratuitement →
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-8 py-3.5 font-medium text-sm text-white/80 hover:bg-white/[0.08] transition"
              >
                Connexion
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
 * FOOTER
 * ═══════════════════════════════════════════════════════ */
function Footer() {
  return (
    <footer className="px-6 pb-10 border-t border-white/[0.06] bg-[#0B0F1A]">
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
      <StatsBanner />
      <FAQ />
      <CTABanner />
      <Footer />
    </div>
  );
}

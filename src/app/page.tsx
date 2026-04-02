"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";

/* ─── tiny helpers ─── */
const G = "bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent";

/* Section background — gradient fade in/out (very subtle tint) */

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
    <section className="relative flex flex-col items-center text-center px-6 pt-8 sm:pt-20 pb-24 sm:pb-48 overflow-hidden">

      <Reveal>
        <div className="mb-5 sm:mb-7 inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-white/15 bg-white/[0.05] px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm text-white/70">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Nouveau — Détection IA disponible
          <span className="text-white/40">→</span>
        </div>

        <h1 className="max-w-5xl text-[2.6rem] md:text-[3.5rem] font-bold leading-[1.08] tracking-tight text-white mb-5">
          Le seul outil pour dupliquer<br />ton contenu <span className={G}>en illimité.</span>
        </h1>

        <p className="text-white/75 text-sm sm:text-lg mb-6 sm:mb-9">
          Chaque copie unique — indétectable par les plateformes.
        </p>

        <div className="flex flex-row gap-2 sm:gap-3 mb-8 sm:mb-10 justify-center">
          <Link href="/tarifs"
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl px-4 sm:px-7 py-2.5 sm:py-3.5 font-semibold text-white text-xs sm:text-sm transition hover:opacity-90 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}>
            Voir les offres →
          </Link>
          <a href="#features"
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 sm:px-7 py-2.5 sm:py-3.5 font-medium text-xs sm:text-sm text-white/80 hover:bg-white/[0.08] transition">
            Fonctionnalités
          </a>
        </div>

        <p className="text-xs text-white/30 tracking-wide uppercase">
          Utilisé par 500+ agences marketing &amp; créateurs de contenu
        </p>
      </Reveal>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
 * SECTION 2 — PROBLÈME / SOLUTION
 * ═══════════════════════════════════════════════════════ */
function ProblemSolution() {
  return (
    <section className="px-6 pb-36">
      <div className="max-w-6xl mx-auto pt-20">
        <Reveal>
          {/* Two-column layout: cards left, text right */}
          <div className="grid md:grid-cols-2 gap-16 mb-6 items-center">
            {/* LEFT — stacked Problem + Solution cards */}
            <div className="space-y-4">
              {/* Problem */}
              <div className="rounded-2xl border border-red-500/25 p-5" style={{ background: "rgba(30,5,5,0.70)" }}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-9 w-9 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                    <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white text-base">Le Problème</h3>
                </div>
                <p className="text-white/75 text-sm leading-relaxed mb-5">
                  Les plateformes détectent chaque doublon — même renommé, même recompressé.
                  Résultat : shadowban silencieux dès la 2e publication.
                </p>
                <div className="rounded-xl border border-red-500/15 bg-red-500/[0.06] px-4 py-3">
                  <p className="text-sm font-semibold text-red-300">
                    1 fichier = 1 seule publication. Après ça, shadowban assuré.
                  </p>
                </div>
              </div>

              {/* Solution */}
              <div className="rounded-2xl border border-indigo-500/25 p-5" style={{ background: "rgba(5,8,40,0.75)" }}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-9 w-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                    <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white text-base">La Solution DuupFlow</h3>
                </div>
                <p className="text-white/75 text-sm leading-relaxed mb-5">
                  DuupFlow régénère l&apos;empreinte de chaque copie — métadonnées uniques,
                  ré-encodage vidéo, micro-variations invisibles. Techniquement nouveau à chaque fois.
                </p>
                <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/[0.06] px-4 py-3">
                  <p className="text-sm font-semibold text-indigo-300">
                    Scale le même contenu à l&apos;infini. Sans jamais être détecté.
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT — title + description text */}
            <div>
              <div className="mb-5">
                <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/25 bg-indigo-500/[0.08] px-4 py-1.5 text-xs font-semibold text-indigo-400 tracking-wide uppercase">
                  Pourquoi DuupFlow existe
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white mb-4 tracking-tight">
                Tes meilleurs contenus méritent{" "}
                <span className={G}>d&apos;exister plus longtemps.</span>
              </h2>
              <p className="text-white/65 text-sm sm:text-base leading-relaxed">
                Les plateformes analysent l&apos;empreinte numérique de chaque fichier.
                DuupFlow rend tes copies techniquement indétectables.
              </p>
            </div>
          </div>

          {/* Result banner — full width below */}
          <div
            className="rounded-2xl border border-white/[0.10] p-5 text-center"
            style={{ background: "rgba(8,12,35,0.65)" }}
          >
            <p className="text-sm text-white/70">
              <span className="text-white font-semibold">Résultat :</span>{" "}
              un seul bon contenu →{" "}
              <span className={G + " font-semibold"}>50 publications uniques</span>{" "}
              → 50 chances de toucher l&apos;algorithme.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
 * SECTION 3 — FEATURE TABS (auto-rotating)
 * ═══════════════════════════════════════════════════════ */
const TABS = [
  { id: "duplication", label: "Duplication Images & Vidéos" },
  { id: "invisible", label: "Modification Invisible" },
  { id: "priority", label: "Priorité d'algorithme" },
  { id: "ai", label: "Détection IA" },
];
const TAB_IDS = TABS.map((t) => t.id);
const TAB_DURATION = 4000;
const TICK = 50;

function MockupDuplication() {
  const copies = [
    { name: "DuupFlow_dup1_47.jpg", type: "Image", size: "2.4 MB", color: "border-fuchsia-500/30 bg-fuchsia-500/[0.08]" },
    { name: "DuupFlow_dup2_83.mp4", type: "Vidéo", size: "18.7 MB", color: "border-indigo-500/30 bg-indigo-500/[0.08]" },
    { name: "DuupFlow_dup3_12.jpg", type: "Image", size: "2.4 MB", color: "border-pink-500/30 bg-pink-500/[0.08]" },
    { name: "DuupFlow_dup4_55.mp4", type: "Vidéo", size: "18.7 MB", color: "border-violet-500/30 bg-violet-500/[0.08]" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-white/50">4 copies générées</span>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-medium">Images & Vidéos</span>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-sky-500/20 flex items-center justify-center text-lg">📁</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/80 font-medium truncate">contenu_source</p>
          <p className="text-xs text-white/35">Fichier source · Image ou Vidéo</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/[0.04] text-white/50">Source</span>
      </div>
      <div className="flex justify-center py-1">
        <svg className="h-5 w-5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
      </div>
      {copies.map((f) => (
        <div key={f.name} className={`rounded-xl border p-3 flex items-center gap-3 ${f.color}`}>
          <div className="h-10 w-10 rounded-lg bg-white/[0.08] flex items-center justify-center text-sm">{f.type === "Image" ? "🖼️" : "🎬"}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/70 font-mono truncate">{f.name}</p>
            <p className="text-xs text-white/35">Métadonnées uniques · {f.size}</p>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-white/40 border border-white/10">{f.type}</span>
          <svg className="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
      ))}
    </div>
  );
}

function MockupInvisible() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-xs text-white/40 font-mono mb-1">Original Hash</p>
        <p className="text-sm text-amber-300 font-mono">a7f3e2d1c4b8...9f0a6e3d</p>
      </div>
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/[0.10]">
          <span className="text-sm">✨</span>
          <span className="text-xs font-semibold text-indigo-300">Pixel magique</span>
        </div>
      </div>
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] p-4">
        <p className="text-xs text-white/40 font-mono mb-1">Modified Hash</p>
        <p className="text-sm text-emerald-300 font-mono">9b2e8f4a7c1d...3b5d2e8f</p>
      </div>
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
        <p className="text-sm text-white/70 font-medium mb-1">Visuellement identique</p>
        <p className="text-xs text-white/40">Le contenu visuel ne change pas. Seule l&apos;empreinte numérique est modifiée.</p>
      </div>
    </div>
  );
}

function MockupPriority() {
  const fields = [
    { key: "Make", value: "Apple" },
    { key: "Model", value: "iPhone 16 Pro" },
    { key: "Software", value: "18.3" },
    { key: "Location", value: "Paris, France" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
          <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <span className="text-xs font-semibold text-amber-300">Métadonnées iPhone injectées</span>
      </div>
      {fields.map((f) => (
        <div key={f.key} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-white/40 font-mono">{f.key}</span>
          <span className="text-xs text-emerald-300 font-mono">{f.value}</span>
        </div>
      ))}
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] p-3 text-center">
        <p className="text-xs text-indigo-300">L&apos;algorithme traite votre contenu comme un vrai iPhone</p>
      </div>
    </div>
  );
}

function MockupAI() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-4">
        <p className="text-xs text-amber-400 font-medium mb-3 flex items-center gap-1.5"><span>⚡</span> Signature IA injectée</p>
        <div className="space-y-2">
          {[["Software", "Midjourney v6.1"], ["Artist", "Midjourney Bot"], ["Creator", "midjourney.com"], ["DigitalSourceType", "trainedAlgorithmicMedia"]].map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs">
              <span className="text-white/40 font-mono">{k}</span>
              <span className="text-amber-300 font-mono">{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] p-4">
        <p className="text-xs text-emerald-400 font-medium mb-3 flex items-center gap-1.5"><span>🛡️</span> Signature IA masquée</p>
        <div className="space-y-2">
          {[["Software", "Adobe Lightroom 7.2"], ["Make", "Sony"], ["Model", "A7 IV"], ["Artist", "Sophie Renaud"]].map(([k, v]) => (
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

const MOCKUPS: Record<string, React.ReactNode> = { duplication: <MockupDuplication />, invisible: <MockupInvisible />, priority: <MockupPriority />, ai: <MockupAI /> };
const TAB_DESCS: Record<string, string> = {
  duplication: "Dupliquez vos images et vidéos en masse. Chaque copie est unique — métadonnées, empreinte technique, hash. Indétectable par les plateformes.",
  invisible: "Modifiez l'empreinte numérique sans toucher au visuel. Pixel magique change le hash de chaque fichier tout en gardant le contenu visuellement identique.",
  priority: "Localisez votre contenu et injectez des métadonnées iPhone authentiques. L'algorithme pense que votre contenu vient d'un appareil réel.",
  ai: "Effacez la signature IA de vos contenus. Remplacez les métadonnées Midjourney, DALL-E, Stable Diffusion par une identité humaine réaliste.",
};

function FeatureTabs() {
  const [active, setActive] = useState("duplication");
  const [progress, setProgress] = useState(0);
  const activeRef = useRef("duplication");
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

  const handleTab = (id: string) => { activeRef.current = id; progressRef.current = 0; setActive(id); setProgress(0); };
  const desc = TAB_DESCS[active];

  return (
    <section className="px-6 pb-36">
      <div className="max-w-5xl mx-auto pt-20">
        <Reveal>
          <div className="flex overflow-x-auto gap-1 p-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] mb-8 scrollbar-none">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => handleTab(t.id)}
                className="flex-1 min-w-max rounded-xl px-4 py-2.5 text-sm font-medium transition whitespace-nowrap relative overflow-hidden"
                style={{ color: active === t.id ? "white" : "rgba(255,255,255,0.45)", background: active === t.id ? "rgba(255,255,255,0.10)" : "transparent", border: active === t.id ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent" }}>
                {t.label}
                {t.id === "ai" && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/25 font-semibold">NEW</span>}
                {active === t.id && (
                  <span className="absolute bottom-0 left-0 h-[2px] rounded-full"
                    style={{ width: `${progress}%`, background: "linear-gradient(90deg,#6366F1,#38BDF8)", transition: "width 50ms linear" }} />
                )}
              </button>
            ))}
          </div>
          <div className="grid md:grid-cols-[1fr_360px] gap-8 items-start">
            <div className="py-4">
              <h3 className="text-2xl font-semibold text-white mb-3">{TABS.find(t => t.id === active)?.label}</h3>
              <p className="text-white/75 leading-relaxed mb-6">{desc}</p>
              <Link href="/register" className="inline-flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition">Essayer maintenant →</Link>
            </div>
            <div className="rounded-2xl border border-white/[0.12] p-4 sm:p-5 backdrop-blur-sm overflow-hidden min-h-[300px] sm:min-h-[480px]" style={{ background: "rgba(8,12,35,0.75)" }}>
              {MOCKUPS[active]}
            </div>
          </div>
        </Reveal>
        <div className="flex justify-center mt-10">
          <Link href="/demo"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-7 py-3 font-medium text-sm text-white/75 hover:text-white hover:bg-white/[0.08] transition">
            Voir la démo →
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
 * SECTION 4 — FEATURES ALTERNATING ROWS (animated mockups)
 * ═══════════════════════════════════════════════════════ */

/* Animated Mockup 1 — Image Duplication */
function AnimImageDup() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    function play() {
      setStep(0);
      const t1 = setTimeout(() => setStep(1), 400);
      const t2 = setTimeout(() => setStep(2), 750);
      const t3 = setTimeout(() => setStep(3), 1100);
      const t4 = setTimeout(() => setStep(4), 1450);
      return [t1, t2, t3, t4];
    }
    const timers = play();
    const loop = setInterval(() => { timers.forEach(clearTimeout); play(); }, 4000);
    return () => { timers.forEach(clearTimeout); clearInterval(loop); };
  }, []);

  const copies = [
    { name: "DuupFlow_20240312_dup1_47.jpg", color: "border-fuchsia-500/30 bg-fuchsia-500/[0.08]" },
    { name: "DuupFlow_20240312_dup2_83.jpg", color: "border-indigo-500/30 bg-indigo-500/[0.08]" },
    { name: "DuupFlow_20240312_dup3_12.jpg", color: "border-pink-500/30 bg-pink-500/[0.08]" },
    { name: "DuupFlow_20240312_dup4_55.jpg", color: "border-violet-500/30 bg-violet-500/[0.08]" },
  ];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-white/50">{step} / 4 copies générées</span>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-medium">× illimité</span>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-sky-500/20 flex items-center justify-center text-lg">🖼️</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/80 font-medium truncate">photo_instagram.jpg</p>
          <p className="text-xs text-white/35">Fichier source · 2.4 MB</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/[0.04] text-white/40">Source</span>
      </div>
      <div className="flex justify-center py-0.5">
        <svg className="h-4 w-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
      </div>
      {copies.map((f, i) => (
        <div key={f.name}
          className={`rounded-xl border p-3 flex items-center gap-3 transition-all duration-500 ${f.color}`}
          style={{ opacity: step > i ? 1 : 0, transform: step > i ? "translateY(0)" : "translateY(12px)" }}>
          <div className="h-9 w-9 rounded-lg bg-white/[0.06] flex items-center justify-center text-sm">📄</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/65 font-mono truncate">{f.name}</p>
            <p className="text-xs text-white/30">Métadonnées modifiées</p>
          </div>
          <svg className="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
      ))}
    </div>
  );
}

/* Animated Mockup 2 — Video Duplication */
function AnimVideoDup() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    function play() {
      setStep(0);
      const t1 = setTimeout(() => setStep(1), 600);
      const t2 = setTimeout(() => setStep(2), 1200);
      const t3 = setTimeout(() => setStep(3), 1800);
      return [t1, t2, t3];
    }
    const timers = play();
    const loop = setInterval(() => { timers.forEach(clearTimeout); play(); }, 4500);
    return () => { timers.forEach(clearTimeout); clearInterval(loop); };
  }, []);

  const platforms = [
    { name: "Compte Instagram 1", icon: "📸", color: "border-fuchsia-500/30 bg-fuchsia-500/[0.07]" },
    { name: "Compte Instagram 2", icon: "📸", color: "border-indigo-500/30 bg-indigo-500/[0.07]" },
    { name: "Compte Instagram 3", icon: "📸", color: "border-red-500/30 bg-red-500/[0.07]" },
  ];

  return (
    <div className="space-y-3">
      {/* Source video */}
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5 flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-indigo-500/20 border border-indigo-500/25 flex items-center justify-center text-xl">🎬</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/80 font-medium">ma_video.mp4</p>
          <p className="text-xs text-white/35">Fichier source</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-white/40">{step}/3 copies</span>
        </div>
      </div>

      {/* Divider with label */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
        <span className="text-[10px] text-white/30 px-2">copie unique par plateforme</span>
        <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
      </div>

      {/* Platform copies — animated in */}
      {platforms.map((p, i) => (
        <div
          key={p.name}
          className={`rounded-xl border p-3 flex items-center gap-3 transition-all duration-500 ${p.color}`}
          style={{ opacity: step > i ? 1 : 0.12, transform: step > i ? "translateY(0)" : "translateY(10px)" }}
        >
          <div className="h-9 w-9 rounded-lg bg-white/[0.06] flex items-center justify-center text-base">{p.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white/70">{p.name}</p>
            <p className="text-[11px] text-white/30">Perçue comme nouveau contenu</p>
          </div>
          {step > i && (
            <span className="text-xs text-emerald-400 font-semibold whitespace-nowrap shrink-0">Unique ✓</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* Animated Mockup 3 — Similarity Comparator */
function AnimSimilarity() {
  const [score, setScore] = useState(94);
  const [active, setActive] = useState(false);

  useEffect(() => {
    function play() {
      setScore(94);
      setActive(false);
      setTimeout(() => {
        setActive(true);
        let current = 94;
        const iv = setInterval(() => {
          current -= 3;
          if (current <= 18) { current = 18; clearInterval(iv); }
          setScore(current);
        }, 60);
      }, 500);
    }
    play();
    const loop = setInterval(play, 4500);
    return () => clearInterval(loop);
  }, []);

  const color = score < 30 ? "text-emerald-400" : score < 60 ? "text-amber-400" : "text-red-400";
  const borderColor = score < 30 ? "border-emerald-500/30 bg-emerald-500/[0.06]" : score < 60 ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-red-500/30 bg-red-500/[0.06]";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {["contenu_A.mp4", "contenu_B.mp4"].map((name, i) => (
          <div key={name} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
            <div className="h-14 rounded-lg bg-white/[0.06] flex items-center justify-center text-2xl mb-2">{i === 0 ? "🎬" : "📹"}</div>
            <p className="text-xs text-white/45 truncate">{name}</p>
          </div>
        ))}
      </div>
      <div className={`rounded-xl border p-5 text-center transition-all duration-300 ${borderColor}`}>
        <div className={`text-4xl font-bold mb-1 transition-all duration-200 ${color}`}>{score}%</div>
        <p className="text-sm text-white/50 mb-3">{score < 30 ? "Très différents — protégé ✓" : score < 60 ? "Similarité modérée" : "Trop similaires — risque"}</p>
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-200 ${score < 30 ? "bg-emerald-500" : score < 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${score}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[["pHash", "8%"], ["Couleur", "22%"], ["Méta", "12%"]].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
            <p className="text-xs text-white/30">{k}</p>
            <p className="text-sm font-semibold text-white/65">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Animated Mockup 4 — AI Metadata Detection */
function AnimAIDet() {
  const [phase, setPhase] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    function play() {
      setPhase(0);
      const t1 = setTimeout(() => setPhase(1), 1200);
      const t2 = setTimeout(() => setPhase(2), 2400);
      return [t1, t2];
    }
    const timers = play();
    const loop = setInterval(() => { timers.forEach(clearTimeout); play(); }, 5000);
    return () => { timers.forEach(clearTimeout); clearInterval(loop); };
  }, []);

  const fields = [
    { key: "Software", bad: "Midjourney v6.1", good: "Adobe Lightroom 7.2" },
    { key: "Artist", bad: "Midjourney Bot", good: "Sophie Renaud" },
    { key: "Make", bad: "midjourney.com", good: "Sony" },
    { key: "Model", bad: "trainedAlgorithmic", good: "A7 IV" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <div className={`h-2 w-2 rounded-full transition-colors duration-500 ${phase === 2 ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"}`} />
        <span className="text-xs text-white/50">
          {phase === 0 ? "Analyse en cours..." : phase === 1 ? "Remplacement des métadonnées..." : "Signature IA masquée ✓"}
        </span>
      </div>
      {fields.map((f) => (
        <div key={f.key} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 flex items-center justify-between gap-2">
          <span className="text-xs text-white/35 font-mono shrink-0">{f.key}</span>
          <div className="flex items-center gap-2 flex-1 justify-end overflow-hidden">
            {phase === 0 && <span className="text-xs text-amber-300 font-mono truncate">{f.bad}</span>}
            {phase === 1 && (
              <>
                <span className="text-xs text-red-400/60 font-mono line-through truncate">{f.bad}</span>
                <span className="text-white/20 text-xs">→</span>
                <span className="text-xs text-white/40 font-mono truncate">{f.good}</span>
              </>
            )}
            {phase === 2 && <span className="text-xs text-emerald-400 font-mono truncate">{f.good}</span>}
          </div>
          {phase === 2 && (
            <svg className="h-3.5 w-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg>
          )}
        </div>
      ))}
    </div>
  );
}

/* Feature alternating row */
function FeatureRow({
  badge, badgeColor, title, subtitle, bullets, mockup, reverse = false, first = false,
}: {
  badge: string; badgeColor: string; title: React.ReactNode; subtitle: string;
  bullets: string[]; mockup: React.ReactNode; reverse?: boolean; first?: boolean;
}) {
  return (
    <Reveal>
      <div className={`flex flex-col ${reverse ? "md:flex-row-reverse" : "md:flex-row"} gap-12 md:gap-20 items-center py-20 ${first ? "" : "border-t border-white/[0.05]"}`}>
        {/* Text */}
        <div className="flex-1">
          <div className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold mb-5 ${badgeColor}`}>
            {badge}
          </div>
          <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-3 sm:mb-4 tracking-tight leading-[1.15]">{title}</h3>
          <p className="text-white/70 text-sm sm:text-base leading-relaxed mb-5 sm:mb-7">{subtitle}</p>
          <ul className="space-y-3.5">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/75">
                <svg className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Mockup */}
        <div className="flex-1 w-full max-w-sm md:max-w-md">
          <div className="rounded-2xl border border-white/[0.12] p-4 sm:p-6 backdrop-blur-sm min-h-[220px] sm:min-h-[320px]" style={{ background: "rgba(8,12,35,0.75)" }}>
            {mockup}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

function CoreFeaturesAlt() {
  return (
    <section id="features" className="px-6 pb-20">
      <div className="max-w-5xl mx-auto pt-20">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3 text-center">Fonctionnalités</p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white mb-4 tracking-tight text-center">
            Quatre modules. <span className={G}>Un seul objectif.</span>
          </h2>
          <p className="text-white/65 text-sm sm:text-base max-w-lg mx-auto text-center">
            Chaque publication unique. Chaque fichier indétectable.
          </p>
        </Reveal>

        <FeatureRow
          first
          badge="🖼️ Duplication Images"
          badgeColor="border border-fuchsia-500/25 bg-fuchsia-500/[0.08] text-fuchsia-300"
          title={<>Un fichier source,{" "}<span className={G}>des copies infinies.</span></>}
          subtitle="Génère autant de variantes que tu veux. Chaque copie a une empreinte EXIF/XMP unique — indétectable par les algorithmes."
          bullets={[
            "Métadonnées EXIF/XMP uniques à chaque copie",
            "Micro-variations visuelles imperceptibles à l'œil",
            "JPG, PNG, WEBP, HEIC — export en un clic",
          ]}
          mockup={<AnimImageDup />}
        />

        <FeatureRow
          badge="🎬 Duplication Vidéos"
          badgeColor="border border-indigo-500/25 bg-indigo-500/[0.08] text-indigo-300"
          title={<>Même vidéo,{" "}<span className={G}>perçue comme différente</span>{" "}partout.</>}
          subtitle="Chaque copie est re-encodée différemment — perçue comme nouveau fichier par Instagram, TikTok et YouTube. Multi-posting sans pénalité."
          bullets={[
            "Copies visuellement identiques à l'original",
            "Détectées comme fichiers uniques par les algorithmes des réseaux sociaux",
            "Multi-posting illimité sans risque de shadowban ou de suppression",
          ]}
          mockup={<AnimVideoDup />}
          reverse
        />

        <FeatureRow
          badge="🔍 Comparateur"
          badgeColor="border border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300"
          title={<>Mesure ta{" "}<span className={G}>protection</span>{" "}avant de publier.</>}
          subtitle="7+ systèmes d'analyse combinés pour un score de similarité en temps réel. Plus le score est bas, plus tu es protégé."
          bullets={[
            "7+ systèmes d'analyse combinés pour une précision maximale",
            "Score en temps réel — résultat en moins de 3s",
            "Testé et validé sur Instagram, TikTok et YouTube",
          ]}
          mockup={<AnimSimilarity />}
        />

        <FeatureRow
          badge="🤖 Détection IA"
          badgeColor="border border-amber-500/25 bg-amber-500/[0.08] text-amber-300"
          title={<>Masque la{" "}<span className={G}>signature IA.</span>{" "}Instantanément.</>}
          subtitle="Remplace les métadonnées d'un contenu généré par IA par une identité humaine réaliste. Aucune modification visuelle — seule l'empreinte numérique change."
          bullets={[
            "Compatible Midjourney, Runway, Higgsfield, DALL·E",
            "Masquage des métadonnées en un clic",
            "Aucune modification du contenu visuel",
          ]}
          mockup={<AnimAIDet />}
          reverse
        />
        <Reveal>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-6 pb-8">
            <Link href="/register"
              className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 font-semibold text-white text-sm transition hover:opacity-90 hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}>
              Commencer maintenant →
            </Link>
            <Link href="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-7 py-3.5 font-medium text-sm text-white/80 hover:bg-white/[0.08] transition">
              Voir la démo
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
 * SECTION 5 — STATS BANNER
 * ═══════════════════════════════════════════════════════ */
const STATS = [
  { val: "∞", label: "Copies par contenu" },
  { val: "7+", label: "Systèmes d'analyse" },
  { val: "10+", label: "Formats supportés" },
  { val: "500+", label: "Agences utilisatrices" },
];

function StatsBanner() {
  return (
    <section className="px-6 pb-36">
      <div className="max-w-5xl mx-auto pt-20">
        <Reveal>
          <div className="rounded-2xl border border-white/[0.10] p-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center" style={{ background: "rgba(8,12,35,0.70)" }}>
            {STATS.map((s) => (
              <div key={s.label}>
                <div className={`text-3xl font-semibold mb-1 ${G}`}>{s.val}</div>
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
 * SECTION 6 — FAQ
 * ═══════════════════════════════════════════════════════ */
const FAQS = [
  { q: "Est-ce que mes contenus seront vraiment uniques pour les plateformes ?", a: "Oui. DuupFlow modifie les métadonnées EXIF/XMP, les paramètres d'encodage et optionnellement des micro-variations visuelles imperceptibles. Chaque fichier possède une empreinte numérique différente, reconnue comme nouveau fichier par les algorithmes de détection d'Instagram, TikTok, YouTube et autres." },
  { q: "Est-ce que DuupFlow modifie la qualité visuelle de mes contenus ?", a: "Non. Par défaut, les transformations sont imperceptibles à l'œil humain. Le mode 'Métadonnées uniquement' ne touche jamais au contenu visuel. Les micro-variations (micro-zoom, saturation ±2%) sont entièrement optionnelles." },
  { q: "Combien de copies puis-je créer d'un seul contenu ?", a: "Il n'y a aucune limite technique. Tu peux générer autant de copies que tu veux en une seule opération. La plupart des agences l'utilisent pour créer entre 5 et 50 variantes par contenu." },
  { q: "Est-ce légal d'utiliser DuupFlow ?", a: "DuupFlow modifie techniquement les fichiers que tu possèdes déjà — il ne crée pas de faux contenus et ne viole pas les droits d'auteur. L'outil est légal ; l'utilisation reste sous ta responsabilité selon les conditions générales de chaque plateforme." },
  { q: "Quels formats de fichiers sont supportés ?", a: "Images : JPG, JPEG, PNG, WEBP, HEIC. Vidéos : MP4, MOV, MKV, AVI, WebM. L'export se fait en JPG/PNG pour les images et MP4 pour les vidéos." },
  { q: "Le module Détection IA fonctionne-t-il aussi pour les vidéos ?", a: "Oui. Le module Détection IA manipule les métadonnées de tous les formats supportés, y compris MP4, MOV et MKV. Il peut masquer les signatures IA dans n'importe quel fichier." },
  { q: "DuupFlow fonctionne-t-il sur tous les réseaux sociaux ?", a: "Oui — Instagram, TikTok, YouTube, Twitter/X, Threads, Pinterest, Facebook et tout réseau qui analyse les empreintes numériques des fichiers. DuupFlow n'est pas limité à un seul réseau." },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" className="relative overflow-hidden">
      {/* Special dark blue background */}
      <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(180deg, #040c28 0%, #06112f 50%, #040c28 100%)" }} />
      {/* Blurred texture blobs */}
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[400px] rounded-full pointer-events-none -z-10"
        style={{ background: "rgba(99,102,241,0.10)", filter: "blur(90px)" }} />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[350px] rounded-full pointer-events-none -z-10"
        style={{ background: "rgba(56,189,248,0.07)", filter: "blur(90px)" }} />
      <div className="absolute top-0 right-0 w-[300px] h-[250px] rounded-full pointer-events-none -z-10"
        style={{ background: "rgba(139,92,246,0.08)", filter: "blur(70px)" }} />
      <div className="px-6 pb-36">
      <div className="max-w-5xl mx-auto pt-20">
        <Reveal>
          <div className="grid md:grid-cols-[2fr_3fr] gap-16">
            <div className="md:sticky md:top-28 self-start">
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3">FAQ</p>
              <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight leading-[1.1]">Questions fréquentes</h2>
              <p className="text-white/60 text-sm mt-4 leading-relaxed">Tu as d&apos;autres questions ? Contacte-nous par email ou via le chat intégré.</p>
            </div>
            <div className="divide-y divide-white/[0.08]">
              {FAQS.map((faq, i) => (
                <div key={i}>
                  <button onClick={() => setOpen(open === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 py-5 text-left text-sm font-medium text-white/90 hover:text-white transition">
                    <span>{faq.q}</span>
                    <span className="shrink-0 h-6 w-6 rounded-full border border-white/15 flex items-center justify-center text-white/50 transition-transform"
                      style={{ transform: open === i ? "rotate(45deg)" : "rotate(0deg)" }}>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                    </span>
                  </button>
                  {open === i && <div className="pb-5 text-sm text-white/70 leading-relaxed">{faq.a}</div>}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
 * SECTION 7 — CTA BOTTOM
 * ═══════════════════════════════════════════════════════ */
function CTABanner() {
  return (
    <section className="px-6 pb-36">
      <div className="max-w-5xl mx-auto pt-20">
        <Reveal>
          <div className="relative rounded-3xl overflow-hidden p-14 text-center"
            style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(56,189,248,0.08) 100%)" }}>
            <div className="pointer-events-none absolute inset-0 border border-white/[0.10] rounded-3xl" />
            <div className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white mb-4 tracking-tight relative">
              Prêt à scaler ton contenu ?
            </h2>
            <p className="text-white/70 text-sm sm:text-base mb-6 sm:mb-8 max-w-md mx-auto relative">
              Tous les modules DuupFlow. Copies illimitées.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 relative">
              <Link href="/register"
                className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 font-semibold text-white text-sm transition hover:opacity-90 hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}>
                Commencer maintenant →
              </Link>
              <Link href="/demo"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-8 py-3.5 font-medium text-sm text-white/80 hover:bg-white/[0.08] transition">
                Voir la démo
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── FOOTER ─── */
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
          <Link href="/legal/terms" className="hover:text-white/60 transition">CGU</Link>
          <Link href="/legal/privacy" className="hover:text-white/60 transition">Confidentialité</Link>
          <Link href="/partenaire" className="hover:text-white/60 transition">Partenaire</Link>
          <a href="mailto:hello@duupflow.com" className="hover:text-white/60 transition">Contact</a>
        </div>
        <div className="mt-4 flex justify-center">
          <a
            href="https://t.me/DuupFlow_Support"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 1 0 24 12.056A12.014 12.014 0 0 0 11.944 0ZM16.906 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472c-.18 1.898-.962 6.502-1.36 8.627c-.168.9-.499 1.201-.82 1.23c-.696.065-1.225-.46-1.9-.902c-1.056-.693-1.653-1.124-2.678-1.8c-1.185-.78-.417-1.21.258-1.91c.177-.184 3.247-2.977 3.307-3.23c.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345c-.48.33-.913.49-1.302.48c-.428-.008-1.252-.241-1.865-.44c-.752-.245-1.349-.374-1.297-.789c.027-.216.325-.437.893-.663c3.498-1.524 5.83-2.529 6.998-3.014c3.332-1.386 4.025-1.627 4.476-1.635Z"/></svg>
            Support Telegram
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ─── ROOT PAGE ─── */
export default function LandingPage() {
  return (
    <div>
      <Hero />
      {/* Separator between hero and content below */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="h-px bg-white/[0.12]" />
      </div>
      <ProblemSolution />
      <div className="max-w-5xl mx-auto px-6">
        <div className="h-px bg-white/[0.12]" />
      </div>
      <FeatureTabs />
      <div className="max-w-5xl mx-auto px-6">
        <div className="h-px bg-white/[0.12]" />
      </div>
      <CoreFeaturesAlt />
      <StatsBanner />
      <FAQ />
      <CTABanner />
      <Footer />
    </div>
  );
}

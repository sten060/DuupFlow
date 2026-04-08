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
    <section className="relative flex flex-col items-center text-center px-6 pt-6 sm:pt-12 pb-20 sm:pb-40 overflow-hidden">

      {/* Social proof avatars */}
      <Reveal>
        <div className="flex items-center gap-2 sm:gap-3 mb-8 sm:mb-10">
          <div className="flex -space-x-2.5">
            {["/testimonials/_ (1).jpeg", "/testimonials/_ (2).jpeg", "/testimonials/_ (3).jpeg", "/testimonials/_ (4).jpeg"].map((src, i) => (
              <img key={i} src={src} alt="" className="h-6 w-6 sm:h-9 sm:w-9 rounded-full border-2 border-[#0B0F1A] object-cover" />
            ))}
          </div>
          <p className="text-xs sm:text-base text-white/60">
            Rejoins <span className="text-white font-semibold">500+</span> agences satisfaites
          </p>
        </div>
      </Reveal>

      {/* Main heading — large, elegant, light weight like LanX */}
      <Reveal delay={80}>
        <h1 className="max-w-5xl text-[2.5rem] sm:text-[3.5rem] md:text-[5rem] font-light leading-[1.08] tracking-[-0.02em] text-white/90 mb-6 sm:mb-7">
          Multiplie ton contenu.{" "}<br className="hidden sm:block" />
          <span className={G}>Domine l&apos;algorithme.</span>
        </h1>
      </Reveal>

      {/* Subtitle */}
      <Reveal delay={160}>
        <p className="max-w-2xl text-white/45 text-base sm:text-lg leading-relaxed mb-8 sm:mb-10">
          <span className="sm:hidden">Chaque copie unique — indétectable par les plateformes.</span>
          <span className="hidden sm:inline">Chaque copie est unique et indétectable par les algorithmes des plateformes. Conçu pour les agences qui veulent scaler leur production de contenu.</span>
        </p>
      </Reveal>

      {/* CTA buttons — slide-in hover effect (CSS in globals.css) */}
      <Reveal delay={240}>
        <div className="flex flex-row gap-3 sm:gap-4 mb-16 sm:mb-24 justify-center">
          <Link href="/register"
            className="btn-glow inline-flex items-center gap-2 rounded-xl px-7 sm:px-9 py-3 sm:py-3.5 font-semibold text-white text-sm sm:text-base">
            Commencer gratuitement
          </Link>
          <Link href="/demo"
            className="slide-btn slide-btn-outline inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/[0.05] px-7 sm:px-9 py-3 sm:py-3.5 font-medium text-sm sm:text-base text-white/80 transition">
            Voir la démo
          </Link>
        </div>
      </Reveal>

      {/* Platform logos — large text marquee like LanX */}
      <Reveal delay={320}>
        <div className="w-screen relative left-1/2 -translate-x-1/2 overflow-hidden py-4">
          <style>{`
            @keyframes marquee-platforms { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
            .marquee-platforms { animation: marquee-platforms 30s linear infinite; }
          `}</style>

          <div className="marquee-platforms flex items-center gap-16 sm:gap-24 w-max">
            {[...Array(2)].map((_, dup) => (
              <div key={dup} className="flex items-center gap-16 sm:gap-24">
                {[
                  { name: "Instagram", icon: <svg className="h-6 w-6 sm:h-7 sm:w-7" viewBox="0 0 24 24" fill="currentColor"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 01-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 017.8 2zm-.2 2A3.6 3.6 0 004 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 003.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6zm9.65 1.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zM12 7a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6z"/></svg> },
                  { name: "TikTok", icon: <svg className="h-6 w-6 sm:h-7 sm:w-7" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.17a8.16 8.16 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.6z"/></svg> },
                  { name: "Reddit", icon: <svg className="h-6 w-6 sm:h-7 sm:w-7" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.8 11.33c.02.16.03.33.03.5 0 2.55-2.97 4.63-6.63 4.63s-6.63-2.07-6.63-4.63c0-.17.01-.33.03-.5a1.45 1.45 0 01-.53-1.11 1.45 1.45 0 012.47-1.05 7.2 7.2 0 013.95-1.24l.74-3.49a.3.3 0 01.35-.24l2.49.53a1.04 1.04 0 011.96.47 1.04 1.04 0 01-1.85.66l-2.14-.45-.65 3.05a7.13 7.13 0 013.87 1.23 1.45 1.45 0 012.47 1.05c0 .42-.2.8-.53 1.09zM9.5 13a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5zm5 0a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5z"/></svg> },
                  { name: "Threads", icon: <svg className="h-6 w-6 sm:h-7 sm:w-7" viewBox="0 0 192 192" fill="currentColor"><path d="M141.537 88.988a66.667 66.667 0 00-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.737-8.706 14.612-10.586 21.341-10.586h.232c8.24.054 14.466 2.452 18.51 7.13 2.96 3.424 4.948 8.174 5.956 14.218a86.34 86.34 0 00-24.478-2.636c-25.544 0-41.972 13.462-41.46 33.977.262 10.48 5.282 19.544 14.13 25.518 7.504 5.063 17.16 7.58 27.2 7.1 13.256-.63 23.636-5.468 30.862-14.372 5.484-6.756 8.926-15.378 10.372-26.076 6.214 3.746 10.822 8.694 13.396 14.768 4.258 10.048 4.508 26.542-7.846 38.878-10.834 10.82-23.862 15.502-43.622 15.666-21.852-.182-38.354-7.152-49.074-20.73C40.84 142.562 35.25 122.282 35.058 98c.192-24.282 5.782-44.562 16.616-60.276C62.394 24.146 78.896 17.176 100.748 16.994c22.02.186 38.742 7.19 49.698 20.834 5.398 6.726 9.484 14.876 12.2 24.276l15.022-4.082c-3.222-11.108-8.132-20.834-14.708-29.024C149.422 12.464 128.994 4.262 100.844 4.044h-.192C72.626 4.26 52.378 12.502 38.84 29.142 23.704 48.024 15.988 74.084 15.76 98.046l-.004.108c.228 23.962 7.944 50.022 23.08 68.904C52.378 183.698 72.626 191.94 100.652 192.156h.192c24.312-.186 42.082-6.776 57.532-21.36 20.588-19.432 19.78-43.586 13.792-57.608-4.292-10.064-12.396-18.246-23.631-23.2zM99.522 149.198c-15.832.756-31.894-6.29-32.372-20.386-.34-10.076 7.18-21.274 28.598-21.274a76.376 76.376 0 0121.022 2.946c-2.394 27.944-17.248 38.714-17.248 38.714z"/></svg> },
                  { name: "X", icon: <svg className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
                  { name: "YouTube", icon: <svg className="h-6 w-6 sm:h-7 sm:w-7" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> },
                ].map((p) => (
                  <div key={p.name} className="flex items-center gap-2.5 text-white/25 shrink-0">
                    {p.icon}
                    <span className="text-xl sm:text-2xl font-semibold whitespace-nowrap tracking-tight">{p.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
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
              <div className="rounded-xl border border-red-500/25 p-5" style={{ background: "rgba(30,5,5,0.70)" }}>
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
              <div className="rounded-xl border border-indigo-500/25 p-5" style={{ background: "rgba(5,8,40,0.75)" }}>
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

/* ── Compact mockups for horizontal scroller cards ── */
function MockupDuplication() {
  const copies = [
    { name: "DuupFlow_dup1_47.jpg", type: "Image", size: "2.4 MB" },
    { name: "DuupFlow_dup2_83.mp4", type: "Vidéo", size: "18.7 MB" },
    { name: "DuupFlow_dup3_12.jpg", type: "Image", size: "2.4 MB" },
  ];
  return (
    <div className="space-y-2.5 text-xs">
      <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 flex items-center gap-2.5">
        <span className="text-base">📁</span>
        <div className="flex-1 min-w-0"><p className="text-white/70 font-medium truncate">contenu_source</p><p className="text-[10px] text-white/30">Fichier source</p></div>
        <span className="px-2 py-0.5 rounded border border-white/10 bg-white/[0.04] text-white/40 text-[10px]">Source</span>
      </div>
      <div className="flex justify-center"><svg className="h-4 w-4 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7" /></svg></div>
      {copies.map((f) => (
        <div key={f.name} className="rounded-lg border border-indigo-500/20 bg-indigo-500/[0.04] px-3 py-2.5 flex items-center gap-2.5">
          <span className="text-base">{f.type === "Image" ? "🖼️" : "🎬"}</span>
          <div className="flex-1 min-w-0"><p className="text-white/60 font-mono truncate text-[11px]">{f.name}</p><p className="text-[10px] text-white/25">Métadonnées uniques · {f.size}</p></div>
          <svg className="h-3.5 w-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
      ))}
    </div>
  );
}

function MockupInvisible() {
  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5">
        <p className="text-[10px] text-white/30 font-mono mb-0.5">Original Hash</p>
        <p className="text-indigo-300 font-mono text-[11px]">a7f3e2d1c4b8...9f0a6e3d</p>
      </div>
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/[0.10]">
          <span className="text-xs">✨</span><span className="text-[11px] font-semibold text-indigo-300">Pixel magique</span>
        </div>
      </div>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2.5">
        <p className="text-[10px] text-white/30 font-mono mb-0.5">Modified Hash</p>
        <p className="text-emerald-300 font-mono text-[11px]">9b2e8f4a7c1d...3b5d2e8f</p>
      </div>
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-center">
        <p className="text-white/60 font-medium text-[11px] mb-0.5">Visuellement identique</p>
        <p className="text-[10px] text-white/30">Le contenu visuel ne change pas. Seule l&apos;empreinte est modifiée.</p>
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
    <div className="space-y-2.5 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-6 w-6 rounded-md bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
          <svg className="h-3 w-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <span className="text-[11px] font-semibold text-indigo-300">Métadonnées iPhone injectées</span>
      </div>
      {fields.map((f) => (
        <div key={f.key} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 flex items-center justify-between">
          <span className="text-white/35 font-mono text-[11px]">{f.key}</span>
          <span className="text-indigo-300 font-mono text-[11px]">{f.value}</span>
        </div>
      ))}
      <div className="rounded-lg border border-indigo-500/15 bg-indigo-500/[0.04] px-3 py-2 text-center">
        <p className="text-[10px] text-indigo-300/70">L&apos;algorithme traite votre contenu comme un vrai iPhone</p>
      </div>
    </div>
  );
}

function MockupAI() {
  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3 py-3">
        <p className="text-[10px] text-amber-400 font-medium mb-2 flex items-center gap-1"><span>⚡</span> Signature IA détectée</p>
        <div className="space-y-1.5">
          {[["Software", "Midjourney v6.1"], ["Artist", "Midjourney Bot"], ["Creator", "midjourney.com"]].map(([k, v]) => (
            <div key={k} className="flex justify-between"><span className="text-white/35 font-mono text-[11px]">{k}</span><span className="text-amber-300/80 font-mono text-[11px]">{v}</span></div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-3">
        <p className="text-[10px] text-emerald-400 font-medium mb-2 flex items-center gap-1"><span>🛡️</span> Signature IA effacée</p>
        <div className="space-y-1.5">
          {[["Software", "Adobe Lightroom 7.2"], ["Make", "Sony"], ["Model", "A7 IV"]].map(([k, v]) => (
            <div key={k} className="flex justify-between"><span className="text-white/35 font-mono text-[11px]">{k}</span><span className="text-emerald-300/80 font-mono text-[11px]">{v}</span></div>
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
 * SECTION 3b — HORIZONTAL SCROLLER (replaces FeatureTabs)
 * ═══════════════════════════════════════════════════════ */
const GLOW = "text-[#5B7BFF]";
const GS = { textShadow: "0 0 25px rgba(91,123,255,0.5)" };

const SCROLLER_CARDS = [
  {
    title: <><span className={GLOW} style={GS}>Duplication</span> Images &amp; Vidéos</>,
    desc: "Dupliquez vos images et vidéos en masse. Chaque copie est unique — métadonnées, empreinte technique, hash. Indétectable par les plateformes.",
    accent: "#6366F1",
  },
  {
    title: <>Modification <span className={GLOW} style={GS}>Invisible</span></>,
    desc: "Modifiez l'empreinte numérique sans toucher au visuel. Pixel magique change le hash de chaque fichier tout en gardant le contenu visuellement identique.",
    accent: "#6366F1",
  },
  {
    title: <><span className={GLOW} style={GS}>Priorité</span> d&apos;algorithme</>,
    desc: "Localisez votre contenu et injectez des métadonnées iPhone authentiques. L'algorithme pense que votre contenu vient d'un appareil réel.",
    accent: "#6366F1",
  },
  {
    title: <>Détection <span className={GLOW} style={GS}>IA</span></>,
    desc: "Effacez la signature IA de vos contenus. Remplacez les métadonnées Midjourney, DALL-E, Stable Diffusion par une identité humaine réaliste.",
    accent: "#6366F1",
    badge: "NEW",
  },
];

function FeaturesScroller() {
  const stickyRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollX, setScrollX] = useState(0);

  useEffect(() => {
    const container = stickyRef.current;
    if (!container) return;
    const onScroll = () => {
      const rect = container.getBoundingClientRect();
      const stickyTop = 0;
      const scrolled = stickyTop - rect.top;
      const maxScroll = container.offsetHeight - window.innerHeight;
      const progress = Math.max(0, Math.min(1, scrolled / maxScroll));
      const track = trackRef.current;
      if (track) {
        const lastCard = track.lastElementChild as HTMLElement | null;
        const cardWidth = lastCard?.offsetWidth ?? 0;
        const maxX = track.scrollWidth - cardWidth - (window.innerWidth - cardWidth) / 2;
        setScrollX(progress * Math.max(0, maxX));
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const cards = SCROLLER_CARDS;
  const stickyHeight = `${(cards.length + 2) * 100}vh`;

  return (
    <section ref={stickyRef} className="relative" style={{ height: stickyHeight }}>
      <div className="sticky top-0 h-screen overflow-hidden flex flex-col justify-center">
        <Reveal>
          <div className="px-6 sm:px-12 mb-20">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white tracking-tight mb-4 leading-[1.1]">
              Augmentez le <span className="text-[#5B7BFF]" style={{ textShadow: "0 0 30px rgba(91,123,255,0.5)" }}>volume</span>, performez,<br className="hidden sm:block" /> sans perte de <span className="text-[#5B7BFF]" style={{ textShadow: "0 0 30px rgba(91,123,255,0.5)" }}>qualité</span>
            </h2>
            <p className="text-white/40 text-sm sm:text-lg max-w-2xl">
              Tous les outils dont vous avez besoin pour scaler votre production de contenu.
            </p>
          </div>
        </Reveal>
        <div ref={trackRef} className="flex gap-[12vw] will-change-transform" style={{ transform: `translateX(calc(50vw - 35vw - ${scrollX}px))` }}>
          {cards.map((card, i) => (
            <div key={i} className="shrink-0 w-[88vw] sm:w-[78vw] md:w-[70vw] rounded-md border border-white/[0.08] overflow-hidden" style={{ background: "rgba(8,12,35,0.6)" }}>
              <div className="grid md:grid-cols-[1fr_1.2fr]">
                <div className="p-6 sm:p-8">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-xl sm:text-2xl font-semibold text-white">{card.title}</h3>
                    {"badge" in card && card.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/25 font-semibold">{card.badge}</span>
                    )}
                  </div>
                  <p className="text-sm sm:text-base text-white/50 leading-relaxed mb-6">{card.desc}</p>
                  <Link href="/register" className="inline-flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition">Essayer maintenant →</Link>
                </div>
                <div className="p-6 sm:p-8 flex items-center">
                  <div className="w-full">{MOCKUPS[["duplication", "invisible", "priority", "ai"][i]]}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── How It Works — CardShowcase ── */
const HOW_STEPS = [
  { num: "01", title: "Importe ton contenu", desc: "Glisse-dépose ton image ou ta vidéo dans DuupFlow. JPG, PNG, WEBP, MP4, MOV, MKV — tous les formats sont acceptés, même en lot.", tag: "Upload" },
  { num: "02", title: "Duplique en illimité", desc: "Choisis le nombre de copies et les options (visuel, semi-visuel, métadonnées). DuupFlow modifie chaque fichier pour qu'il soit unique aux yeux des algorithmes de détection.", tag: "Duplication" },
  { num: "03", title: "Télécharge et publie", desc: "Exporte tes contenus en ZIP ou un par un. Chaque fichier est prêt à être publié sur Instagram, TikTok, YouTube, Twitter/X ou n'importe quelle plateforme.", tag: "Export" },
];

function HowItWorks() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const activeRef = useRef(0);
  const progressRef = useRef(0);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    const tick = 16;
    const speed = 5;
    const increment = (100 / (speed * 1000)) * tick;
    const interval = setInterval(() => {
      progressRef.current += increment;
      if (progressRef.current >= 100) {
        const next = (activeRef.current + 1) % HOW_STEPS.length;
        activeRef.current = next;
        progressRef.current = 0;
        setActiveIndex(next);
        setProgress(0);
      } else {
        setProgress(progressRef.current);
      }
    }, tick);
    return () => clearInterval(interval);
  }, [isMobile]);

  const handleClick = (i: number) => {
    if (isMobile) return;
    activeRef.current = i;
    progressRef.current = 0;
    setActiveIndex(i);
    setProgress(0);
  };

  return (
    <section id="how-it-works" className="px-6 pb-36">
      <div className="max-w-5xl mx-auto pt-20">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3">Comment ça marche</p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white mb-4 tracking-tight">
            Opérationnel <span className={G}>en 3 étapes</span>
          </h2>
          <p className="text-white/45 text-sm sm:text-base mb-12 max-w-xl">
            Simple, rapide, sans courbe d&apos;apprentissage.
          </p>
        </Reveal>

        <Reveal delay={80}>
          {isMobile ? (
            <div className="flex flex-col gap-4">
              {HOW_STEPS.map((card, i) => (
                <div key={i} className="border border-white/[0.08] p-5" style={{ background: "rgba(8,12,35,0.6)" }}>
                  <div className="text-3xl font-bold text-indigo-400/40 mb-3 tracking-tight">{card.num}</div>
                  <h3 className="text-lg font-semibold text-white mb-2">{card.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed mb-3">{card.desc}</p>
                  <span className="text-xs text-indigo-400 font-medium">{card.tag}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-0 w-full" style={{ height: "380px" }}>
              {HOW_STEPS.map((card, i) => {
                const isActive = i === activeIndex;
                return (
                  <div key={i} onClick={() => handleClick(i)}
                    className="relative cursor-pointer border border-white/[0.08] p-6 overflow-hidden"
                    style={{ background: "rgba(8,12,35,0.6)", flex: isActive ? 2.5 : 1, transition: "flex 0.5s ease-in-out", display: "flex", flexDirection: "column" }}>
                    <div className="absolute bottom-0 left-0 w-[2px]" style={{ height: "100%", background: "rgba(255,255,255,0.06)" }}>
                      {isActive && <div className="absolute bottom-0 left-0 w-full" style={{ height: `${progress}%`, background: "linear-gradient(to top, #6366F1, #818CF8)", transition: "height 16ms linear" }} />}
                    </div>
                    <div className="text-4xl font-bold tracking-tight mb-3" style={{ color: isActive ? "rgba(129,140,248,0.6)" : "rgba(129,140,248,0.25)", transition: "color 0.3s" }}>{card.num}</div>
                    <h3 className="text-lg font-semibold mb-3" style={{ color: isActive ? "white" : "rgba(255,255,255,0.5)", transition: "color 0.3s" }}>{card.title}</h3>
                    <div style={{ opacity: isActive ? 1 : 0, maxHeight: isActive ? "300px" : "0px", overflow: "hidden", transition: "opacity 0.3s ease, max-height 0.4s ease", display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
                      <p className="text-sm text-white/60 leading-relaxed">{card.desc}</p>
                      <span className="text-xs text-indigo-400 font-medium mt-4">{card.tag}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Reveal>
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

/* Animated Mockup 3 — Invisible Modification (Pixel magique) */
function AnimInvisible() {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`h-2 w-2 rounded-full transition-colors duration-500 ${phase === 2 ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"}`} />
        <span className="text-xs text-white/50">
          {phase === 0 ? "Hash original détecté..." : phase === 1 ? "Pixel magique en cours..." : "Hash modifié ✓"}
        </span>
      </div>
      <div className={`rounded-xl border p-4 transition-all duration-500 ${phase === 0 ? "border-amber-500/25 bg-amber-500/[0.05]" : "border-white/10 bg-white/[0.04]"}`}>
        <p className="text-xs text-white/40 font-mono mb-1">Original Hash</p>
        <p className={`text-sm font-mono transition-all duration-500 ${phase === 0 ? "text-amber-300" : "text-white/30 line-through"}`}>a7f3e2d1c4b8...9f0a6e3d</p>
      </div>
      <div className="flex justify-center">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-500 ${phase >= 1 ? "border-indigo-500/30 bg-indigo-500/[0.10] scale-105" : "border-white/10 bg-white/[0.04] scale-100"}`}>
          <span className="text-sm">✨</span>
          <span className={`text-xs font-semibold transition-colors duration-500 ${phase >= 1 ? "text-indigo-300" : "text-white/40"}`}>Pixel magique</span>
        </div>
      </div>
      <div className={`rounded-xl border p-4 transition-all duration-500 ${phase === 2 ? "border-emerald-500/25 bg-emerald-500/[0.05]" : "border-white/10 bg-white/[0.04]"}`}>
        <p className="text-xs text-white/40 font-mono mb-1">Modified Hash</p>
        <p className={`text-sm font-mono transition-all duration-500 ${phase === 2 ? "text-emerald-300" : "text-white/20"}`}>9b2e8f4a7c1d...3b5d2e8f</p>
      </div>
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-center">
        <p className={`text-sm font-medium transition-colors duration-500 ${phase === 2 ? "text-emerald-300" : "text-white/50"}`}>Visuellement identique</p>
        <p className="text-xs text-white/35">Le contenu visuel ne change pas</p>
      </div>
    </div>
  );
}

/* Animated Mockup — Priority (iPhone metadata injection) */
function AnimPriority() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    function play() {
      setStep(0);
      const t1 = setTimeout(() => setStep(1), 600);
      const t2 = setTimeout(() => setStep(2), 1200);
      const t3 = setTimeout(() => setStep(3), 1800);
      const t4 = setTimeout(() => setStep(4), 2400);
      return [t1, t2, t3, t4];
    }
    const timers = play();
    const loop = setInterval(() => { timers.forEach(clearTimeout); play(); }, 5000);
    return () => { timers.forEach(clearTimeout); clearInterval(loop); };
  }, []);

  const fields = [
    { key: "Make", value: "Apple" },
    { key: "Model", value: "iPhone 16 Pro" },
    { key: "Software", value: "18.3" },
    { key: "Location", value: "Paris, France" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
          <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <span className="text-xs text-white/50">{step} / 4 métadonnées injectées</span>
      </div>
      {fields.map((f, i) => (
        <div key={f.key}
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 flex items-center justify-between transition-all duration-500"
          style={{ opacity: step > i ? 1 : 0.2, transform: step > i ? "translateX(0)" : "translateX(8px)" }}>
          <span className="text-xs text-white/40 font-mono">{f.key}</span>
          <span className={`text-xs font-mono transition-colors duration-500 ${step > i ? "text-emerald-300" : "text-white/20"}`}>{f.value}</span>
          {step > i && (
            <svg className="h-3.5 w-3.5 text-emerald-400 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg>
          )}
        </div>
      ))}
      {step >= 4 && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] p-3 text-center transition-all duration-500">
          <p className="text-xs text-indigo-300">L&apos;algorithme traite votre contenu comme un vrai iPhone</p>
        </div>
      )}
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
          {phase === 0 ? "Analyse en cours..." : phase === 1 ? "Remplacement des métadonnées..." : "Signature IA effacée ✓"}
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

/* ── Avantages — Image Expand on Hover (Framer-style) ── */
const ADVANTAGES = [
  {
    title: "Duplication en masse",
    desc: "Dupliquez des dizaines de fichiers en quelques secondes. Chaque copie est unique.",
    tags: ["Images & Vidéos", "Illimité", "Parallèle", "Instantané"],
    gradient: "linear-gradient(180deg, #0c1a3a 0%, #162850 40%, #0a1628 100%)",
    mockup: (
      <div className="space-y-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2.5 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-sm">📁</div>
          <div className="flex-1 min-w-0"><p className="text-xs text-white/70 font-medium truncate">video_campagne.mp4</p><p className="text-[10px] text-white/30">Source · 24.5 MB</p></div>
        </div>
        <div className="flex justify-center"><svg className="h-3 w-3 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 5v14M5 12l7 7 7-7" /></svg></div>
        {["dup1_47.mp4", "dup2_83.mp4", "dup3_12.mp4"].map((f) => (
          <div key={f} className="rounded-lg border border-indigo-500/20 bg-indigo-500/[0.04] p-2 flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-white/[0.06] flex items-center justify-center text-[10px]">🎬</div>
            <p className="text-[10px] text-white/50 font-mono truncate flex-1">{f}</p>
            <svg className="h-3 w-3 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Qualité préservée",
    desc: "Résolution identique pixel par pixel. 1080p reste 1080p, 4K reste 4K.",
    tags: ["4K", "Lossless", "Pixel Perfect", "Pro"],
    gradient: "linear-gradient(180deg, #0f0f2a 0%, #1a1a45 40%, #0f0f1a 100%)",
    mockup: (
      <div className="space-y-2">
        {[["Original", "3840×2160", "HEVC", "#818CF8"], ["Copie", "3840×2160", "H.264", "#34D399"]].map(([label, res, codec, color]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
            <p className="text-[10px] font-medium mb-1" style={{ color }}>{label}</p>
            <div className="flex justify-between"><span className="text-[10px] text-white/40">Résolution</span><span className="text-[10px] text-white/70">{res}</span></div>
            <div className="flex justify-between"><span className="text-[10px] text-white/40">Codec</span><span className="text-[10px] text-white/70">{codec}</span></div>
          </div>
        ))}
        <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] p-2 text-center"><p className="text-[10px] text-emerald-300">Qualité : identique ✓</p></div>
      </div>
    ),
  },
  {
    title: "Invisible pour les algos",
    desc: "Hash, métadonnées, structure technique — tout est modifié invisiblement.",
    tags: ["Anti-détection", "Hash unique", "EXIF", "Indétectable"],
    gradient: "linear-gradient(180deg, #1a0a30 0%, #2d1060 40%, #150a28 100%)",
    mockup: (
      <div className="space-y-2">
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-2.5"><p className="text-[10px] text-white/40 font-mono mb-0.5">Hash original</p><p className="text-[10px] text-amber-300 font-mono">a7f3e2d1...9f0a6e3d</p></div>
        <div className="flex justify-center"><div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-indigo-500/25 bg-indigo-500/[0.08]"><span className="text-[10px]">✨</span><span className="text-[10px] font-semibold text-indigo-300">Pixel magique</span></div></div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-2.5"><p className="text-[10px] text-white/40 font-mono mb-0.5">Nouveau hash</p><p className="text-[10px] text-emerald-300 font-mono">9b2e8f4a...3b5d2e8f</p></div>
      </div>
    ),
  },
  {
    title: "Priorité algorithme",
    desc: "Métadonnées iPhone injectées. L'algorithme vous priorise.",
    tags: ["iPhone", "GPS", "iOS", "Boost algo"],
    gradient: "linear-gradient(180deg, #0a1830 0%, #162850 40%, #0a1220 100%)",
    mockup: (
      <div className="space-y-1.5">
        {[["Make", "Apple"], ["Model", "iPhone 16 Pro"], ["Software", "iOS 18.3"], ["GPS", "48.86°N, 2.35°E"]].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-white/35 font-mono">{k}</span>
            <span className="text-[10px] text-emerald-300 font-mono">{v}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Masquage IA",
    desc: "Effacez les signatures Midjourney, DALL-E. Identité humaine injectée.",
    tags: ["C2PA", "JUMBF", "Anti-IA", "Identité"],
    gradient: "linear-gradient(180deg, #1a0e35 0%, #261850 40%, #0f1830 100%)",
    mockup: (
      <div className="space-y-1.5">
        {[["C2PA", "supprimé ✓"], ["JUMBF", "supprimé ✓"], ["EXIF IA", "remplacé ✓"], ["Identité", "humaine ✓"]].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-white/35 font-mono">{k}</span>
            <span className="text-[10px] text-emerald-400 font-mono">{v}</span>
          </div>
        ))}
      </div>
    ),
  },
];

function AvantagesCarousel() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Compute flex for each card based on distance from hovered
  const getFlex = (i: number) => {
    const active = hoveredIndex ?? 0;
    if (i === active) return 4;
    const dist = Math.abs(i - active);
    if (dist === 1) return 1.8;
    return 1;
  };

  return (
    <section id="features" className="px-6 pb-20">
      <div className="max-w-6xl mx-auto pt-20">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3">Avantages</p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white mb-4 tracking-tight">
            Pourquoi les agences choisissent <span className={G}>DuupFlow</span>
          </h2>
          <p className="text-white/45 text-sm sm:text-base mb-12 max-w-xl">
            Chaque publication unique. Chaque fichier indétectable.
          </p>
        </Reveal>

        <Reveal delay={80}>
          {/* Desktop: panels that expand on hover — hovered=large, adjacent=medium, rest=small */}
          <div className="hidden md:flex gap-2 w-full" style={{ height: "560px" }}>
            {ADVANTAGES.map((adv, i) => {
              const isActive = i === (hoveredIndex ?? 0);
              const flex = getFlex(i);
              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="relative overflow-hidden cursor-pointer flex flex-col"
                  style={{
                    flex,
                    transition: "flex 0.6s cubic-bezier(0.4,0,0.2,1)",
                    borderRadius: "6px",
                  }}
                >
                  {/* Background gradient */}
                  <div className="absolute inset-0" style={{ background: adv.gradient }} />
                  <div className="absolute inset-0" style={{
                    background: isActive ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.45)",
                    transition: "background 0.4s",
                  }} />

                  {/* Mockup area — top 70% */}
                  <div className="relative z-10 flex-1 p-4 flex items-center justify-center overflow-hidden" style={{
                    opacity: isActive ? 1 : 0.3,
                    transition: "opacity 0.4s",
                  }}>
                    <div className="w-full max-w-[280px]">{adv.mockup}</div>
                  </div>

                  {/* Text area — bottom 30% */}
                  <div className="relative z-10 p-4 pt-0" style={{
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? "translateY(0)" : "translateY(8px)",
                    transition: "opacity 0.35s ease, transform 0.35s ease",
                  }}>
                    <h3 className="text-sm font-semibold text-white mb-1">{adv.title}</h3>
                    <p className="text-[11px] text-white/50 leading-relaxed mb-3">{adv.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {adv.tags.map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-1 bg-black/30 backdrop-blur-sm border border-white/10 text-white/70">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile: vertical stack */}
          <div className="md:hidden flex flex-col gap-3">
            {ADVANTAGES.map((adv, i) => (
              <div key={i} className="relative overflow-hidden flex flex-col" style={{ borderRadius: "6px" }}>
                <div className="absolute inset-0" style={{ background: adv.gradient }} />
                <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.2)" }} />
                <div className="relative z-10 p-4">{adv.mockup}</div>
                <div className="relative z-10 p-4 pt-0">
                  <h3 className="text-sm font-semibold text-white mb-1">{adv.title}</h3>
                  <p className="text-[11px] text-white/50 leading-relaxed mb-2">{adv.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {adv.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-1 bg-black/30 border border-white/10 text-white/70">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* CTA under avantages */}
        <Reveal delay={120}>
          <div className="text-center mt-16">
            <p className="text-white/60 text-lg mb-6">Envie d&apos;aller plus loin ?</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/fonctionnalites"
                className="btn-glow inline-flex items-center gap-2 rounded-xl px-7 py-3.5 font-semibold text-white text-sm">
                Voir les fonctionnalités
              </Link>
              <Link href="/demo"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-7 py-3.5 font-medium text-sm text-white/80 hover:bg-white/[0.08] transition">
                Voir la démo
              </Link>
            </div>
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
  { q: "Comment DuupFlow rend chaque copie unique ?", a: "DuupFlow modifie les métadonnées (EXIF, XMP, QuickTime), les paramètres techniques (bitrate, GOP, FPS), et peut ajouter du bruit imperceptible via Pixel magique. Chaque copie a un hash unique — les plateformes voient un fichier différent." },
  { q: "Qu'est-ce que la Priorité d'algorithme ?", a: "C'est une fonctionnalité qui injecte des métadonnées Apple authentiques dans vos fichiers : modèle iPhone, version iOS, caméra, GPS, signature. Les plateformes pensent que le contenu provient d'un vrai iPhone, ce qui améliore son traitement par les algorithmes." },
  { q: "Qu'est-ce que Pixel magique ?", a: "Pixel magique ajoute un bruit luma imperceptible à chaque pixel. Visuellement identique, mais le hash du fichier est complètement différent. Les algorithmes de détection de doublons ne peuvent pas faire le lien entre l'original et la copie." },
  { q: "La qualité est-elle préservée ?", a: "Oui. DuupFlow conserve la résolution originale — 1080p reste 1080p, 4K reste 4K. Aucun downscale, aucune perte de qualité." },
  { q: "Est-ce que DuupFlow peut masquer la signature IA ?", a: "Oui. Le module Détection IA efface toutes les métadonnées IA (EXIF, XMP, IPTC, C2PA, JUMBF) et les remplace par une identité humaine réaliste — appareil photo, logiciel, photographe, date." },
  { q: "Combien de copies puis-je générer ?", a: "Le nombre dépend de votre abonnement. Tous les plans permettent la duplication en masse avec des copies illimitées par fichier." },
  { q: "Quels formats sont supportés ?", a: "Images : JPEG, PNG, WebP. Vidéos : MP4, MOV, MKV, AVI, WebM. Le format MOV est utilisé automatiquement avec la Priorité d'algorithme pour simuler un vrai iPhone." },
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
                className="btn-glow inline-flex items-center gap-2 rounded-xl px-8 py-3.5 font-semibold text-white text-sm">
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
      <FeaturesScroller />
      <HowItWorks />
      <AvantagesCarousel />
      <StatsBanner />
      <FAQ />
      <CTABanner />
      <Footer />
    </div>
  );
}

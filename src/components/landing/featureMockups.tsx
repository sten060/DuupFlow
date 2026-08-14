"use client";

import { BLUE, CTA_GRAD } from "@/components/landing/shell";
import { useLoopInView } from "@/components/landing/videoShowcase";

/* ══════════════════════════════════════════════════════════════
 * MOCKUPS ANIMÉS — ce que fait le produit, montré plutôt que décrit.
 * 100% CSS (keyframes duup-* dans globals.css), aucun média chargé,
 * et tout se fige proprement sous prefers-reduced-motion.
 * ══════════════════════════════════════════════════════════════ */

const CHROME_DOT = "h-2 w-2 rounded-full";

/* Barre de fenêtre commune aux deux grands mockups. */
function Chrome({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-black/[0.06] px-3.5 py-2.5">
      <span className={`${CHROME_DOT} bg-[#e5e8ef]`} />
      <span className={`${CHROME_DOT} bg-[#e5e8ef]`} />
      <span className={`${CHROME_DOT} bg-[#e5e8ef]`} />
      <span className="ml-1.5 text-[11px] font-semibold text-[#1a1a1a]">{title}</span>
      {badge && (
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#4686FE]/10 px-2 py-0.5 text-[9px] font-semibold" style={{ color: BLUE }}>
          <span className="duup-breathe h-1.5 w-1.5 rounded-full" style={{ background: BLUE }} />
          {badge}
        </span>
      )}
    </div>
  );
}

/* ─── ÉDITEUR IA ───
   Une prise unique en 3 temps, cycle de 12 s :
   1) le curseur dépose la réf au centre → elle se range à gauche, un peu plus
      petite, pendant que tes fichiers bruts montent à droite ;
   2) Claude monte ; 3) la vidéo finie à droite, la conversation à gauche,
      avec la réponse du user qu'on voit se taper puis partir dans le fil.
   Fenêtres écrites en dur (duup-cursor, duup-ref, duup-f1…, globals.css). */
const CLAUDE_MARK = "/claude-ai-logo-rounded-hd-free-png-1.webp";
export const CLAUDE_WORDMARK = "/Claude_AI_logo.svg.webp";
/* Dérivées optimisées des fichiers de /public (5,4 Mo → 76 Ko ; 55 Mo → 366 Ko). */
const REF_VIDEO = "/mock-reference.jpg";
const FILE_RUSH = "/mock-rush.jpg";
const FILE_LOGO = "/mock-logo.png";
const OUTPUT_VIDEO = "/mock-output.mp4";
const OUTPUT_POSTER = "/mock-output-poster.jpg";
/* Vignette du mockup Duplication (inchangée). */
const THUMB = "/variant-thumb.jpg";

/* Bulle de conversation. `mine` = message du user, aligné à droite. */
function Bubble({ mine, children, className }: { mine?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={`${className ?? ""} flex ${mine ? "justify-end" : "justify-start"}`}>
      <span
        className={`max-w-[86%] rounded-[12px] px-2.5 py-1.5 text-[11px] leading-snug ${mine ? "text-white" : "bg-[#f2f4f8] text-[#1a1a1a]"}`}
        style={mine ? { background: CTA_GRAD } : undefined}
      >
        {children}
      </span>
    </div>
  );
}

export function AiEditorMockup({ locale, reduced }: { locale: "fr" | "en"; reduced: boolean }) {
  const fr = locale === "fr";
  const { ref } = useLoopInView(reduced, 0.2);
  const files = [
    { src: FILE_RUSH, n: "IMG_0831.MOV", beat: "duup-f1" },
    { src: FILE_LOGO, n: "logo-marque.png", beat: "duup-f2" },
    { src: CLAUDE_MARK, n: "claude-logo.webp", beat: "duup-f3" },
  ];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[16px] bg-white shadow-[0_1px_3px_rgba(20,40,90,0.05),0_10px_24px_rgba(20,40,90,0.08),0_28px_56px_rgba(20,40,90,0.07)]">
      <div className="flex items-center gap-2 border-b border-black/[0.05] px-4 py-2.5">
        <span className="text-[11.5px] font-semibold text-[#1a1a1a]">{fr ? "Éditeur IA" : "AI Editor"}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#4686FE]/10 px-2 py-0.5 text-[9.5px] font-semibold" style={{ color: BLUE }}>
          <img src={CLAUDE_MARK} alt="" className="h-3 w-3 rounded-[3px] object-contain" />
          Claude
        </span>
      </div>

      <div className="relative min-h-0 flex-1 p-4">
        {/* ── 1 · La réf déposée, puis rangée à gauche ── */}
        <div className="duup-ref absolute bottom-4 left-4 top-4 aspect-[9/16] overflow-hidden rounded-[11px] bg-[#eef1f7] shadow-[0_10px_26px_rgba(20,40,90,0.20)]">
          <img src={REF_VIDEO} alt="" className="h-full w-full object-cover" />
          <span className="absolute inset-x-1 bottom-1 rounded-[7px] bg-black/55 py-0.5 text-center text-[8.5px] font-semibold text-white backdrop-blur-sm">
            {fr ? "la réf" : "the ref"}
          </span>
        </div>

        {/* Le curseur qui vient déposer le fichier */}
        <span aria-hidden className="duup-cursor pointer-events-none absolute left-1/2 top-1/2 z-10">
          <svg className="h-5 w-5 drop-shadow" viewBox="0 0 24 24" fill="#1a1a1a" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round">
            <path d="M5 3l14 8-6.2 1.6L9.6 19z" />
          </svg>
        </span>

        {/* ── Tes fichiers bruts, à droite ── */}
        <div className="absolute bottom-4 right-4 top-4 flex w-[62%] flex-col justify-center gap-2">
          {files.map((f) => (
            <div key={f.n} className={`${f.beat} flex items-center gap-2.5 rounded-[10px] bg-[#f7f8fb] px-3 py-2`}>
              <img src={f.src} alt="" className="h-7 w-7 shrink-0 rounded-[6px] object-cover" />
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#1a1a1a]">{f.n}</span>
              <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="4.5"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
          ))}
        </div>

        {/* ── 2 · Claude monte ── */}
        <div className="duup-work absolute inset-4 flex flex-col items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-white shadow-[0_10px_26px_rgba(20,40,90,0.14)]">
            <img src={CLAUDE_MARK} alt="" className="h-10 w-10 rounded-[13px] object-contain" />
          </span>
          <span className="mt-3.5 h-1 w-40 overflow-hidden rounded-full bg-[#eaedf4]">
            <span className="duup-workbar block h-1 rounded-full" style={{ background: CTA_GRAD }} />
          </span>
          <p className="mt-3 text-[12px] font-medium text-[#4a4f5c]">{fr ? "Claude monte ta vidéo" : "Claude edits your video"}</p>
        </div>

        {/* ── 3 · La vidéo finie + la conversation ── */}
        <div className="duup-final absolute inset-4 flex gap-3">
          {/* Conversation à gauche */}
          <div className="flex min-w-0 flex-1 flex-col">
            <Bubble className="duup-msg1">
              {fr ? <>Ta vidéo est prête ✨</> : <>Your video is ready ✨</>}
            </Bubble>
            <Bubble mine className="duup-msg2 mt-1.5">
              {fr ? "Recommence avec 3 styles différents" : "Do it again with 3 different styles"}
            </Bubble>

            {/* Le champ de saisie : le texte s'y écrit, puis part dans le fil */}
            <div className="mt-auto flex items-center gap-2 rounded-full bg-[#f2f4f8] px-3 py-2">
              <span className="min-w-0 flex-1 overflow-hidden">
                <span className="duup-typing inline-block align-middle text-[10.5px] text-[#1a1a1a]">
                  {fr ? "Recommence avec 3 styles différents" : "Do it again with 3 different styles"}
                </span>
                <span className="duup-caretbeat ml-px inline-block h-3 w-px align-middle" style={{ background: BLUE }} />
              </span>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: CTA_GRAD }}>
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </span>
            </div>
          </div>

          {/* La vidéo montée, à droite */}
          <div className="relative aspect-[9/16] h-full shrink-0 overflow-hidden rounded-[11px] bg-[#eef1f7] shadow-[0_12px_30px_rgba(20,40,90,0.22)]">
            <video
              ref={ref}
              src={OUTPUT_VIDEO}
              poster={OUTPUT_POSTER}
              preload="none"
              muted
              loop
              playsInline
              disablePictureInPicture
              aria-label={fr ? "Vidéo montée par l'éditeur IA" : "Video edited by the AI editor"}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── DUPLICATION : 1 fichier → N copies uniques qui se génèrent ─── */
export function DuplicationMockup({ locale }: { locale: "fr" | "en" }) {
  const fr = locale === "fr";
  const chips = fr
    ? ["fichier neuf", "qualité d'origine", "prête à reposter"]
    : ["brand-new file", "original quality", "ready to repost"];
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_1px_3px_rgba(20,40,90,0.05),0_10px_24px_rgba(20,40,90,0.08),0_28px_56px_rgba(20,40,90,0.07)]">
      <Chrome title={fr ? "Duplication" : "Duplication"} badge={fr ? "en cours" : "running"} />

      <div className="flex min-h-0 flex-1 items-center gap-3 p-3.5">
        {/* Source */}
        <div className="w-[24%] shrink-0">
          <div className="relative aspect-[9/16] overflow-hidden rounded-[10px] ring-1 ring-black/[0.06]">
            <img src={THUMB} alt="" className="h-full w-full object-cover" />
            <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 py-px text-[7px] font-semibold text-white">1080p</span>
          </div>
          <p className="mt-1.5 truncate text-center text-[9px] font-medium text-[#8a8a8a]">reel.mp4</p>
        </div>

        <svg className="h-4 w-4 shrink-0 text-[#c3c9d6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>

        {/* Copies générées une à une */}
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="duup-seq relative aspect-[9/16] overflow-hidden rounded-[6px] bg-[#eef1f7] ring-1 ring-black/[0.06]"
                style={{ animationDelay: `${i * 0.22}s` }}>
                {/* Micro-variations : chaque copie est très légèrement différente */}
                <img src={THUMB} alt="" className="h-full w-full object-cover"
                  style={{ filter: `saturate(${100 + (i % 4) * 3}%) brightness(${99 + (i % 3)}%) hue-rotate(${(i % 5) - 2}deg)` }} />
                <span className="absolute right-0.5 top-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full text-white shadow" style={{ background: CTA_GRAD }}>
                  <svg className="h-1.5 w-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="5"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
              </div>
            ))}
          </div>
          {/* Ce qui change à chaque copie */}
          <div className="mt-2.5 flex flex-wrap gap-1">
            {chips.map((c, i) => (
              <span key={c} className="duup-seq rounded-full bg-[#f4f6fb] px-1.5 py-0.5 text-[8px] font-medium text-[#605f5f] ring-1 ring-black/[0.04]"
                style={{ animationDelay: `${0.4 + i * 0.4}s` }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Vignettes des modules : une mini-interface par outil ─── */
const TILE = "rounded-[5px] ring-1 ring-black/[0.05]";
const MEDIA_BG = "linear-gradient(165deg,#dfe8ff 0%,#e9e0ff 100%)";

export function ModuleArt({ kind, locale }: { kind: string; locale: "fr" | "en" }) {
  const fr = locale === "fr";

  if (kind === "scraper") {
    const posts = [
      { v: "1.2M", best: true },
      { v: "840K", best: true },
      { v: "12K", best: false },
      { v: "3K", best: false },
    ];
    return (
      <div className="flex h-full w-full items-center justify-center gap-1.5 px-3">
        {posts.map((p, i) => (
          <div key={i} className={`relative aspect-[9/16] w-[22%] overflow-hidden ${TILE} ${p.best ? "ring-2" : ""}`}
            style={{ background: MEDIA_BG, ...(p.best ? { borderColor: BLUE, boxShadow: `0 0 0 1.5px ${BLUE}` } : { opacity: 0.5 }) }}>
            <span className="absolute bottom-0.5 left-0.5 rounded bg-black/50 px-1 text-[9px] font-semibold text-white">{p.v}</span>
          </div>
        ))}
      </div>
    );
  }

  if (kind === "compressor") {
    return (
      <div className="flex h-full w-full flex-col justify-center gap-2 px-5">
        <div>
          <div className="flex justify-between text-[10px] font-medium text-[#8a8a8a]"><span>{fr ? "Avant" : "Before"}</span><span>12,4 Mo</span></div>
          <div className="mt-1 h-2 w-full rounded-full bg-[#e5e8ef]" />
        </div>
        <div>
          <div className="flex justify-between text-[10px] font-medium" style={{ color: BLUE }}><span>{fr ? "Après" : "After"}</span><span>3,1 Mo</span></div>
          <div className="mt-1 h-2 w-full rounded-full bg-[#e5e8ef]">
            <div className="h-2 w-1/4 rounded-full" style={{ background: CTA_GRAD }} />
          </div>
        </div>
      </div>
    );
  }

  if (kind === "comparator") {
    return (
      <div className="flex h-full w-full items-center justify-center gap-3 px-4">
        <div className={`aspect-[9/16] w-[18%] ${TILE}`} style={{ background: MEDIA_BG }} />
        <div className="text-center">
          <p className="text-[15px] font-semibold leading-none" style={{ color: BLUE }}>98,7 %</p>
          <p className="mt-1 text-[9.5px] font-medium text-[#8a8a8a]">{fr ? "de différence" : "different"}</p>
        </div>
        <div className={`aspect-[9/16] w-[18%] ${TILE}`} style={{ background: "linear-gradient(165deg,#e6edff 0%,#efe6ff 100%)" }} />
      </div>
    );
  }

  if (kind === "ai-variation") {
    return (
      <div className="flex h-full w-full items-center justify-center gap-2 px-4">
        <div className={`aspect-square w-[20%] ${TILE}`} style={{ background: MEDIA_BG }} />
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill={BLUE}><path d="m12 3 1.9 4.8L18 9.5l-4.1 1.7L12 16l-1.9-4.8L6 9.5l4.1-1.7Z" /></svg>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`aspect-square w-[34px] ${TILE}`}
              style={{ background: "linear-gradient(165deg,#e6edff 0%,#efe6ff 100%)", opacity: 1 - i * 0.18 }} />
          ))}
        </div>
      </div>
    );
  }

  /* ai-detection */
  return (
    <div className="flex h-full w-full items-center justify-center gap-3 px-5">
      <div className="flex-1 space-y-1.5">
        {[
          [fr ? "Logiciel" : "Software", "—"],
          ["C2PA", fr ? "retiré" : "stripped"],
          ["EXIF", "iPhone 15"],
        ].map(([k, v], i) => (
          <div key={i} className="flex items-center justify-between rounded-md bg-[#f4f6fb] px-2 py-1 text-[9.5px] ring-1 ring-black/[0.04]">
            <span className="font-medium text-[#8a8a8a]">{k}</span>
            <span className="font-semibold text-[#1a1a1a]">{v}</span>
          </div>
        ))}
      </div>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: CTA_GRAD }}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6z" /><path d="M9 12l2 2 4-4" />
        </svg>
      </span>
    </div>
  );
}

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

/* ─── GÉNÉRATEUR DE VARIANTES ───
   Une prise unique en 3 temps, cycle de 12 s :
   1) la consigne se tape ("génère 10 variantes") pendant qu'un faisceau parcourt
      la vidéo de départ ;
   2) les dix variantes tombent dans la grille, l'une après l'autre ;
   3) une fois toutes là, chacune continue de dériver sur SON rythme — c'est ce
      qui montre qu'aucune n'est la copie de sa voisine.
   Une SEULE vidéo est chargée (la source) : les variantes réutilisent son
   poster, décliné en CSS (étalonnage, cadrage, coupes, sous-titres).
   Fenêtres écrites en dur (duup-vscan, duup-v1…, globals.css). */
const CLAUDE_MARK = "/claude-ai-logo-rounded-hd-free-png-1.webp";
export const CLAUDE_WORDMARK = "/Claude_AI_logo.svg.webp";
/* Dérivées optimisées des fichiers de /public (5,4 Mo → 76 Ko ; 55 Mo → 366 Ko). */
const OUTPUT_VIDEO = "/mock-output.mp4";
const OUTPUT_POSTER = "/mock-output-poster.jpg";
/* Vignette du mockup Duplication (inchangée). */
const THUMB = "/variant-thumb.jpg";

/* Les dix variantes. Chacune a SA fenêtre d'apparition (`beat`), SON étalonnage
   qui dérive (`vary` — défini en CSS, sinon l'animation écraserait un filtre
   inline), SON cadrage et SES coupes ; deux d'entre elles portent en plus une
   ligne de sous-titres. `cuts` = largeurs relatives des segments de timeline. */
const VARIANTS = [
  { beat: "duup-v1",  vary: "duup-vary-a", crop: "scale(1.04)",                 cuts: [30, 22, 34, 14], cap: false },
  { beat: "duup-v2",  vary: "duup-vary-b", crop: "scale(1.12) translateX(-4%)", cuts: [18, 38, 20, 24], cap: true },
  { beat: "duup-v3",  vary: "duup-vary-c", crop: "scale(1.07) translateY(3%)",  cuts: [42, 16, 26, 16], cap: false },
  { beat: "duup-v4",  vary: "duup-vary-d", crop: "scale(1.16) translateX(5%)",  cuts: [22, 28, 18, 32], cap: true  },
  { beat: "duup-v5",  vary: "duup-vary-e", crop: "scale(1.02) translateY(-3%)", cuts: [34, 20, 30, 16], cap: false },
  { beat: "duup-v6",  vary: "duup-vary-f", crop: "scale(1.1) translateX(-6%)",  cuts: [16, 26, 40, 18], cap: false },
  { beat: "duup-v7",  vary: "duup-vary-g", crop: "scale(1.05) translateX(7%)",  cuts: [26, 34, 16, 24], cap: true  },
  { beat: "duup-v8",  vary: "duup-vary-h", crop: "scale(1.14) translateY(-5%)", cuts: [38, 18, 22, 22], cap: false },
  { beat: "duup-v9",  vary: "duup-vary-i", crop: "scale(1.03) translateX(-2%)", cuts: [20, 30, 28, 22], cap: false },
  { beat: "duup-v10", vary: "duup-vary-j", crop: "scale(1.18) translateY(4%)",  cuts: [28, 16, 36, 20], cap: true  },
];

/* Une variante : la même vidéo, mais recadrée, réétalonnée et recoupée. */
function VariantTile({ v, index }: { v: (typeof VARIANTS)[number]; index: number }) {
  // Sous 640px la fenêtre 16:10 est trop basse pour deux rangées : il n'en reste
  // qu'une, et les vignettes y sont bridées à 72% de la hauteur pour rester plus
  // petites que la vidéo de départ (à hauteur pleine, elles feraient sa taille).
  return (
    <div
      className={`${v.beat} relative h-[72%] shrink-0 self-center overflow-hidden rounded-[8px] bg-[#eef1f7] shadow-[0_6px_16px_rgba(20,40,90,0.16)] sm:h-full sm:self-stretch`}
      style={{ aspectRatio: "9 / 16" }}
    >
      <img src={OUTPUT_POSTER} alt="" className={`${v.vary} h-full w-full object-cover`} style={{ transform: v.crop }} />
      {/* Le numéro de la variante */}
      <span className="absolute left-1 top-1 rounded-[5px] bg-black/55 px-1 py-px text-[7.5px] font-semibold leading-[1.4] text-white backdrop-blur-sm">
        {String(index + 1).padStart(2, "0")}
      </span>
      {/* Sous-titres : sur certaines variantes seulement */}
      {v.cap && <span className="absolute inset-x-2 bottom-[9px] block h-[2.5px] rounded-full bg-white/90 shadow-[0_0_6px_rgba(0,0,0,0.4)]" />}
      {/* Mini-timeline : des coupes différentes d'une variante à l'autre */}
      <span className="absolute inset-x-1 bottom-1 flex gap-px">
        {v.cuts.map((c, i) => (
          <span key={i} className="h-[2.5px] rounded-full bg-white/70" style={{ flexGrow: c }} />
        ))}
      </span>
    </div>
  );
}

export function VariantsMockup({ locale, reduced }: { locale: "fr" | "en"; reduced: boolean }) {
  const fr = locale === "fr";
  const { ref } = useLoopInView(reduced, 0.2);
  const ask = fr ? "Génère 10 variantes de cette vidéo" : "Generate 10 variants of this video";

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[16px] bg-white shadow-[0_1px_3px_rgba(20,40,90,0.05),0_10px_24px_rgba(20,40,90,0.08),0_28px_56px_rgba(20,40,90,0.07)]">
      <div className="flex items-center gap-2 border-b border-black/[0.05] px-4 py-2.5">
        <span className="text-[11.5px] font-semibold text-[#1a1a1a]">{fr ? "Générateur de variantes" : "Variant generator"}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#4686FE]/10 px-2 py-0.5 text-[9.5px] font-semibold" style={{ color: BLUE }}>
          <img src={CLAUDE_MARK} alt="" className="h-3 w-3 rounded-[3px] object-contain" />
          Claude
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="flex min-h-0 flex-1 gap-3">
          {/* ── 1 · La vidéo de départ, lue par l'IA ── */}
          <div
            className="relative h-full shrink-0 overflow-hidden rounded-[11px] bg-[#eef1f7] shadow-[0_10px_26px_rgba(20,40,90,0.18)]"
            style={{ aspectRatio: "9 / 16" }}
          >
            <video
              ref={ref}
              src={OUTPUT_VIDEO}
              poster={OUTPUT_POSTER}
              preload="none"
              muted
              loop
              playsInline
              disablePictureInPicture
              aria-label={fr ? "La vidéo de départ" : "The source video"}
              className="h-full w-full object-cover"
            />
            <span
              aria-hidden
              className="duup-vscan pointer-events-none absolute inset-x-0 h-[16%]"
              style={{ background: "linear-gradient(180deg,rgba(70,134,254,0) 0%,rgba(70,134,254,0.5) 50%,rgba(70,134,254,0) 100%)" }}
            />
            <span className="absolute inset-x-1 bottom-1 rounded-[7px] bg-black/55 py-0.5 text-center text-[8.5px] font-semibold text-white backdrop-blur-sm">
              {fr ? "ta vidéo" : "your video"}
            </span>
          </div>

          {/* ── 2 · Les variantes, deux rangées de cinq (une seule en mobile) ── */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {[0, 1].map((row) => (
              <div key={row} className={`flex min-h-0 flex-1 items-stretch justify-center gap-2 ${row === 1 ? "hidden sm:flex" : ""}`}>
                {VARIANTS.slice(row * 5, row * 5 + 5).map((v, i) => (
                  <VariantTile key={v.beat} v={v} index={row * 5 + i} />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── 3 · La consigne, puis le compte rendu ── */}
        <div className="relative mt-3 h-8 shrink-0">
          <div className="duup-vask absolute inset-0 flex items-center gap-2 rounded-full bg-[#f2f4f8] px-3">
            <span className="min-w-0 flex-1 overflow-hidden">
              <span className="duup-vtype inline-block align-middle text-[10.5px] text-[#1a1a1a]">{ask}</span>
              <span className="duup-vcaret ml-px inline-block h-3 w-px align-middle" style={{ background: BLUE }} />
            </span>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: CTA_GRAD }}>
              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </span>
          </div>

          <div className="duup-vdone absolute inset-0 flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: CTA_GRAD }}>
              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            <span className="text-[11px] font-medium text-[#1a1a1a]">
              {fr ? "10 variantes prêtes" : "10 variants ready"}
            </span>
            <span className="text-[11px] text-[#8a8f9c]">
              {fr ? "· aucune identique" : "· no two alike"}
            </span>
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

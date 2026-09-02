"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Label, SECTION_LEAD, SECTION_TITLE, SECTION_TITLE_STYLE } from "@/components/landing/shell";
import { showcaseUrl, useLoopInView, usePlayBudget, useReducedMotion, type PlayBudget } from "@/components/landing/videoShowcase";

/* ══════════════════════════════════════════════════════════════
 * GALERIE D'OUTPUTS — « Fait avec DuupFlow »
 * Bandeau horizontal en boucle infinie, deux rangées à contresens.
 *
 * L'animation est 100% CSS (@keyframes duup-marquee-* dans globals.css) :
 * la piste contient le tableau deux fois et se translate de -50%, donc la
 * reprise tombe pile sur la 1re copie. Aucun JS de scroll, aucun rAF.
 * Chargement paresseux + budget de lecture → @/components/landing/videoShowcase
 * ══════════════════════════════════════════════════════════════ */

export type OutputVideo = {
  /** MP4 H.264 720p, muet, court (boucle) — ex. showcaseUrl("output-1.mp4") */
  src: string;
  /** Poster JPEG/WebP 720x1280 — OBLIGATOIRE, c'est ce qui s'affiche avant lecture */
  poster: string;
  /** Légende courte sous la vignette */
  label: { fr: string; en: string };
};

/* ─────────────────────────────────────────────────────────────
 * SOURCE DE VÉRITÉ DE LA GALERIE.
 * Vide pour l'instant : le bandeau fait défiler des emplacements explicites,
 * au même rythme que les vraies vidéos une fois branchées.
 * Remplir avec 6 à 8 entrées, ex. :
 *
 *   {
 *     src: showcaseUrl("output-1.mp4"),
 *     poster: showcaseUrl("output-1.jpg"),
 *     label: { fr: "1 vidéo → 10 montages différents", en: "1 video → 10 different edits" },
 *   },
 * ───────────────────────────────────────────────────────────── */
export const OUTPUT_VIDEOS: OutputVideo[] = [];

/** Nombre d'emplacements affichés tant que OUTPUT_VIDEOS est vide. */
const PLACEHOLDER_COUNT = 8;

/* Légendes d'exemple, pour que les emplacements vides restent lisibles. */
const PLACEHOLDER_LABELS: { fr: string; en: string }[] = [
  { fr: "1 vidéo → 10 montages différents", en: "1 video → 10 different edits" },
  { fr: "1 vidéo → 10 variantes uniques", en: "1 video → 10 unique variants" },
];

/* Durée d'un cycle par colonne. Volontairement toutes différentes : deux
   colonnes qui défilent au même rythme se lisent comme un bloc qui bouge. */
const SPEED = [44, 52, 47, 58, 41, 55];

/* Hauteur de la fenêtre du mur. Les vignettes s'y enfoncent en haut et en bas. */
const WALL = "h-[520px] sm:h-[600px]";

/* Vignettes par colonne AVANT duplication. Une copie doit être plus haute que
   la fenêtre, sinon la translation de -50% découvre du vide en fin de cycle. */
const PER_COLUMN = 3;

/** Plafond de vidéos qui décodent en même temps, toutes rangées confondues. */
const MAX_CONCURRENT_PLAYS = 6;

function useLocale(): "fr" | "en" {
  const params = useParams();
  const l = Array.isArray(params?.locale) ? params?.locale[0] : params?.locale;
  return l === "en" ? "en" : "fr";
}

/* La gouttière d'une vignette est un padding-bottom (surtout pas un `gap`) :
   chaque copie fait alors exactement la moitié de la colonne, condition pour
   que le -50% boucle sans saut. */
const CELL = "w-full shrink-0 pb-3 sm:pb-4";

/* ─── Une vignette : poster tant qu'elle est hors écran, lecture à l'entrée ─── */
function Tile({ item, locale, reduced, budget, duplicate, onOpen }: {
  item: OutputVideo;
  locale: "fr" | "en";
  reduced: boolean;
  budget: PlayBudget;
  /** 2e copie de la piste : invisible pour le clavier et les lecteurs d'écran */
  duplicate?: boolean;
  onOpen: () => void;
}) {
  const gate = useMemo(() => budget.createGate(), [budget]);
  const { ref, playing } = useLoopInView(reduced, 0.2, gate);

  return (
    <figure className={`group m-0 ${CELL}`} aria-hidden={duplicate || undefined}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={item.label[locale]}
        tabIndex={duplicate ? -1 : undefined}
        className="relative block w-full overflow-hidden rounded-[22px] bg-[#eef1f7] ring-1 ring-black/[0.06] shadow-[0_14px_36px_rgba(20,40,90,0.10)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(20,40,90,0.18)]"
      >
        <div className="relative aspect-[9/16] w-full">
          <video
            ref={ref}
            src={item.src}
            poster={item.poster}
            preload="none"
            muted
            loop
            playsInline
            disablePictureInPicture
            tabIndex={-1}
            className="h-full w-full object-cover"
          />
          {/* Voile + pastille lecture : disparaît dès que la boucle tourne */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10 transition-opacity duration-300"
            style={{ opacity: playing ? 0 : 1 }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/85 shadow-[0_8px_20px_rgba(20,40,90,0.18)] backdrop-blur-sm">
              <svg className="h-3.5 w-3.5 translate-x-px text-[#1a1a1a]" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </span>
          </span>
          {/* Indice « clic = son » au survol */}
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] font-medium text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100"
          >
            <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7" /></svg>
            {locale === "en" ? "Sound" : "Son"}
          </span>
        </div>
      </button>
      <figcaption className="mt-2.5 px-1 text-[12px] leading-snug text-[#605f5f]">{item.label[locale]}</figcaption>
    </figure>
  );
}

/* ─── Vignette de démo : un écran de feed vertical, façon TikTok / Reels ───
   Ce n'est PAS une vraie capture (je n'ai pas de fichiers) : c'est l'habillage
   d'un feed pour que le mur se lise comme du short-form dès maintenant.
   Dès qu'une entrée est ajoutée à OUTPUT_VIDEOS, elle prend la place. */
const FEED_SKINS = [
  { grad: "linear-gradient(170deg,#2b2f4a 0%,#4b3b6e 55%,#7b4d7a 100%)", handle: "@clips.daily", net: "TikTok" },
  { grad: "linear-gradient(170deg,#123047 0%,#1f5c6e 55%,#3a8f8c 100%)", handle: "@repost.officiel", net: "Reels" },
  { grad: "linear-gradient(170deg,#3a2140 0%,#6d2f52 55%,#b04a4a 100%)", handle: "@shorts.hub", net: "Reels" },
  { grad: "linear-gradient(170deg,#1c2340 0%,#33406e 55%,#5a6bb0 100%)", handle: "@viral.feed", net: "TikTok" },
];

function PlaceholderTile({ index, locale, duplicate }: { index: number; locale: "fr" | "en"; duplicate?: boolean }) {
  const hint = PLACEHOLDER_LABELS[index % PLACEHOLDER_LABELS.length][locale];
  const skin = FEED_SKINS[index % FEED_SKINS.length];
  const stats = [
    { d: "M12 21s-7-4.5-9.3-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.3 12c-2.3 4.5-9.3 9-9.3 9Z", v: "12,4K" },
    { d: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z", v: "318" },
    { d: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M8 7l4-4 4 4", v: "1,1K" },
  ];
  return (
    <figure className={`m-0 ${CELL}`} aria-hidden={duplicate || undefined}>
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[22px] ring-1 ring-black/[0.06] shadow-[0_14px_36px_rgba(20,40,90,0.10)]"
        style={{ background: skin.grad }}>
        {/* Voile de lisibilité, comme sur un vrai feed */}
        <span aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 42%)" }} />

        {/* Barre de progression */}
        <span aria-hidden className="absolute inset-x-3 top-2.5 h-[2px] rounded-full bg-white/25">
          <span className="block h-full w-1/3 rounded-full bg-white/85" />
        </span>

        {/* Plateforme */}
        <span className="absolute left-3 top-5 rounded-full bg-black/35 px-1.5 py-0.5 text-[9.5px] font-semibold text-white backdrop-blur-sm">
          {skin.net}
        </span>

        {/* Colonne d'actions */}
        <span aria-hidden className="absolute bottom-12 right-1.5 flex flex-col items-center gap-2.5">
          {stats.map((s, i) => (
            <span key={i} className="flex flex-col items-center gap-0.5">
              <svg className="h-4 w-4 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d={s.d} />
              </svg>
              <span className="text-[8.5px] font-semibold text-white/90">{s.v}</span>
            </span>
          ))}
        </span>

        {/* Pied : compte + légende */}
        <span className="absolute inset-x-2.5 bottom-2.5">
          <span className="block text-[10px] font-semibold text-white">{skin.handle}</span>
          <span className="mt-0.5 block truncate text-[9.5px] text-white/80">{hint}</span>
          <span className="mt-1 block h-1 w-2/3 rounded-full bg-white/20" />
        </span>
      </div>
      <figcaption className="mt-2.5 px-1 text-[12px] leading-snug text-[#605f5f]">{hint}</figcaption>
    </figure>
  );
}

/* ─── Une colonne du mur : la pile, doublée, animée en CSS ─── */
function MarqueeColumn({ items, indices, placeholders, direction, duration, paused, locale, reduced, budget, onOpen }: {
  /** Vignettes de cette colonne ; tableau vide = emplacements de démo */
  items: OutputVideo[];
  /** Index de chaque vignette dans OUTPUT_VIDEOS (pour ouvrir la bonne modale) */
  indices: number[];
  /** Indices des emplacements de démo quand OUTPUT_VIDEOS est vide */
  placeholders: number[];
  direction: "up" | "down";
  duration: number;
  paused: boolean;
  locale: "fr" | "en";
  reduced: boolean;
  budget: PlayBudget;
  onOpen: (index: number) => void;
}) {
  const count = items.length > 0 ? items.length : placeholders.length;
  const cell = (i: number, duplicate: boolean) =>
    items.length > 0
      ? <Tile key={`${duplicate ? "b" : "a"}-${i}`} item={items[i]} locale={locale} reduced={reduced} budget={budget}
          duplicate={duplicate} onOpen={() => onOpen(indices[i])} />
      : <PlaceholderTile key={`${duplicate ? "b" : "a"}-${i}`} index={placeholders[i]} locale={locale} duplicate={duplicate} />;

  const single = Array.from({ length: count }, (_, i) => cell(i, false));

  // Mouvement coupé : la colonne se fige, sans copie doublée.
  if (reduced) return <div className="flex flex-col">{single}</div>;

  return (
    <div
      className={`duup-marquee-track duup-marquee-track--${direction}`}
      style={{ animationDuration: `${duration}s`, ...(paused ? { animationPlayState: "paused" as const } : {}) }}
    >
      {single}
      {/* 2e copie : c'est elle qui rend la reprise invisible */}
      {Array.from({ length: count }, (_, i) => cell(i, true))}
    </div>
  );
}

/* ─── Le mur : N colonnes, une sur deux à contresens ─── */
function Wall({ columns, className, items, paused, locale, reduced, budget, onOpen }: {
  columns: number;
  className: string;
  items: OutputVideo[];
  paused: boolean;
  locale: "fr" | "en";
  reduced: boolean;
  budget: PlayBudget;
  onOpen: (index: number) => void;
}) {
  return (
    <div className={className} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: columns }, (_, c) => {
        // Chaque colonne prend une tranche décalée du tableau : contenus
        // distincts d'une colonne à l'autre, et toujours PER_COLUMN vignettes
        // pour que la boucle ne découvre jamais de vide.
        const total = items.length || PLACEHOLDER_COUNT;
        const slice = Array.from({ length: Math.min(PER_COLUMN, total) }, (_, k) => (c * PER_COLUMN + k) % total);
        const colIndices = items.length > 0 ? slice : [];
        const colPlaceholders = items.length > 0 ? [] : slice;
        return (
          <MarqueeColumn
            key={c}
            items={colIndices.map((i) => items[i])}
            indices={colIndices}
            placeholders={colPlaceholders}
            direction={c % 2 === 0 ? "up" : "down"}
            duration={SPEED[c % SPEED.length]}
            paused={paused}
            locale={locale}
            reduced={reduced}
            budget={budget}
            onOpen={onOpen}
          />
        );
      })}
    </div>
  );
}

/* ─── Modal plein écran : son + contrôles ─── */
function Lightbox({ item, locale, onClose }: { item: OutputVideo; locale: "fr" | "en"; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.label[locale]}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="relative max-h-full" onClick={(e) => e.stopPropagation()}>
        <video
          src={item.src}
          poster={item.poster}
          controls
          autoPlay
          playsInline
          className="max-h-[86vh] w-auto rounded-[20px] bg-black shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
        />
        <p className="mt-3 text-center text-[13px] text-white/80">{item.label[locale]}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={locale === "en" ? "Close" : "Fermer"}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/25 transition hover:bg-white/20"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

/* Fondu haut/bas : les vignettes s'effacent en entrant et en sortant du mur. */
const WALL_FADE = "linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)";

export default function OutputGallery() {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const budget = usePlayBudget(MAX_CONCURRENT_PLAYS);
  const [open, setOpen] = useState<number | null>(null);
  const items = OUTPUT_VIDEOS;

  const wallProps = { items, paused: open !== null, locale, reduced, budget, onOpen: setOpen };

  return (
    <section id="gallery" className="overflow-hidden px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Label>{locale === "en" ? "Real outputs" : "Vrais rendus"}</Label>
          <h2 className={`mx-auto mt-7 max-w-2xl ${SECTION_TITLE}`} style={SECTION_TITLE_STYLE}>
            {locale === "en" ? "Made with DuupFlow." : "Fait avec DuupFlow."}
          </h2>
          <p className={`mx-auto mt-4 max-w-lg ${SECTION_LEAD}`}>
            {locale === "en"
              ? "Not mockups: videos actually produced by the tool."
              : "Pas des maquettes : des vidéos réellement sorties de l'outil."}
          </p>
        </div>
      </div>

      {/* Le mur : sort du conteneur centré (-mx-6 annule le padding de section) */}
      <div className="duup-marquee relative -mx-6 mt-14">
        {/* Voiles flous : les vignettes s'y enfoncent en haut et en bas */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 backdrop-blur-[5px] sm:h-28"
          style={{
            background: "linear-gradient(to bottom, #fff 12%, rgba(255,255,255,0))",
            maskImage: "linear-gradient(to bottom, #000 45%, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, #000 45%, transparent)",
          }} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 backdrop-blur-[5px] sm:h-28"
          style={{
            background: "linear-gradient(to top, #fff 12%, rgba(255,255,255,0))",
            maskImage: "linear-gradient(to top, #000 45%, transparent)",
            WebkitMaskImage: "linear-gradient(to top, #000 45%, transparent)",
          }} />

        <div className={`${reduced ? "overflow-y-auto" : "overflow-hidden"} ${WALL} px-3 sm:px-4`}
          style={reduced ? undefined : { maskImage: WALL_FADE, WebkitMaskImage: WALL_FADE }}>
          {/* Mobile — 2 colonnes */}
          <Wall {...wallProps} columns={2} className="grid gap-3 lg:hidden" />
          {/* Desktop — 6 colonnes, une sur deux à contresens */}
          <Wall {...wallProps} columns={6} className="hidden gap-4 lg:grid" />
        </div>
      </div>

      {open !== null && items[open] && (
        <Lightbox item={items[open]} locale={locale} onClose={() => setOpen(null)} />
      )}
    </section>
  );
}

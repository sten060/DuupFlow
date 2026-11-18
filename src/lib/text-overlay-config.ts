// src/lib/text-overlay-config.ts
//
// ── TEXTES SUR LES DUPLICATIONS (mode Simple, BETA) — réglages partagés ──────
// Module PUR (aucune dépendance serveur) : lu par le formulaire (aperçu en
// direct) ET par le serveur (processVideos → text-overlay.ts). L'aperçu montre
// donc exactement les combinaisons que recevront les copies.
//
// Deux blocs indépendants, chacun avec son propre « Varier sur chaque copie » :
//   · CAPTION : un texte fixe écrit par le user (hook, titre) ;
//   · SOUS-TITRES : la voix de la vidéo, transcrite, dans un style viral
//     (karaoké, mot par mot, bandeau TikTok, classique).
// En variation, chaque réglage devient une LISTE et chaque copie pioche une
// combinaison différente (captionVariant / subtitleVariant).

export const TEXT_FONTS = {
  sans:      { family: "Inter",          weight: 500, label: "Classique" },
  grotesk:   { family: "Montserrat",     weight: 600, label: "Montserrat" },
  geometric: { family: "Poppins",        weight: 600, label: "Poppins" },
  rounded:   { family: "Fredoka",        weight: 600, label: "Arrondie" },
  black:     { family: "Archivo Black",  weight: 400, label: "Très grasse" },
} as const;
export type TextFont = keyof typeof TEXT_FONTS;
export const TEXT_FONT_KEYS = Object.keys(TEXT_FONTS) as TextFont[];

/** Fonds d'une caption : aucun (texte seul), bandeau ligne par ligne (texte
 *  natif Instagram/TikTok), bloc arrondi, bloc à angles droits. */
export const TEXT_BGS = ["none", "lines", "rounded", "square"] as const;
export type TextBg = (typeof TEXT_BGS)[number];

/** Styles de sous-titres — les plus vus sur TikTok / Reels aujourd'hui. */
export const SUBTITLE_STYLES = ["karaoke", "word", "native", "classic"] as const;
export type SubtitleStyle = (typeof SUBTITLE_STYLES)[number];

export const TEXT_POSITIONS = ["top", "middle", "bottom"] as const;
export type TextPosition = (typeof TEXT_POSITIONS)[number];

/** Nuancier (couleurs de texte, de fond et d'accent). */
export const TEXT_COLORS = ["#FFFFFF", "#111111", "#FFD60A", "#FF3D7F", "#2F6BFF", "#E53935", "#22C55E", "#A855F7"] as const;

export type CaptionConfig = {
  enabled: boolean;
  text: string;
  /** « all » = toute la vidéo ; « range » = de `from` à `to` secondes
   *  (to = null : jusqu'à la fin). La caption peut donc arriver au milieu,
   *  ou seulement à la fin. */
  duration: "all" | "range";
  from: number;
  to: number | null;
  vary: boolean;
  fonts: TextFont[]; bgs: TextBg[]; textColors: string[]; bgColors: string[]; positions: TextPosition[];
  /** Position LIBRE posée à la souris dans l'aperçu (centre, % du cadre,
   *  hors cadre permis). Prioritaire sur `positions` ; null = une des
   *  positions prédéfinies. */
  place: { x: number; y: number } | null;
  /** Taille du texte (px pour une largeur de 1080), réglable à la souris. */
  size: number;
};

export type SubtitleConfig = {
  enabled: boolean;
  vary: boolean;
  styles: SubtitleStyle[]; fonts: TextFont[]; textColors: string[];
  /** Karaoké : couleur du mot prononcé ; bandeau : couleur du fond. */
  accentColors: string[];
  positions: TextPosition[];
  /** Position LIBRE posée à la souris dans l'aperçu (centre, % du cadre). */
  place: { x: number; y: number } | null;
};

export type TextOverlayConfig = { caption: CaptionConfig; subtitles: SubtitleConfig };

export const MAX_CAPTION_CHARS = 120;
/** Fenêtre par défaut quand on passe en « Personnalisé » (s). */
export const CAPTION_RANGE_DEFAULT = { from: 0, to: 3 };
/** Taille de caption (px @1080) : bornes du redimensionnement à la souris. */
export const CAPTION_SIZE = { min: 28, max: 140, default: 58 };

export const DEFAULT_CAPTION: CaptionConfig = {
  enabled: false, text: "", duration: "all", from: CAPTION_RANGE_DEFAULT.from, to: CAPTION_RANGE_DEFAULT.to, vary: false,
  fonts: ["sans"], bgs: ["lines"], textColors: ["#111111"], bgColors: ["#FFFFFF"], positions: ["top"],
  place: null, size: CAPTION_SIZE.default,
};
export const DEFAULT_SUBTITLES: SubtitleConfig = {
  enabled: false, vary: false,
  styles: ["karaoke"], fonts: ["black"], textColors: ["#FFFFFF"], accentColors: ["#FFD60A"], positions: ["bottom"],
  place: null,
};
export const DEFAULT_TEXT_OVERLAY: TextOverlayConfig = { caption: DEFAULT_CAPTION, subtitles: DEFAULT_SUBTITLES };

export type CaptionVariant = { font: TextFont; bg: TextBg; textColor: string; bgColor: string; position: TextPosition };
export type SubtitleVariant = { style: SubtitleStyle; font: TextFont; textColor: string; accentColor: string; position: TextPosition };

/* ── Validation (données venues du navigateur ou d'un réglage enregistré) ── */

const hexOk = (s: unknown): s is string => typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s);
function list<T extends string>(v: unknown, allowed: readonly T[] | ((x: unknown) => x is T), fallback: T[]): T[] {
  const ok = (x: unknown): x is T => (typeof allowed === "function" ? allowed(x) : (allowed as readonly unknown[]).includes(x));
  const out = Array.isArray(v) ? [...new Set(v.filter(ok))].slice(0, 12) : [];
  return out.length ? out : fallback;
}

/** Réglage complet, toujours valide (sert aussi à relire un réglage enregistré). */
export function normalizeTextOverlay(raw: unknown): TextOverlayConfig {
  let o: Partial<TextOverlayConfig> = {};
  try { o = ((typeof raw === "string" ? JSON.parse(raw) : raw) as Partial<TextOverlayConfig>) ?? {}; } catch { /* défauts */ }
  const c = (o.caption ?? {}) as Partial<CaptionConfig>, s = (o.subtitles ?? {}) as Partial<SubtitleConfig>;
  const dc = DEFAULT_CAPTION, ds = DEFAULT_SUBTITLES;
  return {
    caption: {
      enabled: !!c.enabled,
      // Les retours à la ligne TAPÉS sont gardés (6 lignes max) ; le reste des
      // espaces est normalisé. Aucune coupure automatique ailleurs.
      text: String(c.text ?? "").replace(/\r/g, "").replace(/[^\S\n]+/g, " ").replace(/\n{2,}/g, "\n").split("\n").slice(0, 6).join("\n").slice(0, MAX_CAPTION_CHARS),
      ...captionWindowOf(c),
      vary: !!c.vary,
      fonts: list(c.fonts, TEXT_FONT_KEYS, dc.fonts),
      bgs: list(c.bgs, TEXT_BGS, dc.bgs),
      textColors: list(c.textColors, hexOk, dc.textColors),
      bgColors: list(c.bgColors, hexOk, dc.bgColors),
      positions: list(c.positions, TEXT_POSITIONS, dc.positions),
      place: placeOf(c.place),
      size: Math.min(CAPTION_SIZE.max, Math.max(CAPTION_SIZE.min, Number(c.size) || CAPTION_SIZE.default)),
    },
    subtitles: {
      enabled: !!s.enabled,
      vary: !!s.vary,
      styles: list(s.styles, SUBTITLE_STYLES, ds.styles),
      fonts: list(s.fonts, TEXT_FONT_KEYS, ds.fonts),
      textColors: list(s.textColors, hexOk, ds.textColors),
      accentColors: list(s.accentColors, hexOk, ds.accentColors),
      positions: list(s.positions, TEXT_POSITIONS, ds.positions),
      place: placeOf(s.place),
    },
  };
}

/** Fenêtre d'affichage valide. Accepte l'ancien format (« start » + seconds :
 *  les N premières secondes) des templates déjà enregistrés. */
function captionWindowOf(c: Partial<CaptionConfig> & { seconds?: unknown }): Pick<CaptionConfig, "duration" | "from" | "to"> {
  const legacy = (c as { duration?: string }).duration === "start";
  if (c.duration !== "range" && !legacy) return { duration: "all", from: CAPTION_RANGE_DEFAULT.from, to: CAPTION_RANGE_DEFAULT.to };
  const from = Math.min(600, Math.max(0, legacy ? 0 : Number(c.from) || 0));
  const rawTo = legacy ? Number(c.seconds) : c.to == null ? null : Number(c.to);
  const to = rawTo == null || !Number.isFinite(rawTo) ? null : Math.min(600, Math.max(from + 0.1, rawTo));
  return { duration: "range", from: Math.round(from * 10) / 10, to: to == null ? null : Math.round(to * 10) / 10 };
}

/** Position libre valide (hors cadre permis, dans une limite raisonnable). */
function placeOf(p: unknown): { x: number; y: number } | null {
  const o = p as { x?: unknown; y?: unknown } | null;
  if (!o || !Number.isFinite(Number(o.x)) || !Number.isFinite(Number(o.y))) return null;
  return { x: Math.min(150, Math.max(-50, Number(o.x))), y: Math.min(150, Math.max(-50, Number(o.y))) };
}

/** Réglage à appliquer côté serveur. null = rien à poser. */
export function parseTextOverlay(raw: unknown): TextOverlayConfig | null {
  if (raw == null || raw === "") return null;
  const cfg = normalizeTextOverlay(raw);
  cfg.caption.text = cfg.caption.text.trim();
  if (!cfg.caption.text) cfg.caption.enabled = false;
  return cfg.caption.enabled || cfg.subtitles.enabled ? cfg : null;
}

/* ── Combinaisons par copie ───────────────────────────────────────────────── */

export function isLight(hex: string): boolean {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

/** Mélange déterministe (graine = les réglages) puis ordre « le plus différent
 *  d'abord » : chaque copie change le plus de réglages possible par rapport
 *  aux précédentes (un simple mélange donnait deux copies voisines qui ne
 *  différaient que par la couleur). */
function spread<T extends Record<string, string>>(items: T[], seedOf: unknown): T[] {
  let h = 2166136261;
  for (const ch of JSON.stringify(seedOf)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909); return ((h >>>= 0) % 100000) / 100000; };
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  const dist = (a: T, b: T) => Object.keys(a).reduce((n, k) => n + (a[k] !== b[k] ? 1 : 0), 0);
  const pool = arr.slice(0, 300), ordered: T[] = pool.length ? [pool.shift()!] : [];
  while (pool.length) {
    let best = 0, bestScore = -1;
    const recent = ordered.slice(-4).reverse();
    for (let k = 0; k < pool.length; k++) {
      const score = recent.reduce((acc, r, idx) => acc + dist(pool[k], r) * (idx === 0 ? 100 : 1), 0);
      if (score > bestScore) { bestScore = score; best = k; }
    }
    ordered.push(pool.splice(best, 1)[0]);
  }
  return ordered.concat(arr.slice(300));
}

/** La graine ne dépend que des LISTES de choix (pas du texte) : taper la
 *  caption ne doit pas rebattre les variantes de l'aperçu. */
const seedOfCaption = (c: CaptionConfig) => [c.fonts, c.bgs, c.textColors, c.bgColors, c.positions];
const seedOfSubs = (s: SubtitleConfig) => [s.styles, s.fonts, s.textColors, s.accentColors, s.positions];

function captionCombos(c: CaptionConfig): CaptionVariant[] {
  const one = <T,>(a: T[]) => (c.vary ? a : a.slice(0, 1));
  const out: CaptionVariant[] = [];
  for (const font of one(c.fonts)) for (const bg of one(c.bgs)) for (const textColor of one(c.textColors))
    // Position libre (posée à la souris) : elle vaut pour toutes les copies.
    for (const bgColor of bg === "none" ? [""] : one(c.bgColors)) for (const position of c.place ? c.positions.slice(0, 1) : one(c.positions)) {
      if (bg !== "none" && textColor.toLowerCase() === bgColor.toLowerCase()) continue; // illisible
      out.push({ font, bg, textColor, bgColor, position });
    }
  if (!out.length) {
    const bgColor = c.bgs[0] === "none" ? "" : c.bgColors[0];
    out.push({ font: c.fonts[0], bg: c.bgs[0], bgColor, textColor: bgColor && isLight(bgColor) ? "#111111" : "#FFFFFF", position: c.positions[0] });
  }
  return c.vary ? spread(out, seedOfCaption(c)) : out.slice(0, 1);
}

/** Styles qui utilisent une couleur d'accent (mot actif / fond). */
export const usesAccent = (style: SubtitleStyle) => style === "karaoke" || style === "native";

function subtitleCombos(s: SubtitleConfig): SubtitleVariant[] {
  const one = <T,>(a: T[]) => (s.vary ? a : a.slice(0, 1));
  const out: SubtitleVariant[] = [];
  for (const style of one(s.styles)) for (const font of one(s.fonts)) for (const textColor of one(s.textColors))
    for (const accentColor of usesAccent(style) ? one(s.accentColors) : [""])
      for (const position of s.place ? s.positions.slice(0, 1) : one(s.positions)) {
        if (accentColor && textColor.toLowerCase() === accentColor.toLowerCase()) continue; // mot actif / fond invisibles
        out.push({ style, font, textColor, accentColor, position });
      }
  if (!out.length) {
    const accentColor = s.accentColors[0];
    out.push({ style: s.styles[0], font: s.fonts[0], accentColor, textColor: isLight(accentColor) ? "#111111" : "#FFFFFF", position: s.positions[0] });
  }
  return s.vary ? spread(out, seedOfSubs(s)) : out.slice(0, 1);
}

export const captionVariant = (c: CaptionConfig, i: number) => { const all = captionCombos(c); return all[i % all.length]; };
export const subtitleVariant = (s: SubtitleConfig, i: number) => { const all = subtitleCombos(s); return all[i % all.length]; };
export const captionVariantCount = (c: CaptionConfig) => captionCombos(c).length;
export const subtitleVariantCount = (s: SubtitleConfig) => subtitleCombos(s).length;

/** Centre vertical (% du cadre) d'une position — dans la zone sûre de
 *  TikTok / Reels (ni sous les onglets du haut, ni sous la légende du bas). */
export const POSITION_Y: Record<TextPosition, number> = { top: 20, middle: 50, bottom: 70 };

/** Caption et sous-titres au même endroit : la caption remonte d'un cran. */
export function captionY(captionPos: TextPosition, subtitlesOn: boolean, subtitlePos: TextPosition): number {
  return subtitlesOn && captionPos === subtitlePos ? Math.max(14, POSITION_Y[captionPos] - 14) : POSITION_Y[captionPos];
}

/** Centre de la caption (% du cadre) : la position libre si posée à la
 *  souris, sinon la position par défaut (haut ; remontée si les sous-titres
 *  sont au même endroit). */
export function captionCenter(c: CaptionConfig, v: CaptionVariant, subtitlesOn: boolean, subtitlePos: TextPosition, subtitlesPlaced = false): { x: number; y: number } {
  return c.place ?? { x: 50, y: subtitlesPlaced ? POSITION_Y[v.position] : captionY(v.position, subtitlesOn, subtitlePos) };
}

/** Centre des sous-titres (% du cadre) : position libre, sinon bas. */
export function subtitleCenter(s: SubtitleConfig, v: SubtitleVariant): { x: number; y: number } {
  return s.place ?? { x: 50, y: POSITION_Y[v.position] };
}

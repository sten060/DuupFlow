// src/lib/ai-dup/validate.ts
//
// ── LE GARDE-FOU DERRIÈRE CLAUDE ─────────────────────────────────────────────
// Claude propose les N copies (planner.ts) ; ce module décide de ce qui sera
// RÉELLEMENT fabriqué. Il ne fait jamais confiance au modèle sur les interdits :
//   · valeurs visuelles écrêtées dans VISUAL_BOUNDS (réduites de moitié si
//     vidéo courte) — au-delà, la perte de qualité se voit ;
//   · textes placés par le CODE (placement.ts) : jamais sur un visage, jamais
//     hors zone sûre, jamais sur un texte existant ; sinon retirés ;
//   · au plus MAX_TEXT_ELEMENTS textes à l'écran, texte d'origine compris ;
//   · deux copies n'ont jamais la même combinaison texte / style / position.
// Les indications du user agissent en amont (sur Claude) : rien ici ne peut
// être contourné par elles.
//
// Fonction PURE (aucun appel réseau) : testée par scripts/ai-dup-plan-e2e.mts.
// Chaque ajustement est consigné dans `corrections` (debug, pas montré au user).

import {
  VISUAL_BOUNDS, SHORT_VIDEO_BOUNDS_FACTOR, MAX_TEXT_ELEMENTS, CAPTION_MAX_CHARS,
  SHORT_VIDEO_MAX_TEXT_CHARS, CAPTION_MAX_LINES, MIN_COPIES, MAX_COPIES,
} from "./config";
import {
  presetById, withFont, coverId, parseCoverId,
  COVER_COLOR_KEYS, COVER_SHAPE_KEYS, TEXT_FONT_KEYS, type CoverColor, type CoverShape, type TextFontKey,
} from "./cover-styles";
import { replaceTarget, toCopyFrame, placeCover, type ReplaceTarget } from "./replace-caption";
import { presetsFor, type TextPreset } from "./text-presets";
import { canvasHeight, placeSubtitles, placeText } from "./placement";
import { seededRng, between } from "./rng";
import type { AiDupAnalysis, AiDupMode, AiDupPlan, CopyPlan, PlannedText, Rect, TextAnchor } from "./types";

/* ── Ce que Claude renvoie (schéma de sortie du planificateur) ────────────── */

export type RawCopy = {
  /** Réécriture de la caption d'origine (enabled=false si non demandée) :
   *  style COMPOSÉ (couleur × forme de bloc × police, cover-styles.ts). */
  rewrite?: { enabled: boolean; text: string; color: string; shape: string; font: string };
  /** `font` : police d'un style de la famille classique (optionnel). */
  caption: { enabled: boolean; text: string; preset: string; anchor: string; font?: string };
  subtitles: { enabled: boolean; preset: string; anchor: string };
  cropPct: number;
  cropOffsetX: number;
  cropOffsetY: number;
  speed: number;
  saturation: number;
  contrast: number;
  brightness: number;
  temperature: number;
};
export type RawPlan = { language: string; copies: RawCopy[] };

export const ANCHORS: TextAnchor[] = [
  "top-left", "top-center", "top-right",
  "middle-left", "middle-center", "middle-right",
  "bottom-left", "bottom-center", "bottom-right",
];
const isAnchor = (a: unknown): a is TextAnchor => typeof a === "string" && (ANCHORS as string[]).includes(a);

/* ── Bornes ───────────────────────────────────────────────────────────────── */

type Range = { min: number; max: number };

/** Bornes effectives : en vidéo courte (cas E), l'écart à la valeur neutre
 *  est divisé par SHORT_VIDEO_BOUNDS_FACTOR. */
export function effectiveBounds(short: boolean): Record<keyof typeof VISUAL_BOUNDS, Range> {
  const shrink = (r: Range, neutral: number): Range => short
    ? { min: neutral + (r.min - neutral) * SHORT_VIDEO_BOUNDS_FACTOR, max: neutral + (r.max - neutral) * SHORT_VIDEO_BOUNDS_FACTOR }
    : { ...r };
  const crop = VISUAL_BOUNDS.cropPct;
  return {
    cropPct: short ? { min: crop.min, max: Math.max(crop.min, crop.max * SHORT_VIDEO_BOUNDS_FACTOR) } : { ...crop },
    cropOffset: { ...VISUAL_BOUNDS.cropOffset },
    speed: shrink(VISUAL_BOUNDS.speed, 1),
    saturation: shrink(VISUAL_BOUNDS.saturation, 1),
    contrast: shrink(VISUAL_BOUNDS.contrast, 1),
    brightness: shrink(VISUAL_BOUNDS.brightness, 0),
    temperature: shrink(VISUAL_BOUNDS.temperature, 0),
  };
}

function clamp(v: unknown, r: Range, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(r.max, Math.max(r.min, n)) : fallback;
}

/* ── Copie de secours (sans Claude) ───────────────────────────────────────── */

/** Copie tirée au sort dans les bornes. Sans modèle on n'écrit AUCUNE caption
 *  (pas de texte inventé au hasard) ; les sous-titres restent possibles
 *  puisqu'ils viennent de la voix. */
export function fallbackRawCopy(analysis: AiDupAnalysis, index: number, seed: string): RawCopy {
  const rnd = seededRng(`${seed}#fallback#${index}`);
  const b = effectiveBounds(analysis.scenario === "E_short");
  const subs = presetsFor("subtitles");
  const free = analysis.freeZones.map((z) => z.anchor);
  return {
    rewrite: { enabled: false, text: "", color: "white", shape: "lines", font: "sans" },
    caption: { enabled: false, text: "", preset: "", anchor: "top-center" },
    subtitles: {
      enabled: true,
      preset: subs[index % subs.length].id,
      anchor: free.length ? free[Math.floor(index / subs.length) % free.length] : "bottom-center",
    },
    cropPct: between(rnd, b.cropPct.min, b.cropPct.max),
    cropOffsetX: between(rnd, -40, 40),
    cropOffsetY: between(rnd, -40, 40),
    speed: between(rnd, b.speed.min, b.speed.max),
    saturation: between(rnd, b.saturation.min, b.saturation.max),
    contrast: between(rnd, b.contrast.min, b.contrast.max),
    brightness: between(rnd, b.brightness.min, b.brightness.max),
    temperature: between(rnd, b.temperature.min, b.temperature.max),
  };
}

/* ── Textes d'une copie ───────────────────────────────────────────────────── */

const cleanText = (t: unknown) => String(t ?? "").replace(/\s+/g, " ").trim();

function resolvePreset(id: string, kind: "caption" | "subtitles", note: (m: string) => void): TextPreset {
  const p = presetById(id);
  if (p && p.kinds.includes(kind)) return p;
  const repl = presetsFor(kind)[0];
  note(`style « ${id || "∅"} » invalide pour ${kind} → ${repl.id}`);
  return repl;
}

type Ctx = {
  analysis: AiDupAnalysis; canvasH: number; subtitlesAllowed: boolean; budget: number;
  /** Caption d'origine à réécrire (null = on la garde telle quelle). */
  replace: ReplaceTarget | null;
};

/** Caption de remplacement d'une copie : centrée sur l'ancienne, dans le
 *  cadre de la copie (le recadrage la déplace et la grossit). */
function buildRewrite(ctx: Ctx, text: string, preset: TextPreset, visual: CopyPlan["visual"]): PlannedText | null {
  const r = ctx.replace;
  if (!r) return null;
  const cover = toCopyFrame(r.box, visual);
  const placement = placeCover(text, preset, cover, ctx.canvasH);
  if (!placement) return null;
  return {
    kind: "caption", text, preset: preset.id, anchor: placement.anchor, placement,
    startSec: r.startSec, endSec: r.endSec,
    replaces: { original: r.text, blur: cover },
  };
}

function buildSubtitles(ctx: Ctx, preset: TextPreset, anchor: TextAnchor, avoid: Rect[] = []): PlannedText | null {
  const windows = placeSubtitles(ctx.analysis, preset, anchor, avoid);
  if (!windows.length) return null;
  return { kind: "subtitles", preset: preset.id, anchor: windows[0].anchor, windows };
}

function buildCaption(ctx: Ctx, text: string, preset: TextPreset, anchor: TextAnchor, avoid: Rect[]): PlannedText | null {
  const placement = placeText(text, preset, anchor, ctx.analysis.freeZones, ctx.canvasH, CAPTION_MAX_LINES, avoid);
  if (!placement) return null;
  return { kind: "caption", text, preset: preset.id, anchor: placement.anchor, placement };
}

const boxesOf = (t: PlannedText): Rect[] => t.placement ? [t.placement.box] : (t.windows ?? []).map((w) => w.box);

function buildTexts(ctx: Ctx, raw: RawCopy, visual: CopyPlan["visual"], note: (m: string) => void): PlannedText[] {
  const out: PlannedText[] = [];
  const scen = ctx.analysis.scenario;

  // Réécriture d'abord : elle prend la place de la caption d'origine (déjà
  // comptée dans `existing`), et les autres textes doivent l'éviter.
  let rewrite: PlannedText | null = null;
  if (ctx.replace) {
    const text = cleanText(raw.rewrite?.text);
    if (!raw.rewrite?.enabled || !text) note("réécriture absente → caption d'origine gardée");
    // maxChars n'est qu'une CIBLE donnée à Claude : quelques caractères de
    // plus se rattrapent en réduisant la police (placeCover décide si ça tient).
    else if (text.length > Math.min(CAPTION_MAX_CHARS, Math.round(ctx.replace.maxChars * 1.1))) note(`réécriture trop longue (${text.length} > ${Math.round(ctx.replace.maxChars * 1.1)}) → caption d'origine gardée`);
    else if (text.toLowerCase() === ctx.replace.text.toLowerCase()) note("réécriture identique à l'originale → caption d'origine gardée");
    else {
      const pick = <K extends string>(v: unknown, keys: K[], fallback: K, what: string): K => {
        if (keys.includes(v as K)) return v as K;
        note(`${what} de réécriture « ${String(v || "∅")} » inconnu → ${fallback}`);
        return fallback;
      };
      const id = coverId(
        pick<CoverColor>(raw.rewrite.color, COVER_COLOR_KEYS, "white", "couleur"),
        pick<CoverShape>(raw.rewrite.shape, COVER_SHAPE_KEYS, "lines", "forme"),
        pick<TextFontKey>(raw.rewrite.font, TEXT_FONT_KEYS, "sans", "police"),
      );
      rewrite = buildRewrite(ctx, text, presetById(id)!, visual);
      // Bandeau ligne par ligne impossible à caler sur l'ancienne caption →
      // même couleur, même police, en bloc arrondi. Pilule sur plus de 2
      // lignes = grosse bulle → bloc arrondi aussi.
      const p = parseCoverId(id);
      if (rewrite && p?.shape === "pill" && (rewrite.placement?.lines ?? 1) > 2) {
        rewrite = buildRewrite(ctx, text, presetById(coverId(p.color, "rounded", p.font))!, visual);
        note("pilule sur plus de 2 lignes → bloc arrondi");
      }
      if (!rewrite && p?.shape === "lines") {
        rewrite = buildRewrite(ctx, text, presetById(coverId(p.color, "rounded", p.font))!, visual);
        if (rewrite) note("bandeau ligne par ligne impossible ici → bloc arrondi");
      }
      if (!rewrite) note("réécriture trop longue pour la place → caption d'origine gardée");
    }
  }
  const taken = (): Rect[] => [...(rewrite ? boxesOf(rewrite) : []), ...out.flatMap(boxesOf)];

  // Sous-titres d'abord : en face cam (C / D) ce sont eux qui comptent.
  if (raw.subtitles?.enabled) {
    if (!ctx.subtitlesAllowed) note("sous-titres refusés (pas de voix, déjà présents, ou vidéo courte)");
    else if (out.length >= ctx.budget) note("sous-titres refusés (limite de textes à l'écran)");
    else {
      const preset = resolvePreset(raw.subtitles.preset, "subtitles", note);
      const st = buildSubtitles(ctx, preset, isAnchor(raw.subtitles.anchor) ? raw.subtitles.anchor : "bottom-center", taken());
      if (st) out.push(st); else note("sous-titres retirés : aucune zone libre assez grande");
    }
  }

  if (raw.caption?.enabled) {
    const text = cleanText(raw.caption.text);
    const maxChars = scen === "E_short" ? SHORT_VIDEO_MAX_TEXT_CHARS : CAPTION_MAX_CHARS;
    if (!text) note("caption vide retirée");
    else if (text.length > maxChars) note(`caption trop longue (${text.length} > ${maxChars}) retirée`);
    else if (out.length >= ctx.budget) note("caption refusée (limite de textes à l'écran)");
    else {
      const preset = resolvePreset(withFont(raw.caption.preset, raw.caption.font), "caption", note);
      const cap = buildCaption(ctx, text, preset, isAnchor(raw.caption.anchor) ? raw.caption.anchor : "top-center", taken());
      if (cap) {
        if (cap.anchor !== raw.caption.anchor) note(`caption déplacée ${raw.caption.anchor} → ${cap.anchor}`);
        out.push(cap);
      } else note("caption retirée : ne tient dans aucune zone libre");
    }
  }
  return rewrite ? [rewrite, ...out] : out;
}

/** Réparation : la réécriture d'une copie, refaite en BLOC arrondi (même
 *  couleur, même police) — quand un bandeau ligne par ligne laissait voir
 *  l'ancienne caption. null si impossible. */
export function rewriteAsBlock(copy: CopyPlan, analysis: AiDupAnalysis): PlannedText | null {
  const t = copy.texts.find((x) => x.replaces);
  const p = t ? parseCoverId(t.preset) : null;
  if (!t || !p || p.shape !== "lines") return null;
  const ctx: Ctx = { analysis, canvasH: canvasHeight(analysis), subtitlesAllowed: false, budget: 0, replace: replaceTarget(analysis).target };
  return buildRewrite(ctx, t.text ?? "", presetById(coverId(p.color, "rounded", p.font))!, copy.visual);
}

/* ── Unicité ──────────────────────────────────────────────────────────────── */

export const textSignature = (texts: PlannedText[]) =>
  texts.map((t) => `${t.kind}|${(t.text ?? "").toLowerCase()}|${t.preset}|${t.anchor}`).sort().join("§");

/** Essaie de rendre une copie unique en changeant le style puis la position
 *  d'un de ses textes. Renvoie les nouveaux textes, ou null si impossible. */
function makeUnique(ctx: Ctx, texts: PlannedText[], taken: Set<string>, visual: CopyPlan["visual"]): PlannedText[] | null {
  for (let ti = texts.length - 1; ti >= 0; ti--) {
    const t = texts[ti];
    const others = texts.filter((_, j) => j !== ti);
    const avoid = others.flatMap(boxesOf);
    if (t.replaces) {
      // La réécriture reste sur l'ancienne caption : seul son style peut
      // varier (couleur, puis forme, puis police).
      for (const color of COVER_COLOR_KEYS) for (const shape of COVER_SHAPE_KEYS) for (const font of TEXT_FONT_KEYS) {
        const id = coverId(color, shape, font);
        if (id === t.preset) continue;
        const alt = buildRewrite(ctx, t.text ?? "", presetById(id)!, visual);
        if (alt && !taken.has(textSignature([...others, alt]))) return [...others, alt];
      }
      continue;
    }
    const anchors = [t.anchor, ...ctx.analysis.freeZones.map((z) => z.anchor).filter((a) => a !== t.anchor)];
    for (const anchor of anchors) {
      for (const preset of presetsFor(t.kind)) {
        if (anchor === t.anchor && preset.id === t.preset) continue;
        const alt = t.kind === "caption"
          ? buildCaption(ctx, t.text ?? "", preset, anchor, avoid)
          : buildSubtitles(ctx, preset, anchor, avoid);
        if (!alt) continue;
        if (avoid.length && boxesOf(alt).some((b) => avoid.some((a) => overlap(a, b)))) continue;
        const candidate = [...others, alt];
        if (!taken.has(textSignature(candidate))) return candidate;
      }
    }
  }
  return null;
}

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/* ── Entrée principale ────────────────────────────────────────────────────── */

export function validatePlan(input: {
  analysis: AiDupAnalysis;
  mode: AiDupMode;
  copies: number;
  /** Sortie de Claude ; null = Claude indisponible → plan de secours. */
  raw: RawPlan | null;
  /** Graine propre au lancement : deux lancements = deux jeux de réglages spoofer. */
  seed: string;
  /** Cacher la caption d'origine et la réécrire (si elle s'y prête). */
  replaceCaption?: boolean;
}): AiDupPlan {
  const { analysis, mode, raw, seed } = input;
  const n = Math.max(MIN_COPIES, Math.min(MAX_COPIES, Math.floor(Number(input.copies) || 1)));
  const corrections: string[] = [];
  const language = raw && /^[a-z]{2}$/i.test(String(raw.language ?? "").trim())
    ? String(raw.language).trim().toLowerCase()
    : analysis.language ?? "fr";
  const spoofer = (i: number) => ({ seed: `${seed}:${i}` });

  // Mode Invisible : aucune modification visible, le spoofer fait tout.
  if (mode === "invisible") {
    return {
      scenario: analysis.scenario, language,
      copies: Array.from({ length: n }, (_, i) => ({ index: i, texts: [], spoofer: spoofer(i) })),
      corrections,
    };
  }

  const short = analysis.scenario === "E_short";
  const b = effectiveBounds(short);
  const existing = (analysis.burnedCaption.present ? 1 : 0) + (analysis.existingSubtitles.present ? 1 : 0);
  const ctx: Ctx = {
    analysis,
    canvasH: canvasHeight(analysis),
    subtitlesAllowed: analysis.hasVoice && !!analysis.words?.length && !analysis.existingSubtitles.present && !short,
    budget: Math.max(0, MAX_TEXT_ELEMENTS - existing),
    replace: input.replaceCaption ? replaceTarget(analysis).target : null,
  };

  const rawCopies = (raw?.copies ?? []).slice(0, n);
  if (!raw) corrections.push("plan de secours (Claude indisponible)");
  else if (rawCopies.length < n) corrections.push(`Claude a rendu ${rawCopies.length}/${n} copies → complétées par tirage`);
  while (rawCopies.length < n) rawCopies.push(fallbackRawCopy(analysis, rawCopies.length, seed));

  const takenTexts = new Set<string>();
  const takenVisual = new Set<string>();
  const copies: CopyPlan[] = rawCopies.map((rc, i) => {
    const note = (m: string) => corrections.push(`copie ${i + 1} : ${m}`);
    const visual = {
      cropPct: r2(clamp(rc.cropPct, b.cropPct, b.cropPct.min)),
      cropOffsetX: r2(clamp(rc.cropOffsetX, b.cropOffset, 0)),
      cropOffsetY: r2(clamp(rc.cropOffsetY, b.cropOffset, 0)),
      speed: r3(clamp(rc.speed, b.speed, 1)),
      color: {
        saturation: r3(clamp(rc.saturation, b.saturation, 1)),
        contrast: r3(clamp(rc.contrast, b.contrast, 1)),
        brightness: r3(clamp(rc.brightness, b.brightness, 0)),
        temperature: r3(clamp(rc.temperature, b.temperature, 0)),
      },
    };

    // Unicité visuelle (copies sans texte surtout) : réglage déjà pris →
    // nouveau tirage dans les bornes, propre à la copie. AVANT les textes :
    // la caption de remplacement se place d'après le recadrage final.
    let vKey = JSON.stringify(visual);
    for (let k = 1; takenVisual.has(vKey) && k <= 10; k++) {
      const alt = fallbackRawCopy(analysis, i, `${seed}#visual#${k}`);
      Object.assign(visual, {
        cropPct: r2(alt.cropPct), cropOffsetX: r2(alt.cropOffsetX), cropOffsetY: r2(alt.cropOffsetY), speed: r3(alt.speed),
        color: { saturation: r3(alt.saturation), contrast: r3(alt.contrast), brightness: r3(alt.brightness), temperature: r3(alt.temperature) },
      });
      vKey = JSON.stringify(visual);
      if (k === 1) note("réglage visuel identique à une autre copie → nouveau tirage");
    }
    takenVisual.add(vKey);

    let texts = buildTexts(ctx, rc, visual, note);
    if (texts.length) {
      const sig = textSignature(texts);
      if (takenTexts.has(sig)) {
        const alt = makeUnique(ctx, texts, takenTexts, visual);
        if (alt) { texts = alt; note("combinaison texte/style/position déjà prise → variée"); }
        else note("combinaison texte identique à une autre copie (aucune alternative libre)");
      }
      takenTexts.add(textSignature(texts));
    }

    return { index: i, visual, texts, spoofer: spoofer(i) };
  });

  return { scenario: analysis.scenario, language, copies, corrections };
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

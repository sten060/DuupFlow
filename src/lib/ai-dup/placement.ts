// src/lib/ai-dup/placement.ts
//
// ── OÙ POSER UN TEXTE (calcul pur, aucune IA) ────────────────────────────────
// L'IA choisit une ANCRE (« haut-gauche ») ; ce module la transforme en
// coordonnées et garantit les interdits de la spec : jamais sur un visage,
// jamais hors zone sûre, jamais sur un texte existant. Si le texte ne tient
// pas dans la zone, on réduit la police (jusqu'à un plancher lisible) puis on
// renonce — mieux vaut pas de texte qu'un texte qui déborde sur un visage.

import { computeFreeZones, expand, intersects } from "./analyze";
import { FACE_MARGIN_PCT, BURNED_TEXT_MARGIN_PCT, MIN_FONT_PX, CAPTION_MAX_LINES, SUBTITLE_LINES, SUBTITLE_CHARS_PER_SCREEN } from "./config";
import type { AiDupAnalysis, FreeZone, Rect, TextAnchor, TextPlacement, TimedRect } from "./types";
import type { TextPreset } from "./text-presets";

/** Largeur de référence du canvas (convention px @1080). */
const W = 1080;
/** Interligne du moteur (EditCaption.lineHeight par défaut). */
const LINE_HEIGHT = 1.24;

/** Ordre de repli quand l'ancre demandée n'est pas libre : on reste le plus
 *  près possible (même rangée d'abord, puis rangée voisine). */
const ROW_ORDER: Record<string, string[]> = {
  top: ["top", "middle", "bottom"],
  middle: ["middle", "top", "bottom"],
  bottom: ["bottom", "middle", "top"],
};
const COL_ORDER: Record<string, string[]> = {
  left: ["left", "center", "right"],
  center: ["center", "left", "right"],
  right: ["right", "center", "left"],
};

export function anchorFallbacks(anchor: TextAnchor): TextAnchor[] {
  const [r, c] = anchor.split("-");
  return ROW_ORDER[r].flatMap((row) => COL_ORDER[c].map((col) => `${row}-${col}` as TextAnchor));
}

/** Hauteur du canvas (px) à largeur 1080, selon le format de la vidéo. */
export function canvasHeight(a: Pick<AiDupAnalysis, "width" | "height">): number {
  return W * (a.height / Math.max(1, a.width));
}

/** Gabarit estimé d'un texte : nombre de lignes et boîte en %, pour une
 *  largeur max donnée. Estimation volontairement pessimiste (césure aux mots
 *  ignorée → on ajoute une ligne de marge dès qu'on passe à plusieurs lignes). */
function measure(text: string, preset: TextPreset, fontSize: number, maxWidthPct: number, canvasH: number, maxLines: number) {
  const pad = (preset.caption.padding ?? preset.caption.paddingX ?? 0) * 2 + (preset.caption.strokeWidth ?? 0) * 2;
  const maxW = (maxWidthPct / 100) * W - pad;
  const textW = text.length * fontSize * preset.charWidth;
  let lines = Math.max(1, Math.ceil(textW / Math.max(1, maxW)));
  if (lines > 1) lines = Math.min(lines + 1, Math.max(lines, maxLines + 1)); // marge de césure
  const wPx = Math.min(textW, maxW) + pad;
  const hPx = lines * fontSize * LINE_HEIGHT + (preset.caption.padding ?? preset.caption.paddingY ?? 0) * 2;
  return { lines, wPct: (wPx / W) * 100, hPct: (hPx / canvasH) * 100 };
}

/** Place un texte dans une zone libre. null si impossible même au plancher. */
export function placeInZone(
  text: string, preset: TextPreset, zone: FreeZone, canvasH: number, maxLines: number,
): TextPlacement | null {
  for (let fs = preset.fontSize; fs >= MIN_FONT_PX; fs -= 4) {
    const m = measure(text, preset, fs, zone.w, canvasH, maxLines);
    if (m.lines > maxLines || m.hPct > zone.h || m.wPct > zone.w) continue;
    const [row, col] = zone.anchor.split("-");
    const x = col === "left" ? zone.x + m.wPct / 2 : col === "right" ? zone.x + zone.w - m.wPct / 2 : zone.x + zone.w / 2;
    const y = row === "top" ? zone.y + m.hPct / 2 : row === "bottom" ? zone.y + zone.h - m.hPct / 2 : zone.y + zone.h / 2;
    const box: Rect = { x: r1(x - m.wPct / 2), y: r1(y - m.hPct / 2), w: r1(m.wPct), h: r1(m.hPct) };
    return { anchor: zone.anchor, x: r1(x), y: r1(y), align: col === "left" ? "left" : col === "right" ? "right" : "center", fontSize: fs, box };
  }
  return null;
}

/** Place un texte en partant de l'ancre voulue puis des ancres voisines.
 *  `avoid` : boîtes déjà occupées (autre texte de la même copie). */
export function placeText(
  text: string, preset: TextPreset, wanted: TextAnchor, zones: FreeZone[], canvasH: number, maxLines: number, avoid: Rect[] = [],
): TextPlacement | null {
  for (const anchor of anchorFallbacks(wanted)) {
    const zone = zones.find((z) => z.anchor === anchor);
    if (!zone) continue;
    const p = placeInZone(text, preset, zone, canvasH, maxLines);
    if (p && !avoid.some((a) => intersects(expand(a, 1), p.box))) return p;
  }
  return null;
}

/* ── Sous-titres moment par moment ────────────────────────────────────────── */

type Protected = Rect & { startSec: number; endSec: number };

function protectedItems(a: AiDupAnalysis): Protected[] {
  const d = a.durationSec;
  const timed = (r: TimedRect, m: number): Protected => ({ ...expand(r, m), startSec: r.startSec ?? 0, endSec: r.endSec ?? d });
  return [
    ...a.faces.map((f) => timed(f, FACE_MARGIN_PCT)),
    ...a.burnedCaption.boxes.map((b) => timed(b, BURNED_TEXT_MARGIN_PCT)),
    ...a.existingSubtitles.boxes.map((b) => timed(b, BURNED_TEXT_MARGIN_PCT)),
    ...(a.graphics ?? []).map((g) => timed(g, BURNED_TEXT_MARGIN_PCT)),
  ];
}

/** Découpe la vidéo aux instants où un visage / texte apparaît ou disparaît,
 *  et donne les zones libres de chaque tranche. Prudence : une tranche SANS
 *  visage alors que la vidéo en contient ailleurs est traitée comme si tous
 *  les visages y étaient (l'inspection peut avoir raté une apparition). */
export function freeZonesOverTime(a: AiDupAnalysis): { startSec: number; endSec: number; zones: FreeZone[] }[] {
  const d = a.durationSec;
  if (d <= 0) return [];
  const items = protectedItems(a);
  const faceItems = items.slice(0, a.faces.length);
  const cuts = [...new Set([0, d, ...items.flatMap((i) => [i.startSec, i.endSec])])]
    .filter((t) => t >= 0 && t <= d).sort((x, y) => x - y);
  const out: { startSec: number; endSec: number; zones: FreeZone[] }[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const s = cuts[i], e = cuts[i + 1];
    if (e - s < 0.05) continue;
    let active = items.filter((it) => it.startSec < e && s < it.endSec);
    const facesHere = active.some((it) => faceItems.includes(it));
    if (faceItems.length && !facesHere) active = [...active, ...faceItems];
    out.push({ startSec: s, endSec: e, zones: computeFreeZones(active) });
  }
  return out;
}

/** Place les sous-titres : même ancre que voulue quand c'est possible, sinon
 *  la plus proche, tranche par tranche. Tranches contiguës au même endroit
 *  fusionnées. Hauteur prévue pour SUBTITLE_LINES lignes. */
export function placeSubtitles(
  a: AiDupAnalysis, preset: TextPreset, wanted: TextAnchor, avoid: Rect[] = [],
): (TextPlacement & { startSec: number; endSec: number })[] {
  const sample = "x".repeat(SUBTITLE_CHARS_PER_SCREEN);
  const canvasH = canvasHeight(a);
  const out: (TextPlacement & { startSec: number; endSec: number })[] = [];
  for (const slice of freeZonesOverTime(a)) {
    const p = placeText(sample, preset, wanted, slice.zones, canvasH, SUBTITLE_LINES, avoid);
    if (!p) continue;
    const prev = out[out.length - 1];
    // Fusion seulement à position IDENTIQUE : une position valide sur une
    // tranche peut toucher un visage sur la suivante.
    if (prev && prev.x === p.x && prev.y === p.y && prev.fontSize === p.fontSize && Math.abs(prev.endSec - slice.startSec) < 0.01) {
      prev.endSec = r2(slice.endSec);
    } else {
      out.push({ ...p, startSec: r2(slice.startSec), endSec: r2(slice.endSec) });
    }
  }
  return out;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

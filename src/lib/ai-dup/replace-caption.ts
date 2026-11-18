// src/lib/ai-dup/replace-caption.ts
//
// ── RÉÉCRIRE LA CAPTION D'ORIGINE (calcul pur, aucune IA) ────────────────────
// La caption incrustée est l'empreinte la plus visible d'une vidéo. Sur
// demande, chaque copie la cache et y écrit la même idée, reformulée.
//
// On ne sait pas EFFACER un texte incrusté. Recette, à deux étages :
//   1. un flou fort sur la zone de l'ancienne caption (filet de sécurité :
//      même si la boîte est un peu juste, aucune lettre ne reste lisible) ;
//   2. une boîte PLEINE, un peu plus grande que l'ancienne caption, avec le
//      nouveau texte dedans.
//
// Ce module décide QUAND c'est possible (une caption fixe, de taille
// raisonnable, qui ne touche aucun visage) et OÙ poser la boîte dans le
// cadre de la COPIE (le recadrage déplace et grossit l'ancienne caption).

import { expand, intersects } from "./analyze";
import {
  REPLACE_COVER_MARGIN_PCT, REPLACE_MAX_W_PCT, REPLACE_MAX_H_PCT, REPLACE_SAME_TIMING_SEC,
  REPLACE_LENGTH_FACTOR, CAPTION_MAX_CHARS, MIN_FONT_PX, CAPTION_MAX_LINES, REPLACE_MAX_FONT_PX,
} from "./config";
import type { TextPreset } from "./text-presets";
import type { AiDupAnalysis, CopyPlan, Rect, TextPlacement } from "./types";

export type ReplaceTarget = {
  /** Zone de l'ancienne caption, en % du cadre SOURCE (union de ses lignes). */
  box: Rect;
  startSec: number;
  endSec: number;
  text: string;
  /** Longueur max de la caption réécrite. */
  maxChars: number;
};

/** La caption d'origine peut-elle être remplacée ? Sinon, pourquoi (affiché
 *  au user). null + raison null = pas de caption du tout. */
export function replaceTarget(a: AiDupAnalysis): { target: ReplaceTarget | null; reason: string | null } {
  const cap = a.burnedCaption;
  if (!a.inspected || !cap.present || !cap.boxes.length) return { target: null, reason: null };
  if (a.existingSubtitles.present) {
    // Des sous-titres qui suivent la voix ressemblent à une caption : on ne
    // remplace pas à l'aveugle un texte qui change à chaque phrase.
    return { target: null, reason: "la vidéo a des sous-titres qui changent avec la voix" };
  }
  const d = a.durationSec;
  const starts = cap.boxes.map((b) => b.startSec ?? 0);
  const ends = cap.boxes.map((b) => b.endSec ?? d);
  // Plusieurs boîtes = les lignes d'UNE caption, ou plusieurs textes
  // successifs. Elles doivent apparaître et disparaître ensemble.
  if (Math.max(...starts) - Math.min(...starts) > REPLACE_SAME_TIMING_SEC || Math.max(...ends) - Math.min(...ends) > REPLACE_SAME_TIMING_SEC) {
    return { target: null, reason: "la caption change pendant la vidéo" };
  }
  const x0 = Math.min(...cap.boxes.map((b) => b.x)), y0 = Math.min(...cap.boxes.map((b) => b.y));
  const x1 = Math.max(...cap.boxes.map((b) => b.x + b.w)), y1 = Math.max(...cap.boxes.map((b) => b.y + b.h));
  // Étendue mesurée dans les pixels si on l'a (plus juste que l'inspection).
  const box = expand(cap.tightBox ?? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, REPLACE_COVER_MARGIN_PCT);
  if (box.w > REPLACE_MAX_W_PCT || box.h > REPLACE_MAX_H_PCT) return { target: null, reason: "la caption est trop grande pour être cachée proprement" };
  const startSec = Math.max(0, Math.min(...starts)), endSec = Math.min(d, Math.max(...ends));
  const onFace = a.faces.some((f) => (f.startSec ?? 0) < endSec && startSec < (f.endSec ?? d) && intersects(box, f));
  if (onFace) return { target: null, reason: "la caption touche un visage" };
  const text = (cap.text ?? "").trim();
  if (!text) return { target: null, reason: "le texte de la caption n'a pas pu être lu" };
  // Plancher de 20 : une caption d'un mot doit pouvoir devenir une courte phrase.
  const maxChars = Math.min(CAPTION_MAX_CHARS, Math.max(20, Math.round(text.length * REPLACE_LENGTH_FACTOR)));
  return { target: { box, startSec, endSec, text, maxChars }, reason: null };
}

/** Rectangle du cadre SOURCE → cadre de la COPIE, après le recadrage du
 *  moteur (ai-editor/render.ts → spatialPrefix : fenêtre 1/s centrée puis
 *  décalée de offset % de la marge). */
export function toCopyFrame(r: Rect, visual: CopyPlan["visual"]): Rect {
  if (!visual || visual.cropPct <= 0) return { ...r };
  const s = 1 + visual.cropPct / 100;
  const left = (1 - 1 / s) * (0.5 + visual.cropOffsetX / 100) * 100;
  const top = (1 - 1 / s) * (0.5 + visual.cropOffsetY / 100) * 100;
  const x = (r.x - left) * s, y = (r.y - top) * s;
  const cx = Math.max(0, x), cy = Math.max(0, y);
  return {
    x: r1(cx), y: r1(cy),
    w: r1(Math.min(100, x + r.w * s) - cx), h: r1(Math.min(100, y + r.h * s) - cy),
  };
}

/* ── Gabarit de la boîte (mêmes conventions que le moteur, render.ts) ──────── */

const W = 1080;
const LINE_HEIGHT = 1.24;
/** Marge minimale (en % de la largeur) entre le bloc et chaque bord de la
 *  vidéo : au-delà, les apps rognent le bord à la publication (retour Sten,
 *  16/11 : blocs collés aux bords). */
const EDGE_PCT = 4;
const MAX_BOX_PCT = 100 - 2 * EDGE_PCT;
/** Une réécriture peut prendre une ligne de plus que la place idéale. */
const MAX_LINES = CAPTION_MAX_LINES + 1;

/** Place la caption de remplacement CENTRÉE sur l'ancienne (déjà ramenée au
 *  cadre de la copie). Principe d'un monteur : la boîte a la taille de
 *  l'ancienne caption (imposée au moteur, minBoxW/H) et c'est la POLICE qui
 *  grandit pour la remplir — pas des marges gonflées autour d'un petit texte.
 *  On prend la plus grande police dont le texte tient dans la boîte ; si même
 *  la plus petite déborde, la boîte grandit (en hauteur) plutôt que de
 *  renoncer. null seulement si le texte dépasse MAX_LINES au plancher. */
export function placeCover(text: string, preset: TextPreset, coverIn: Rect, canvasH: number): TextPlacement | null {
  // Jamais collé aux bords : la zone à couvrir est ramenée dans les marges
  // (ce qui dépasserait reste flouté dessous, et c'est un bord de vidéo).
  const cl = Math.max(EDGE_PCT, coverIn.x), cr = Math.min(100 - EDGE_PCT, coverIn.x + coverIn.w);
  if (cr - cl < 5) return null;
  const cover: Rect = { ...coverIn, x: cl, w: cr - cl };
  const cwPx = (cover.w / 100) * W, chPx = (cover.h / 100) * canvasH;
  const padX = preset.caption.paddingX ?? preset.caption.padding ?? 24;
  const padY = preset.caption.paddingY ?? preset.caption.padding ?? 14;
  if (preset.caption.boxShape === "lines") return placeLines(text, preset, cover, canvasH, padX, padY);
  // Largeur utile d'une ligne : celle de l'ancienne caption, sans les marges.
  // Plancher à 50 % du cadre : une caption d'un mot ne doit pas forcer une
  // colonne étroite pour une reformulation plus longue.
  const lineCap = Math.max(cwPx, W * 0.5) - 2 * padX;
  const fit = (fs: number) => {
    const total = text.length * fs * preset.charWidth;
    const lines = Math.max(1, Math.ceil(total / lineCap));
    const textW = Math.min(total, lineCap);
    const h = lines * fs * LINE_HEIGHT + 2 * padY;
    return { lines, w: textW + 2 * padX, h };
  };
  let chosen: { fs: number; lines: number; w: number; h: number } | null = null;
  // 3 lignes au plus d'abord (proche d'une caption native) ; 4 en dernier
  // recours — une tour de 4 lignes étroites en grosse police est moins belle
  // qu'un bloc de 3 lignes un peu plus petit (vu le 16/11).
  for (const maxL of [CAPTION_MAX_LINES, MAX_LINES]) {
    for (let fs = REPLACE_MAX_FONT_PX; fs >= MIN_FONT_PX; fs -= 2) {
      const f = fit(fs);
      // Le bloc peut grandir de 25 % en hauteur : un texte bien lisible vaut
      // mieux qu'un bloc pile à la taille de l'ancienne caption.
      if (f.lines <= maxL && f.h <= chPx * 1.25) { chosen = { fs, ...f }; break; }
    }
    if (chosen) break;
  }
  if (!chosen) {
    const f = fit(MIN_FONT_PX);
    if (f.lines > MAX_LINES) return null;
    chosen = { fs: MIN_FONT_PX, ...f };
  }
  const boxWpx = Math.min((MAX_BOX_PCT / 100) * W, Math.max(cwPx, chosen.w));
  const boxHpx = Math.max(chPx, chosen.h);
  const wPct = (boxWpx / W) * 100, hPct = (boxHpx / canvasH) * 100;
  // Centre décalé si besoin pour que le bloc reste dans les marges.
  const cx = Math.min(100 - EDGE_PCT - wPct / 2, Math.max(EDGE_PCT + wPct / 2, cover.x + cover.w / 2));
  const cy = cover.y + cover.h / 2;
  return {
    anchor: "middle-center", x: r1(cx), y: r1(cy), align: "center", fontSize: chosen.fs,
    box: { x: r1(cx - wPct / 2), y: r1(cy - hPct / 2), w: r1(wPct), h: r1(hPct) },
    // px @1080 : hauteur ramenée à l'échelle de la largeur (convention moteur).
    minBoxW: Math.round(cwPx), minBoxH: Math.round(chPx),
    wrapW: Math.round(lineCap),
    lines: chosen.lines,
  };
}

/** Bandeau LIGNE PAR LIGNE (texte natif Instagram/TikTok) : chaque ligne a
 *  son propre fond, à sa largeur. Pas de taille minimale possible → c'est le
 *  TEXTE qui doit couvrir l'ancienne caption : chaque ligne au moins aussi
 *  large qu'elle, et assez de lignes pour toute sa hauteur. On cherche le
 *  nombre de lignes L et la police qui tiennent ces deux contraintes ; sinon
 *  null (la copie passe en bloc arrondi, même couleur et même police). */
function placeLines(text: string, preset: TextPreset, cover: Rect, canvasH: number, padX: number, padY: number): TextPlacement | null {
  const cwPx = (cover.w / 100) * W, chPx = (cover.h / 100) * canvasH;
  // Le moteur coupe les lignes à 90 % de la largeur : on reste en dessous.
  const lineMax = Math.min(cwPx * 1.12, W * 0.86) - 2 * padX;
  const need = cwPx * 0.98 - 2 * padX; // largeur de TEXTE par ligne pour couvrir
  for (let L = 1; L <= MAX_LINES; L++) {
    const perFs = (text.length * preset.charWidth) / L; // largeur d'une ligne par px de police
    const fsW = need / perFs, fsWmax = lineMax / perFs;
    const fsH = (chPx * 0.98 - 2 * padY) / (L * LINE_HEIGHT);
    const fs = Math.ceil(Math.max(fsW, fsH, MIN_FONT_PX));
    if (fs > fsWmax || fs > REPLACE_MAX_FONT_PX) continue;
    const h = L * fs * LINE_HEIGHT + 2 * padY;
    if (h > chPx * 1.4) continue; // bandeaux bien plus hauts que l'original : non
    const wPct = ((perFs * fs + 2 * padX) / W) * 100, hPct = (h / canvasH) * 100;
    const cx = Math.min(100 - EDGE_PCT - wPct / 2, Math.max(EDGE_PCT + wPct / 2, cover.x + cover.w / 2));
    const cy = cover.y + cover.h / 2;
    return {
      anchor: "middle-center", x: r1(cx), y: r1(cy), align: "center", fontSize: fs,
      box: { x: r1(cx - wPct / 2), y: r1(cy - hPct / 2), w: r1(wPct), h: r1(hPct) },
      // Un peu plus que la ligne moyenne : le moteur coupe en L lignes égales.
      wrapW: Math.round(perFs * fs * 1.06),
      lines: L,
    };
  }
  return null;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

// src/lib/ai-dup/to-edit-plan.ts
//
// ── D'UNE COPIE PLANIFIÉE À UN PLAN DE MONTAGE DE L'ÉDITEUR IA ───────────────
// Traduction pure CopyPlan → EditPlan, exécuté tel quel par le moteur de rendu
// existant (ai-editor/render.ts). Rien n'est décidé ici : les positions, tailles
// et styles viennent de validate.ts.
//
// Temps : la copie couvre TOUTE la vidéo (on duplique, on ne remonte pas). Avec
// une vitesse ≠ 1, un instant t de la source tombe à t / vitesse dans la
// copie — les sous-titres sont recalés en conséquence.

import type { EditCaption, EditPlan } from "@/lib/ai-editor/plan-types";
import { presetById } from "./cover-styles";
import { SUBTITLE_CHARS_PER_SCREEN, SUBTITLE_MAX_PAUSE_SEC } from "./config";
import type { AiDupAnalysis, CopyPlan, PlannedText } from "./types";

type Word = { startSec: number; endSec: number; text: string };

/** Découpe la parole en blocs d'écran : ≤ N caractères, et coupure sur une
 *  pause (une phrase ne doit pas rester affichée pendant un silence). */
export function chunkWords(words: Word[], maxChars = SUBTITLE_CHARS_PER_SCREEN): Word[][] {
  const out: Word[][] = [];
  let cur: Word[] = [];
  let len = 0;
  for (const w of words) {
    const t = w.text.trim();
    if (!t) continue;
    const prev = cur[cur.length - 1];
    const pause = prev ? w.startSec - prev.endSec : 0;
    // Fin de phrase → nouveau bloc (sinon « j'utilise déjà. La méthode »).
    const sentenceEnd = !!prev && /[.!?…]$/.test(prev.text);
    if (cur.length && (len + 1 + t.length > maxChars || pause > SUBTITLE_MAX_PAUSE_SEC || sentenceEnd)) {
      out.push(cur); cur = []; len = 0;
    }
    cur.push({ ...w, text: t });
    len += (len ? 1 : 0) + t.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

function captionFor(t: PlannedText, outDur: number, speed: number): EditCaption | null {
  const preset = presetById(t.preset);
  if (!preset || !t.placement || !t.text) return null;
  const p = t.placement;
  return {
    ...preset.caption,
    text: t.text,
    // Fenêtre en temps SOURCE (caption de remplacement) → temps de la copie.
    startSec: t.startSec != null ? r2(t.startSec / speed) : 0,
    endSec: t.endSec != null ? Math.min(outDur, r2(t.endSec / speed)) : outDur,
    x: p.x, y: p.y, align: p.align, fontSize: p.fontSize,
    // Remplacement : fond PLEIN (jamais translucide) et taille minimale de
    // boîte = l'ancienne caption, pour la couvrir entièrement.
    ...(t.replaces ? { backgroundOpacity: 1 } : {}),
    ...(p.minBoxW != null ? { minBoxWidth: p.minBoxW } : {}),
    ...(p.minBoxH != null ? { minBoxHeight: p.minBoxH } : {}),
    ...(p.wrapW != null ? { wrapWidth: p.wrapW, fixedSize: true } : {}),
  };
}

function subtitlesFor(t: PlannedText, words: Word[], speed: number): EditCaption[] {
  const preset = presetById(t.preset);
  if (!preset || !t.windows?.length) return [];
  const out: EditCaption[] = [];
  for (const chunk of chunkWords(words)) {
    const s = chunk[0].startSec, e = chunk[chunk.length - 1].endSec;
    // Fenêtre de placement = celle qui contient le milieu du bloc (temps source).
    const mid = (s + e) / 2;
    const win = t.windows.find((w) => mid >= w.startSec && mid < w.endSec);
    if (!win) continue; // pas de place sûre à ce moment-là → pas de sous-titre
    const karaoke = preset.caption.animation === "karaoke" || preset.caption.animation === "wordByWord";
    out.push({
      ...preset.caption,
      text: chunk.map((w) => w.text).join(" "),
      startSec: r2(s / speed),
      endSec: r2(Math.max(e, s + 0.3) / speed),
      x: win.x, y: win.y, align: win.align, fontSize: win.fontSize,
      ...(karaoke ? { words: chunk.map((w) => ({ text: w.text, start: r2(w.startSec / speed), end: r2(w.endSec / speed) })) } : {}),
    });
  }
  return out;
}

export function copyToEditPlan(copy: CopyPlan, materialId: string, materialName: string, analysis: AiDupAnalysis): EditPlan {
  const v = copy.visual;
  const speed = v?.speed && Math.abs(v.speed - 1) > 0.001 ? v.speed : 1;
  const outDur = analysis.durationSec / speed;
  const captions: EditCaption[] = [];
  for (const t of copy.texts) {
    if (t.kind === "caption") { const c = captionFor(t, outDur, speed); if (c) captions.push(c); }
    else captions.push(...subtitlesFor(t, analysis.words ?? [], speed));
  }
  // Ancienne caption floutée SOUS la boîte de remplacement : filet de sécurité
  // si la boîte est un peu juste (le flou s'applique après le recadrage, donc
  // dans le cadre de la copie — c'est celui de `blur`).
  const blurRegions = copy.texts.filter((t) => t.replaces).map((t) => ({
    x: t.replaces!.blur.x, y: t.replaces!.blur.y, width: t.replaces!.blur.w, height: t.replaces!.blur.h,
    intensity: 1, startSec: r2((t.startSec ?? 0) / speed), endSec: r2((t.endSec ?? analysis.durationSec) / speed),
  }));
  return {
    aspect: analysis.aspect,
    ...(v ? { grade: { ...v.color } } : {}),
    segments: [{
      materialId,
      startSec: 0,
      endSec: analysis.durationSec,
      ...(v ? { scale: r3(1 + v.cropPct / 100), offsetX: v.cropOffsetX, offsetY: v.cropOffsetY } : {}),
      ...(speed !== 1 ? { speed } : {}),
      ...(blurRegions.length ? { blurRegions } : {}),
    }],
    ...(captions.length ? { captions } : {}),
    label: `${materialName.replace(/\.[a-z0-9]+$/i, "")} · copie ${copy.index + 1}`,
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

// src/lib/ai-dup/analyze.ts
//
// ── ANALYSE D'UNE VIDÉO POUR LA DUPLICATION IA (une fois par vidéo) ──────────
// Assemble trois sources :
//   1. l'analyse matière de l'Éditeur IA (durée, format, son, transcript mot à
//      mot, fiabilité de la voix) — déjà faite à l'upload, gratuite ici ;
//   2. un regard Gemini dédié (gemini.ts → inspectForDuplication) : textes
//      incrustés, visages, langue, voix ;
//   3. du CALCUL pur pour tout ce qui protège le user : zones libres et cas de
//      figure. Ces décisions ne sont jamais confiées à un modèle.
//
// Dégradation sûre : si l'inspection échoue, on ne sait pas où sont les
// visages → AUCUNE zone libre → aucun texte ajouté (les autres leviers restent).

import type { ProjectMaterial } from "@/lib/ai-editor/store";
import { inspectForDuplication, geminiLastError, type DupInspection } from "@/lib/ai-editor/gemini";
import { proxyForViewing } from "@/lib/ai-editor/render";
import {
  SAFE_ZONE, FACE_MARGIN_PCT, BURNED_TEXT_MARGIN_PCT, SHORT_VIDEO_SEC,
  FACECAM_MIN_PRESENCE, FACECAM_MIN_AREA_PCT, MIN_TEXT_ZONE_H_PCT,
} from "./config";
import { measureCaptionTiming } from "./caption-timing";
import type { AiDupAnalysis, AiDupScenario, DetectedText, FreeZone, Rect, TextAnchor, TimedRect } from "./types";

/* ── Géométrie ────────────────────────────────────────────────────────────── */

const ROWS = ["top", "middle", "bottom"] as const;
const COLS = ["left", "center", "right"] as const;

/** Les 9 cases de la zone sûre (grille 3×3), une par ancre. */
export function safeZoneCells(): FreeZone[] {
  const x0 = SAFE_ZONE.left, x1 = 100 - SAFE_ZONE.right;
  const y0 = SAFE_ZONE.top, y1 = 100 - SAFE_ZONE.bottom;
  const cw = (x1 - x0) / 3, ch = (y1 - y0) / 3;
  return ROWS.flatMap((r, ri) => COLS.map((c, ci) => ({
    anchor: `${r}-${c}` as TextAnchor,
    x: round(x0 + ci * cw), y: round(y0 + ri * ch), w: round(cw), h: round(ch),
  })));
}

export function expand(r: Rect, margin: number): Rect {
  const x = Math.max(0, r.x - margin), y = Math.max(0, r.y - margin);
  return { x, y, w: Math.min(100, r.x + r.w + margin) - x, h: Math.min(100, r.y + r.h + margin) - y };
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

const round = (v: number) => Math.round(v * 10) / 10;

/** Plage horizontale (en % du cadre) couverte par chaque alignement : un texte
 *  centré peut s'étaler sur toute la largeur sûre, un texte calé à gauche ou à
 *  droite sur ~60 % de celle-ci. */
function columnSpan(col: (typeof COLS)[number]): { x: number; w: number } {
  const x0 = SAFE_ZONE.left, x1 = 100 - SAFE_ZONE.right, W = x1 - x0;
  if (col === "center") return { x: x0, w: W };
  if (col === "left") return { x: x0, w: W * 0.6 };
  return { x: x1 - W * 0.6, w: W * 0.6 };
}

/** Zones libres. Pour chaque ancre (rangée × alignement), on garde la plus
 *  haute bande verticale de sa rangée qui ne touche aucune zone protégée sur
 *  la largeur de l'alignement — si elle mesure au moins MIN_TEXT_ZONE_H_PCT.
 *  Une grille fixe 3×3 jetait des bandes réellement libres (au-dessus d'une
 *  tête, sur un torse) dès qu'un visage en mordait un coin.
 *  Les visages et textes sont protégés sur TOUTE la vidéo (union dans le
 *  temps) : une caption ajoutée reste souvent affichée du début à la fin. */
export function computeFreeZones(protectedZones: Rect[]): FreeZone[] {
  const y0 = SAFE_ZONE.top, rowH = (100 - SAFE_ZONE.bottom - y0) / 3;
  const out: FreeZone[] = [];
  ROWS.forEach((r, ri) => {
    const top = y0 + ri * rowH, bottom = top + rowH;
    for (const c of COLS) {
      const span = columnSpan(c);
      // Intervalles verticaux occupés dans cette rangée, sur cette largeur.
      const blocked = protectedZones
        .filter((p) => p.x < span.x + span.w && span.x < p.x + p.w && p.y < bottom && top < p.y + p.h)
        .map((p) => [Math.max(top, p.y), Math.min(bottom, p.y + p.h)] as const)
        .sort((a, b) => a[0] - b[0]);
      // Plus grand trou entre ces intervalles.
      let best: [number, number] | null = null, cursor = top;
      for (const [s, e] of [...blocked, [bottom, bottom] as const]) {
        if (s - cursor > (best ? best[1] - best[0] : 0)) best = [cursor, s];
        cursor = Math.max(cursor, e);
      }
      if (best && best[1] - best[0] >= MIN_TEXT_ZONE_H_PCT) {
        out.push({ anchor: `${r}-${c}` as TextAnchor, x: round(span.x), y: round(best[0]), w: round(span.w), h: round(best[1] - best[0]) });
      }
    }
  });
  return out;
}

/* ── Cas de figure ────────────────────────────────────────────────────────── */

/** Une face cam = un visage assez gros, présent la majeure partie du temps. */
export function isFaceCam(faces: TimedRect[], durationSec: number): boolean {
  if (!faces.length || durationSec <= 0) return false;
  const big = faces.filter((f) => f.w * f.h / 100 >= FACECAM_MIN_AREA_PCT);
  const covered = big.reduce((s, f) => s + Math.max(0, (f.endSec ?? durationSec) - (f.startSec ?? 0)), 0);
  return covered / durationSec >= FACECAM_MIN_PRESENCE;
}

export function pickScenario(a: {
  durationSec: number; hasVoice: boolean; faceCam: boolean;
  burnedCaption: boolean; existingSubtitles: boolean;
}): AiDupScenario {
  if (a.durationSec < SHORT_VIDEO_SEC) return "E_short";
  // Sous-titres déjà présents : la voix est déjà écrite → on n'en rajoute pas,
  // on varie autour (même traitement que la caption incrustée).
  if (a.existingSubtitles) return a.faceCam && a.burnedCaption ? "D_facecam_caption" : "B_burned_caption";
  if (a.faceCam && a.hasVoice) return a.burnedCaption ? "D_facecam_caption" : "C_facecam_talk";
  if (a.burnedCaption) return "B_burned_caption";
  return "A_no_text";
}

/* ── Assemblage ───────────────────────────────────────────────────────────── */

function aspectOf(w: number, h: number): AiDupAnalysis["aspect"] {
  const r = w / Math.max(1, h);
  return r < 0.85 ? "9:16" : r > 1.4 ? "16:9" : "1:1";
}

function toDetected(insp: DupInspection | null, kind: "caption" | "subtitles"): DetectedText {
  const t = (insp?.texts ?? []).filter((x) => x.kind === kind);
  if (!t.length) return { present: false, boxes: [] };
  return {
    present: true,
    boxes: t.map((x) => ({ ...x.box, startSec: x.startSec, endSec: x.endSec })),
    text: t.map((x) => x.text).filter(Boolean).join(" / ").slice(0, 300) || undefined,
    style: { color: t[0].color, background: t[0].background, hasStroke: t[0].hasStroke },
  };
}

/** Analyse une vidéo déjà ingérée dans le projet conteneur.
 *  `absPath` = chemin du fichier (store.materialAbsPath). */
export async function analyzeForDuplication(material: ProjectMaterial, absPath: string): Promise<AiDupAnalysis> {
  const base = material.analysis;
  if (!base || material.kind !== "video") throw new Error(`« ${material.name} » n'est pas une vidéo analysée.`);
  const notes: string[] = [];
  const durationSec = base.durationSec ?? 0;

  const viewPath = await proxyForViewing(absPath).catch(() => absPath);
  // Une relance : les échecs vus en test sont des coupures réseau passagères
  // pendant l'envoi à Google (« fetch failed »), pas des refus du modèle.
  let insp = await inspectForDuplication(viewPath);
  if (!insp) {
    await new Promise((r) => setTimeout(r, 5_000));
    insp = await inspectForDuplication(viewPath);
  }
  if (!insp) notes.push(`Inspection visuelle indisponible (${geminiLastError() || "raison inconnue"}) : aucun texte ne sera ajouté.`);

  const words = base.transcript?.words?.length ? base.transcript.words : undefined;
  // Voix = des mots transcrits ET une piste jugée fiable (pas une hallucination
  // sur de la musique) ET — si Gemini a regardé — quelqu'un parle vraiment.
  const hasVoice = !!words && base.voiceReliable !== false && (insp ? insp.hasVoice : true);

  const burnedCaption = toDetected(insp, "caption");
  const existingSubtitles = toDetected(insp, "subtitles");
  const faces: TimedRect[] = (insp?.faces ?? []).map((f) => ({ ...f.box, startSec: f.startSec, endSec: f.endSec }));
  const graphics = (insp?.graphics ?? []).map((g) => ({ ...g.box, startSec: g.startSec, endSec: g.endSec, what: g.what }));

  const protectedZones: Rect[] = [
    ...faces.map((f) => expand(f, FACE_MARGIN_PCT)),
    ...burnedCaption.boxes.map((b) => expand(b, BURNED_TEXT_MARGIN_PCT)),
    ...existingSubtitles.boxes.map((b) => expand(b, BURNED_TEXT_MARGIN_PCT)),
    ...graphics.map((g) => expand(g, BURNED_TEXT_MARGIN_PCT)),
  ];
  const freeZones = insp ? computeFreeZones(protectedZones) : [];
  if (insp && freeZones.length === 0) notes.push("Aucune zone libre dans la zone sûre : aucun texte ne sera ajouté.");

  const faceCam = isFaceCam(faces, durationSec);
  const scenario = pickScenario({
    durationSec, hasVoice, faceCam,
    burnedCaption: burnedCaption.present, existingSubtitles: existingSubtitles.present,
  });

  const out: AiDupAnalysis = {
    durationSec,
    width: base.width,
    height: base.height,
    aspect: aspectOf(base.width, base.height),
    hasAudio: base.hasAudio !== false,
    hasVoice,
    language: insp?.language || null,
    burnedCaption,
    existingSubtitles,
    faces,
    graphics,
    freeZones,
    scenario,
    inspected: !!insp,
    contentSummary: (base.segments ?? []).map((g) => g.content).filter(Boolean).join(" / ").slice(0, 600) || undefined,
    words,
    notes: [...(base.notes ?? []), ...notes],
  };
  // Début / fin réels de la caption d'origine (la boîte de réécriture doit
  // la couvrir du premier au dernier instant).
  await measureCaptionTiming(out, absPath);
  return out;
}

// Découpe intelligente — PUR CODE (fonctions pures, aucune IA générative).
// À partir de l'analyse ffmpeg (analysis.ts) et, si disponible, de la
// transcription whisper.cpp (transcribe.ts), choisit pour chaque variante
// un extrait de ~15-30s :
//   - vidéo PARLÉE  → fenêtres les plus fortes en énergie audio, jamais
//                     démarrées dans un silence ; avec transcription :
//                     démarrage sur un DÉBUT de phrase, fin étirée jusqu'à
//                     une FIN de phrase, bonus de densité de parole
//   - vidéo SANS parole → fenêtres les plus denses en changements de plan
//                     (les passages les plus dynamiques) — pas de whisper ici
//   - démarrage "propre" : snappé sur une fin de silence / un cut / une phrase
//   - variantes DIFFÉRENTES : recouvrement limité entre extraits choisis
// Vidéo courte (≤ MAX_FULL_SEC) → la vidéo entière, comme avant.
// TODO: brancher un LLM pour choisir les extraits par le SENS (punchlines).

import type { VideoAnalysis } from "./analysis";
import type { TranscriptSegment } from "./transcribe";

export interface SegmentPick {
  startSec: number;
  durationSec: number;
  // Pourquoi cet extrait — affiché nulle part pour l'instant, utile en debug.
  reason: "full" | "audio" | "scenes" | "spread";
}

const MIN_CLIP_SEC = 15;
const MAX_CLIP_SEC = 30;
// En dessous de cette durée, pas de découpe : la brute part entière.
const MAX_FULL_SEC = 34;
// Recouvrement max entre deux extraits choisis (fraction de la durée du clip).
const MAX_OVERLAP = 0.5;

// Même PRNG seedé que pipeline.ts — résultats stables pour un même job.
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickSegments(opts: {
  durationSec: number;
  analysis: VideoAnalysis;
  hasAudio: boolean;
  count: number; // nombre de variantes → autant d'extraits
  seed: number;
  // Transcription whisper (vidéos parlées uniquement) — null/absent = OK,
  // la découpe retombe sur l'énergie audio seule.
  transcript?: TranscriptSegment[] | null;
}): SegmentPick[] {
  const { durationSec, analysis, hasAudio, count, seed } = opts;
  const transcript = opts.transcript ?? null;
  const rng = mulberry32(seed);

  // ── Vidéo courte : pas de découpe ──────────────────────────────────────────
  if (durationSec <= MAX_FULL_SEC) {
    return Array.from({ length: count }, () => ({
      startSec: 0,
      durationSec,
      reason: "full" as const,
    }));
  }

  const useAudio = hasAudio && analysis.loudness.length > 0;

  // Points d'entrée "propres" : fins de silence + cuts + DÉBUTS de phrase
  // (whisper) + le début. Les débuts de phrase priment via le snap.
  const sentenceStarts = transcript?.map((s) => s.startSec) ?? [];
  const sentenceEnds = transcript?.map((s) => s.endSec) ?? [];
  const cleanStarts = [
    0,
    ...analysis.silences.map((s) => s.end),
    ...analysis.sceneCuts,
    ...sentenceStarts,
  ].sort((a, b) => a - b);

  // ── Candidats : une fenêtre par seconde, longueur variée par variante ─────
  const picks: SegmentPick[] = [];
  for (let v = 0; v < count; v++) {
    const clipLen = Math.min(
      MIN_CLIP_SEC + rng() * (MAX_CLIP_SEC - MIN_CLIP_SEC),
      durationSec
    );
    const lastStart = durationSec - clipLen;

    let best: SegmentPick | null = null;
    let bestScore = -Infinity;

    for (let start = 0; start <= lastStart; start += 1) {
      // Démarrage snappé sur le point d'entrée propre le plus proche (≤ 1.5s).
      const snap = nearestWithin(cleanStarts, start, 1.5);
      const s = snap !== null ? Math.min(snap, lastStart) : start;

      let score: number;
      if (useAudio) {
        score = meanLoudness(analysis.loudness, s, s + clipLen);
        if (isInSilence(analysis.silences, s)) score -= 20; // jamais démarrer muet
        if (snap !== null) score += 2; // entrée propre
        if (transcript) {
          // Densité de parole : privilégie les fenêtres où ça parle vraiment.
          score += speechDensity(transcript, s, s + clipLen) * 6;
          // Coupe en plein milieu d'une phrase → forte pénalité.
          if (startsMidSentence(transcript, s)) score -= 12;
        }
      } else {
        // Sans parole : densité de cuts = dynamisme visuel.
        score = countIn(analysis.sceneCuts, s, s + clipLen) * 3;
        if (snap !== null) score += 1;
      }
      score += rng() * 0.5; // départage aléatoire stable (variantes ≠ entre jobs)

      // Diversité : pénalité PROPORTIONNELLE au recouvrement excessif avec
      // les extraits déjà choisis. Proportionnelle (et non plate) : sur une
      // vidéo courte où tout se recouvre, elle départage quand même vers la
      // fenêtre la moins redondante au lieu de reprendre le même extrait.
      const worstOverlap = Math.max(
        0,
        ...picks.map((p) => overlapSec(s, clipLen, p.startSec, p.durationSec))
      );
      const excessOverlap = worstOverlap - clipLen * MAX_OVERLAP;
      if (excessOverlap > 0) score -= 30 + excessOverlap * 8;

      if (score > bestScore) {
        bestScore = score;
        best = {
          startSec: round1(s),
          durationSec: round1(clipLen),
          reason: useAudio ? "audio" : analysis.sceneCuts.length > 0 ? "scenes" : "spread",
        };
      }
    }

    let pick = best ?? {
      // Filet de sécurité (ne devrait pas arriver) : répartition uniforme.
      startSec: round1((lastStart * v) / Math.max(1, count - 1)),
      durationSec: round1(clipLen),
      reason: "spread" as const,
    };

    // Fin alignée sur une FIN de phrase : étire/rétrécit la fenêtre jusqu'à
    // la fin de phrase la plus proche dans [MIN, MAX+5]s — on ne coupe
    // personne au milieu d'un mot.
    if (transcript && sentenceEnds.length > 0 && pick.reason !== "full") {
      const target = pick.startSec + pick.durationSec;
      let bestEnd: number | null = null;
      for (const e of sentenceEnds) {
        const len = e - pick.startSec;
        if (len >= MIN_CLIP_SEC && len <= MAX_CLIP_SEC + 5 && e <= durationSec) {
          if (bestEnd === null || Math.abs(e - target) < Math.abs(bestEnd - target)) {
            bestEnd = e;
          }
        }
      }
      if (bestEnd !== null) {
        // +0.3s de respiration après la dernière phrase.
        pick = {
          ...pick,
          durationSec: round1(Math.min(bestEnd + 0.3, durationSec) - pick.startSec),
        };
      }
    }

    picks.push(pick);
  }

  return picks;
}

// ── Helpers purs ─────────────────────────────────────────────────────────────

function meanLoudness(
  points: Array<{ t: number; m: number }>,
  from: number,
  to: number
): number {
  let sum = 0;
  let n = 0;
  for (const p of points) {
    if (p.t >= from && p.t < to) {
      sum += p.m;
      n++;
    }
  }
  return n === 0 ? -70 : sum / n;
}

function isInSilence(
  silences: Array<{ start: number; end: number }>,
  t: number
): boolean {
  return silences.some((s) => t >= s.start && t < s.end);
}

// Fraction (0-1) de la fenêtre couverte par de la parole.
function speechDensity(
  transcript: TranscriptSegment[],
  from: number,
  to: number
): number {
  let covered = 0;
  for (const s of transcript) {
    covered += Math.max(0, Math.min(s.endSec, to) - Math.max(s.startSec, from));
  }
  return covered / Math.max(1, to - from);
}

// true si t tombe STRICTEMENT au milieu d'une phrase (pas à son début).
function startsMidSentence(
  transcript: TranscriptSegment[],
  t: number
): boolean {
  return transcript.some((s) => t > s.startSec + 0.5 && t < s.endSec - 0.3);
}

function countIn(values: number[], from: number, to: number): number {
  return values.filter((v) => v >= from && v < to).length;
}

function nearestWithin(
  sorted: number[],
  target: number,
  maxDist: number
): number | null {
  let best: number | null = null;
  for (const v of sorted) {
    if (Math.abs(v - target) <= maxDist) {
      if (best === null || Math.abs(v - target) < Math.abs(best - target)) best = v;
    }
    if (v > target + maxDist) break;
  }
  return best;
}

function overlapSec(
  aStart: number,
  aLen: number,
  bStart: number,
  bLen: number
): number {
  return Math.max(
    0,
    Math.min(aStart + aLen, bStart + bLen) - Math.max(aStart, bStart)
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

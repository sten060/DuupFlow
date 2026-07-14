// PHASE 3 — Le réalisateur : croise les MOUVEMENTS de la ref (moves) et ce que
// contient le RUSH de l'utilisateur (FootageMap) → un plan de plans montés
// (EditShot[]) que Remotion exécute (cadrage animé + caption par plan).
//
// 100% CODE (pas d'appel IA ici) : mapping général, pas un template.
//
// TIMING (le point crucial) : les moments des transitions viennent des CUTS
// PRÉCIS détectés par ffmpeg (rhythm.cutTimestampsSec), pas des temps
// approximatifs de la vision. La durée du hook et l'instant de chaque coupure
// sont donc fidèles à la ref, puis adaptés à la durée du rush par la règle de
// timeline générale (mapTimeline) — priorité au hook.

import { mapTimeline } from "./captions";
import type {
  EditShot,
  Framing,
  FootageMap,
  MontageMove,
  ViralRecipe,
} from "./types";

const FULL: Framing = { zoom: 1, cx: 0.5, cy: 0.5 };

// Catégorie de ce qu'un plan montre — c'est ce qui change entre deux "beats".
function categoryOf(shows: string): "face" | "wide" {
  const s = shows.toLowerCase();
  return /visage|face|t[êe]te|regard|yeux|d[ée]tail|gros plan/.test(s)
    ? "face"
    : "wide";
}

function framingFor(cat: "face" | "wide", footage: FootageMap): Framing {
  if (cat === "face" && footage.faceBox) {
    const b = footage.faceBox;
    const zoom = Math.max(1.25, Math.min(2.6, 0.55 / Math.max(0.08, b.h)));
    return { zoom, cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
  }
  return { ...FULL };
}

interface Beat {
  startRefSec: number; // instant de début dans la ref (secondes)
  cat: "face" | "wide";
  action: MontageMove["action"];
  shows: string;
}

/**
 * Construit le plan de montage "coordonné". Retourne null si on ne peut pas
 * reproduire le montage (l'appelant retombe sur le rendu normal).
 * @param captions textes à répartir sur les plans (= [hook, ...reveals] du LLM)
 * @param baseDurationSec durée du rush user (= durée de sortie)
 */
export function buildDirectorPlan(
  recipe: ViralRecipe,
  footage: FootageMap,
  captions: string[],
  baseDurationSec: number
): EditShot[] | null {
  if (recipe.montageLevel !== "coordonne") return null;
  const moves = recipe.moves ?? [];
  if (moves.length === 0) return null;

  const refDur = Math.max(1, recipe.layout?.refDurationSec ?? baseDurationSec);
  const cuts = (recipe.rhythm?.cutTimestampsSec ?? []).slice().sort((a, b) => a - b);

  // ── Beats SÉMANTIQUES : un nouveau plan quand ce qui est montré CHANGE
  // (visage → corps). Les cuts internes d'un même contenu (poses) sont ignorés.
  const sorted = [...moves].sort((a, b) => a.atFrac - b.atFrac);
  const beats: Beat[] = [];
  for (const m of sorted) {
    const cat = categoryOf(m.shows);
    const last = beats[beats.length - 1];
    if (!last || last.cat !== cat) {
      beats.push({ startRefSec: m.atFrac * refDur, cat, action: m.action, shows: m.shows });
    }
  }
  if (beats.length < 2) return null; // pas de vrai changement visage↔corps
  // Le rush doit contenir un visage repérable pour la partie "face".
  if (beats.some((b) => b.cat === "face") && !footage.faceBox) return null;

  // ── TIMING PRÉCIS : cale chaque transition (sauf la 1ʳᵉ = 0) sur le CUT
  // ffmpeg le plus proche (à ±1.2s) → l'instant exact de la coupure de la ref.
  beats[0].startRefSec = 0;
  for (let i = 1; i < beats.length; i++) {
    let best = beats[i].startRefSec;
    let bestD = Infinity;
    for (const c of cuts) {
      const d = Math.abs(c - beats[i].startRefSec);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (bestD <= 1.2) beats[i].startRefSec = best;
  }

  // ── ADAPTATION : transitions ref (secondes) → sortie via la règle générale
  // (priorité au hook, compression/étirement naturel selon la durée du rush).
  const refTransitions = beats.slice(1).map((b) => b.startRefSec);
  const outTransitions = mapTimeline(refTransitions, refDur, baseDurationSec);
  const boundaries = [0, ...outTransitions, baseDurationSec];

  const shots: EditShot[] = [];
  let prev: Framing = framingFor(beats[0].cat, footage);
  for (let i = 0; i < beats.length; i++) {
    const dur = Math.max(0.3, boundaries[i + 1] - boundaries[i]);
    const target = framingFor(beats[i].cat, footage);
    const animated =
      beats[i].action === "zoom-in" ||
      beats[i].action === "pull-back" ||
      beats[i].action === "pan";
    shots.push({
      durationSec: dur,
      from: animated ? prev : target, // sinon coupure nette (from = cible)
      to: target,
      caption: captions[Math.min(i, captions.length - 1)] ?? "",
    });
    prev = target;
  }
  return shots;
}

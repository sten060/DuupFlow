// PHASE 3 — Le réalisateur : croise les MOUVEMENTS de la ref (moves) et ce que
// contient le RUSH de l'utilisateur (FootageMap) → un plan de plans montés
// (EditShot[]) que Remotion exécute (cadrage animé + caption par plan).
//
// 100% CODE (pas d'appel IA ici) : c'est du mapping général, pas un template.
// Vocabulaire général : chaque plan de la ref dit "montre le visage / le corps /
// un plan large" → on cadre le rush en conséquence (zoom sur le visage, plein
// cadre pour le corps), on garde son rythme (durées) et son enchaînement
// (coupure ou zoom/dézoom).

import type {
  EditShot,
  Framing,
  FootageMap,
  MontageMove,
  ViralRecipe,
} from "./types";

const FULL: Framing = { zoom: 1, cx: 0.5, cy: 0.5 };

// Cadrage du rush pour "ce que le plan doit montrer".
function framingFor(shows: string, footage: FootageMap): Framing {
  const s = shows.toLowerCase();
  const wantsFace = /visage|face|t[êe]te|regard|yeux/.test(s);
  const wantsDetail = /d[ée]tail|gros plan|zoom/.test(s);

  if ((wantsFace || wantsDetail) && footage.faceBox) {
    const b = footage.faceBox;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    // Zoom pour que le visage occupe ~55% de la hauteur (borné pour rester net).
    const zoom = Math.max(1.25, Math.min(2.6, 0.55 / Math.max(0.08, b.h)));
    return { zoom, cx, cy };
  }
  // corps entier / plan large / autre → plein cadre.
  return { ...FULL };
}

// Regroupe les mouvements de la ref en PLANS (nouveau plan quand le texte
// change ou qu'il y a une coupure). Retourne les bornes [début, fin[ en frac.
interface Beat {
  startFrac: number;
  endFrac: number;
  shows: string;
  action: MontageMove["action"];
  text: string;
}

function beatsFromMoves(moves: MontageMove[]): Beat[] {
  const sorted = [...moves].sort((a, b) => a.atFrac - b.atFrac);
  const beats: Beat[] = [];
  for (const m of sorted) {
    const last = beats[beats.length - 1];
    const newBeat =
      !last || m.action === "cut" || m.textAtThisMoment !== last.text;
    if (newBeat) {
      if (last) last.endFrac = m.atFrac;
      beats.push({
        startFrac: m.atFrac,
        endFrac: 1,
        shows: m.shows,
        action: m.action,
        text: m.textAtThisMoment,
      });
    } else if (last) {
      // Même plan qui continue : on garde le cadrage le plus "parlant".
      if (m.shows) last.shows = m.shows;
    }
  }
  return beats.filter((b) => b.endFrac - b.startFrac > 0.02);
}

/**
 * Construit le plan de montage "coordonné". Retourne null si on ne peut pas
 * reproduire le montage (pas de mouvements, ou rush inexploitable) — l'appelant
 * retombe alors sur le rendu normal.
 * @param captions textes à répartir sur les plans (= [hook, ...reveals] du LLM)
 */
export function buildDirectorPlan(
  recipe: ViralRecipe,
  footage: FootageMap,
  captions: string[],
  outDurationSec: number
): EditShot[] | null {
  if (recipe.montageLevel !== "coordonne") return null;
  const moves = recipe.moves ?? [];
  if (moves.length === 0) return null;

  const beats = beatsFromMoves(moves);
  if (beats.length < 2) return null; // pas de vrai enchaînement

  // Si aucun plan ne demande le visage, le rush ne permet rien de "coordonné"
  // de spécial → on laisse le rendu normal gérer.
  const anyFace = beats.some((b) => framingFor(b.shows, footage).zoom > 1.1);
  if (!anyFace || !footage.faceBox) return null;

  const shots: EditShot[] = [];
  let prev: Framing = framingFor(beats[0].shows, footage);
  beats.forEach((b, i) => {
    const target = framingFor(b.shows, footage);
    const dur = Math.max(0.4, (b.endFrac - b.startFrac) * outDurationSec);
    // Enchaînement : zoom-in/pull-back/pan = transition animée depuis le plan
    // précédent ; sinon coupure nette (cadrage fixe sur ce plan).
    const animated =
      b.action === "zoom-in" || b.action === "pull-back" || b.action === "pan";
    shots.push({
      durationSec: dur,
      from: animated ? prev : target,
      to: target,
      // Caption alignée sur l'ordre des plans (réutilise la dernière si moins
      // de textes que de plans).
      caption: captions[Math.min(i, captions.length - 1)] ?? "",
    });
    prev = target;
  });

  return shots;
}

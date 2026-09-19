// src/lib/ai-auto/variation.ts
//
// ── GÉNÉRATEUR DE PLANS DE VARIATION (module « IA automatique ») ─────────────
// Rôle : transformer une décision de duplication (« N copies de ce fichier,
// intensité X ») en N EditPlan RÉELLEMENT différents que le moteur de rendu
// de l'Éditeur IA exécute tel quel. C'est ici que vit la recette d'unicité :
// chaque copie diffère de l'original ET des autres copies sur plusieurs axes
// à la fois (timeline, cadrage, colorimétrie, vitesse, miroir).
//
// Principe de sobriété (règle n°6 de l'Éditeur IA) : les bornes sont DANS ce
// module, pas dans la confiance faite à l'IA. Le directeur (Claude) choisit
// les axes autorisés (miroir ? vitesse ?) et l'intensité ; les amplitudes
// réelles sont écrêtées ici pour que la copie reste visuellement propre.
//
// Déterminisme : le tirage est SEEDÉ par (materialId, index de copie). Relancer
// la même demande produit les mêmes plans — indispensable pour déboguer un
// rendu raté sans courir après un aléa.

import type { EditPlan, EditSegment, ColorGrade } from "@/lib/ai-editor/plan-types";
import type { ProjectMaterial } from "@/lib/ai-editor/store";

export type VariationIntensity = "light" | "normal" | "strong";

export type VariationRequest = {
  materialId: string;
  copies: number;
  intensity: VariationIntensity;
  /** Miroir horizontal autorisé (à refuser quand du texte est lisible à l'écran). */
  allowMirror: boolean;
  /** Micro-variation de vitesse autorisée (à refuser sur musique très reconnaissable). */
  allowSpeed: boolean;
};

// Amplitude générale par intensité. « strong » reste borné : au-delà, la copie
// se voit à l'œil nu et perd sa qualité — ce serait contre-productif.
const INTENSITY_FACTOR: Record<VariationIntensity, number> = {
  light: 0.5,
  normal: 1,
  strong: 1.5,
};

/** RNG déterministe (mulberry32) seedé par une chaîne. */
function seededRng(seed: string): () => number {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tirage symétrique dans [-amp, +amp]. */
const spread = (rnd: () => number, amp: number) => (rnd() * 2 - 1) * amp;

/** Aspect de sortie = celui du fichier source (on ne recadre pas le format). */
function aspectOf(width: number, height: number): NonNullable<EditPlan["aspect"]> {
  const r = width / Math.max(1, height);
  if (r < 0.85) return "9:16";
  if (r > 1.4) return "16:9";
  return "1:1";
}

/**
 * Construit les N plans de montage d'un fichier. Chaque plan couvre le fichier
 * entier (on duplique, on ne remonte pas le propos) avec des bords rognés
 * différemment — c'est le décalage de timeline — plus un cadrage, une
 * colorimétrie et éventuellement une vitesse/miroir propres à la copie.
 */
export function buildVariationPlans(material: ProjectMaterial, req: VariationRequest): EditPlan[] {
  const a = material.analysis;
  if (!a || material.kind !== "video") {
    throw new Error(`Le fichier « ${material.name} » n'est pas une vidéo analysée — duplication impossible.`);
  }
  const dur = a.durationSec ?? 0;
  const f = INTENSITY_FACTOR[req.intensity];
  const plans: EditPlan[] = [];

  for (let i = 0; i < req.copies; i++) {
    const rnd = seededRng(`${req.materialId}#${i}`);

    // ── Timeline : rogner un peu au début ET à la fin décale toutes les
    // signatures temporelles. Borné à 4 % de la durée par bord (max 0,6 s)
    // pour ne jamais couper une attaque de phrase.
    const maxTrim = Math.min(0.6 * f, dur * 0.04);
    let startSec = dur > 3 ? 0.05 + rnd() * maxTrim : 0;
    let endSec = dur > 3 ? dur - (0.05 + rnd() * maxTrim) : dur;
    if (endSec - startSec < 1) { startSec = 0; endSec = dur; }

    // ── Cadrage : léger punch-in décentré, différent par copie. 8 % max :
    // au-delà, la perte de champ se remarque.
    const scale = 1 + (0.012 + rnd() * 0.035) * f;
    const seg: EditSegment = {
      materialId: req.materialId,
      startSec: Number(startSec.toFixed(2)),
      endSec: Number(endSec.toFixed(2)),
      scale: Number(Math.min(1.08, scale).toFixed(3)),
      offsetX: Number(spread(rnd, 4 * f).toFixed(1)),
      offsetY: Number(spread(rnd, 3 * f).toFixed(1)),
    };

    // ── Miroir : une copie sur deux (jamais la première, qui reste la plus
    // proche de l'original). Refusé par le directeur si du texte est lisible.
    if (req.allowMirror && i % 2 === 1) seg.flipH = true;

    // ── Vitesse : ±3 % max — inaudible à l'oreille, mais toute la piste
    // audio et la timeline changent de signature.
    if (req.allowSpeed) {
      const speed = 1 + spread(rnd, 0.03 * f);
      if (Math.abs(speed - 1) > 0.008) seg.speed = Number(speed.toFixed(3));
    }

    // ── Colorimétrie : micro-variations combinées, chacune sous le seuil du
    // visible, mais leur somme change la carte de couleur de chaque frame.
    const grade: ColorGrade = {
      saturation: Number((1 + spread(rnd, 0.05 * f)).toFixed(3)),
      contrast: Number((1 + spread(rnd, 0.04 * f)).toFixed(3)),
      brightness: Number(spread(rnd, 0.025 * f).toFixed(3)),
      temperature: Number(spread(rnd, 0.08 * f).toFixed(3)),
    };
    if (rnd() < 0.5) grade.grain = Number((0.03 + rnd() * 0.07 * f).toFixed(3));

    plans.push({
      aspect: aspectOf(a.width, a.height),
      grade,
      segments: [seg],
      label: `${material.name.replace(/\.[a-z0-9]+$/i, "")} · duplication ${i + 1}`,
    });
  }
  return plans;
}

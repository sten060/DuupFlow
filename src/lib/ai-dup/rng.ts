// src/lib/ai-dup/rng.ts — tirage déterministe (mulberry32) seedé par une chaîne.
// Même graine → mêmes valeurs : un lancement raté se rejoue à l'identique.

export function seededRng(seed: string): () => number {
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

/** Valeur uniforme dans [min, max]. */
export const between = (rnd: () => number, min: number, max: number) => min + rnd() * (max - min);

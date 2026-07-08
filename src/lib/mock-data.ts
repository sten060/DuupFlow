// ─────────────────────────────────────────────────────────────────────────────
// Studio DuupFlow (/studio) — constantes + données encore mock.
// L'upload et la génération sont désormais RÉELS en local (ffmpeg) — voir
// src/lib/studio/*. Restent mock ici :
//   - les URLs de référence (l'analyse des reels de référence viendra plus tard)
//   - les pools de hooks (utilisés par le pipeline pour l'incrustation)
// TODO: brancher la génération de hooks par IA à partir des références.
// ─────────────────────────────────────────────────────────────────────────────

// ── Limites / défauts du studio ──────────────────────────────────────────────
export const MAX_REFERENCES = 3;
export const MAX_RAW_VIDEOS = 5;
export const MIN_VARIANTS = 1;
export const MAX_VARIANTS = 10;
export const DEFAULT_VARIANTS = 4;
export const INITIAL_CREDITS = 18; // 1 crédit = 1 reel généré (mock)

// ── Pool d'URLs mock ajoutées quand l'input référence est vide ───────────────
export const MOCK_REFERENCE_URLS = [
  "instagram.com/reel/x8k2…",
  "tiktok.com/@creator/72…",
  "instagram.com/reel/b41f…",
];

// ── Hooks incrustés dans les variantes, par format (niche OFM / clippers) ────
export const TALKING_HOOKS = [
  "Personne te dira ça…",
  "Le truc que 90% ratent",
  "J'ai testé 30 jours",
  "Arrête de faire ça",
  "La vérité que tout le monde évite",
  "Ce que j'aurais aimé savoir avant",
  "3 erreurs qui te coûtent cher",
  "Le secret des comptes qui explosent",
];

export const ACTION_HOOKS = [
  "POV : ton lundi",
  "Attends la fin…",
  "Ça part en 3 secondes",
  "Le glow up est réel",
  "Vitesse x2, résultat x10",
  "Regarde jusqu'au bout",
];

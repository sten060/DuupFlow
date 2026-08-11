// src/lib/ai-editor/analysis-config.ts
//
// ── SEUILS & CONSTANTES DE L'ANALYSE (réf + matière) ─────────────────────────
// Règle (§6 exigences qualité) : AUCUNE constante magique dispersée dans le
// code d'analyse. Tout seuil vit ici, NOMMÉ, avec la JUSTIFICATION de sa valeur.
// Si tu modifies un seuil : mets à jour sa justification, et ANALYSE-REF.md si
// le comportement décrit change.

/* ── Keyframes de la référence (analyze.ts) ────────────────────────────────── */

/** Nombre max d'images clés extraites d'une réf. 12 ≈ une par plan sur un
 *  short-form typique (10-16 plans) sans exploser le payload MCP (~1 Mo). */
export const REF_KEYFRAMES_MAX = 12;

/** Largeur (px) des keyframes extraites. 480 suffit pour lire le TEXTE des
 *  captions (360 le rendait illisible), sans doubler le poids du payload. */
export const REF_KEYFRAME_WIDTH = 480;

/** Qualité JPEG ffmpeg (-q:v, 2-31, plus bas = mieux). 3 ≈ JPEG ~90 : le texte
 *  fin des captions est le premier détruit par la compression — et c'est
 *  précisément ce que la couche compréhension doit lire. */
export const REF_KEYFRAME_QV = 3;

/** Position de la frame « hook » : très tôt (15 % de la durée, plafonné 0,6 s)
 *  — les 1res secondes portent le hook, l'instant 0 est souvent noir/logo. */
export const REF_HOOK_RATIO = 0.15;
export const REF_HOOK_MAX_SEC = 0.6;

/** Seuil de détection de coupes (scene score ffmpeg, 0-1). 0,3 = compromis
 *  mesuré : en dessous, les mouvements de caméra comptent comme des coupes ;
 *  au-dessus, les cuts doux (fondus courts) sont manqués. */
export const SCENE_CUT_THRESHOLD = 0.3;

/* ── Affichage des keyframes dans get_reference (mcp-tools.ts) ─────────────── */

/** Images montrées au consommateur. 8 = couvre les plans d'un short-form ;
 *  5 laissait 11 plans sur 16 invisibles (faux diagnostics mesurés). */
export const REF_IMAGES_SHOWN = 8;

/** Compression d'affichage MCP (certains clients jettent les réponses trop
 *  lourdes). 480 px / q80 : lisible, ~8 × 80 Ko ≈ 0,6 Mo par réponse. */
export const MCP_IMAGE_WIDTH = 480;
export const MCP_IMAGE_QUALITY = 80;

/* ── Silences / VAD (ref-profile.ts) ───────────────────────────────────────── */

/** Durée minimale d'un run de silence retenu (s). 0,15 : en dessous c'est une
 *  respiration ou l'attaque d'une syllabe — à GARDER, pas à signaler. */
export const SILENCE_MIN_SEC = 0.15;

/** Rognage des bords d'un silence (s) : protège les attaques/fins de syllabes
 *  que le seuil d'énergie mord légèrement. */
export const SILENCE_EDGE_TRIM_SEC = 0.05;

/** Seuil adaptatif : plancher de bruit (p10 des trames RMS) × ce facteur.
 *  2,5 = marge contre le souffle sans avaler la parole douce. */
export const SILENCE_FLOOR_FACTOR = 2.5;

/** Bornes du seuil relatif au pic (p95) : le seuil ne descend jamais sous
 *  p95×0,02 (fichiers très propres) ni au-dessus de p95×0,08 (ne jamais
 *  classer de la parole douce comme silence). */
export const SILENCE_MIN_VS_PEAK = 0.02;
export const SILENCE_MAX_VS_PEAK = 0.08;

/* ── Nettoyage du rush : blancs & micro-pauses (mcp-tools.ts) ──────────────── */

/** Un trou ≥ ce seuil (s) = BLANC inter-phrases → à SAUTER entre 2 segments. */
export const GAP_BLANK_SEC = 0.5;

/** Entre SILENCE_MIN et GAP_BLANK = MICRO-PAUSE intra-phrase → à RESSERRER
 *  (subdivision du segment), pas à sauter. Catégories distinctes car les deux
 *  se traitent différemment au montage. */
export const GAP_MICRO_SEC = 0.15;

/** Voie de repli énergie (anciennes analyses sans `silences`) : rognage des
 *  bords plus large (résolution 0,25 s → bords imprécis). */
export const GAP_EDGE_TRIM_FALLBACK_SEC = 0.12;

/* ── Détection des reprises (mcp-tools.ts) ─────────────────────────────────── */

/** Taille du n-gramme d'ancrage. 3 mots : en dessous, trop de faux positifs
 *  (bigrammes banals) ; au-dessus, les reprises partielles échappent. */
export const RETAKE_NGRAM = 3;

/** Écart max (s) entre deux occurrences CONSÉCUTIVES d'une chaîne de reprises.
 *  Une vraie reprise revient vite (< 6 s) ; « vous donner un » réutilisé 10 s
 *  plus loin dans une phrase différente N'EST PAS une reprise (faux positif
 *  mesuré qui aurait détruit le cœur d'une vidéo de test). */
export const RETAKE_CHAIN_GAP_SEC = 6;

/** Au-delà de cet écart (s), exiger une similarité ÉTENDUE au-delà du n-gramme
 *  (mot suivant OU précédent identique) — une reprise répète le début de
 *  phrase à l'identique, une réutilisation légitime diverge juste après. */
export const RETAKE_STRICT_GAP_SEC = 3.5;

/** Plage coupée minimale (s) — évite de signaler du bruit. */
export const RETAKE_MIN_SPAN_SEC = 0.8;

/* ── Compréhension Gemini (gemini.ts) ──────────────────────────────────────── */

/** Modèle par défaut : ALIAS ROULANT. Google RETIRE les modèles versionnés
 *  (gemini-2.0-flash est mort en 2026 → 404 sur chaque analyse pendant des
 *  semaines, en silence). L'alias suit le flash stable ; la cascade
 *  listCandidateModels couvre le reste. Override : AI_EDITOR_GEMINI_MODEL. */
export const GEMINI_DEFAULT_MODEL = "gemini-flash-latest";

/** Échantillonnage vidéo envoyé à Gemini (img/s). 2 : suffisant pour lire les
 *  captions et les plans, x5 moins cher que 10. Override : AI_EDITOR_GEMINI_FPS. */
export const GEMINI_DEFAULT_FPS = 2;

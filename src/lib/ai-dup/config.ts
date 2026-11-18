// src/lib/ai-dup/config.ts
//
// ── RÉGLAGES DE LA « DUPLICATION IA EN 1 CLIC » ──────────────────────────────
// Le user dépose UNE vidéo, choisit un mode (Invisible / Variations) et un
// nombre de copies ; un agent Claude planifie les N copies en un seul appel,
// puis le moteur de l'Éditeur IA + le spoofer les fabriquent.
//
// Règle (même que ai-editor/analysis-config.ts) : AUCUNE constante magique
// dispersée dans le module. Tout réglage vit ici, NOMMÉ, avec sa justification.
// Les valeurs marquées « À FIXER (Sten) » sont des valeurs de départ.

import type { AiDupMode } from "./types";

/* ── Modèle Claude ────────────────────────────────────────────────────────── */

/** Modèle du planificateur. Un seul appel par lancement (le plan des N copies),
 *  donc Sonnet suffit largement et coûte nettement moins qu'Opus. Surchargeable
 *  sans redéploiement de code via AI_DUP_MODEL. */
export const AI_DUP_MODEL = process.env.AI_DUP_MODEL || "claude-sonnet-5-5";

/** Plafond de sortie du planificateur. 50 copies × ~150 tokens de réglages ≈
 *  7 500 tokens : 16 000 laisse de la marge sans autoriser une dérive. */
export const PLANNER_MAX_TOKENS = 16_000;

/** Plafond de sortie de l'appel de vérification (un verdict court par copie). */
export const VERIFIER_MAX_TOKENS = 4_000;

/* ── Nombre de copies ─────────────────────────────────────────────────────── */

export const MIN_COPIES = 1;
export const MAX_COPIES = 50;
/** Valeur affichée par défaut dans le formulaire. */
export const DEFAULT_COPIES = 5;

/** Taille max du champ « Indications » (protège le prompt et le coût). */
export const MAX_INDICATIONS_CHARS = 1_000;

/* ── Quota et tokens ──────────────────────────────────────────────────────── */
// Même modèle que l'Éditeur IA avec Claude intégré (décision Sten, 2026-11-16) :
//   • la FABRICATION compte en vidéos du quota mensuel (plans.ts) : 1 copie =
//     1 vidéo, comme un rendu de l'Éditeur IA. Réservé avant, rendu si écartée ;
//   • les appels CLAUDE (plan des copies + contrôle visuel) se paient en tokens :
//     volume offert chaque mois PARTAGÉ avec le Claude intégré, puis solde de
//     tokens (billing.ts). Le mode Invisible n'appelle jamais Claude.

/** Vidéos du quota consommées par copie. */
export const AI_DUP_COST_PER_COPY: Record<AiDupMode, number> = {
  invisible: 1,
  variations: 1,
};

/** Estimation des tokens Claude, en CENTIMES (1 c = 100 tokens), marge
 *  comprise — mesurée le 16/11 sur Sonnet 5.5 : plan de 8 copies = 5 c, de
 *  50 copies = 20 c ; contrôle visuel ≈ 0,5 c par copie. Sert seulement à
 *  l'affichage avant de lancer : le débit réel suit la consommation exacte. */
export const AI_DUP_EST_BASE_CENTS = 2;     // partie fixe du plan (consignes, analyse)
export const AI_DUP_EST_PER_COPY_CENTS = 1; // ~0,4 c de plan + ~0,6 c de contrôle visuel

/** Estimation affichée (centimes) pour un lancement. Invisible = aucun appel Claude. */
export function aiDupTokenEstimateCents(mode: AiDupMode, copies: number): number {
  return mode === "invisible" ? 0 : AI_DUP_EST_BASE_CENTS + AI_DUP_EST_PER_COPY_CENTS * copies;
}

/** Vidéos du quota consommées par un lancement complet. */
export function aiDupCost(mode: AiDupMode, copies: number): number {
  return AI_DUP_COST_PER_COPY[mode] * copies;
}

/* ── Zone sûre Reels / TikTok ─────────────────────────────────────────────── */
// Marges (en % du cadre) recouvertes par l'interface des apps : barre du haut
// (onglets, live), bas (pseudo, légende, musique), côté droit (like, commentaire,
// partage). Un texte ajouté DOIT tenir entièrement à l'intérieur.

export const SAFE_ZONE = {
  top: 12,    // onglets « Abonnements / Pour toi » + encoche
  bottom: 22, // pseudo + légende sur 2 lignes + bandeau musique
  left: 5,    // marge de confort (rien dessus, mais texte collé au bord = amateur)
  right: 15,  // colonne d'icônes (like / commentaire / partage / avatar)
} as const;

/** Marge autour d'un visage détecté (en % du cadre) : un texte ne doit pas
 *  toucher le menton ni le front, pas seulement éviter le centre du visage. */
export const FACE_MARGIN_PCT = 5;

/** Marge autour d'une caption déjà incrustée (cas B / D) : un élément ajouté
 *  ne doit ni la recouvrir ni la coller. */
export const BURNED_TEXT_MARGIN_PCT = 3;

/** Hauteur minimale (en % du cadre) d'une zone libre : 5 % ≈ une ligne de
 *  sous-titre lisible sur un 9:16. En dessous, la bande est inutilisable. */
export const MIN_TEXT_ZONE_H_PCT = 5;

/** Jamais plus de N éléments texte simultanés à l'écran (caption d'origine
 *  incluse). Au-delà, la vidéo devient illisible et ressemble à du spam. */
export const MAX_TEXT_ELEMENTS = 2;

/* ── Cas de figure ────────────────────────────────────────────────────────── */

/** En dessous de cette durée (s) : cas E, variations légères uniquement, pas
 *  de texte long (on n'a pas le temps de le lire). */
export const SHORT_VIDEO_SEC = 7;

/** Face cam (cas C / D) : un visage d'au moins N % de la surface du cadre…
 *  2 % ≈ un visage cadré poitrine sur un 9:16 ; en dessous, c'est une
 *  silhouette dans un plan large, pas quelqu'un qui parle à la caméra. */
export const FACECAM_MIN_AREA_PCT = 2;
/** …présent au moins cette part de la durée (0-1). */
export const FACECAM_MIN_PRESENCE = 0.5;

/** Cas E : longueur max d'un texte ajouté (caractères). */
export const SHORT_VIDEO_MAX_TEXT_CHARS = 30;

/** Longueur max d'une caption générée (cas A), tous cas confondus. */
export const CAPTION_MAX_CHARS = 80;

/** Plancher de taille de police (px @1080) quand on réduit pour tenir dans
 *  une zone : 40 px ≈ 3,7 % de la largeur, la limite de lisibilité sur mobile. */
export const MIN_FONT_PX = 40;

/** Une caption ajoutée tient sur 3 lignes max (au-delà, elle mange l'image). */
export const CAPTION_MAX_LINES = 3;

/** Sous-titres : 2 lignes de ~28 caractères à l'écran (cadence short-form). */
export const SUBTITLE_LINES = 2;
export const SUBTITLE_CHARS_PER_SCREEN = 28;
/** Un silence plus long que ça termine le bloc de sous-titre affiché. */
export const SUBTITLE_MAX_PAUSE_SEC = 0.6;

/* ── Réécriture de la caption d'origine (mode Variations) ──────────────────── */
// La caption incrustée est l'empreinte la plus visible d'une vidéo : les
// plateformes lisent le texte à l'écran. Sur demande (case cochée par défaut),
// chaque copie la CACHE sous une boîte pleine et y écrit la même idée
// reformulée. On ne sait pas effacer un texte incrusté : on le floute (filet
// de sécurité) puis on pose une boîte opaque un peu plus grande par-dessus.

/** Styles autorisés pour la boîte de remplacement : fond PLEIN uniquement
 *  (un contour seul laisserait voir l'ancien texte). */
export const REPLACE_PRESETS = ["cover-white", "cover-black", "cover-pink"];

/** Taille de police max (px @1080) de la caption réécrite : elle grandit pour
 *  remplir la place de l'ancienne, sans devenir un titre géant. */
export const REPLACE_MAX_FONT_PX = 96;

/** Marge (en % du cadre) ajoutée autour de l'ancienne caption : la boîte doit
 *  la dépasser franchement, une lettre qui dépasse suffit à trahir la copie. */
export const REPLACE_COVER_MARGIN_PCT = 1.5;

/** Une ancienne caption plus large / plus haute que ça (en % du cadre) ne se
 *  cache pas proprement (la boîte mangerait l'image) → on la garde. */
export const REPLACE_MAX_W_PCT = 90;
export const REPLACE_MAX_H_PCT = 30;

/** Les morceaux d'une même caption (une ligne = une boîte pour l'inspection)
 *  doivent apparaître et disparaître ensemble, à N s près. Au-delà, la caption
 *  CHANGE pendant la vidéo (plusieurs textes successifs) → on la garde. */
export const REPLACE_SAME_TIMING_SEC = 0.6;

/** Longueur max de la caption réécrite : proche de l'originale (même place,
 *  même taille de police), ×1,2 de souplesse, jamais plus que CAPTION_MAX_CHARS. */
export const REPLACE_LENGTH_FACTOR = 1.2;

/* ── Spoofer ──────────────────────────────────────────────────────────────── */

/** Packs du duplicateur appliqués à CHAQUE copie (les deux modes) :
 *  métadonnées neuves + réencodage haute qualité (CRF 14-18, débit plafonné à
 *  celui de la source → jamais plus lourd) + pixel magique (bruit de luma
 *  invisible qui change l'empreinte de chaque image). Tirés au hasard par le
 *  duplicateur à chaque passage → réglages différents d'une copie à l'autre. */
export const SPOOFER_PACKS = ["metadata", "metadata_technical", "pixel_magic"];

/** Métadonnées d'appareil iPhone cohérentes (cf. règles EXIF de duplication). */
export const SPOOFER_IPHONE_META = true;

/** Copies fabriquées en parallèle pour UN lancement. Le moteur de rendu et le
 *  duplicateur ont déjà leurs propres files d'attente globales ; 2 suffit à
 *  enchaîner rendu (copie n) et spoofer (copie n-1) sans tout saturer. */
export const COPIES_IN_PARALLEL = 2;

/* ── Bornes des leviers visuels (mode Variations) ─────────────────────────── */
// Le planificateur choisit DANS ces bornes ; le serveur écrête toute valeur
// hors bornes (les indications du user ne peuvent pas les dépasser : au-delà,
// la perte de qualité se voit).

export const VISUAL_BOUNDS = {
  /** Recadrage (zoom) en % : 1,5 % minimum pour que ça compte, 8 % max avant
   *  que la perte de champ et de netteté se remarque. */
  cropPct: { min: 1.5, max: 8 },
  /** Décalage du recadrage (−50..50 % de la marge disponible). */
  cropOffset: { min: -50, max: 50 },
  /** Vitesse : ±4 % reste inaudible sur la voix et la musique. */
  speed: { min: 0.96, max: 1.04 },
  /** Colorimétrie : sous le seuil du « filtre visible ». */
  saturation: { min: 0.92, max: 1.08 },
  contrast: { min: 0.94, max: 1.06 },
  brightness: { min: -0.04, max: 0.04 },
  temperature: { min: -0.1, max: 0.1 },
} as const;

/** Cas E (vidéo courte) : on réduit les bornes de moitié. */
export const SHORT_VIDEO_BOUNDS_FACTOR = 0.5;

/* ── Vérification ─────────────────────────────────────────────────────────── */

/** Une copie en échec à la vérification est refaite AU PLUS N fois, puis
 *  écartée (et son coût rendu au quota). */
export const MAX_RETRIES_PER_COPY = 1;

/** Largeur (px) de la frame envoyée à Claude pour vérification : 480 suffit à
 *  lire le texte (cf. REF_KEYFRAME_WIDTH) sans alourdir l'appel. */
export const VERIFY_FRAME_WIDTH = 480;

/** Style de repli quand un texte est jugé illisible : la boîte noire
 *  semi-opaque se lit sur n'importe quel fond. */
export const READABLE_FALLBACK_PRESET = "black-box";

/** Tolérance (en % du cadre) du contrôle VISUEL de la zone sûre : la
 *  géométrie exacte est déjà garantie par le code ; l'œil ne doit refuser
 *  qu'un débordement net, pas une mesure approximative au ras de la limite. */
export const SAFE_ZONE_TOLERANCE_PCT = 2;

/** Écart de durée toléré entre la copie et l'attendu (part de la durée) :
 *  au-delà, le rendu a perdu ou dupliqué un morceau. */
export const DURATION_TOLERANCE = 0.05;

/* ── Exécution ────────────────────────────────────────────────────────────── */

/** Durée de vie d'un ticket terminé en mémoire (comme les tickets de rendu). */
export const JOB_TTL_MS = 2 * 60 * 60 * 1000;

/** Préfixe des tickets (à côté de dup_ / dx_ / rendus). */
export const JOB_ID_PREFIX = "aid_";

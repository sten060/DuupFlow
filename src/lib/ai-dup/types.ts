// src/lib/ai-dup/types.ts
//
// ── VOCABULAIRE DE LA « DUPLICATION IA EN 1 CLIC » ───────────────────────────
// Le fil du module, dans l'ordre :
//   1. AiDupRequest   — ce que le user envoie (vidéo, mode, copies, indications)
//   2. AiDupAnalysis  — ce qu'on sait de la vidéo (une fois par vidéo)
//   3. CopyPlan[]     — les réglages des N copies (UN appel au planificateur)
//   4. AiDupJob       — le ticket qui suit la fabrication + vérification
//
// Types uniquement, sans dépendance : importable côté client (page) comme
// côté serveur. Coordonnées spatiales TOUJOURS en % du cadre (0-100), origine
// en haut à gauche — même convention que l'Éditeur IA (plan-types.ts).

import type { CaptionFont } from "@/lib/ai-editor/font-catalog";

/** Remonte la consommation d'un appel Claude (facturation, billing.ts). */
export type UsageSink = (model: string, usage: {
  input_tokens?: number | null; output_tokens?: number | null;
  cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null;
}) => void;

/* ── 1. Demande ───────────────────────────────────────────────────────────── */

/** invisible = spoofer seul (aucune modif visible) ;
 *  variations = spoofer + modifs visuelles (texte, recadrage, vitesse, couleur). */
export type AiDupMode = "invisible" | "variations";

export type AiDupRequest = {
  /** Id de la matière dans le projet conteneur (Éditeur IA). */
  materialId: string;
  mode: AiDupMode;
  /** MIN_COPIES..MAX_COPIES (borné côté serveur). */
  copies: number;
  /** Texte libre du user, prioritaire sur les règles par défaut SAUF sur les
   *  interdits (visage, zone sûre, qualité). */
  indications?: string;
  /** Mode Variations : cacher la caption d'origine sous une boîte pleine et y
   *  écrire la même idée reformulée (si la vidéo en a une, fixe). */
  replaceCaption?: boolean;
};

/* ── 2. Analyse ───────────────────────────────────────────────────────────── */

/** Rectangle en % du cadre (x/y = coin haut-gauche). */
export type Rect = { x: number; y: number; w: number; h: number };

/** Une zone à protéger, éventuellement limitée dans le temps (s). */
export type TimedRect = Rect & { startSec?: number; endSec?: number };

/** Style d'un texte incrusté détecté — assez pour le décrire et ne pas le
 *  recouvrir, pas pour le reproduire au pixel. */
export type DetectedTextStyle = {
  color?: string;        // hex
  background?: string;   // hex ou "none"
  hasStroke?: boolean;
  font?: CaptionFont;    // meilleur match du catalogue
};

export type DetectedText = {
  present: boolean;
  /** Zone(s) occupée(s) : on ne pose jamais rien dessus. */
  boxes: TimedRect[];
  /** Texte lu (best-effort), utile au planificateur pour le ton et la langue. */
  text?: string;
  style?: DetectedTextStyle;
  /** Étendue RÉELLE du texte, mesurée dans les pixels (caption-timing.ts) —
   *  plus serrée que la boîte de l'inspection. Absente si non mesurable. */
  tightBox?: Rect;
};

/** Cas de figure de la spec (mode Variations). En mode Invisible, ignoré. */
export type AiDupScenario =
  | "A_no_text"          // pas de texte → caption différente par copie
  | "B_burned_caption"   // caption incrustée → on la garde, variations autour
  | "C_facecam_talk"     // face cam qui parle, sans texte → sous-titres
  | "D_facecam_caption"  // face cam + caption → sous-titres dans une zone libre
  | "E_short";           // < SHORT_VIDEO_SEC → variations légères, pas de texte long

export type AiDupAnalysis = {
  durationSec: number;
  width: number;
  height: number;
  aspect: "9:16" | "1:1" | "16:9";
  hasAudio: boolean;
  /** Une voix parle (transcript fiable), pas seulement de la musique. */
  hasVoice: boolean;
  /** Langue détectée (code ISO 639-1, ex. "fr", "en"), null si inconnue. */
  language: string | null;
  /** Caption « titre » incrustée (hook, texte de la vidéo). */
  burnedCaption: DetectedText;
  /** Sous-titres déjà présents (texte qui suit la voix). */
  existingSubtitles: DetectedText;
  /** Visages (zones protégées), avec leur fenêtre de présence. */
  faces: TimedRect[];
  /** Éléments graphiques incrustés au montage (logos, stickers, emojis,
   *  images) : protégés comme les textes d'origine — jamais recouverts. */
  graphics: (TimedRect & { what?: string })[];
  /** Zones libres pour du texte : les cases de la zone sûre (grille 3×3,
   *  une par ancre) qui ne touchent ni un visage ni un texte existant.
   *  Calculées par le CODE (pas par l'IA). Vide = aucun texte ajouté. */
  freeZones: FreeZone[];
  scenario: AiDupScenario;
  /** false = l'inspection visuelle a échoué : on ignore où sont les visages et
   *  les textes → aucun texte ajouté, et l'analyse n'est pas mise en cache. */
  inspected: boolean;
  /** Ce que montre la vidéo, scène par scène (description Gemini faite à
   *  l'upload) — sans elle, les captions générées restent génériques. */
  contentSummary?: string;
  /** Transcript mot à mot (sous-titres synchro, cas C/D). */
  words?: { startSec: number; endSec: number; text: string }[];
  /** Messages de dégradation douce (ex. détection de visage indisponible). */
  notes: string[];
};

/* ── 3. Plan d'une copie ──────────────────────────────────────────────────── */

/** Ancrage d'un texte ajouté, dans la zone sûre. Le serveur traduit l'ancre en
 *  coordonnées et vérifie qu'elle tombe dans une zone libre. */
export type TextAnchor =
  | "top-left" | "top-center" | "top-right"
  | "middle-left" | "middle-center" | "middle-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

/** Case de la zone sûre où un texte peut être posé sans rien recouvrir. */
export type FreeZone = Rect & { anchor: TextAnchor };

/** Styles de texte prêts à l'emploi (à définir dans un catalogue dédié).
 *  Le planificateur choisit un id ; il n'invente pas de style libre. */
export type TextPresetId = string;

export type PlannedText = {
  kind: "caption" | "subtitles";
  /** caption : le texte affiché. subtitles : vide (vient du transcript). */
  text?: string;
  preset: TextPresetId;
  anchor: TextAnchor;
  /** Fenêtre d'affichage (s). Absent = toute la vidéo (caption) ou synchro voix (sous-titres). */
  startSec?: number;
  endSec?: number;
  /** Caption : position RÉSOLUE par le serveur (jamais par l'IA). */
  placement?: TextPlacement;
  /** Sous-titres : position résolue PAR FENÊTRE DE TEMPS — un visage qui
   *  descend dans le cadre fait remonter les sous-titres, au lieu de les
   *  supprimer pour toute la vidéo. Hors fenêtre = pas de sous-titre. */
  windows?: (TextPlacement & { startSec: number; endSec: number })[];
  /** Caption de REMPLACEMENT : posée sur la caption d'origine, qu'elle cache.
   *  `blur` = zone floutée dessous (filet de sécurité), en % du cadre de la
   *  COPIE (après recadrage). startSec/endSec = fenêtre de l'originale. */
  replaces?: { original: string; blur: Rect };
};

/** Géométrie finale d'un texte, en % du cadre. */
export type TextPlacement = {
  anchor: TextAnchor;
  /** Centre du bloc (convention EditCaption.x / y). */
  x: number;
  y: number;
  align: "left" | "center" | "right";
  /** Taille retenue (px @1080), éventuellement réduite pour tenir. */
  fontSize: number;
  /** Boîte estimée occupée par le texte — sert à la vérification. */
  box: Rect;
  /** Taille MINIMALE de la boîte de fond (px @1080) : une caption de
   *  remplacement couvre toute l'ancienne, au pixel près (le moteur l'impose). */
  minBoxW?: number;
  minBoxH?: number;
  /** Largeur de ligne imposée au moteur (px @1080) : le nombre de lignes et
   *  la taille calculés ici sont rendus tels quels (pas de recoupe, pas de
   *  réduction automatique). */
  wrapW?: number;
  /** Nombre de lignes prévu (réécriture). */
  lines?: number;
};

/** Réglages spoofer d'une copie : TOUJOURS différents d'une copie à l'autre
 *  (métadonnées + réencodage + pixel magique). */
export type SpooferSettings = {
  /** Graine des tirages du spoofer (appareil, date, bruit pixel magique…). */
  seed: string;
  /** Libellé de l'appareil annoncé dans les métadonnées (pour le résumé). */
  deviceLabel?: string;
};

export type CopyPlan = {
  /** 0..N-1. */
  index: number;
  /** Absent en mode Invisible. */
  visual?: {
    cropPct: number;
    cropOffsetX: number;
    cropOffsetY: number;
    speed: number;
    color: { saturation: number; contrast: number; brightness: number; temperature: number };
  };
  /** 0..MAX_TEXT_ELEMENTS textes ajoutés (vide en mode Invisible). */
  texts: PlannedText[];
  spoofer: SpooferSettings;
};

/** Ce que renvoie le planificateur (UN appel Claude pour les N copies). */
export type AiDupPlan = {
  scenario: AiDupScenario;
  /** Langue des textes générés (détectée, sauf indication contraire du user). */
  language: string;
  copies: CopyPlan[];
  /** Ajustements faits par le serveur (valeur écrêtée, texte retiré…), pour le debug. */
  corrections: string[];
};

/* ── 4. Ticket de fabrication ─────────────────────────────────────────────── */

export type CopyStatus =
  | "queued"
  | "rendering"   // moteur Éditeur IA (Variations)
  | "spoofing"    // métadonnées + réencodage + pixel magique
  | "verifying"
  | "retrying"
  | "done"
  | "discarded";  // échec après MAX_RETRIES_PER_COPY → écartée, coût rendu

export type CopyResult = {
  index: number;
  status: CopyStatus;
  /** Essais effectués (1 = premier passage). */
  attempts: number;
  /** Nom du fichier final (servi par la route de téléchargement). */
  fileName?: string;
  sizeBytes?: number;
  /** Résumé court, ex. « Recadrage 4 %, vitesse ×1,03, caption haut-gauche
   *  style jaune, métadonnées iPhone 15 ». */
  summary?: string;
  /** Raison d'un échec / d'un écart (lisible par le user). */
  error?: string;
  /** Pourquoi la copie a été refaite (« texte peu lisible → style plus lisible »). */
  retryReason?: string;
  /** Verdict du dernier contrôle (debug / support). */
  check?: string;
  /** Historique : le fichier a été supprimé par le nettoyage des sorties. */
  expired?: boolean;
};

export type AiDupJobStatus = "analyzing" | "planning" | "producing" | "done" | "failed";

export type AiDupJob = {
  id: string;            // JOB_ID_PREFIX + …
  userId: string;        // la personne qui agit (quota)
  storeKey: string;      // rangement (créateur actif ou user) — cf. ai-editor/scope.ts
  projectId: string;
  request: AiDupRequest;
  status: AiDupJobStatus;
  /** 0-100, global (analyse + plan + copies). */
  progress: number;
  /** Tokens Claude consommés (centimes, 1 c = 100 tokens), connus à la fin. */
  tokensCents?: number;
  /** Vidéos du quota réservées / déjà rendues. */
  reservedUnits: number;
  releasedUnits: number;
  plan: AiDupPlan | null;
  copies: CopyResult[];
  /** Messages pour le user sur ce qui n'a pas pu être fait et pourquoi
   *  (« pas assez de place pour une caption sans couvrir le visage »…). */
  notices: string[];
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
};

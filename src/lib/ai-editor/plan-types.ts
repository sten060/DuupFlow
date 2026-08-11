// src/lib/ai-editor/plan-types.ts
//
// ── VOCABULAIRE DU PLAN DE MONTAGE (EditPlan) ────────────────────────────────
// La source de vérité des PRIMITIVES de l'Éditeur IA : ce que Claude (le
// monteur) peut exprimer, ce que le moteur (render.ts) sait exécuter, et ce
// qu'un futur éditeur manuel manipulera. Une variante = UN EditPlan.
//
// Règle de la feature (voir README.md) : on n'ajoute pas des « effets nommés »,
// on ajoute des primitives COMPOSABLES. Toute nouvelle primitive suit la
// checklist du README (type ici → schéma MCP → moteur → perception).
//
// Ce fichier ne contient QUE des types + petites constantes d'énumération —
// aucune dépendance, importable côté client (futur éditeur manuel) comme côté
// serveur.

/* ── Segments (plans) ──────────────────────────────────────────────────────── */

export type SegMotion = "none" | "zoomIn" | "zoomOut" | "panLeft" | "panRight" | "handheld";
export type SegFit = "contain" | "cover" | "blurFill";
export type SegTransition = "cut" | "fade" | "whipPan" | "slide" | "zoomPunch" | "flash" | "glitch";

// Flou/pixelisation d'une ZONE du plan (masquage visage/pseudo/logo/numéro).
export type BlurRegion = {
  x?: number; y?: number;          // coin haut-gauche, % du cadre
  width?: number; height?: number; // taille, % du cadre
  intensity?: number;              // 0-1 (force du flou / grossièreté des pixels)
  startSec?: number; endSec?: number; // fenêtre, relative au plan
  shape?: "rect" | "ellipse";      // ellipse = visages
  mode?: "blur" | "pixelate";      // flou gaussien (défaut) ou mosaïque
};

// Secousse PONCTUELLE (sur un temps fort / beat) — distincte du handheld (continu).
export type ShakeKick = {
  t?: number;                      // instant, s relatives au plan
  intensity?: number;              // 0-1
  duration?: number;               // s (défaut ~0.18)
};

export type SegLayout = "single" | "splitH" | "splitV" | "pip";
export type OverlayAnim = "none" | "slideLeft" | "slideRight" | "slideUp" | "slideDown" | "fade" | "pop";
export type OverlayEasing = "linear" | "easeOut" | "spring";
export const OVERLAY_ANIMS: readonly string[] = ["none", "slideLeft", "slideRight", "slideUp", "slideDown", "fade", "pop"];
export const OVERLAY_EASINGS: readonly string[] = ["linear", "easeOut", "spring"];

/** Forme d'une incrustation : rect (telle quelle), square (recadrée carrée),
 *  circle (bulle ronde — le layout « speaker en bulle » des edits OpusClip). */
export type OverlayShape = "rect" | "square" | "circle";

export type SegOverlay = {
  // Média incrusté (id de matière)… OU carte de couleur pure via `color`.
  materialId?: string;
  // CARTE DE COULEUR : rectangle (arrondi) de couleur unie, sans média — panneau
  // plein cadre derrière une liste, fond de bloc, badge. Utilisée si materialId
  // est absent. Hex #RRGGBB.
  color?: string;
  x?: number; y?: number;          // position (coin haut-gauche) en % du cadre
  width?: number;                  // largeur en % du cadre (5-100)
  height?: number;                 // hauteur en % du cadre — média : recadre (cover) dans la boîte w×h ; carte : requis (défaut = carré)
  shape?: OverlayShape;            // square/circle : recadre la source en carré (+ masque rond pour circle)
  startSec?: number; endSec?: number; // fenêtre d'affichage, relative au segment
  opacity?: number;                // 0-1
  borderRadius?: number;           // px @1080 (coins arrondis — réellement appliqué)
  zIndex?: number;                 // ordre d'empilement (petit = dessous)
  // ── Animation entrée/sortie ──
  enter?: OverlayAnim;             // comment l'incrustation ENTRE dans le cadre
  exit?: OverlayAnim;              // comment elle SORT
  enterDuration?: number;          // s (défaut 0.4)
  exitDuration?: number;           // s (défaut 0.4)
  easing?: OverlayEasing;          // courbe (défaut easeOut)
};

/** Zoom punch : coup de zoom ponctuel sur un temps fort (l'effet d'accroche
 *  short-form le plus courant, à la CapCut). Bump sinus 0→1→0 sur la fenêtre. */
export type ZoomPunch = {
  at: number;                      // timecode (s) DANS le plan (0-based)
  duration?: number;               // 0.05-0.6 s (défaut 0.2)
  amount?: number;                 // facteur de zoom au pic, 1.05-2.5 (défaut 1.4)
  direction?: "in" | "out";        // in = punch vers l'avant (défaut) ; out = plan zoomé qui recule sur le beat
  blur?: number;                   // 0-1 : flou (gaussien) synchronisé sur le punch (approx du flou radial)
};

export type EditSegment = {
  materialId: string;
  startSec?: number;
  endSec?: number;
  motion?: SegMotion | "zoom-in" | "zoom-out";
  motionIntensity?: number;
  fit?: SegFit;
  transition?: SegTransition;      // à l'ENTRÉE du plan (le 1er reste en cut)
  transitionDuration?: number;     // secondes (0.1-0.4 typique), bornée à la durée
  flashColor?: string;             // pour transition "flash" : "white" (défaut) | "black" | hex
  glitchIntensity?: number;        // pour transition "glitch" : 0-1 (défaut 0.6)
  // ── Vitesse (chantier 1) — VIDÉO uniquement (ignoré silencieusement sur image) ──
  speed?: number;                  // 0.25-4, défaut 1 (l'audio du plan suit, pitch modifié)
  freezeAt?: number;               // timecode (s) DANS le fichier → arrêt sur image
  freezeDuration?: number;         // durée du gel (s)
  speedRamp?: { from: number; to: number }; // rampe de vitesse progressive sur le plan
  reverse?: boolean;               // lecture inversée (vidéo + audio)
  // ── Recadrage (chantier 2) — se COMPOSE avec motion (le mouvement passe par-dessus) ──
  scale?: number;                  // 1-3 : zoom (punch-in) dans l'image, défaut 1
  offsetX?: number;                // -50..50 % : position H du recadrage (agit si scale>1)
  offsetY?: number;                // -50..50 % : position V du recadrage
  flipH?: boolean;                 // miroir horizontal (levier d'unicité)
  flipV?: boolean;                 // miroir vertical
  rotate?: number;                 // rotation en degrés
  // ── Masquage / secousse ──
  blurRegions?: BlurRegion[];      // flou/pixelisation de zones (visage, pseudo, logo…)
  shakeAt?: ShakeKick[];           // secousses ponctuelles (calées sur les beats/drops)
  zoomPunch?: ZoomPunch;           // coup de zoom d'accroche sur un temps fort
  // ── Composition multi-média (chantier 4) ──
  layout?: SegLayout;              // single (défaut) | splitH | splitV | pip
  overlays?: SegOverlay[];         // médias/cartes additionnels compositée dans le plan
  grade?: ColorGrade;              // colorimétrie PROPRE au plan (surcharge le grade global)
  freezeGrade?: ColorGrade;        // colorimétrie appliquée UNIQUEMENT pendant la fenêtre de gel (freeze) — ex. N&B sur le freeze
  // ── Fondu au noir/blanc (au niveau du plan) — s'assombrit progressivement vers fadeColor ──
  fadeIn?: number;                 // s (0-2) : le plan APPARAÎT depuis fadeColor
  fadeOut?: number;                // s (0-2) : le plan se FOND vers fadeColor à la fin
  fadeColor?: string;              // couleur du fondu (défaut noir) — "white" utile aussi
  fadeEasing?: "linear" | "easeInOut"; // courbe de l'assombrissement (défaut easeInOut)
};

/* ── Captions (textes incrustés) ───────────────────────────────────────────── */

export type CaptionStyle = "outline" | "box" | "sticker";
export type CaptionSize = "s" | "m" | "l";
export type CaptionFont = "sans" | "rounded" | "impact" | "serif" | "script" | "display";
export type EmojiStyle = "3d" | "flat"; // 3d = Fluent 3D (défaut) ; flat = Twemoji

export type EditCaption = {
  text: string;
  startSec: number;
  endSec: number;
  position?: "top" | "center" | "bottom";
  x?: number;            // centre horizontal en % (0-100) — prioritaire sur position
  y?: number;            // centre vertical en % (0-100)
  align?: "left" | "center" | "right";
  style?: CaptionStyle;  // outline (défaut) | box | sticker (raccourci : fond opaque, très arrondi, padding généreux, gras sans contour)
  background?: string;   // couleur hex du fond → force box ; "none" → force outline
  backgroundOpacity?: number; // 0-1, opacité du fond (défaut 1 = OPAQUE)
  borderRadius?: number; // px (@1080) : coins arrondis du fond (30-40 pour un sticker)
  padding?: number;      // px (@1080) : marge intérieure du fond (X et Y)
  paddingX?: number;     // px (@1080) : marge intérieure horizontale (prioritaire sur padding)
  paddingY?: number;     // px (@1080) : marge intérieure verticale (prioritaire sur padding)
  size?: CaptionSize;
  fontSize?: number;     // px (à W=1080), prioritaire sur size
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;  // px
  font?: CaptionFont;    // famille de police
  fontWeight?: number;   // 400-900
  letterSpacing?: number;// px (interlettrage)
  lineHeight?: number;   // multiplicateur (défaut 1.24)
  textTransform?: "none" | "uppercase";
  shadowColor?: string;  // ombre portée (distincte du contour)
  shadowBlur?: number;   // px
  shadowOffset?: number; // px (décalage bas-droite)
  emojiStyle?: EmojiStyle; // "3d" (Fluent, défaut) | "flat" (Twemoji) — override du défaut du plan
  // ── Animation (chantier 3) ──
  animation?: "none" | "fade" | "pop" | "slideUp" | "typewriter" | "wordByWord" | "karaoke";
  animationDuration?: number;                      // s (défaut ~0.35)
  // ── Animation de SORTIE : comment la caption disparaît à endSec (fade = fondu,
  // pop = fondu rapide, slideUp/slideDown = glisse en fondu). Ignorée pour
  // wordByWord/karaoke (leurs calques gèrent leur propre timing).
  exitAnimation?: "none" | "fade" | "pop" | "slideUp" | "slideDown";
  exitDuration?: number;                           // s (défaut ~0.35)
  // ── COMPTEUR ANIMÉ : le texte devient un nombre qui défile de `from` à `to`
  // sur [startSec,endSec] (easing easeOut : file vite puis se pose). Remplace
  // `text`/`spans`/`animation`. Style/position/contour de la caption s'appliquent.
  counter?: { from: number; to: number; decimals?: number; prefix?: string; suffix?: string };
  words?: { text: string; start: number; end: number; color?: string }[]; // wordByWord/karaoke : timing par mot (+ couleur STATIQUE du mot — mot-clé en relief)
  highlightColor?: string;                         // karaoké : couleur du mot actif
  glow?: { color: string; intensity: number };     // effet NÉON (halo saturé autour du texte)
  // ── Captions « designées » (style TikTok) : chaque SPAN = une portion du texte
  // avec sa propre couleur et/ou sa propre police (mot multicolore, mot en script…).
  // Quand `spans` est fourni, le texte rendu = la concaténation des `text` (séparés
  // par une espace) et remplace `text`. Chaque span hérite des réglages globaux
  // (color/font/fontWeight) sauf pour les champs qu'il redéfinit. Absent → rendu
  // classique inchangé. Les emojis restent rendus en images (couleur ignorée).
  spans?: { text: string; color?: string; font?: CaptionFont; italic?: boolean; weight?: number }[];
};

/* ── Colorimétrie / audio / plan ───────────────────────────────────────────── */

export type ColorGrade = {
  saturation?: number;   // 1 = neutre
  contrast?: number;     // 1 = neutre
  brightness?: number;   // 0 = neutre (-1..1)
  temperature?: number;  // -1 froid .. +1 chaud (0 neutre)
  grain?: number;        // 0..1
  vignette?: boolean;
};

export type AudioDuck = {
  enabled?: boolean;
  threshold?: number;      // seuil de déclenchement 0-1 (défaut 0.05)
  reduction?: number;      // atténuation cible en dB (défaut 12) → pilote le ratio
  attack?: number;         // s (défaut 0.1) — vitesse de baisse quand la voix arrive
  release?: number;        // s (défaut 0.4) — vitesse de remontée quand la voix s'arrête
};

export type EditAudioTrack = {
  materialId: string;      // matière audio OU vidéo (on prend sa piste son)
  startSec?: number;       // décalage dans la piste
  volume?: number;         // 0-2, défaut 1
  mode?: "mix" | "replace";// mix (par-dessus le son des plans, défaut) | replace
  duck?: boolean | AudioDuck; // MIX only : baisse la musique quand une voix parle dans les plans
};

export type EditPlan = {
  aspect?: "9:16" | "1:1" | "16:9";
  fps?: number;
  background?: string;   // couleur de fond (letterbox), défaut noir
  grade?: ColorGrade;
  audio?: EditAudioTrack;
  segments: EditSegment[];
  captions?: EditCaption[];
  emojiStyle?: EmojiStyle; // défaut des emojis de TOUTES les captions ("3d" | "flat")
  label?: string;
};

export type OutKeyframe = { t: number; dataUri: string };

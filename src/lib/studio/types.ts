// Types partagés client/serveur du Studio (/studio).
// Fichier volontairement sans import Node : il est importé par les composants client.

export type ReelFormat = "Talking" | "Action";

// Vidéo brute uploadée (réelle, stockée en local dans .studio-local/uploads).
export interface UploadedVideo {
  id: string; // nom de fichier sur disque (ex: "src_1720000000_ab12cd.mp4")
  name: string; // nom d'origine côté utilisateur
  format: ReelFormat; // détecté côté serveur (piste audio + volume moyen)
  durationLabel: string; // "0:26"
  sizeMo: number;
}

// Reel généré (réel, encodé par ffmpeg dans .studio-local/outputs).
export interface StudioReel {
  id: string;
  variantLabel: string; // "Variante 3"
  hook: string;
  format: ReelFormat;
  duration: string; // durée réelle de la sortie, "0:26"
  source: string; // nom d'origine de la vidéo brute
  fileName: string; // nom proposé au téléchargement, "variante_3.mp4"
  sizeMo: number; // poids réel du fichier généré
  url: string; // /api/studio/media/<fichier> — streaming + download
  // Extrait découpé dans la brute ("0:42 → 1:05") ou "vidéo entière".
  segment?: string;
  // Caption prête à publier (texte + hashtags), générée par le LLM.
  // Absente si LLM indisponible (vidéos sans parole ou sans clé API).
  caption?: string;
}

// ── Références virales (reels performants collés par l'utilisateur) ──────────

// Mesures QUANTITATIVES du montage de la référence — c'est ce qui permet de
// REPRODUIRE le montage (nombre de captions, timing, position, taille), pas
// juste son "ambiance". Estimées par vision sur des frames à timestamps connus.
export interface RecipeLayout {
  revealCount: number; // nb de captions révélées APRÈS le hook (0 = hook seul)
  revealAtFrac: number[]; // moments d'apparition, fraction 0-1 de la durée
  hookYFrac: number; // position verticale du HAUT du hook (0-1)
  stackYFrac: number; // position verticale du HAUT de la 1ʳᵉ révélation (0-1)
  fontFrac: number; // hauteur d'une ligne de texte / hauteur vidéo (ex 0.035)
  maxCharsPerLine: number; // largeur de ligne observée (caractères, calibrée)
  // "stack" = les captions s'ACCUMULENT (défaut) ; "replace" = chaque caption
  // REMPLACE la précédente (détecté en comparant les frames 50% et 85%).
  mode: "stack" | "replace";
  // Durée de la ref (mesurée par ffmpeg côté serveur, pas par la vision) —
  // sert à convertir revealAtFrac en secondes ABSOLUES au moment du plan.
  refDurationSec: number;
}

// "Recette" extraite d'un reel de référence : le SCHÉMA transférable (pas le
// contenu). Sert à faire écrire au LLM des hooks/captions dans le même style.
export interface ViralRecipe {
  hookStyle: string; // ex : "curiosité, 'personne te dit ça'"
  captionStyle: string; // visuel : "gros texte blanc, contour noir, un mot à la fois"
  structure: string; // rythme / structure (hook → développement → CTA)
  tone: string; // ex : "cash, direct, tutoiement"
  cta: string; // appel à l'action typique
  examples: string[]; // 1-3 exemples de hooks observés
  accentColor?: string; // couleur d'accent des captions (#RRGGBB) si repérée
  uppercase?: boolean; // captions en MAJUSCULES ?
  layout?: RecipeLayout; // mesures du montage (reveal/timing/position/taille)
}

// Une référence collée : statut d'analyse + recette une fois prête.
export interface StudioReference {
  id: string; // hash de l'URL
  url: string;
  status: "analyzing" | "ready" | "error";
  title: string; // libellé court affiché (plateforme + fin d'URL)
  recipe?: ViralRecipe;
  error?: string;
}

// Instantané d'un job de génération (réponse du polling).
export interface StudioJobSnapshot {
  jobId: string;
  total: number;
  done: boolean;
  failed: number;
  reels: StudioReel[];
  error?: string;
}

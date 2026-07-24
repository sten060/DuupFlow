// Types partagés client/serveur de l'Importateur de compte (/dashboard/... ou /studio).
// Le user colle le lien de SON compte (IG/TikTok) → on scrape → on classe ses
// meilleures vidéos → il coche celles à télécharger (→ download, Drive, duplication).
//
// Fichier volontairement SANS import Node : importé par des composants client.

export type SocialPlatform = "instagram" | "tiktok";

// Compte cible résolu depuis le lien collé par l'utilisateur.
export interface AccountTarget {
  platform: SocialPlatform;
  handle: string; // sans @ (ex: "leo.dupont")
  profileUrl: string; // URL canonique du profil
}

// ── Parse le lien collé par l'utilisateur → cible normalisée ─────────────────
// Volontairement ICI (module sans import Node) et non dans apify.ts : l'UI en a
// besoin pour connaître la plateforme AVANT le scan et afficher le prix exact —
// sans embarquer le runner Apify dans le bundle client.
export function parseAccountUrl(raw: string): AccountTarget | null {
  const input = raw.trim();
  if (!input) return null;

  // Formats acceptés : URL complète, "@handle" (défaut IG), ou "tiktok.com/@x".
  const igMatch = input.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (igMatch) {
    const handle = igMatch[1].replace(/\/$/, "");
    return { platform: "instagram", handle, profileUrl: `https://www.instagram.com/${handle}/` };
  }
  const ttMatch = input.match(/tiktok\.com\/@([A-Za-z0-9._]+)/i);
  if (ttMatch) {
    const handle = ttMatch[1];
    return { platform: "tiktok", handle, profileUrl: `https://www.tiktok.com/@${handle}` };
  }
  // "@handle" nu → IG par défaut (le plus courant).
  const bare = input.match(/^@?([A-Za-z0-9._]+)$/);
  if (bare) {
    const handle = bare[1];
    return { platform: "instagram", handle, profileUrl: `https://www.instagram.com/${handle}/` };
  }
  return null;
}

// Une vidéo telle que renvoyée par le scraper Apify, normalisée (les scrapers
// ont des noms de champs différents → on ramène tout à cette forme commune).
// `videoUrl` = URL CDN DIRECTE (signée, EXPIRE vite) → voie 2 : à télécharger
// immédiatement côté serveur, jamais à renvoyer au front pour un download différé.
export interface ScrapedVideo {
  postUrl: string; // URL permanente du post (ne périme jamais) — fallback download
  videoUrl: string | null; // URL CDN directe du fichier .mp4 (périssable)
  thumbnailUrl: string | null;
  caption: string;
  durationSec: number | null;
  timestamp: string | null; // ISO date de publication
  // Métriques (selon dispo par plateforme — certaines absentes → null).
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

// Vidéo enrichie d'un score de performance, prête à afficher dans la grille.
export interface ScoredVideo extends ScrapedVideo {
  id: string; // hash stable de postUrl (clé React + suivi téléchargement)
  score: number; // score de performance normalisé (0-100)
  engagementRate: number | null; // (likes+comments+shares)/views si views connu
  rank: number; // 1 = meilleure perf
}

// Instantané d'un job de SCAN (réponse du polling GET /api/account/scan/[jobId]).
export interface AccountScanSnapshot {
  jobId: string;
  target: AccountTarget;
  windowDays: number;
  // Nombre de vidéos voulues par l'utilisateur ("les N plus performantes").
  // Choisi AVANT le scan : pilote la pré-sélection et l'affichage.
  // NB : ne réduit PAS le coût du scan (il faut scraper toute la fenêtre pour
  // pouvoir classer) — mais réduit le coût/temps de téléchargement, surtout TikTok.
  topCount: number;
  status: "scraping" | "ready" | "error";
  scannedCount: number; // nb de vidéos ramenées par le scraper
  videos: ScoredVideo[]; // classées, meilleure en premier
  error?: string;
  // Nature de l'erreur pour l'UI :
  //  • "user"     → actionnable par l'utilisateur (compte privé, restreint, aucun
  //                 reel sur la période…) → on affiche le message tel quel.
  //  • "platform" → panne d'infrastructure (Apify indispo/quota, config…) → on
  //                 affiche un message générique « contacte le support », JAMAIS
  //                 le détail technique.
  errorKind?: "user" | "platform";
  // Avertissement non bloquant affiché au-dessus des résultats. Sert notamment
  // à signaler qu'un compte actif a probablement du contenu RÉCENT invisible en
  // scan public (age-restreint) — heuristique, pas une certitude.
  notice?: string;
}

// Résultat du téléchargement d'UNE vidéo (voie 2) — mappé sur UploadedVideo
// du studio pour se brancher directement sur la duplication.
export interface DownloadedVideoResult {
  sourceId: string; // id de la ScoredVideo demandée
  ok: boolean;
  // Présent si ok : le fichier est stocké et exploitable (forme UploadedVideo studio).
  uploadedId?: string; // nom de fichier sur disque (ex: "src_..._ab12.mp4")
  name?: string;
  durationLabel?: string;
  sizeMo?: number;
  error?: string;
}

// Instantané d'un job de DOWNLOAD (réponse du polling).
export interface AccountDownloadSnapshot {
  jobId: string;
  total: number;
  done: boolean;
  results: DownloadedVideoResult[];
  error?: string;
}

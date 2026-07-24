// Runner Apify (REST) + adaptateurs par plateforme.
//
// On appelle l'API "run-sync-get-dataset-items" : lance l'actor, ATTEND la fin,
// renvoie directement les items du dataset. Simple et suffisant pour un scan
// PLAFONNÉ (fenêtre de N jours → ~quelques dizaines de vidéos, < quelques min).
// TODO: pour de très gros comptes, passer en run async + polling (limite ~5 min
// du run-sync). Le job de scan étant déjà asynchrone côté client, ça reste transparent.
//
// Le mapping des champs est DÉFENSIF : chaque scraper nomme ses champs
// différemment (et ça change) → on essaie plusieurs noms connus et on retombe
// proprement sur null. À confirmer/ajuster contre un vrai run.

export { parseAccountUrl } from "./types";
import { parseAccountUrl } from "./types";
import type {
  AccountTarget,
  ScrapedVideo,
  SocialPlatform,
} from "./types";

const APIFY_BASE = "https://api.apify.com/v2";

// Erreur d'INFRASTRUCTURE (Apify indisponible, quota/crédit du compte Apify,
// token manquant…). Le vrai motif est loggé côté serveur mais JAMAIS montré à
// l'utilisateur : l'UI affiche un message générique « échec — contacte le
// support ». Surtout ne rien laisser filtrer d'un problème de crédit Apify.
export class ScrapePlatformError extends Error {
  constructor(msg = "platform_error") {
    super(msg);
    this.name = "ScrapePlatformError";
  }
}

// Actor par plateforme. TikTok : clockworks (sémantique profil claire) ;
// apidojo/tiktok-scraper est le swap "moins cher" une fois les champs validés.
const ACTORS: Record<SocialPlatform, string> = {
  instagram: "apify~instagram-reel-scraper",
  tiktok: "clockworks~tiktok-scraper",
};

function getToken(): string {
  const t = process.env.APIFY_TOKEN;
  if (!t) {
    console.error("[account] APIFY_TOKEN manquant — configure-le en env.");
    throw new ScrapePlatformError("missing_token");
  }
  return t;
}

// Date ISO (YYYY-MM-DD) il y a `days` jours — borne basse de la fenêtre.
function sinceDate(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// ── Construction de l'input de l'actor par plateforme ────────────────────────
function buildInput(target: AccountTarget, windowDays: number, limit: number): Record<string, unknown> {
  const since = sinceDate(windowDays);
  if (target.platform === "instagram") {
    // apify/instagram-reel-scraper : la fenêtre borne la pagination (l'actor
    // s'arrête au-delà de `onlyPostsNewerThan` → on ne paie pas le vieux contenu).
    return {
      username: [target.handle],
      resultsLimit: limit,
      onlyPostsNewerThan: since,
    };
  }
  // clockworks/tiktok-scraper
  return {
    profiles: [target.handle],
    resultsPerPage: limit,
    oldestPostDateUnified: since,
    shouldDownloadVideos: false, // voie 2 : on télécharge nous-mêmes, hors Apify
    shouldDownloadCovers: false,
  };
}

// ── Mapping défensif d'un item de dataset → ScrapedVideo ─────────────────────
function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
// Premier champ non-null parmi plusieurs noms candidats.
function pick<T>(obj: Record<string, any>, keys: string[], f: (v: unknown) => T | null): T | null {
  for (const k of keys) {
    const val = f(obj[k]);
    if (val !== null) return val;
  }
  return null;
}

// Un item peut être un enregistrement de PROFIL/ERREUR (compte privé, restreint,
// introuvable) plutôt qu'un post — le scraper IG le renvoie ainsi. On le reconnaît.
function isErrorRecord(item: Record<string, any>): boolean {
  return typeof item?.error === "string" || item?.isRestrictedProfile === true;
}

// Message clair pour l'utilisateur, à partir d'une durée de fenêtre.
// "Aucun reel sur la période" n'est PAS une erreur du compte : le compte poste
// peut-être souvent, mais pas de reel DANS la fenêtre choisie (ex. dernier reel
// il y a 8 jours alors que la fenêtre est de 7). → on invite à l'élargir.
function noVideosMessage(windowDays: number): string {
  const wider =
    windowDays <= 7 ? "30 ou 90 jours" : windowDays <= 30 ? "90 jours ou 1 an" : "1 an";
  return (
    `Aucun reel visible sur les ${windowDays} derniers jours. Deux causes possibles : ` +
    `le compte a posté il y a plus longtemps (élargis la fenêtre : ${wider}), ` +
    `ou son contenu récent est age-restreint — invisible en scan public.`
  );
}

// Message lisible tiré d'un enregistrement d'erreur profil.
function profileErrorMessage(item: Record<string, any>, windowDays: number): string {
  if (item?.isRestrictedProfile) {
    return `Compte restreint (${item.restrictionReason || "accès limité"}) — impossible en scan anonyme. Essaie un compte public.`;
  }
  const e = String(item?.error || "").toLowerCase();
  if (e.includes("private")) return "Compte privé — impossible à scanner.";
  if (e.includes("not found") || e.includes("exist")) return "Compte introuvable — vérifie le pseudo.";
  // "no_items" = le scraper n'a rien trouvé DANS la fenêtre → pas une panne.
  if (e.includes("no_items") || e.includes("no items") || e.includes("no result")) {
    return noVideosMessage(windowDays);
  }
  return `Scraper : ${item?.error || "profil inaccessible"}`;
}

function mapItem(item: Record<string, any>, platform: SocialPlatform): ScrapedVideo | null {
  if (isErrorRecord(item)) return null; // pas un post → ignoré (géré en amont)

  const postUrl =
    pick(item, ["url", "webVideoUrl", "postPage", "shareUrl"], str);
  if (!postUrl) return null; // sans URL de post, on ne peut ni classer ni re-scraper

  // Garde : ce doit être un POST (pas une URL de profil). Un vrai reel a une URL
  // /p/… ou /reel/…, ou au minimum une URL vidéo / un compteur de vues.
  const looksLikePost = /\/(p|reel|reels|video)\//i.test(postUrl);
  const hasVideoSignal =
    !!pick(item, ["videoUrl", "downloadUrl", "mediaUrl"], str) ||
    pick(item, ["videoPlayCount", "videoViewCount", "playCount"], num) !== null;
  if (!looksLikePost && !hasVideoSignal) return null;

  // URL CDN directe du .mp4 : noms variables selon scraper (défensif).
  const videoUrl =
    pick(item, ["videoUrl", "downloadUrl", "mediaUrl"], str) ??
    str(item?.videoMeta?.downloadAddr) ??
    (Array.isArray(item?.mediaUrls) ? str(item.mediaUrls[0]) : null);

  const thumbnailUrl =
    pick(item, ["displayUrl", "thumbnailUrl", "coverUrl", "cover"], str) ??
    str(item?.videoMeta?.coverUrl);

  return {
    postUrl,
    videoUrl,
    thumbnailUrl,
    caption: pick(item, ["caption", "text", "title", "description"], str) ?? "",
    durationSec: pick(item, ["videoDuration", "duration"], num) ?? num(item?.videoMeta?.duration),
    timestamp: pick(item, ["timestamp", "createTimeISO", "createTime", "takenAt"], str),
    // Métriques — vues d'abord (play/view), puis engagement.
    views: pick(item, ["videoPlayCount", "videoViewCount", "playCount", "views"], num),
    likes: pick(item, ["likesCount", "diggCount", "likes", "heartCount"], num),
    comments: pick(item, ["commentsCount", "commentCount", "comments"], num),
    shares: pick(item, ["sharesCount", "shareCount", "shares", "reshareCount"], num),
  };
}

// Ajoute le token Apify à une URL de KV store (les records de download TikTok
// sont privés au run → 403 sans token).
function withToken(url: string): string {
  const token = getToken();
  return url.includes("token=") ? url : `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

// Lance un actor et renvoie les items du dataset (run-sync-get-dataset-items).
async function runActor(actor: string, input: Record<string, unknown>): Promise<Record<string, any>[]> {
  const token = getToken();
  const url = `${APIFY_BASE}/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    // Le vrai motif (crédit/quota Apify épuisé, 402, indispo…) est loggé ICI
    // seulement — JAMAIS renvoyé à l'utilisateur. On lève une erreur plateforme
    // générique que l'UI traduit en « échec, contacte le support ».
    const detail = await res.text().catch(() => "");
    console.error(`[account] Apify HTTP ${res.status} : ${detail.slice(0, 300)}`);
    throw new ScrapePlatformError(`apify_http_${res.status}`);
  }
  const items = (await res.json()) as Record<string, any>[];
  return Array.isArray(items) ? items : [];
}

// ── Lance le scrape d'un profil → vidéos normalisées ─────────────────────────
// NB : le scan TikTok NE télécharge PAS (shouldDownloadVideos:false) → videoUrl
// reste null, résolu à la demande au moment du download (voir ci-dessous).
export async function scrapeProfile(
  target: AccountTarget,
  windowDays: number,
  limit: number
): Promise<ScrapedVideo[]> {
  const items = await runActor(ACTORS[target.platform], buildInput(target, windowDays, limit));

  const videos = items
    .map((it) => mapItem(it, target.platform))
    .filter((v): v is ScrapedVideo => v !== null);

  // Aucune vidéo → message clair plutôt qu'un résultat vide trompeur.
  //  • enregistrement d'erreur profil (privé/restreint/introuvable/no_items)
  //  • OU dataset vide sans erreur explicite (rien sur la période)
  // Dans tous ces cas le job rembourse (cf. lib/account/jobs).
  if (videos.length === 0) {
    const errItem = items.find(isErrorRecord);
    throw new Error(
      errItem ? profileErrorMessage(errItem, windowDays) : noVideosMessage(windowDays),
    );
  }

  return videos;
}

// ── Résout une URL de fichier TÉLÉCHARGEABLE pour UN post (au download) ───────
// Instagram : l'URL CDN est déjà connue au scan (video.videoUrl) — cette fonction
//   ne sert qu'en secours (URL expirée) : re-scrape le profil et retrouve le post.
// TikTok : aucune URL directe au scan → on re-scrape CE post avec le download
//   activé ($0.0013, seulement sur les vidéos choisies) → mediaUrls[0] + token.
export async function resolveVideoUrlForDownload(
  target: AccountTarget,
  postUrl: string
): Promise<string | null> {
  if (target.platform === "tiktok") {
    const items = await runActor(ACTORS.tiktok, {
      postURLs: [postUrl],
      resultsPerPage: 1,
      shouldDownloadVideos: true,
      shouldDownloadCovers: false,
    });
    const mu = items[0]?.mediaUrls;
    const raw = Array.isArray(mu) && typeof mu[0] === "string" ? mu[0] : null;
    if (!raw) return null;
    // KV store Apify → besoin du token ; CDN public éventuel → tel quel.
    return raw.includes("apify.com") ? withToken(raw) : raw;
  }

  // Instagram : re-scrape le profil (fenêtre large, petit plafond) pour une URL fraîche.
  const again = await scrapeProfile(target, 3650, 200);
  return again.find((v) => v.postUrl === postUrl)?.videoUrl ?? null;
}

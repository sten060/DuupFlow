// Registres de jobs EN MÉMOIRE (local) — même pattern que lib/studio/jobs.ts.
// Le client poll les snapshots. `globalThis` → survit au HMR du dev Next.
//
// Deux flux :
//   • SCAN     : scrape Apify → score → snapshot classé.
//   • DOWNLOAD : voie 2, stream des vidéos cochées → uploads studio. Séquencé
//                (concurrence limitée) et suivant DIRECTEMENT le scrape pour que
//                les URLs CDN n'aient pas expiré. Sur 403 → re-scrape ciblé + retry.

import fs from "fs/promises";
import path from "path";
import { UPLOADS_DIR } from "@/lib/studio/local-store";
import { detectFormat, formatDuration, probeVideo } from "@/lib/studio/pipeline";
import { parseAccountUrl, resolveVideoUrlForDownload, scrapeProfile, ScrapePlatformError } from "./apify";
import { rankVideos } from "./scoring";
import { downloadToStore, runWithConcurrency, ExpiredUrlError } from "./download";
import type {
  AccountDownloadSnapshot,
  AccountScanSnapshot,
  AccountTarget,
  DownloadedVideoResult,
  ScoredVideo,
} from "./types";

const DEFAULT_LIMIT = 100; // plafond de vidéos scrapées (coût borné)
const DOWNLOAD_CONCURRENCY = 4; // piège n°2 : 3-5 max pour ne pas se faire rate-limit

// ── Registres ────────────────────────────────────────────────────────────────
interface ScanJob extends AccountScanSnapshot {
  startedAt: number;
}
interface DownloadJob extends AccountDownloadSnapshot {
  startedAt: number;
}
const scanJobs: Map<string, ScanJob> = ((globalThis as any).__duupAccountScans ??= new Map());
const dlJobs: Map<string, DownloadJob> = ((globalThis as any).__duupAccountDownloads ??= new Map());

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Purge les jobs terminés de plus d'1 h (anti-fuite mémoire).
function purge<T extends { done?: boolean; status?: string; startedAt: number }>(m: Map<string, T>) {
  for (const [id, j] of m) {
    const finished = j.done === true || j.status === "ready" || j.status === "error";
    if (finished && Date.now() - j.startedAt > 60 * 60 * 1000) m.delete(id);
  }
}

// ── SCAN ──────────────────────────────────────────────────────────────────────
export function getScanSnapshot(jobId: string): AccountScanSnapshot | null {
  const j = scanJobs.get(jobId);
  if (!j) return null;
  const { startedAt: _i, ...snap } = j;
  return snap;
}

// Démarre un scan (non awaité par la route). Retourne le snapshot initial.
// Facturation du job : de quoi rembourser si le scrape n'aboutit pas.
interface ScanBilling {
  userId: string;
  costCents: number;
}

export function startScanJob(
  rawUrl: string,
  windowDays: number,
  topCount: number,
  billing?: ScanBilling
): AccountScanSnapshot | { error: string } {
  const target = parseAccountUrl(rawUrl);
  if (!target) return { error: "Lien de compte invalide (colle une URL Instagram ou TikTok, ou @pseudo)." };

  const jobId = newId("scan");
  const job: ScanJob = {
    jobId,
    target,
    windowDays,
    topCount,
    status: "scraping",
    scannedCount: 0,
    videos: [],
    startedAt: Date.now(),
  };
  scanJobs.set(jobId, job);
  void runScan(job, billing);
  purge(scanJobs);

  const { startedAt: _i, ...snap } = job;
  return snap;
}

// Heuristique « contenu récent probablement age-restreint ».
// Les posts age-restreints sont silencieusement omis par le scraper anonyme.
// On les soupçonne quand le TROU en haut de la liste est anormal PAR RAPPORT À
// LA CADENCE du compte : un compte qui poste tous les 2 jours mais dont le
// dernier reel visible date de 9 jours a probablement du récent masqué. Un
// compte qui poste toutes les semaines et dont le dernier date de 9 jours =
// normal, on ne dit rien. Comparer au rythme réel évite les faux positifs.
function restrictedContentNotice(videos: ScoredVideo[], windowDays: number): string | undefined {
  if (windowDays < 14) return undefined; // sur une petite fenêtre, un trou est banal

  const ts = videos
    .map((v) => (v.timestamp ? Date.parse(v.timestamp) : NaN))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a); // récent → ancien
  if (ts.length < 4) return undefined; // pas assez pour estimer une cadence

  // Intervalle MÉDIAN entre deux posts (en jours) = cadence typique du compte.
  const gaps: number[] = [];
  for (let i = 1; i < ts.length; i++) gaps.push((ts[i - 1] - ts[i]) / 86_400_000);
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];

  const daysSinceNewest = (Date.now() - ts[0]) / 86_400_000;

  // Trou en haut nettement plus grand que la cadence habituelle (≥ 2,5×), au
  // moins 4 jours, et dans la fenêtre scannée → anomalie → probable restriction.
  const anomalous =
    daysSinceNewest >= Math.max(4, median * 2.5) && daysSinceNewest < windowDays;
  if (!anomalous) return undefined;

  return (
    `Le reel visible le plus récent date de ${Math.round(daysSinceNewest)} jours, ` +
    `alors que ce compte poste en moyenne tous les ${Math.max(1, Math.round(median))} jours. ` +
    `Son contenu des derniers jours est peut-être age-restreint — invisible en scan public.`
  );
}

async function runScan(job: ScanJob, billing?: ScanBilling): Promise<void> {
  // Rembourse intégralement : l'utilisateur a payé au clic, il ne doit jamais
  // perdre ses tokens sur un compte privé, restreint, introuvable — ni sur un
  // scrape qui ne remonte rien.
  const refund = async (why: string) => {
    if (!billing) return;
    const { recordTransaction } = await import("@/lib/tokens-server");
    await recordTransaction({
      userId: billing.userId,
      deltaCents: billing.costCents,
      reason: "scrape_refund",
      metadata: { why, handle: job.target.handle, platform: job.target.platform },
    }).catch(() => { /* best-effort : ne jamais faire échouer le job là-dessus */ });
    console.log(`[account] remboursement ${billing.costCents} tokens (${why})`);
  };

  try {
    const videos = await scrapeProfile(job.target, job.windowDays, DEFAULT_LIMIT);
    job.scannedCount = videos.length;
    job.videos = rankVideos(videos);
    job.notice = restrictedContentNotice(job.videos, job.windowDays);
    job.status = "ready";
    console.log(
      `[account] scan ${job.target.platform}/@${job.target.handle} : ` +
        `${videos.length} vidéos sur ${job.windowDays}j → top "${job.videos[0]?.score ?? "-"}"`
    );
    // Scrape techniquement réussi mais AUCUNE vidéo : rien de facturable non plus.
    if (videos.length === 0) await refund("aucune vidéo trouvée");
  } catch (e) {
    job.status = "error";
    if (e instanceof ScrapePlatformError) {
      // Panne d'infra (Apify/crédit/config) → message générique, aucun détail.
      job.errorKind = "platform";
      job.error = "Le scan a échoué pour une raison technique.";
      console.error("[account] scan échoué (plateforme) :", e.message);
    } else {
      // Erreur actionnable par l'utilisateur (privé, restreint, aucun reel…).
      job.errorKind = "user";
      job.error = e instanceof Error ? e.message : String(e);
      console.error("[account] scan échoué (user) :", job.error);
    }
    await refund(job.errorKind === "platform" ? "erreur plateforme" : job.error!);
  }
}

// ── DOWNLOAD (voie 2) ──────────────────────────────────────────────────────────
export function getDownloadSnapshot(jobId: string): AccountDownloadSnapshot | null {
  const j = dlJobs.get(jobId);
  if (!j) return null;
  const { startedAt: _i, ...snap } = j;
  return snap;
}

// Démarre le téléchargement des vidéos cochées (résolues depuis un scan).
// `selected` = vidéos scorées choisies par l'utilisateur (elles portent videoUrl
// + postUrl frais du scan). `target` sert au Referer et au re-scrape sur 403.
export function startDownloadJob(
  target: AccountTarget,
  selected: ScoredVideo[]
): AccountDownloadSnapshot {
  const jobId = newId("dl");
  const job: DownloadJob = {
    jobId,
    total: selected.length,
    done: false,
    results: [],
    startedAt: Date.now(),
  };
  dlJobs.set(jobId, job);
  void runDownloads(job, target, selected);
  purge(dlJobs);

  const { startedAt: _i, ...snap } = job;
  return snap;
}

async function runDownloads(
  job: DownloadJob,
  target: AccountTarget,
  selected: ScoredVideo[]
): Promise<void> {
  try {
    const results = await runWithConcurrency(
      selected,
      DOWNLOAD_CONCURRENCY,
      (video) => downloadOne(target, video)
    );
    job.results = results;
  } catch (e) {
    job.error = e instanceof Error ? e.message : String(e);
    console.error("[account] download job échoué :", job.error);
  } finally {
    job.done = true;
  }
}

// Télécharge UNE vidéo (voie 2) + probe → forme UploadedVideo studio.
// Sur ExpiredUrlError (403 CDN), re-scrape ce seul post pour une URL fraîche et
// retente UNE fois (piège n°3).
async function downloadOne(target: AccountTarget, video: ScoredVideo): Promise<DownloadedVideoResult> {
  const base: DownloadedVideoResult = { sourceId: video.id, ok: false };
  try {
    // IG : URL connue au scan. TikTok : null → résolue à la demande (re-scrape
    // du post avec download activé, seulement sur les vidéos choisies).
    let url = video.videoUrl ?? (await resolveVideoUrlForDownload(target, video.postUrl));
    if (!url) throw new Error("Impossible d'obtenir l'URL vidéo de ce post");

    let file;
    try {
      file = await downloadToStore(url, target.platform);
    } catch (e) {
      // URL CDN expirée (surtout IG) → on re-résout une URL fraîche et on retente.
      if (e instanceof ExpiredUrlError) {
        const fresh = await resolveVideoUrlForDownload(target, video.postUrl);
        if (!fresh) throw new Error("URL expirée et re-scrape sans URL fraîche");
        file = await downloadToStore(fresh, target.platform);
      } else {
        throw e;
      }
    }

    // Probe → durée/format, comme un upload studio classique.
    const probe = await probeVideo(file.absPath);
    const format = await detectFormat(file.absPath, probe);
    return {
      ...base,
      ok: true,
      uploadedId: file.storedId,
      name: `${target.handle}_${video.rank}.mp4`,
      durationLabel: formatDuration(probe.durationSec),
      sizeMo: Math.max(1, Math.round(file.sizeBytes / 1_000_000)),
    };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }
}

// Supprime un fichier téléchargé (nettoyage après envoi vers duplication/Drive).
export async function cleanupDownloaded(storedId: string): Promise<void> {
  if (!/^src_[A-Za-z0-9_]+\.mp4$/.test(storedId)) return; // garde anti-traversal
  await fs.unlink(path.join(UPLOADS_DIR, storedId)).catch(() => {});
}

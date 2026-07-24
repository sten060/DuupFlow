// ⭐ VOIE 2 — Téléchargement d'une vidéo depuis son URL CDN DIRECTE (celle que
// le scraper Apify renvoie déjà), en streaming vers le stockage local.
//
// Les 3 pièges, gérés ici :
//   1. STREAM, jamais de buffer complet en RAM (cf. incident OOM ffmpeg) →
//      on pipe response.body → createWriteStream, aucun .arrayBuffer().
//   2. HEADERS CDN : User-Agent navigateur + Referer, sinon 403 aléatoires.
//   3. EXPIRATION : ces URLs sont signées et périment (quelques heures). Un 403
//      lève ExpiredUrlError → l'appelant peut re-scraper ce seul post pour une
//      URL fraîche et réessayer. C'est pourquoi le download DOIT suivre le scrape
//      dans le même job (jamais renvoyer l'URL au front pour plus tard).

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { UPLOADS_DIR, ensureStudioDirs } from "@/lib/studio/local-store";
import type { SocialPlatform } from "./types";

// Erreur typée : l'URL CDN a expiré (403/410) → l'appelant re-scrape et retente.
export class ExpiredUrlError extends Error {
  constructor(msg = "URL CDN expirée") {
    super(msg);
    this.name = "ExpiredUrlError";
  }
}

const MAX_BYTES = 300 * 1024 * 1024; // 300 Mo — garde-fou (un reel dépasse rarement 50 Mo)
const DOWNLOAD_TIMEOUT_MS = 120_000;

// Referer par plateforme — certains CDN refusent sans (piège n°2).
const REFERER: Record<SocialPlatform, string> = {
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/",
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export interface DownloadedFile {
  storedId: string; // nom de fichier sur disque (ex: "src_1720000000_ab12.mp4")
  absPath: string;
  sizeBytes: number;
}

// Télécharge `videoUrl` en streaming vers .studio-local/uploads sous un nom
// généré par NOUS (jamais de nom utilisateur → pas de path-traversal).
// Lève ExpiredUrlError sur 403/410 ; Error générique sinon.
export async function downloadToStore(
  videoUrl: string,
  platform: SocialPlatform
): Promise<DownloadedFile> {
  await ensureStudioDirs();

  const storedId = `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp4`;
  const absPath = path.join(UPLOADS_DIR, storedId);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const res = await fetch(videoUrl, {
      // Piège n°2 : headers navigateur, sinon le CDN peut renvoyer 403.
      headers: {
        "User-Agent": UA,
        Referer: REFERER[platform],
        Accept: "*/*",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    // Piège n°3 : URL périmée → erreur typée pour re-scrape + retry.
    if (res.status === 403 || res.status === 410) {
      throw new ExpiredUrlError(`CDN a renvoyé ${res.status}`);
    }
    if (!res.ok || !res.body) {
      throw new Error(`Téléchargement échoué (HTTP ${res.status})`);
    }

    // Garde-fou taille via Content-Length quand présent (avant même de streamer).
    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) {
      throw new Error(`Vidéo trop lourde (${Math.round(declared / 1_000_000)} Mo)`);
    }

    // Piège n°1 : STREAM web → Node Readable → fichier, sans jamais tout charger
    // en mémoire. pipeline() propage les erreurs et ferme les descripteurs.
    const nodeStream = Readable.fromWeb(res.body as any);
    let written = 0;
    nodeStream.on("data", (chunk: Buffer) => {
      written += chunk.length;
      if (written > MAX_BYTES) nodeStream.destroy(new Error("Vidéo trop lourde (dépasse 300 Mo)"));
    });

    const out = fsSync.createWriteStream(absPath);
    await pipeline(nodeStream, out);

    const { size } = await fs.stat(absPath);
    if (size === 0) throw new Error("Fichier téléchargé vide");
    return { storedId, absPath, sizeBytes: size };
  } catch (e) {
    // Nettoyage du fichier partiel en cas d'échec.
    await fs.unlink(absPath).catch(() => {});
    if ((e as Error)?.name === "AbortError") {
      throw new Error("Téléchargement expiré (timeout)");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Pool de concurrence simple : télécharge `items` par lots de `concurrency`
// (piège : 3-5 max, sinon le CDN rate-limit). Chaque tâche est indépendante ;
// un échec n'arrête pas les autres (résultat par tâche via le callback).
export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await task(items[i], i);
    }
  }

  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), items.length || 1) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

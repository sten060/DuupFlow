// src/lib/ai-editor/material-ingest.ts
//
// AJOUT D'UNE MATIÈRE dans un projet de l'Éditeur IA — la seule porte d'entrée,
// partagée par l'upload de l'app (/api/ai-editor/material) et par le MCP
// (add_material : Claude dépose lui-même un fichier depuis Google Drive ou un
// lien). Mêmes limites, même analyse, même préparation SDR : un fichier ajouté
// par Claude est indiscernable d'un fichier déposé à la main.
//
// + les téléchargements côté serveur utilisés par add_material :
//   • downloadDriveFile / listDriveFolder : via le compte de service ;
//   • downloadPublicUrl : lien https public, protégé contre le SSRF (pas
//     d'adresse interne, IP vérifiée AU MOMENT de la connexion, redirections
//     revalidées, taille et durée plafonnées).

import fs from "fs/promises";
import { createWriteStream } from "fs";
import os from "os";
import path from "path";
import https from "https";
import dns from "dns";
import net from "net";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { analyzeMaterial, probeDurationSec } from "./analyze";
import { prepareSdrProxy } from "./render";
import { addMaterial, updateMaterialAnalysis, materialAbsPath, type ProjectMaterial } from "./store";
import { driveAccessToken, explainDriveError } from "@/lib/google-service-account";

export const MATERIAL_MAX_BYTES = 300 * 1024 * 1024;
// Plafonds de durée (grâce de 3 s pour l'arrondi) : vidéo 2 min, audio seul 4 min.
const MAT_VIDEO_MAX_SEC = 120;
const MAT_AUDIO_MAX_SEC = 240;

export type MaterialKind = "video" | "image" | "audio";

export function materialKind(mimeType: string, fileName: string): MaterialKind {
  if (mimeType.startsWith("image")) return "image";
  if (mimeType.startsWith("audio") || /\.(mp3|m4a|wav|aac|ogg|flac)$/i.test(fileName)) return "audio";
  return "video";
}

export function isSupportedMedia(mimeType: string, fileName: string): boolean {
  return /^(video|image|audio)\//.test(mimeType) || /\.(mp4|mov|m4v|mkv|webm|jpe?g|png|webp|heic|heif|mp3|m4a|wav|aac|ogg|flac)$/i.test(fileName);
}

/**
 * Ajoute un fichier DÉJÀ sur disque (tmpPath) au projet. Le fichier temporaire
 * est copié par le store : l'appelant reste responsable de le supprimer.
 */
export async function ingestMaterialFile(opts: {
  storeKey: string;
  projectId: string;
  tmpPath: string;
  fileName: string;
  mimeType: string;
  desc: string;
  logTag?: string;
}): Promise<{ ok: true; material: ProjectMaterial } | { ok: false; status: number; error: string }> {
  const { storeKey, projectId, tmpPath, fileName, mimeType, desc } = opts;
  const tag = opts.logTag ?? "ai-editor/material";
  const kind = materialKind(mimeType, fileName);
  const ext = fileName.match(/\.[a-z0-9]+$/i)?.[0] || (kind === "image" ? ".jpg" : kind === "audio" ? ".mp3" : ".mp4");

  // Garde de durée (vidéo 2 min, audio 4 min) — AVANT toute analyse coûteuse.
  if (kind !== "image") {
    const dur = await probeDurationSec(tmpPath).catch(() => 0);
    const cap = kind === "audio" ? MAT_AUDIO_MAX_SEC : MAT_VIDEO_MAX_SEC;
    if (dur > cap + 3) {
      const mm = Math.floor(cap / 60);
      return { ok: false, status: 413, error: `Fichier trop long (${Math.round(dur)} s). Maximum ${mm} min pour ${kind === "audio" ? "un audio" : "une vidéo"}.` };
    }
  }

  if (kind === "image") {
    // Image : analyse rapide (vignette/dims) → inline.
    const analysis = await analyzeMaterial(tmpPath, mimeType).catch((e) => { console.error(`[${tag}] analyse image KO:`, (e as Error)?.message); return null; });
    const material = await addMaterial(storeKey, projectId, { srcPath: tmpPath, ext, name: fileName, kind, desc, analysis, status: analysis ? "ready" : "failed" });
    if (!material) return { ok: false, status: 500, error: "Projet introuvable ou copie échouée." };
    return { ok: true, material };
  }

  // Audio / vidéo : analyse LONGUE (transcription, beats, drops). On persiste TOUT
  // DE SUITE (status "analyzing") pour que list_material le voie immédiatement,
  // puis on analyse en tâche de fond.
  const material = await addMaterial(storeKey, projectId, { srcPath: tmpPath, ext, name: fileName, kind, desc, analysis: null, status: "analyzing" });
  if (!material) return { ok: false, status: 500, error: "Projet introuvable ou copie échouée." };
  const absPath = materialAbsPath(storeKey, projectId, material.storedName); // fichier déjà persisté
  void (async () => {
    try {
      const analysis = await analyzeMaterial(absPath, mimeType);
      await updateMaterialAnalysis(storeKey, projectId, material.id, analysis, "ready");
      console.log(`[${tag}] analyse terminée : ${fileName} (id ${material.id})`);
      // Rush HDR (iPhone) → version SDR préparée MAINTENANT, pas au premier montage.
      if (kind === "video") await prepareSdrProxy(absPath);
    } catch (e) {
      console.error(`[${tag}] analyse échouée : ${fileName} (id ${material.id})`, e);
      await updateMaterialAnalysis(storeKey, projectId, material.id, null, "failed");
    }
  })().catch((e) => console.error(`[${tag}] tâche de fond en échec dur : ${fileName}`, e));
  return { ok: true, material };
}

/* ── Téléchargements côté serveur (MCP add_material) ───────────────────────── */

export type Downloaded = { tmpDir: string; tmpPath: string; fileName: string; mimeType: string; bytes: number };

async function newTmp(fileName: string): Promise<{ tmpDir: string; tmpPath: string }> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_mcpmat_"));
  const ext = fileName.match(/\.[a-z0-9]+$/i)?.[0] || ".bin";
  return { tmpDir, tmpPath: path.join(tmpDir, `mat${ext}`) };
}

const DRIVE_API = "https://www.googleapis.com/drive/v3";

type DriveMeta = { id: string; name: string; mimeType: string; size?: string };

async function driveGetMeta(fileId: string, token: string): Promise<DriveMeta> {
  const res = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(explainDriveError(res.status, await res.text().catch(() => "")));
  return res.json() as Promise<DriveMeta>;
}

/** Les fichiers médias d'un dossier Drive partagé avec le compte de service. */
export async function listDriveFolder(folderId: string, max = 10): Promise<DriveMeta[]> {
  const token = await driveAccessToken();
  const q = encodeURIComponent(`'${folderId.replace(/'/g, "")}' in parents and trashed = false`);
  const res = await fetch(
    `${DRIVE_API}/files?q=${q}&fields=files(id,name,mimeType,size)&pageSize=100&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(explainDriveError(res.status, await res.text().catch(() => "")));
  const files = ((await res.json()) as { files?: DriveMeta[] }).files ?? [];
  return files.filter((f) => isSupportedMedia(f.mimeType, f.name)).slice(0, max);
}

/** Télécharge un fichier Drive (partagé avec le compte de service) sur disque. */
export async function downloadDriveFile(fileId: string): Promise<Downloaded> {
  const token = await driveAccessToken();
  const meta = await driveGetMeta(fileId, token);
  if (meta.mimeType.startsWith("application/vnd.google-apps")) {
    throw new Error(`« ${meta.name} » est un document Google (pas un fichier média) : impossible à utiliser comme matière.`);
  }
  if (!isSupportedMedia(meta.mimeType, meta.name)) {
    throw new Error(`« ${meta.name} » n'est ni une vidéo, ni une image, ni un audio (${meta.mimeType}).`);
  }
  if (meta.size && Number(meta.size) > MATERIAL_MAX_BYTES) {
    throw new Error(`« ${meta.name} » est trop lourd (${Math.round(Number(meta.size) / 1e6)} Mo, max 300 Mo).`);
  }
  const res = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok || !res.body) throw new Error(explainDriveError(res.status, await res.text().catch(() => "")));
  const { tmpDir, tmpPath } = await newTmp(meta.name);
  try {
    const bytes = await streamToFile(Readable.fromWeb(res.body as never), tmpPath);
    return { tmpDir, tmpPath, fileName: meta.name, mimeType: meta.mimeType, bytes };
  } catch (e) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw e;
  }
}

/** Écrit un flux sur disque en coupant net au-delà de MATERIAL_MAX_BYTES. */
async function streamToFile(stream: Readable, dest: string): Promise<number> {
  let bytes = 0;
  stream.on("data", (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > MATERIAL_MAX_BYTES) stream.destroy(new Error("Fichier trop lourd (max 300 Mo)."));
  });
  await pipeline(stream, createWriteStream(dest));
  return bytes;
}

/* ── Lien https public, protégé contre le SSRF ──
   Claude peut recevoir des liens de n'importe où : le serveur ne doit JAMAIS
   aller lire une adresse interne (métadonnées cloud, réseau privé, localhost).
   L'IP est vérifiée DANS le lookup de la connexion elle-même → pas de
   contournement par un DNS qui change de réponse entre la vérif et l'appel. */

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const low = ip.toLowerCase();
  if (low.startsWith("::ffff:")) return isPrivateIp(low.slice(7));
  return low === "::1" || low === "::" || low.startsWith("fc") || low.startsWith("fd") || low.startsWith("fe80");
}

const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = (addresses as unknown as dns.LookupAddress[]) ?? [];
    const bad = list.find((a) => isPrivateIp(a.address));
    if (!list.length || bad) return callback(new Error("Adresse interne refusée."), "", 0);
    if ((options as dns.LookupOptions).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

function getOnce(url: URL): Promise<import("http").IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { lookup: safeLookup, timeout: 30_000, headers: { "User-Agent": "DuupFlow-Material/1.0" } }, resolve);
    req.on("timeout", () => req.destroy(new Error("Le lien ne répond pas (délai dépassé).")));
    req.on("error", reject);
  });
}

export async function downloadPublicUrl(rawUrl: string): Promise<Downloaded> {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error("Lien invalide."); }
  for (let hop = 0; hop < 4; hop++) {
    if (url.protocol !== "https:") throw new Error("Seuls les liens https sont acceptés.");
    if (net.isIP(url.hostname) && isPrivateIp(url.hostname)) throw new Error("Adresse interne refusée.");
    const res = await getOnce(url);
    const status = res.statusCode ?? 0;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      url = new URL(res.headers.location, url); // redirection revalidée au tour suivant
      continue;
    }
    if (status !== 200) { res.resume(); throw new Error(`Le lien répond ${status}.`); }
    const mimeType = String(res.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    const fromDisposition = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(String(res.headers["content-disposition"] || ""))?.[1];
    const fileName = decodeURIComponent(fromDisposition || path.basename(url.pathname) || "fichier");
    if (!isSupportedMedia(mimeType, fileName)) {
      res.resume();
      throw new Error(`Ce lien ne renvoie pas une vidéo, une image ou un audio (${mimeType || "type inconnu"}). Il faut un lien de téléchargement DIRECT, pas une page web.`);
    }
    const len = Number(res.headers["content-length"] || 0);
    if (len > MATERIAL_MAX_BYTES) { res.resume(); throw new Error(`Fichier trop lourd (${Math.round(len / 1e6)} Mo, max 300 Mo).`); }
    const { tmpDir, tmpPath } = await newTmp(fileName);
    try {
      const bytes = await streamToFile(res, tmpPath);
      return { tmpDir, tmpPath, fileName, mimeType: mimeType || "video/mp4", bytes };
    } catch (e) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      throw e;
    }
  }
  throw new Error("Trop de redirections.");
}

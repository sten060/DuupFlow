// src/lib/brief-images.ts
//
// IMAGES DU BRIEF d'un créateur — jusqu'à 10 images de référence (style de
// captions, ambiance, cadrages, exemples de posts…) que Claude VOIT, en plus du
// texte du brief. PERMANENTES : elles ne disparaissent que si le user les
// supprime ou supprime le créateur.
//
// Stockage sur le volume persistant, sous-dossier dédié :
//   OUT_BASE/wsbrief_<workspaceId>/images/<id>.jpg  + images/meta.json
// ⚠️ Toujours dans le SOUS-dossier images/ : le nettoyage horaire
// (cleanupOldFiles) efface les fichiers posés à la racine de chaque dossier de
// OUT_BASE, jamais ceux des sous-dossiers.
//
// Chaque image est normalisée à l'envoi (orientation corrigée, 1568 px max, JPEG)
// : c'est la taille que Claude lit le mieux, et 10 images restent légères.

import fs from "fs/promises";
import os from "os";
import path from "path";
import sharp from "sharp";

const OUT_BASE = process.env.OUT_BASE
  ?? (process.env.VERCEL ? path.join(os.tmpdir(), "duupflow") : path.join(process.cwd(), "public", "out"));

export const BRIEF_IMAGES_MAX = 10;
export const BRIEF_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
const MAX_EDGE = 1568;

export type BriefImage = { id: string; name: string; width: number; height: number; createdAt: number };

const ID_RE = /^[a-z0-9]{6,20}$/;
const WS_RE = /^[0-9a-f-]{36}$/;

function rootDir(workspaceId: string) {
  if (!WS_RE.test(workspaceId)) throw new Error("workspace invalide");
  return path.join(OUT_BASE, `wsbrief_${workspaceId}`);
}
function imagesDir(workspaceId: string) { return path.join(rootDir(workspaceId), "images"); }
function metaFile(workspaceId: string) { return path.join(imagesDir(workspaceId), "meta.json"); }

export async function listBriefImages(workspaceId: string): Promise<BriefImage[]> {
  try {
    const list = JSON.parse(await fs.readFile(metaFile(workspaceId), "utf8")) as BriefImage[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function writeMeta(workspaceId: string, list: BriefImage[]) {
  await fs.mkdir(imagesDir(workspaceId), { recursive: true });
  const tmp = `${metaFile(workspaceId)}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(list), "utf8");
  await fs.rename(tmp, metaFile(workspaceId)); // écriture atomique
}

/* Verrou par créateur : deux envois simultanés ne doivent ni dépasser la
   limite de 10 ni s'écraser la liste (même principe que le store de l'éditeur). */
const chains = new Map<string, Promise<unknown>>();
function withLock<T>(workspaceId: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(workspaceId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  chains.set(workspaceId, run.then(() => {}, () => {}));
  return run;
}

export async function addBriefImage(
  workspaceId: string,
  input: Buffer,
  name: string,
): Promise<{ ok: true; image: BriefImage } | { ok: false; error: string }> {
  return withLock(workspaceId, async () => {
    const list = await listBriefImages(workspaceId);
    if (list.length >= BRIEF_IMAGES_MAX) return { ok: false, error: `Maximum ${BRIEF_IMAGES_MAX} images par créateur.` };
    let out: { data: Buffer; info: sharp.OutputInfo };
    try {
      out = await sharp(input, { failOn: "none" })
        .rotate() // orientation EXIF (photos de téléphone)
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" }) // PNG transparent → fond blanc
        .jpeg({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      return { ok: false, error: `« ${name} » n'est pas une image lisible.` };
    }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await fs.mkdir(imagesDir(workspaceId), { recursive: true });
    await fs.writeFile(path.join(imagesDir(workspaceId), `${id}.jpg`), out.data);
    const image: BriefImage = { id, name: name.slice(0, 120), width: out.info.width, height: out.info.height, createdAt: Date.now() };
    await writeMeta(workspaceId, [...list, image]);
    return { ok: true, image };
  });
}

export async function removeBriefImage(workspaceId: string, imageId: string): Promise<boolean> {
  if (!ID_RE.test(imageId)) return false;
  return withLock(workspaceId, async () => {
    const list = await listBriefImages(workspaceId);
    if (!list.some((i) => i.id === imageId)) return false;
    await fs.unlink(path.join(imagesDir(workspaceId), `${imageId}.jpg`)).catch(() => {});
    await writeMeta(workspaceId, list.filter((i) => i.id !== imageId));
    return true;
  });
}

/** Suppression du créateur → ses images partent avec lui. */
export async function removeAllBriefImages(workspaceId: string): Promise<void> {
  await fs.rm(rootDir(workspaceId), { recursive: true, force: true }).catch(() => {});
}

export async function readBriefImage(workspaceId: string, imageId: string): Promise<Buffer | null> {
  if (!ID_RE.test(imageId)) return null;
  try { return await fs.readFile(path.join(imagesDir(workspaceId), `${imageId}.jpg`)); } catch { return null; }
}

/** Les images en base64, prêtes à être montrées à Claude (MCP, IA automatique). */
export async function briefImagesForClaude(workspaceId: string): Promise<{ name: string; data: string; mimeType: "image/jpeg" }[]> {
  const list = await listBriefImages(workspaceId);
  const out: { name: string; data: string; mimeType: "image/jpeg" }[] = [];
  for (const img of list) {
    const buf = await readBriefImage(workspaceId, img.id);
    if (buf) out.push({ name: img.name, data: buf.toString("base64"), mimeType: "image/jpeg" });
  }
  return out;
}

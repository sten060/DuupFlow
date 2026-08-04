// src/lib/ai-editor/store.ts
//
// Persistance de l'Éditeur IA — sur le volume, par user (même base que les
// sorties vidéo : OUT_BASE/<userId>/ai-editor/<projectId>/). Aucune migration DB
// nécessaire. Un « projet » = une référence analysée + de la matière.
//
//   OUT_BASE/<userId>/ai-editor/<projectId>/
//     project.json          → métadonnées + analyses (keyframes en data URI)
//     reference.<ext>        → la vidéo de référence (pour le rendu ultérieur)
//     material/<id>.<ext>    → les fichiers de matière du user
//
// C'est ce que le futur serveur MCP lira pour donner à Claude la réf + la matière.

import fs from "fs/promises";
import os from "os";
import path from "path";
import type { ReferenceAnalysis, MaterialAnalysis } from "./analyze";

// Même base que les sorties vidéo (OUT_BASE) — volume persistant en prod.
// Découplé de dashboard/utils pour ne pas tirer l'auth ici.
const OUT_BASE = process.env.OUT_BASE
  ?? (process.env.VERCEL ? path.join(os.tmpdir(), "duupflow") : path.join(process.cwd(), "public", "out"));

export type MaterialStatus = "analyzing" | "ready" | "failed";
export type ProjectMaterial = {
  id: string;
  name: string;
  kind: "video" | "image" | "audio";
  desc: string;
  storedName: string;
  analysis: MaterialAnalysis | null;
  status?: MaterialStatus;   // "analyzing" tant que l'analyse (audio/vidéo/Gemini) tourne
};

export type ProjectReference = {
  source: "file" | "url";
  label: string;
  storedName: string;
  analysis: ReferenceAnalysis;
};

export type ProjectVariant = {
  id: string;
  createdAt: number;
  storedName: string;   // variants/<id>.mp4
  poster: string | null; // vignette (data URI)
  label?: string;
  durationSec?: number;      // durée du rendu (affichée dans list_variants)
  derivedFrom?: string;      // id de la variante dont elle dérive (update_variant)
  plan?: Record<string, unknown>; // le EditPlan utilisé → permet update_variant (patch)
};

export type Project = {
  id: string;
  createdAt: number;
  updatedAt: number;
  reference: ProjectReference | null;
  materials: ProjectMaterial[];
  variants: ProjectVariant[];
};

const ID_RE = /^[a-z0-9]{6,}$/;
const rid = (n = 7) => Math.random().toString(36).slice(2, 2 + n);
function newProjectId(): string {
  return Date.now().toString(36) + rid(6);
}

function userRoot(userId: string) { return path.join(OUT_BASE, userId, "ai-editor"); }
function projectDir(userId: string, id: string) { return path.join(userRoot(userId), id); }
function projectFile(userId: string, id: string) { return path.join(projectDir(userId, id), "project.json"); }

/** Chemins absolus d'un projet — exposés au moteur de rendu. */
export function projectPaths(userId: string, projectId: string) {
  const dir = projectDir(userId, projectId);
  return { dir, materialDir: path.join(dir, "material"), variantsDir: path.join(dir, "variants") };
}
/** Chemin absolu d'un fichier de matière (par storedName). */
export function materialAbsPath(userId: string, projectId: string, storedName: string): string {
  return path.join(projectDir(userId, projectId), "material", storedName);
}

async function write(userId: string, p: Project): Promise<void> {
  p.updatedAt = Date.now();
  await fs.writeFile(projectFile(userId, p.id), JSON.stringify(p), "utf8");
}

/* ── Verrou d'écriture PAR PROJET ─────────────────────────────────────────────
   project.json est modifié par read-modify-write. Les uploads (l'UI en envoie
   plusieurs EN PARALLÈLE) + les analyses async concurrentes s'écrasaient → des
   matières se perdaient silencieusement. On sérialise toutes les mutations d'un
   même projet via une chaîne de promesses (mono-réplica → suffit). */
const _writeChain = new Map<string, Promise<unknown>>();
function withLock<T>(userId: string, projectId: string, fn: () => Promise<T>): Promise<T> {
  const key = `${userId}::${projectId}`;
  const prev = _writeChain.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn); // exécute fn après la précédente, quel que soit son sort
  _writeChain.set(key, run.then(() => {}, () => {}));
  return run;
}

export async function createProject(userId: string): Promise<Project> {
  const id = newProjectId();
  await fs.mkdir(path.join(projectDir(userId, id), "material"), { recursive: true });
  await fs.mkdir(path.join(projectDir(userId, id), "variants"), { recursive: true });
  const now = Date.now();
  const p: Project = { id, createdAt: now, updatedAt: now, reference: null, materials: [], variants: [] };
  await write(userId, p);
  return p;
}

export async function getProject(userId: string, projectId: string): Promise<Project | null> {
  if (!ID_RE.test(projectId)) return null;
  try {
    const p = JSON.parse(await fs.readFile(projectFile(userId, projectId), "utf8")) as Project;
    if (!Array.isArray(p.variants)) p.variants = []; // rétro-compat
    if (!Array.isArray(p.materials)) p.materials = [];
    return p;
  } catch {
    return null;
  }
}

export async function getLatestProject(userId: string): Promise<Project | null> {
  try {
    const entries = await fs.readdir(userRoot(userId), { withFileTypes: true });
    const projects = (
      await Promise.all(entries.filter((e) => e.isDirectory()).map((e) => getProject(userId, e.name)))
    ).filter((x): x is Project => !!x);
    projects.sort((a, b) => b.updatedAt - a.updatedAt);
    return projects[0] ?? null;
  } catch {
    return null;
  }
}

/** Copie la vidéo de référence dans le projet + enregistre son analyse/recette. */
export async function saveReference(
  userId: string,
  projectId: string,
  opts: { srcPath: string; ext: string; source: "file" | "url"; label: string; analysis: ReferenceAnalysis },
): Promise<Project | null> {
  return withLock(userId, projectId, async () => {
    const p = await getProject(userId, projectId);
    if (!p) return null;
    const storedName = `reference${opts.ext.startsWith(".") ? opts.ext : `.${opts.ext}`}`;
    // Remplacement : si l'ancienne réf avait une autre extension, on retire le fichier
    // orphelin (la matière et les variantes du projet, elles, sont conservées).
    const prev = p.reference?.storedName;
    if (prev && prev !== storedName) {
      await fs.unlink(path.join(projectDir(userId, projectId), prev)).catch(() => {});
    }
    await fs.copyFile(opts.srcPath, path.join(projectDir(userId, projectId), storedName));
    p.reference = { source: opts.source, label: opts.label, storedName, analysis: opts.analysis };
    await write(userId, p);
    return p;
  });
}

/** Met à jour l'analyse de la référence SANS recopier le fichier (ré-analyse en
 *  place : régénère le profil avec le code courant, ex. couche compréhension). */
export async function updateReferenceAnalysis(
  userId: string,
  projectId: string,
  analysis: ReferenceAnalysis,
): Promise<Project | null> {
  return withLock(userId, projectId, async () => {
    const p = await getProject(userId, projectId);
    if (!p || !p.reference) return null;
    p.reference = { ...p.reference, analysis };
    await write(userId, p);
    return p;
  });
}

/** Chemin absolu du fichier de référence stocké (pour une ré-analyse en place). */
export function referenceAbsPath(userId: string, projectId: string, storedName: string): string {
  return path.join(projectDir(userId, projectId), storedName);
}

/** Ajoute un fichier de matière (copié dans material/) + son analyse. */
export async function addMaterial(
  userId: string,
  projectId: string,
  opts: { srcPath: string; ext: string; name: string; kind: "video" | "image" | "audio"; desc: string; analysis: MaterialAnalysis | null; status?: MaterialStatus },
): Promise<ProjectMaterial | null> {
  const id = rid(8);
  const storedName = `${id}${opts.ext.startsWith(".") ? opts.ext : `.${opts.ext}`}`;
  // Copie du fichier HORS verrou (nom unique → aucune contention).
  try { await fs.copyFile(opts.srcPath, materialAbsPath(userId, projectId, storedName)); }
  catch (e) { console.error(`[ai-editor/store] copie matière échouée (${opts.name}):`, (e as Error)?.message); return null; }
  // La ligne en base sous VERROU (sérialisé avec les autres uploads/analyses).
  return withLock(userId, projectId, async () => {
    const p = await getProject(userId, projectId);
    if (!p) return null;
    const material: ProjectMaterial = { id, name: opts.name, kind: opts.kind, desc: opts.desc, storedName, analysis: opts.analysis, status: opts.status ?? "ready" };
    p.materials.push(material);
    await write(userId, p);
    return material;
  });
}

/** Met à jour l'analyse + le statut d'une matière (fin d'ingestion async). */
export async function updateMaterialAnalysis(
  userId: string, projectId: string, materialId: string, analysis: MaterialAnalysis | null, status: MaterialStatus,
): Promise<boolean> {
  return withLock(userId, projectId, async () => {
    const p = await getProject(userId, projectId);
    if (!p) return false;
    const m = p.materials.find((x) => x.id === materialId);
    if (!m) return false;
    m.analysis = analysis;
    m.status = status;
    await write(userId, p);
    return true;
  });
}

/** Enregistre une variante rendue (mp4 copié dans variants/) + sa vignette. */
export async function addVariant(
  userId: string,
  projectId: string,
  opts: { srcPath: string; poster: string | null; label?: string; plan?: Record<string, unknown>; durationSec?: number; derivedFrom?: string },
): Promise<ProjectVariant | null> {
  const id = rid(8);
  const storedName = `${id}.mp4`;
  await fs.mkdir(path.join(projectDir(userId, projectId), "variants"), { recursive: true });
  try { await fs.copyFile(opts.srcPath, path.join(projectDir(userId, projectId), "variants", storedName)); }
  catch (e) { console.error("[ai-editor/store] copie variante échouée:", (e as Error)?.message); return null; }
  return withLock(userId, projectId, async () => {
    const p = await getProject(userId, projectId);
    if (!p) return null;
    const variant: ProjectVariant = { id, createdAt: Date.now(), storedName, poster: opts.poster, label: opts.label, durationSec: opts.durationSec, derivedFrom: opts.derivedFrom, plan: opts.plan };
    p.variants.unshift(variant); // la plus récente en premier
    await write(userId, p);
    return variant;
  });
}

export async function updateMaterialDesc(userId: string, projectId: string, materialId: string, desc: string): Promise<boolean> {
  return withLock(userId, projectId, async () => {
    const p = await getProject(userId, projectId);
    if (!p) return false;
    const m = p.materials.find((x) => x.id === materialId);
    if (!m) return false;
    m.desc = desc.slice(0, 500);
    await write(userId, p);
    return true;
  });
}

export async function removeMaterial(userId: string, projectId: string, materialId: string): Promise<boolean> {
  return withLock(userId, projectId, async () => {
    const p = await getProject(userId, projectId);
    if (!p) return false;
    const idx = p.materials.findIndex((x) => x.id === materialId);
    if (idx < 0) return false;
    const [m] = p.materials.splice(idx, 1);
    await fs.unlink(path.join(projectDir(userId, projectId), "material", m.storedName)).catch(() => {});
    await write(userId, p);
    return true;
  });
}

/** Supprime une variante (fichier mp4 + entrée). */
export async function removeVariant(userId: string, projectId: string, variantId: string): Promise<boolean> {
  return withLock(userId, projectId, async () => {
    const p = await getProject(userId, projectId);
    if (!p) return false;
    const idx = p.variants.findIndex((x) => x.id === variantId);
    if (idx < 0) return false;
    const [v] = p.variants.splice(idx, 1);
    await fs.unlink(path.join(projectDir(userId, projectId), "variants", v.storedName)).catch(() => {});
    await write(userId, p);
    return true;
  });
}

/** Purge les variantes plus vieilles que maxAgeMs (fichier + entrée), pour TOUS
 *  les projets de TOUS les users — même politique de rétention que les sorties de
 *  duplication (appelée par le cron cleanup). La référence et la matière (les
 *  INTRANTS du projet) sont conservées ; seules les variantes rendues expirent. */
export async function cleanupOldVariants(maxAgeMs: number): Promise<number> {
  let removed = 0;
  const now = Date.now();
  let userDirs: import("fs").Dirent[];
  try { userDirs = await fs.readdir(OUT_BASE, { withFileTypes: true }); } catch { return 0; }
  for (const ue of userDirs) {
    if (!ue.isDirectory()) continue;
    let projDirs: import("fs").Dirent[];
    try { projDirs = await fs.readdir(userRoot(ue.name), { withFileTypes: true }); } catch { continue; }
    for (const pe of projDirs) {
      if (!pe.isDirectory()) continue;
      const p = await getProject(ue.name, pe.name);
      if (!p || !p.variants.length) continue;
      const keep: ProjectVariant[] = [];
      let changed = false;
      for (const v of p.variants) {
        if (now - v.createdAt > maxAgeMs) {
          await fs.unlink(path.join(projectDir(ue.name, pe.name), "variants", v.storedName)).catch(() => {});
          removed++; changed = true;
        } else keep.push(v);
      }
      if (changed) { p.variants = keep; await write(ue.name, p); }
    }
  }
  return removed;
}

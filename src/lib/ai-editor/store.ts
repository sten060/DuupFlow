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

export type ProjectMaterial = {
  id: string;
  name: string;
  kind: "video" | "image";
  desc: string;
  storedName: string;
  analysis: MaterialAnalysis | null;
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
  const p = await getProject(userId, projectId);
  if (!p) return null;
  const storedName = `reference${opts.ext.startsWith(".") ? opts.ext : `.${opts.ext}`}`;
  await fs.copyFile(opts.srcPath, path.join(projectDir(userId, projectId), storedName));
  p.reference = { source: opts.source, label: opts.label, storedName, analysis: opts.analysis };
  await write(userId, p);
  return p;
}

/** Ajoute un fichier de matière (copié dans material/) + son analyse. */
export async function addMaterial(
  userId: string,
  projectId: string,
  opts: { srcPath: string; ext: string; name: string; kind: "video" | "image"; desc: string; analysis: MaterialAnalysis | null },
): Promise<ProjectMaterial | null> {
  const p = await getProject(userId, projectId);
  if (!p) return null;
  const id = rid(8);
  const storedName = `${id}${opts.ext.startsWith(".") ? opts.ext : `.${opts.ext}`}`;
  await fs.copyFile(opts.srcPath, path.join(projectDir(userId, projectId), "material", storedName));
  const material: ProjectMaterial = { id, name: opts.name, kind: opts.kind, desc: opts.desc, storedName, analysis: opts.analysis };
  p.materials.push(material);
  await write(userId, p);
  return material;
}

/** Enregistre une variante rendue (mp4 copié dans variants/) + sa vignette. */
export async function addVariant(
  userId: string,
  projectId: string,
  opts: { srcPath: string; poster: string | null; label?: string },
): Promise<ProjectVariant | null> {
  const p = await getProject(userId, projectId);
  if (!p) return null;
  const id = rid(8);
  const storedName = `${id}.mp4`;
  await fs.mkdir(path.join(projectDir(userId, projectId), "variants"), { recursive: true });
  await fs.copyFile(opts.srcPath, path.join(projectDir(userId, projectId), "variants", storedName));
  const variant: ProjectVariant = { id, createdAt: Date.now(), storedName, poster: opts.poster, label: opts.label };
  p.variants.unshift(variant); // la plus récente en premier
  await write(userId, p);
  return variant;
}

export async function updateMaterialDesc(userId: string, projectId: string, materialId: string, desc: string): Promise<boolean> {
  const p = await getProject(userId, projectId);
  if (!p) return false;
  const m = p.materials.find((x) => x.id === materialId);
  if (!m) return false;
  m.desc = desc.slice(0, 500);
  await write(userId, p);
  return true;
}

export async function removeMaterial(userId: string, projectId: string, materialId: string): Promise<boolean> {
  const p = await getProject(userId, projectId);
  if (!p) return false;
  const idx = p.materials.findIndex((x) => x.id === materialId);
  if (idx < 0) return false;
  const [m] = p.materials.splice(idx, 1);
  await fs.unlink(path.join(projectDir(userId, projectId), "material", m.storedName)).catch(() => {});
  await write(userId, p);
  return true;
}

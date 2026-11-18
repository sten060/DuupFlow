// src/lib/ai-dup/history.ts
//
// ── HISTORIQUE DES DUPLICATIONS IA ───────────────────────────────────────────
// Les tickets vivent en mémoire (jobs.ts) : sans trace écrite, « Nouvelle
// duplication » ou un redéploiement faisait perdre l'accès aux copies déjà
// faites. Chaque ticket est donc aussi écrit en JSON dans le dossier du
// créateur (OUT_BASE/<clé>/ai-dup-history/<id>.json) : au lancement, puis à
// la fin. Le nettoyage des sorties ne touche que les fichiers à la racine du
// dossier, pas ce sous-dossier.
//
// Les COPIES sont posées à la racine du dossier, comme les autres sorties, que
// le nettoyage horaire efface au bout d'~1 h. Pour tenir la promesse « gardée
// 5 jours », cleanupOldFiles demande à keptAiDupCopies() la liste des copies
// encore couvertes par un historique de moins de 5 jours et les épargne.
// À la relecture, une copie dont le fichier a disparu est marquée `expired`.

import fs from "fs/promises";
import path from "path";
import { creatorOutDir } from "@/lib/creator-out-dir";
import { JOB_ID_PREFIX } from "./config";
import type { AiDupJob } from "./types";

/** Entrées gardées par créateur (les plus anciennes sont supprimées). */
const HISTORY_KEEP = 30;

/** Une duplication (entrée + copies) est supprimée d'office après 5 jours si
 *  le user ne l'a pas fait (décision Sten, 16/11). */
export const HISTORY_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export type HistoryMeta = { materialName: string; thumb: string | null };
type Saved = { meta: HistoryMeta; job: AiDupJob };

const dirOf = (storeKey: string) => path.join(creatorOutDir(storeKey), "ai-dup-history");
const validId = (id: string) => new RegExp(`^${JOB_ID_PREFIX}[a-z0-9]{4,20}$`).test(id);

export async function saveHistory(job: AiDupJob, meta: HistoryMeta): Promise<void> {
  const dir = dirOf(job.storeKey);
  try {
    await fs.mkdir(dir, { recursive: true });
    const tmp = path.join(dir, `${job.id}.json.part`);
    await fs.writeFile(tmp, JSON.stringify({ meta, job } satisfies Saved));
    await fs.rename(tmp, path.join(dir, `${job.id}.json`));
    if (job.finishedAt) await prune(dir);
  } catch (e) {
    console.warn(`[ai-dup/history] ${job.id} non enregistré :`, (e as Error).message);
  }
}

async function prune(dir: string) {
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  if (files.length <= HISTORY_KEEP) return;
  const stats = await Promise.all(files.map(async (f) => ({ f, t: (await fs.stat(path.join(dir, f))).mtimeMs })));
  for (const { f } of stats.sort((a, b) => b.t - a.t).slice(HISTORY_KEEP)) await fs.rm(path.join(dir, f), { force: true });
}

/** Relit un ticket enregistré. Un ticket jamais terminé (serveur redémarré
 *  en cours de route) est rendu comme interrompu ; les copies dont le
 *  fichier a été nettoyé sont marquées expirées. */
export async function loadHistory(id: string, storeKey: string): Promise<(Saved & { job: AiDupJob }) | null> {
  if (!validId(id)) return null;
  let saved: Saved;
  try { saved = JSON.parse(await fs.readFile(path.join(dirOf(storeKey), `${id}.json`), "utf8")); } catch { return null; }
  const job = saved.job;
  if (job.storeKey !== storeKey) return null;
  // Plus de 5 jours : supprimée d'office (copies + entrée), ici même — c'est
  // le passage obligé de toute lecture (liste, « Voir », Drive).
  if (job.finishedAt && Date.now() - job.startedAt > HISTORY_MAX_AGE_MS) {
    await deleteHistory(id, storeKey);
    return null;
  }
  if (!job.finishedAt) {
    job.finishedAt = job.startedAt;
    job.progress = 100;
    if (job.status !== "done") { job.status = job.copies.some((c) => c.status === "done") ? "done" : "failed"; }
    job.error ??= "Duplication interrompue (redémarrage du serveur) : les copies terminées restent disponibles.";
    for (const c of job.copies) if (c.status !== "done" && c.status !== "discarded") Object.assign(c, { status: "discarded", error: "interrompue" });
  }
  const outDir = creatorOutDir(storeKey);
  await Promise.all(job.copies.map(async (c) => {
    if (c.status !== "done" || !c.fileName) return;
    try { await fs.access(path.join(outDir, c.fileName)); } catch { c.expired = true; }
  }));
  return { meta: saved.meta, job };
}

/** Supprime une duplication : ses copies (fichiers) puis son entrée.
 *  false si introuvable. Un lancement encore en cours n'est pas supprimable
 *  (vérifié par l'appelant). */
export async function deleteHistory(id: string, storeKey: string): Promise<boolean> {
  if (!validId(id)) return false;
  const file = path.join(dirOf(storeKey), `${id}.json`);
  let saved: Saved;
  try { saved = JSON.parse(await fs.readFile(file, "utf8")); } catch { return false; }
  if (saved.job.storeKey !== storeKey) return false;
  const outDir = creatorOutDir(storeKey);
  await Promise.all(saved.job.copies.map((c) => c.fileName
    ? fs.rm(path.join(outDir, path.basename(c.fileName)), { force: true }).catch(() => {})
    : Promise.resolve()));
  await fs.rm(file, { force: true });
  return true;
}

/** Noms des copies (fichiers à la racine de `outDir`) qu'un historique de
 *  moins de 5 jours référence encore : le nettoyage horaire les garde.
 *  Ne lit que des JSON, ne lève jamais. */
export async function keptAiDupCopies(outDir: string): Promise<Set<string>> {
  const keep = new Set<string>();
  const dir = path.join(outDir, "ai-dup-history");
  let files: string[];
  try { files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json")); } catch { return keep; }
  const now = Date.now();
  await Promise.all(files.map(async (f) => {
    try {
      const { job } = JSON.parse(await fs.readFile(path.join(dir, f), "utf8")) as Saved;
      if (now - job.startedAt > HISTORY_MAX_AGE_MS) return;
      for (const c of job.copies) if (c.fileName) keep.add(path.basename(c.fileName));
    } catch { /* JSON illisible : ignoré */ }
  }));
  return keep;
}

export type HistoryItem = {
  id: string; startedAt: number; expiresAt: number; mode: AiDupJob["request"]["mode"]; requested: number;
  done: number; expired: boolean; running: boolean; materialName: string; thumb: string | null;
};

/** Les dernières duplications d'un créateur, les plus récentes d'abord. */
export async function listHistory(storeKey: string, limit = 20): Promise<HistoryItem[]> {
  let files: string[];
  try { files = (await fs.readdir(dirOf(storeKey))).filter((f) => f.endsWith(".json")); } catch { return []; }
  const items = await Promise.all(files.map(async (f) => {
    const s = await loadHistory(f.replace(/\.json$/, ""), storeKey);
    if (!s) return null;
    const done = s.job.copies.filter((c) => c.status === "done");
    return {
      id: s.job.id, startedAt: s.job.startedAt, expiresAt: s.job.startedAt + HISTORY_MAX_AGE_MS, mode: s.job.request.mode, requested: s.job.request.copies,
      done: done.length, expired: done.length > 0 && done.every((c) => c.expired), running: false,
      materialName: s.meta.materialName, thumb: s.meta.thumb,
    } satisfies HistoryItem;
  }));
  return items.filter((x) => !!x).map((x) => x as HistoryItem).sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
}

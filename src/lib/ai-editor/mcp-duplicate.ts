// src/lib/ai-editor/mcp-duplicate.ts
//
// LE DUPLICATEUR DANS LE MCP — Claude duplique lui-même, avec TOUS les réglages
// du dashboard, puis peut envoyer les copies en matière dans l'Éditeur IA.
//
// Même moteur, mêmes règles que la page Duplication :
//   • vidéos : processVideos (modes simple ET avancé, packs, watermark,
//     mouvement, rotation, dimensions, pays, métadonnées iPhone…) ;
//   • images : processImage (fondamentaux, visuels, semi, miroir, pays, iPhone) ;
//   • quota RÉSERVÉ avant de produire (sur la PERSONNE qui agit), surplus rendu
//     à la fin ; plan gratuit refusé ; résolution plafonnée selon le plan ;
//   • copies rangées dans le dossier du CRÉATEUR (OUT_BASE/<clé>) → elles
//     apparaissent aussi dans sa bibliothèque Duplication de l'app, et suivent
//     la même rétention que les copies faites à la main.
//
// Vidéos = longues → tâche de fond + ticket (« dup_… »), comme les rendus.
// Images = rapides → réponse directe.

import fs from "fs/promises";
import os from "os";
import path from "path";
import { getLatestProject, createProject, materialAbsPath, type ProjectMaterial } from "./store";
import { downloadPublicUrl, ingestMaterialFile } from "./material-ingest";
import { reserveUsage, releaseUsage, logUsageEvent } from "@/lib/usage";
import { isUserOnFreePlan } from "@/lib/plan-gate";
import { maxVideoHeightForPlan } from "@/lib/plans";

const OUT_BASE = process.env.OUT_BASE
  ?? (process.env.VERCEL ? path.join(os.tmpdir(), "duupflow") : path.join(process.cwd(), "public", "out"));

export function creatorOutDir(storeKey: string): string {
  return path.join(OUT_BASE, storeKey);
}

const VIDEO_EXTS = [".mp4", ".mov", ".m4v", ".mkv", ".avi", ".webm"];
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".heic", ".heif"];
const extOf = (n: string) => (path.extname(n) || "").toLowerCase();
const MAX_SOURCES = 10;

type Source = { name: string; tmpPath: string; owned: boolean };

/** Sources : matières du projet (par id) et/ou liens https directs. */
async function resolveSources(
  storeKey: string,
  args: Record<string, unknown>,
  kind: "video" | "image",
): Promise<{ sources: Source[]; errors: string[] }> {
  const errors: string[] = [];
  const sources: Source[] = [];
  const ids = Array.isArray(args.material_ids) ? args.material_ids.filter((x): x is string => typeof x === "string") : [];
  const urls = Array.isArray(args.urls) ? args.urls.filter((x): x is string => typeof x === "string") : [];
  if (ids.length + urls.length === 0) return { sources, errors: ["Donne au moins une source : material_ids (matières du projet, voir list_material) et/ou urls (liens https directs)."] };
  if (ids.length + urls.length > MAX_SOURCES) return { sources, errors: [`Maximum ${MAX_SOURCES} fichiers sources par appel.`] };

  if (ids.length) {
    const project = await getLatestProject(storeKey);
    for (const id of ids) {
      const m: ProjectMaterial | undefined = project?.materials.find((x) => x.id === id);
      if (!project || !m) { errors.push(`Matière « ${id} » introuvable dans le projet (list_material donne les ids).`); continue; }
      if (m.kind !== kind) { errors.push(`« ${m.name} » est ${m.kind === "image" ? "une image" : m.kind === "audio" ? "un audio" : "une vidéo"}, pas ${kind === "video" ? "une vidéo" : "une image"}.`); continue; }
      sources.push({ name: m.name, tmpPath: materialAbsPath(storeKey, project.id, m.storedName), owned: false });
    }
  }
  for (const u of urls) {
    try {
      const d = await downloadPublicUrl(u);
      const ok = kind === "video" ? VIDEO_EXTS.includes(extOf(d.fileName)) || d.mimeType.startsWith("video") : IMAGE_EXTS.includes(extOf(d.fileName)) || d.mimeType.startsWith("image");
      if (!ok) { errors.push(`${u} — ce n'est pas ${kind === "video" ? "une vidéo" : "une image"}.`); await fs.rm(d.tmpDir, { recursive: true, force: true }).catch(() => {}); continue; }
      // Le moteur lit le fichier par son chemin : on garde le dossier temporaire jusqu'à la fin.
      sources.push({ name: d.fileName, tmpPath: d.tmpPath, owned: true });
    } catch (e) {
      errors.push(`${u} — ${(e as Error).message}`);
    }
  }
  return { sources, errors };
}

async function cleanup(sources: Source[]) {
  for (const s of sources) if (s.owned) await fs.rm(path.dirname(s.tmpPath), { recursive: true, force: true }).catch(() => {});
}

/** Plan gratuit / quota : réservation atomique AVANT de produire. */
async function reserve(userId: string, type: "videos" | "images", n: number) {
  if (await isUserOnFreePlan(userId)) {
    return { ok: false as const, text: "Le plan gratuit ne permet pas de dupliquer. Explique au user qu'il faut un plan (DuupFlow → Plan & token)." };
  }
  const r = await reserveUsage(userId, type, n);
  if (!r.allowed) {
    return { ok: false as const, text: `Quota atteint : ${r.message ?? `${r.current ?? "?"}/${r.limit ?? "?"} ${type === "videos" ? "vidéos" : "images"} ce mois-ci`}. Propose au user de passer au plan supérieur ou de réduire le nombre de copies.` };
  }
  return { ok: true as const, plan: r.plan ?? null, trialCredit: r.trialCredit === true };
}

/* ══ VIDÉOS (tâche de fond) ═════════════════════════════════════════════════ */

export type DupJob = {
  id: string;
  storeKey: string;
  userId: string;
  status: "running" | "done" | "failed";
  progress: number;
  message: string;
  requested: number;
  outputs: string[];       // noms de fichiers produits (dossier du créateur)
  warnings: string[];
  startedAt: number;
  finishedAt?: number;
};

const g = globalThis as unknown as { __duupDupJobs?: Map<string, DupJob> };
const JOBS = (g.__duupDupJobs ??= new Map());
const TTL = 3 * 60 * 60 * 1000;
function sweep() { const now = Date.now(); for (const [k, j] of JOBS) if (j.finishedAt && now - j.finishedAt > TTL) JOBS.delete(k); }

export function getDupJob(id: string): DupJob | null { sweep(); return JOBS.get(id) ?? null; }
export function dupJobsFor(storeKey: string): DupJob[] { sweep(); return [...JOBS.values()].filter((j) => j.storeKey === storeKey).sort((a, b) => b.startedAt - a.startedAt); }

const SIMPLE_PACKS = ["metadata", "metadata_technical", "pixel_magic", "audio", "motion", "motion_dynamic", "visual"];

export async function startVideoDuplication(userId: string, storeKey: string, args: Record<string, unknown>): Promise<{ job?: DupJob; error?: string }> {
  const mode = args.mode === "advanced" ? "advanced" : "simple";
  const count = Math.max(1, Math.min(10, Math.floor(Number(args.count) || 1)));
  const { sources, errors } = await resolveSources(storeKey, args, "video");
  if (!sources.length) { await cleanup(sources); return { error: errors.join("\n") || "Aucune vidéo source." }; }

  const requested = sources.length * count;
  const res = await reserve(userId, "videos", requested);
  if (!res.ok) { await cleanup(sources); return { error: res.text }; }

  // FormData identique à celle de la page Duplication.
  const fd = new FormData();
  fd.append("channel", mode);
  fd.append("mode", mode);
  fd.append("count", String(count));
  const capH = maxVideoHeightForPlan(res.plan);
  fd.append("maxShortEdge", String(Number.isFinite(capH) ? capH : 0));
  if (typeof args.country === "string" && /^[A-Za-z]{2}$/.test(args.country)) fd.append("country", args.country.toUpperCase());
  if (args.iphone_meta === true) fd.append("iphoneMeta", "1");
  if (mode === "simple") {
    const packs = (Array.isArray(args.packs) ? args.packs : ["visual", "motion", "metadata_technical"])
      .filter((p): p is string => typeof p === "string" && SIMPLE_PACKS.includes(p));
    fd.append("packs", packs.join(","));
    if (args.watermark === true) fd.append("simpleWatermark", "1");
    const o = (args.options && typeof args.options === "object" ? args.options : {}) as Record<string, unknown>;
    fd.append("singles", JSON.stringify({
      flip: o.flip === true,
      reverse: o.mirror === true,
      shake: o.shake === true,
      motionMode: o.motion_intensity === "fort" ? "fort" : "doux",
      motionDynamicMode: o.advanced_motion_intensity === "doux" ? "doux" : "fort",
      rotation: { enabled: typeof o.rotation_deg === "number", min_deg: -Math.abs(Number(o.rotation_deg) || 0), max_deg: Math.abs(Number(o.rotation_deg) || 0) },
      dims: { enabled: typeof o.resize_factor === "number", w_factor: Number(o.resize_factor) || 1, h_factor: Number(o.resize_factor) || 1 },
    }));
  } else {
    // Mode avancé : plages par réglage ({ enabled, min, max }) — le moteur borne lui-même.
    const ranges = (args.advanced_ranges && typeof args.advanced_ranges === "object" ? args.advanced_ranges : {}) as Record<string, unknown>;
    fd.append("advancedRanges", JSON.stringify(ranges));
    fd.append("singles", "{}");
  }

  const job: DupJob = {
    id: `dup_${Math.random().toString(36).slice(2, 10)}`,
    storeKey, userId, status: "running", progress: 0, message: "Démarrage…",
    requested, outputs: [], warnings: errors, startedAt: Date.now(),
  };
  JOBS.set(job.id, job);

  void (async () => {
    const workDir = creatorOutDir(storeKey);
    try {
      await fs.mkdir(workDir, { recursive: true });
      const { processVideos } = await import("@/app/dashboard/videos/processVideos");
      const out = await processVideos(
        fd,
        async (pct, msg) => { job.progress = Math.min(99, Math.round(pct)); job.message = msg; },
        workDir,
        sources.map((s) => ({ name: s.name, tmpPath: s.tmpPath })),
      );
      job.outputs = out.outputPaths.map((p) => path.basename(p));
      if (out.rejectedFiles.length) job.warnings.push(...out.rejectedFiles);
      job.status = job.outputs.length ? "done" : "failed";
      job.message = job.outputs.length ? "Terminé" : (out.rejectedFiles.join("; ") || "Aucune copie produite.");
    } catch (e) {
      job.status = "failed";
      job.message = (e as Error)?.message?.slice(0, 300) || "Duplication échouée.";
    } finally {
      const produced = job.outputs.length;
      if (produced < requested) await releaseUsage(userId, "videos", requested - produced, res.trialCredit).catch(() => {});
      if (produced) void logUsageEvent(userId, "videos", produced);
      job.progress = 100;
      job.finishedAt = Date.now();
      await cleanup(sources);
    }
  })();

  return { job };
}

export function describeDupJob(job: DupJob): string {
  if (job.status === "running") {
    return `DUPLICATION ${job.id} EN COURS — ${job.progress}% (${job.message}). ${job.requested} copie(s) demandée(s). Rappelle get_duplication avec ce ticket dans quelques secondes.`;
  }
  const head = job.status === "done"
    ? `DUPLICATION ${job.id} TERMINÉE — ${job.outputs.length}/${job.requested} copie(s) :`
    : `DUPLICATION ${job.id} ÉCHOUÉE — ${job.message}`;
  const files = job.outputs.map((n) => `  • ${n}`).join("\n");
  const warn = job.warnings.length ? `\n⚠ ${job.warnings.join("\n⚠ ")}` : "";
  const next = job.outputs.length
    ? `\n\nCes copies sont aussi visibles dans la bibliothèque Duplication de DuupFlow (créateur en cours). Pour les monter : send_duplicates_to_editor avec ce ticket (ou les noms de fichiers) → elles deviennent de la matière de l'Éditeur IA.`
    : "";
  return `${head}\n${files}${warn}${next}`;
}

/* ══ IMAGES (réponse directe) ══════════════════════════════════════════════ */

export async function duplicateImages(userId: string, storeKey: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
  const count = Math.max(1, Math.min(20, Math.floor(Number(args.count) || 1)));
  const { sources, errors } = await resolveSources(storeKey, args, "image");
  if (!sources.length) { await cleanup(sources); return { text: errors.join("\n") || "Aucune image source.", isError: true }; }
  const requested = sources.length * count;
  const res = await reserve(userId, "images", requested);
  if (!res.ok) { await cleanup(sources); return { text: res.text, isError: true }; }

  const o = (args.options && typeof args.options === "object" ? args.options : {}) as Record<string, unknown>;
  const flags = {
    fundamentals: o.fundamentals !== false, // défaut : oui
    semi: o.semi !== false,                  // défaut : oui
    visuals: o.visuals === true,
    reverse: o.mirror === true,
  };
  const opts = {
    country: typeof args.country === "string" && /^[A-Za-z]{2}$/.test(args.country) ? args.country.toUpperCase() : undefined,
    iphoneMeta: args.iphone_meta === true,
  };

  const outDir = creatorOutDir(storeKey);
  await fs.mkdir(outDir, { recursive: true });
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const { processImage } = await import("@/lib/image-pipeline");
  const { runImageOp } = await import("@/lib/imageProcessingLimiter");
  const outputs: string[] = [];
  try {
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const buf = await fs.readFile(src.tmpPath).catch(() => null);
      if (!buf) { errors.push(`${src.name} — lecture impossible.`); continue; }
      const ext = extOf(src.name) || ".jpg";
      for (let c = 0; c < count; c++) {
        try {
          const { data, outExt } = await runImageOp(() => processImage(buf, ext, flags, opts));
          // Même nommage que la page Duplication (aucun nom de produit dans le fichier).
          const outName = `IMG_${stamp}_${i + 1}_c${c + 1}_${Date.now()}${Math.random().toString(16).slice(2, 10)}${outExt}`;
          await fs.writeFile(path.join(outDir, outName), data);
          outputs.push(outName);
        } catch (e) {
          errors.push(`${src.name} copie ${c + 1} — ${(e as Error).message}`);
        }
      }
    }
  } finally {
    if (outputs.length < requested) await releaseUsage(userId, "images", requested - outputs.length, res.trialCredit).catch(() => {});
    if (outputs.length) void logUsageEvent(userId, "images", outputs.length);
    await cleanup(sources);
  }
  const text = outputs.length
    ? `${outputs.length}/${requested} image(s) dupliquée(s) :\n${outputs.map((n) => `  • ${n}`).join("\n")}` +
      (errors.length ? `\n⚠ ${errors.join("\n⚠ ")}` : "") +
      `\n\nVisibles dans la bibliothèque Duplication de DuupFlow. Pour les utiliser en montage : send_duplicates_to_editor avec ces noms de fichiers.`
    : `Aucune image produite.\n${errors.join("\n")}`;
  return { text, isError: outputs.length === 0 };
}

/* ══ Copies → matière de l'Éditeur IA ══════════════════════════════════════ */

/** Nombre max de copies envoyées en matière en une fois (MCP et bouton du dashboard). */
export const SEND_TO_EDITOR_MAX = 20;

export type SentResult = { name: string; ok: true; materialId: string; analyzing: boolean } | { name: string; ok: false; error: string };

/**
 * Ajoute des copies dupliquées (déjà sur disque) en matière du dernier projet
 * de l'Éditeur IA de `storeKey` — porte commune au MCP (send_duplicates_to_editor)
 * et au bouton « Envoyer vers l'éditeur » des pages Duplication.
 */
export async function ingestDuplicates(
  storeKey: string,
  files: { absPath: string; name: string }[],
  desc: string,
  logTag: string,
): Promise<{ projectId: string; results: SentResult[] }> {
  const project = (await getLatestProject(storeKey)) ?? (await createProject(storeKey));
  const one = async (f: { absPath: string; name: string }): Promise<SentResult> => {
    try { await fs.access(f.absPath); } catch { return { name: f.name, ok: false, error: "introuvable (copie expirée ? Les copies sont gardées environ 1 h)." }; }
    const ext = extOf(f.name);
    const mime = IMAGE_EXTS.includes(ext) ? `image/${ext === ".jpg" ? "jpeg" : ext.slice(1)}` : "video/mp4";
    const r = await ingestMaterialFile({ storeKey, projectId: project.id, tmpPath: f.absPath, fileName: f.name, mimeType: mime, desc, logTag });
    return r.ok ? { name: f.name, ok: true, materialId: r.material.id, analyzing: r.material.status === "analyzing" } : { name: f.name, ok: false, error: r.error };
  };
  // 4 à la fois : l'envoi reste rapide sans saturer le serveur (le store
  // sérialise déjà l'écriture du projet sous verrou). Ordre d'origine conservé.
  const results: SentResult[] = new Array(files.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, files.length) }, async () => {
    while (next < files.length) { const i = next++; results[i] = await one(files[i]); }
  }));
  return { projectId: project.id, results };
}

/** Nom de fichier simple (pas de chemin) d'un dossier de copies. */
export function isPlainOutName(name: string): boolean {
  return /^[\w.() -]{1,200}$/.test(name) && !name.includes("..");
}

export async function sendDuplicatesToEditor(storeKey: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
  let names = Array.isArray(args.files) ? args.files.filter((x): x is string => typeof x === "string") : [];
  if (typeof args.ticket === "string" && args.ticket) {
    const job = getDupJob(args.ticket);
    if (!job || job.storeKey !== storeKey) return { text: `Ticket ${args.ticket} introuvable (expiré, ou autre créateur).`, isError: true };
    if (job.status === "running") return { text: `La duplication ${job.id} est encore en cours (${job.progress}%). Attends qu'elle soit terminée (get_duplication).`, isError: true };
    names = [...new Set([...names, ...job.outputs])];
  }
  if (!names.length) return { text: "Donne un ticket de duplication (dup_…) ou une liste de noms de fichiers (files).", isError: true };
  if (names.length > SEND_TO_EDITOR_MAX) return { text: `Maximum ${SEND_TO_EDITOR_MAX} fichiers par envoi.`, isError: true };

  const outDir = creatorOutDir(storeKey);
  const desc = typeof args.description === "string" ? args.description.slice(0, 500) : "Copie dupliquée par DuupFlow";
  const lines: string[] = [];
  const valid: { absPath: string; name: string }[] = [];
  for (const name of names) {
    // Uniquement un nom de fichier du dossier du créateur (pas de chemin).
    if (!isPlainOutName(name)) { lines.push(`❌ ${name} — nom invalide.`); continue; }
    valid.push({ absPath: path.join(outDir, name), name });
  }
  const { projectId, results } = await ingestDuplicates(storeKey, valid, desc, "mcp/send_duplicates");
  for (const r of results) lines.push(r.ok ? `✅ ${r.name} → matière ${r.materialId}${r.analyzing ? " (analyse en cours)" : ""}` : `❌ ${r.name} — ${r.error}`);
  const added = results.filter((r) => r.ok).length;
  return {
    text: `${added}/${names.length} copie(s) ajoutée(s) en matière au projet (id ${projectId}) :\n${lines.join("\n")}` +
      (added ? "\n\nLes vidéos s'analysent en tâche de fond : appelle list_material avant de monter, puis create_variant." : ""),
    isError: added === 0,
  };
}

/** Copies récentes du créateur (bibliothèque Duplication). */
export async function listDuplicates(storeKey: string): Promise<string> {
  const outDir = creatorOutDir(storeKey);
  const names = await fs.readdir(outDir).catch(() => [] as string[]);
  const finals = names.filter((n) => !n.startsWith(".") && !n.startsWith("__") && !n.startsWith("tmp_") && !n.endsWith(".part") && !n.startsWith("CMP_") && (VIDEO_EXTS.includes(extOf(n)) || IMAGE_EXTS.includes(extOf(n))));
  if (!finals.length) return "Aucune copie récente pour ce créateur (les copies sont gardées environ 1 h).";
  return `COPIES RÉCENTES (${finals.length}) :\n${finals.slice(-60).map((n) => `  • ${n}`).join("\n")}`;
}

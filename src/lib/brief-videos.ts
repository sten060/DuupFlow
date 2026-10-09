// src/lib/brief-videos.ts
//
// VIDÉOS DU BRIEF d'un créateur — jusqu'à 5 vidéos « qui marchent » chez lui,
// analysées EXACTEMENT comme une référence de l'Éditeur IA (plans, captions
// lues à l'écran, rythme, transitions, audio, couleur, transcription…). Claude
// reçoit leur DESCRIPTIF avec le brief et les images : il connaît le style du
// créateur sans que personne ait à le réexpliquer.
//
// PERMANENTES, comme les images : elles ne disparaissent que si le user les
// supprime ou supprime le créateur (removeAllBriefImages efface tout le dossier
// wsbrief_<id>, vidéos comprises).
//
// On ne garde PAS le fichier vidéo : seulement l'analyse (allégée), une
// vignette et quelques images clés. Stockage :
//   OUT_BASE/wsbrief_<workspaceId>/videos/meta.json
//   OUT_BASE/wsbrief_<workspaceId>/videos/<id>.json   (analyse)
//   OUT_BASE/wsbrief_<workspaceId>/videos/<id>.jpg    (vignette)
// ⚠️ Sous-dossier obligatoire : le nettoyage horaire efface les fichiers posés
// à la racine des dossiers de OUT_BASE, jamais ceux des sous-dossiers.
//
// L'analyse prend ~1 min (Gemini regarde la vidéo + transcription) : elle tourne
// en tâche de fond ; la vidéo est listée tout de suite avec le statut
// « analyzing », puis « ready » ou « failed ».

import fs from "fs/promises";
import os from "os";
import path from "path";
import sharp from "sharp";
import type { ReferenceAnalysis } from "@/lib/ai-editor/analyze";

const OUT_BASE = process.env.OUT_BASE
  ?? (process.env.VERCEL ? path.join(os.tmpdir(), "duupflow") : path.join(process.cwd(), "public", "out"));

export const BRIEF_VIDEOS_MAX = 5;
export const BRIEF_VIDEO_MAX_BYTES = 300 * 1024 * 1024;
export const BRIEF_VIDEO_MAX_SEC = 120;
/** Au-delà, une analyse « en cours » a été coupée (redémarrage du serveur). */
const STALE_MS = 20 * 60 * 1000;
const KEYFRAMES_KEPT = 4;

export type BriefVideoStatus = "analyzing" | "ready" | "failed";
export type BriefVideo = { id: string; name: string; durationSec: number; status: BriefVideoStatus; error?: string; createdAt: number };

const ID_RE = /^[a-z0-9]{6,20}$/;
const WS_RE = /^[0-9a-f-]{36}$/;

function videosDir(workspaceId: string) {
  if (!WS_RE.test(workspaceId)) throw new Error("workspace invalide");
  return path.join(OUT_BASE, `wsbrief_${workspaceId}`, "videos");
}
function metaFile(workspaceId: string) { return path.join(videosDir(workspaceId), "meta.json"); }

async function readMeta(workspaceId: string): Promise<BriefVideo[]> {
  try {
    const list = JSON.parse(await fs.readFile(metaFile(workspaceId), "utf8")) as BriefVideo[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Liste des vidéos ; une analyse restée « en cours » trop longtemps est montrée en échec. */
export async function listBriefVideos(workspaceId: string): Promise<BriefVideo[]> {
  const now = Date.now();
  return (await readMeta(workspaceId)).map((v) =>
    v.status === "analyzing" && now - v.createdAt > STALE_MS
      ? { ...v, status: "failed" as const, error: "Analyse interrompue. Supprime la vidéo et renvoie-la." }
      : v,
  );
}

async function writeMeta(workspaceId: string, list: BriefVideo[]) {
  await fs.mkdir(videosDir(workspaceId), { recursive: true });
  const tmp = `${metaFile(workspaceId)}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(list), "utf8");
  await fs.rename(tmp, metaFile(workspaceId)); // écriture atomique
}

/* Verrou par créateur : deux envois simultanés ne doivent ni dépasser la limite
   de 5 ni s'écraser la liste. */
const chains = new Map<string, Promise<unknown>>();
function withLock<T>(workspaceId: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(workspaceId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  chains.set(workspaceId, run.then(() => {}, () => {}));
  return run;
}

/**
 * Ajoute une vidéo (fichier DÉJÀ sur disque, dans `tmpDir` que cette fonction
 * supprime une fois l'analyse finie) et lance son analyse en tâche de fond.
 */
export async function addBriefVideo(
  workspaceId: string,
  tmpDir: string,
  tmpPath: string,
  name: string,
): Promise<{ ok: true; video: BriefVideo } | { ok: false; error: string }> {
  const cleanup = () => fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  const { probeDurationSec, analyzeReferenceVideo } = await import("@/lib/ai-editor/analyze");
  const dur = await probeDurationSec(tmpPath).catch(() => 0);
  if (!dur) { await cleanup(); return { ok: false, error: `« ${name} » n'est pas une vidéo lisible.` }; }
  if (dur > BRIEF_VIDEO_MAX_SEC + 3) { await cleanup(); return { ok: false, error: `« ${name} » est trop longue (${Math.round(dur)} s). Maximum 2 min.` }; }

  const reserved = await withLock(workspaceId, async () => {
    const list = await readMeta(workspaceId);
    if (list.length >= BRIEF_VIDEOS_MAX) return null;
    const video: BriefVideo = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name.slice(0, 120),
      durationSec: Math.round(dur * 10) / 10,
      status: "analyzing",
      createdAt: Date.now(),
    };
    await writeMeta(workspaceId, [...list, video]);
    return video;
  });
  if (!reserved) { await cleanup(); return { ok: false, error: `Maximum ${BRIEF_VIDEOS_MAX} vidéos par créateur.` }; }

  void (async () => {
    let status: BriefVideoStatus = "failed";
    let error: string | undefined;
    try {
      const analysis = await analyzeReferenceVideo(tmpPath);
      // Supprimée (ou créateur supprimé) pendant l'analyse → on n'écrit rien.
      if ((await readMeta(workspaceId)).some((v) => v.id === reserved.id)) {
        await fs.writeFile(path.join(videosDir(workspaceId), `${reserved.id}.json`), JSON.stringify(await slimAnalysis(analysis)), "utf8");
        const thumb = analysis.keyframes[Math.min(1, analysis.keyframes.length - 1)]?.dataUri;
        if (thumb) {
          const jpg = await sharp(Buffer.from(thumb.split(",")[1] ?? "", "base64")).resize({ width: 480, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
          await fs.writeFile(path.join(videosDir(workspaceId), `${reserved.id}.jpg`), jpg);
        }
        status = "ready";
      }
    } catch (e) {
      console.error(`[brief-videos] analyse échouée (${name}):`, (e as Error)?.message);
      error = "L'analyse a échoué. Supprime la vidéo et réessaie.";
    } finally {
      await cleanup();
    }
    await withLock(workspaceId, async () => {
      const list = await readMeta(workspaceId);
      if (!list.some((v) => v.id === reserved.id)) return;
      await writeMeta(workspaceId, list.map((v) => (v.id === reserved.id ? { ...v, status, ...(error ? { error } : {}) } : v)));
    }).catch(() => {});
  })();

  return { ok: true, video: reserved };
}

/** Analyse allégée : tout ce que Claude lit, sans les gros tableaux bruts. */
async function slimAnalysis(a: ReferenceAnalysis): Promise<ReferenceAnalysis> {
  const step = Math.max(1, Math.floor(a.keyframes.length / KEYFRAMES_KEPT));
  const picked = a.keyframes.filter((_, i) => i % step === 0).slice(0, KEYFRAMES_KEPT);
  const keyframes = await Promise.all(picked.map(async (k) => {
    try {
      const buf = await sharp(Buffer.from(k.dataUri.split(",")[1] ?? "", "base64")).resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
      return { t: k.t, dataUri: `data:image/jpeg;base64,${buf.toString("base64")}` };
    } catch {
      return k;
    }
  }));
  return {
    ...a,
    keyframes,
    transcript: a.transcript ? { phrases: a.transcript.phrases, fullText: a.transcript.fullText } : null,
    audio: a.audio ? { ...a.audio, energy: [] } : a.audio,
  };
}

export async function readBriefVideoAnalysis(workspaceId: string, videoId: string): Promise<ReferenceAnalysis | null> {
  if (!ID_RE.test(videoId)) return null;
  try { return JSON.parse(await fs.readFile(path.join(videosDir(workspaceId), `${videoId}.json`), "utf8")) as ReferenceAnalysis; } catch { return null; }
}

export async function readBriefVideoThumb(workspaceId: string, videoId: string): Promise<Buffer | null> {
  if (!ID_RE.test(videoId)) return null;
  try { return await fs.readFile(path.join(videosDir(workspaceId), `${videoId}.jpg`)); } catch { return null; }
}

export async function removeBriefVideo(workspaceId: string, videoId: string): Promise<boolean> {
  if (!ID_RE.test(videoId)) return false;
  return withLock(workspaceId, async () => {
    const list = await readMeta(workspaceId);
    if (!list.some((v) => v.id === videoId)) return false;
    await Promise.all([".json", ".jpg"].map((ext) => fs.unlink(path.join(videosDir(workspaceId), `${videoId}${ext}`)).catch(() => {})));
    await writeMeta(workspaceId, list.filter((v) => v.id !== videoId));
    return true;
  });
}

/* ── Ce que Claude lit ─────────────────────────────────────────────────────── */

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Descriptif texte d'une vidéo du brief, à partir de son analyse. */
export function describeBriefVideo(name: string, a: ReferenceAnalysis): string {
  const comp = a.comprehension;
  const lines: (string | null)[] = [
    `VIDÉO « ${name} » — ${r1(a.durationSec)} s · ${a.width}×${a.height} · ${a.pacing.cutCount} coupe(s)${a.pacing.avgCutSec ? ` · ~${a.pacing.avgCutSec} s/plan` : ""}`,
    comp?.whyItWorks ? `Pourquoi ça marche : ${comp.whyItWorks}` : null,
    a.hookText ? `Hook parlé : « ${a.hookText} »` : null,
    comp?.captions.length
      ? `Captions à l'écran (${comp.captions.length}) — style :\n` + comp.captions.slice(0, 8).map((c) =>
          `  · « ${c.text} » [${c.startSec}–${c.endSec}s] font "${c.font}" ${c.fontWeight} · ${c.fontSizePx}px · ${c.color}` +
          `${c.hasStroke ? ` · contour ${c.strokeWidthPx}px` : ""}${c.background && c.background !== "none" ? ` · fond ${c.background}` : ""} · y ${c.yPct}%` +
          `${c.animation && c.animation !== "none" ? ` · animation ${c.animation}` : ""}`).join("\n")
      : comp ? "Captions à l'écran : aucune." : null,
    comp?.shots.length
      ? `Plans :\n` + comp.shots.slice(0, 12).map((s) => `  · [${s.startSec}–${s.endSec}s] ${s.motion !== "none" ? `${s.motion} · ` : ""}${s.content}`).join("\n")
      : null,
    comp?.cuts?.length
      ? `Transitions : ${Object.entries(comp.cuts.reduce<Record<string, number>>((m, c) => { m[c.transition] = (m[c.transition] ?? 0) + 1; return m; }, {})).map(([k, n]) => `${k} ×${n}`).join(", ")}`
      : null,
    comp?.emojisOverall ? `Emojis : ${comp.emojisOverall}` : null,
    a.audio ? `Audio : ${a.audio.type}${a.audio.bpm ? ` · ~${a.audio.bpm} BPM` : ""}${comp?.duckingPresent ? " · musique baissée sous la voix" : ""}` : null,
    a.color ? `Couleur : saturation ${a.color.saturation} · luminosité ${a.color.brightness} · ${a.color.warmCold}${a.color.bw ? " · noir & blanc" : ""}` : null,
    a.transcript?.phrases.length
      ? `Ce qui est dit :\n${a.transcript.phrases.slice(0, 20).map((p) => `  [${r1(p.startSec)}s] ${p.text}`).join("\n")}`
      : null,
    !comp ? "⚠️ Analyse partielle : le style des captions n'a pas pu être lu." : null,
  ];
  return lines.filter(Boolean).join("\n");
}

/** Pour Claude : descriptif + images clés de chaque vidéo prête, et l'état des autres. */
export async function briefVideosForClaude(workspaceId: string): Promise<{
  videos: { name: string; text: string; images: { data: string; mimeType: "image/jpeg" }[] }[];
  pending: string[];
}> {
  const list = await listBriefVideos(workspaceId);
  const videos: { name: string; text: string; images: { data: string; mimeType: "image/jpeg" }[] }[] = [];
  const pending: string[] = [];
  for (const v of list) {
    if (v.status === "analyzing") { pending.push(v.name); continue; }
    if (v.status !== "ready") continue;
    const a = await readBriefVideoAnalysis(workspaceId, v.id);
    if (!a) continue;
    videos.push({
      name: v.name,
      text: describeBriefVideo(v.name, a),
      images: a.keyframes.map((k) => ({ data: k.dataUri.split(",")[1] ?? "", mimeType: "image/jpeg" as const })).filter((i) => i.data),
    });
  }
  return { videos, pending };
}

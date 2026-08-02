// src/lib/ai-editor/render.ts
//
// Moteur de rendu de l'Éditeur IA. Principe MCP : le Claude du user est le
// MONTEUR (il choisit plans/ordre/timing/captions), ce moteur est l'EXÉCUTEUR :
// donné un PLAN, il assemble une vidéo depuis la matière (coupe → normalise au
// canvas → concat → captions incrustées) + un poster.
//
// v1 : vidéo SANS SON (audio en v2). Captions = texte rasterisé PNG (sharp) +
// overlay — portable (pas de drawtext/libass), best-effort. FFmpeg via runFFmpeg.

import fs from "fs/promises";
import os from "os";
import path from "path";
import { runFFmpeg } from "@/lib/studio/pipeline";
import { getProject, materialAbsPath, addVariant } from "./store";
import type { ProjectVariant } from "./store";

export type EditSegment = { materialId: string; startSec?: number; endSec?: number };
export type EditCaption = { text: string; startSec: number; endSec: number; position?: "top" | "center" | "bottom" };
export type EditPlan = {
  aspect?: "9:16" | "1:1" | "16:9";
  segments: EditSegment[];
  captions?: EditCaption[];
  label?: string;
};

const CANVAS: Record<string, [number, number]> = { "9:16": [1080, 1920], "1:1": [1080, 1080], "16:9": [1920, 1080] };
const IMG_DEFAULT_SEC = 2.5;
const MAX_SEGMENTS = 40;
const MAX_CAPTIONS = 30;
const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Rasterise une caption (texte + boîte) sur un PNG transparent WxH, placée. */
async function captionPng(text: string, W: number, H: number, position: EditCaption["position"], outPath: string): Promise<void> {
  const sharp = (await import("sharp")).default;
  const fsz = Math.round(W * 0.055);
  const lineH = Math.round(fsz * 1.25);
  const maxChars = Math.max(8, Math.floor(W / (fsz * 0.58)));
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur ? cur + " " + w : w).length > maxChars) { if (cur) lines.push(cur); cur = w; }
    else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  const used = lines.slice(0, 4);
  const n = used.length;
  const boxH = n * lineH + Math.round(fsz * 0.6);
  const boxW = Math.round(W * 0.9);
  const boxX = Math.round((W - boxW) / 2);
  const boxY = position === "top" ? Math.round(H * 0.07) : position === "center" ? Math.round((H - boxH) / 2) : Math.round(H * 0.8 - boxH);
  const startY = boxY + Math.round((boxH - n * lineH) / 2) + Math.round(fsz);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tspans = used.map((l, i) => `<tspan x="${W / 2}" y="${startY + i * lineH}">${esc(l)}</tspan>`).join("");
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="18" fill="black" fill-opacity="0.5"/>
    <text text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="${fsz}" fill="white">${tspans}</text>
  </svg>`;
  await fs.writeFile(outPath, await sharp(Buffer.from(svg)).png().toBuffer());
}

export async function renderVariant(
  userId: string,
  projectId: string,
  plan: EditPlan,
): Promise<{ variant: ProjectVariant } | { error: string }> {
  const project = await getProject(userId, projectId);
  if (!project) return { error: "Projet introuvable." };

  const segs = Array.isArray(plan.segments) ? plan.segments.slice(0, MAX_SEGMENTS) : [];
  if (segs.length === 0) return { error: "Le plan doit contenir au moins un segment." };
  const [W, H] = CANVAS[plan.aspect ?? "9:16"] ?? CANVAS["9:16"];

  const inputs: string[] = [];
  const vlabels: string[] = [];
  const filters: string[] = [];

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const mat = project.materials.find((m) => m.id === seg.materialId);
    if (!mat) return { error: `Matière introuvable : ${seg.materialId}` };
    const abs = materialAbsPath(userId, projectId, mat.storedName);
    try { await fs.access(abs); } catch { return { error: `Fichier manquant pour ${mat.name}.` }; }

    const norm = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p`;
    if (mat.kind === "image") {
      const dur = Math.max(0.3, seg.endSec != null && seg.startSec != null ? seg.endSec - seg.startSec : seg.endSec ?? IMG_DEFAULT_SEC);
      inputs.push("-loop", "1", "-t", dur.toFixed(3), "-i", abs);
      filters.push(`[${i}:v]${norm}[v${i}]`);
    } else {
      inputs.push("-i", abs);
      const s = seg.startSec != null ? `start=${num(seg.startSec, 0).toFixed(3)}` : "";
      const e = seg.endSec != null ? `end=${num(seg.endSec, 0).toFixed(3)}` : "";
      const trim = s || e ? `trim=${[s, e].filter(Boolean).join(":")},setpts=PTS-STARTPTS,` : "";
      filters.push(`[${i}:v]${trim}${norm}[v${i}]`);
    }
    vlabels.push(`[v${i}]`);
  }

  filters.push(`${vlabels.join("")}concat=n=${segs.length}:v=1:a=0[cat]`);

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_render_"));
  const outPath = path.join(dir, "variant.mp4");
  const posterPath = path.join(dir, "poster.jpg");

  try {
    // Captions — best-effort (PNG sharp + overlay). Échec → vidéo sans captions.
    let last = "cat";
    const caps = (plan.captions ?? []).slice(0, MAX_CAPTIONS).filter((c) => c?.text?.trim());
    try {
      for (let k = 0; k < caps.length; k++) {
        const c = caps[k];
        const png = path.join(dir, `cap${k}.png`);
        await captionPng(c.text, W, H, c.position ?? "bottom", png);
        inputs.push("-i", png);
        const inIdx = segs.length + k;
        const out = `cc${k}`;
        filters.push(`[${last}][${inIdx}:v]overlay=0:0:enable='between(t,${num(c.startSec, 0).toFixed(2)},${num(c.endSec, 3).toFixed(2)})'[${out}]`);
        last = out;
      }
    } catch (e) {
      console.warn("[ai-editor/render] captions ignorées:", (e as Error)?.message);
      last = "cat";
    }
    filters.push(`[${last}]null[vout]`);

    const args = [
      "-y", "-hide_banner", "-loglevel", "error",
      ...inputs,
      "-filter_complex", filters.join(";"),
      "-map", "[vout]", "-an",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outPath,
    ];
    const { code, stderr } = await runFFmpeg(args, 10 * 60 * 1000);
    if (code !== 0) return { error: `Rendu FFmpeg échoué : ${stderr.slice(-200)}` };

    let poster: string | null = null;
    try {
      const r = await runFFmpeg(["-y", "-hide_banner", "-loglevel", "error", "-ss", "0.5", "-i", outPath, "-frames:v", "1", "-vf", "scale=480:-2", posterPath], 30_000);
      if (r.code === 0) {
        const buf = await fs.readFile(posterPath);
        if (buf.length) poster = `data:image/jpeg;base64,${buf.toString("base64")}`;
      }
    } catch { /* poster best-effort */ }

    const variant = await addVariant(userId, projectId, { srcPath: outPath, poster, label: plan.label });
    if (!variant) return { error: "Enregistrement de la variante échoué." };
    return { variant };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// src/app/dashboard/similarity/actions.ts
"use server";

import path from "path";
import fs from "fs/promises";
import os from "os";
import crypto from "crypto";
import sharp from "sharp";
import { execa } from "execa";
import { redirect } from "next/navigation";
import { getFFmpegBin } from "@/app/dashboard/videos/processVideos";

// ---------- utils ----------
function randHex(n = 2) {
  return crypto.randomBytes(n).toString("hex");
}
function isNextRedirect(e: unknown) {
  return !!(e && typeof e === "object" && "digest" in (e as any) && String((e as any).digest).startsWith("NEXT_REDIRECT"));
}
type Hash64 = bigint;

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff", ".avif", ".heic", ".heif"];
const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"];

function extOf(name: string) {
  const p = name.lastIndexOf(".");
  return p >= 0 ? name.slice(p).toLowerCase() : "";
}

function kindFromMimeOrExt(mime: string, filename: string): "image" | "video" | "unknown" {
  if (mime) {
    const top = mime.split("/")[0];
    if (top === "image") return "image";
    if (top === "video") return "video";
  }
  const ext = extOf(filename);
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (VIDEO_EXTS.includes(ext)) return "video";
  return "unknown";
}

// ---------- Hash helpers ----------
function hamming64(a: Hash64, b: Hash64): number {
  let x = a ^ b;
  let c = 0;
  while (x !== 0n) {
    x &= (x - 1n);
    c++;
  }
  return c;
}
function simFromHamming(h: number, bits = 64): number {
  return Math.max(0, Math.min(100, Math.round((1 - h / bits) * 100)));
}

// aHash 8x8 (grayscale)
async function imageAHash64(buf: Buffer): Promise<Hash64> {
  const arr = await sharp(buf).grayscale().resize(8, 8, { fit: "fill" }).raw().toBuffer();
  let sum = 0;
  for (let i = 0; i < 64; i++) sum += arr[i];
  const avg = sum / 64;
  let bits = 0n;
  for (let i = 0; i < 64; i++) {
    bits = (bits << 1n) | (arr[i] >= avg ? 1n : 0n);
  }
  return bits;
}

// dHash 8x8 (grayscale)
async function imageDHash64(buf: Buffer): Promise<Hash64> {
  const w = 9, h = 8; // 9x8 -> 8*8 diffs
  const arr = await sharp(buf).grayscale().resize(w, h, { fit: "fill" }).raw().toBuffer();
  let bits = 0n;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i1 = y * w + x;
      const i2 = y * w + (x + 1);
      bits = (bits << 1n) | (arr[i1] < arr[i2] ? 1n : 0n);
    }
  }
  return bits;
}

// pHash 64 bits (grayscale, DCT 32x32 -> 8x8)
async function imagePHash64(buf: Buffer): Promise<Hash64> {
  const N = 32;
  const raw = await sharp(buf).grayscale().resize(N, N, { fit: "fill" }).raw().toBuffer();

  const block: number[] = [];
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0;
      for (let x = 0; x < N; x++) {
        const cx = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N));
        for (let y = 0; y < N; y++) {
          const cy = Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N));
          sum += raw[x * N + y] * cx * cy;
        }
      }
      block.push(sum);
    }
  }
  const coeffs = block.slice(1);
  const sorted = [...coeffs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  let bits = 0n;
  for (let i = 0; i < 64; i++) {
    const v = i === 0 ? 0 : block[i];
    bits = (bits << 1n) | (v > median ? 1n : 0n);
  }
  return bits;
}

/** pHash multi-crops : centre + 2 décalages légers (extraits en parallèle) */
async function multiCropPHashes(buf: Buffer): Promise<Hash64[]> {
  const { width = 0, height = 0 } = await sharp(buf).metadata();
  const w = Math.max(32, Math.floor(width * 0.96));
  const h = Math.max(32, Math.floor(height * 0.96));
  const cx = Math.max(0, Math.floor((width - w) / 2));
  const cy = Math.max(0, Math.floor((height - h) / 2));
  const dx = Math.max(0, Math.floor(width * 0.01));
  const dy = Math.max(0, Math.floor(height * 0.01));
  const crops = [
    { left: cx, top: cy, width: w, height: h },
    { left: Math.min(cx + dx, Math.max(0, width - w)), top: cy, width: w, height: h },
    { left: cx, top: Math.min(cy + dy, Math.max(0, height - h)), width: w, height: h },
  ];
  return Promise.all(crops.map(async (c) => imagePHash64(await sharp(buf).extract(c).toBuffer())));
}

/** Histogramme RGB (16 bins par canal) → similarité 0–100 */
async function colorHistogramSimilarity(a: Buffer, b: Buffer): Promise<number> {
  const W = 64, H = 64;
  const [ra, rb] = await Promise.all([
    sharp(a).resize(W, H, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true }),
    sharp(b).resize(W, H, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true }),
  ]);

  const binsA = new Array(16 * 3).fill(0);
  const binsB = new Array(16 * 3).fill(0);

  function fill(buf: Buffer, bins: number[], channels: number) {
    const ch = channels; // 3 ou 4 — use each buffer's own channel count
    for (let i = 0; i < buf.length; i += ch) {
      const r = buf[i], g = buf[i + 1], b = buf[i + 2];
      bins[(r >> 4) + 0]++;      // R 0..15
      bins[(g >> 4) + 16]++;     // G 0..15
      bins[(b >> 4) + 32]++;     // B 0..15
    }
  }
  fill(ra.data, binsA, ra.info.channels);
  fill(rb.data, binsB, rb.info.channels);

  let inter = 0, sum = 0;
  for (let i = 0; i < binsA.length; i++) {
    inter += Math.min(binsA[i], binsB[i]);
    sum += Math.max(binsA[i], binsB[i]);
  }
  const s = sum ? inter / sum : 1;
  return Math.round(s * 100);
}

/** Énergie de hautes fréquences (variance du Laplacien) → similarité 0–100 */
async function highFreqSimilarity(a: Buffer, b: Buffer): Promise<number> {
  const W = 64, H = 64;
  const [ga, gb] = await Promise.all([
    sharp(a).grayscale().resize(W, H, { fit: "fill" }).raw().toBuffer(),
    sharp(b).grayscale().resize(W, H, { fit: "fill" }).raw().toBuffer(),
  ]);

  function lapVar(raw: Buffer): number {
    const k = [0, 1, 0, 1, -4, 1, 0, 1, 0];
    const f = (x: number, y: number) => raw[y * W + x] || 0;
    const out: number[] = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const n =
          k[0] * f(x - 1, y - 1) + k[1] * f(x, y - 1) + k[2] * f(x + 1, y - 1) +
          k[3] * f(x - 1, y) + k[4] * f(x, y) + k[5] * f(x + 1, y) +
          k[6] * f(x - 1, y + 1) + k[7] * f(x, y + 1) + k[8] * f(x + 1, y + 1);
        out.push(n);
      }
    }
    const mean = out.reduce((s, v) => s + v, 0) / out.length;
    const v = out.reduce((s, v) => s + (v - mean) ** 2, 0) / out.length;
    return v;
  }

  const va = lapVar(ga);
  const vb = lapVar(gb);
  const maxv = Math.max(va, vb) || 1;
  const diff = Math.abs(va - vb);
  // tolérance ~ 8% de la plus grande énergie
  const tol = 0.08 * maxv;
  const sim = Math.max(0, Math.min(100, Math.round((1 - diff / tol) * 100)));
  return sim;
}

// ---------- META (images) ----------
type MetaDict = Record<string, string | number | boolean | null | undefined>;

async function imageMetaSignature(tmpPath: string): Promise<MetaDict> {
  try {
    const meta = await sharp(tmpPath).metadata();
    const out: MetaDict = {
      format: meta.format,
      space: meta.space,
      width: meta.width || null,
      height: meta.height || null,
      density: meta.density || null,
      hasProfile: Boolean(meta.icc),
      hasAlpha: Boolean(meta.hasAlpha),
    };
    return out;
  } catch {
    return {};
  }
}

function pctSimilarity(a: number, b: number, tolAbs: number): number {
  const d = Math.abs(a - b);
  if (d <= 0) return 100;
  if (d >= tolAbs) return 0;
  return Math.max(0, 100 * (1 - d / tolAbs));
}

function metaSimilarityImages(a: MetaDict, b: MetaDict): number {
  let score = 0, wsum = 0;
  const add = (v: number, w: number) => { score += v * w; wsum += w; };

  if (a.format || b.format) add(a.format === b.format ? 100 : 0, 3);
  if (a.space || b.space) add(a.space === b.space ? 100 : 0, 3);
  if (typeof a.width === "number" && typeof b.width === "number") add(pctSimilarity(a.width, b.width, 1), 5);
  if (typeof a.height === "number" && typeof b.height === "number") add(pctSimilarity(a.height, b.height, 1), 5);
  if (typeof a.density === "number" && typeof b.density === "number") add(pctSimilarity(a.density, b.density, 6), 2);
  if (a.hasProfile !== undefined || b.hasProfile !== undefined) add(a.hasProfile === b.hasProfile ? 100 : 0, 2);
  if (a.hasAlpha !== undefined || b.hasAlpha !== undefined) add(a.hasAlpha === b.hasAlpha ? 100 : 0, 1);

  return wsum ? +(score / wsum).toFixed(2) : 0;
}

// ---------- VIDEO helpers ----------
async function extractFrame(videoPath: string, t: number, ffmpegBin: string): Promise<Buffer | null> {
  const tmp = path.join(path.dirname(videoPath), `__frame_${t}_${randHex(2)}.png`);
  try {
    await execa(ffmpegBin, ["-y", "-ss", String(t), "-i", videoPath, "-frames:v", "1", "-vf", "scale=128:-2", tmp], {
      timeout: 10_000,
    });
    const buf = await fs.readFile(tmp);
    await fs.unlink(tmp).catch(() => {});
    return buf;
  } catch {
    await fs.unlink(tmp).catch(() => {});
    return null;
  }
}

async function videoHashSignature(videoPath: string, ffmpegBin: string): Promise<{ phashes: Hash64[]; dhashes: Hash64[] }> {
  // Try ffprobe to get duration — short 2 s timeout to avoid blocking the whole action.
  let duration = 30; // default assumption
  try {
    const ffprobeBin = ffmpegBin.replace(/ffmpeg([^/]*)$/, "ffprobe$1");
    const { stdout } = await execa(ffprobeBin, [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1", videoPath,
    ], { timeout: 2_000 });
    const parsed = Number(stdout.trim());
    if (parsed > 0) duration = Math.floor(parsed);
  } catch {
    try {
      const { stdout } = await execa("ffprobe", [
        "-v", "error", "-select_streams", "v:0",
        "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1", videoPath,
      ], { timeout: 2_000 });
      const parsed = Number(stdout.trim());
      if (parsed > 0) duration = Math.floor(parsed);
    } catch {}
  }

  // 2 frames (1/4 and 3/4 of duration) — sufficient for perceptual matching.
  const FRAMES = 2;
  const pts = Array.from({ length: FRAMES }, (_, i) =>
    Math.max(0, Math.floor(((i + 0.5) / FRAMES) * duration))
  );

  const frameResults = await Promise.all(pts.map(async (t) => {
    const frame = await extractFrame(videoPath, t, ffmpegBin);
    if (!frame) return null;
    const [ph, dh] = await Promise.all([imagePHash64(frame), imageDHash64(frame)]);
    return { ph, dh };
  }));

  const phashes: Hash64[] = [];
  const dhashes: Hash64[] = [];
  for (const r of frameResults) {
    if (r) { phashes.push(r.ph); dhashes.push(r.dh); }
  }
  return { phashes, dhashes };
}

function averageHamming(sigA: Hash64[], sigB: Hash64[]): number {
  const m = Math.min(sigA.length, sigB.length);
  if (m === 0) return 32;
  const total = Array.from({ length: m }, (_, i) => hamming64(sigA[i], sigB[i]))
    .reduce((sum, v) => sum + v, 0);
  return total / m;
}

async function videoMetaSignature(tmpPath: string, ffmpegBin: string): Promise<MetaDict> {
  try {
    const ffprobeBin = ffmpegBin.replace(/ffmpeg([^/]*)$/, "ffprobe$1");
    const probeCmd = await execa(ffprobeBin, [
      "-v","error","-select_streams","v:0",
      "-show_entries","stream=codec_name,profile,level,pix_fmt,color_range,color_space,color_transfer,width,height,bit_rate,avg_frame_rate:format=bit_rate,duration",
      "-of","json", tmpPath,
    ], { timeout: 2_000 }).catch(() =>
      execa("ffprobe", [
        "-v","error","-select_streams","v:0",
        "-show_entries","stream=codec_name,profile,level,pix_fmt,color_range,color_space,color_transfer,width,height,bit_rate,avg_frame_rate:format=bit_rate,duration",
        "-of","json", tmpPath,
      ], { timeout: 2_000 })
    );
    const { stdout } = probeCmd;
    const j = JSON.parse(stdout);
    const s = j.streams?.[0] || {};
    const f = j.format || {};
    let fps = 0;
    if (typeof s.avg_frame_rate === "string" && s.avg_frame_rate.includes("/")) {
      const [n, d] = s.avg_frame_rate.split("/").map(Number);
      if (n && d) fps = n / d;
    }
    return {
      codec: s.codec_name,
      profile: s.profile,
      level: typeof s.level === "number" ? s.level : null,
      pix_fmt: s.pix_fmt,
      color_space: s.color_space,
      width: s.width,
      height: s.height,
      bit_rate_stream: typeof s.bit_rate === "number" ? s.bit_rate : null,
      bit_rate_container: typeof f.bit_rate === "number" ? f.bit_rate : null,
      fps,
      duration: typeof f.duration === "string" ? Number(f.duration) : null,
    };
  } catch {
    return {};
  }
}

function metaSimilarityVideos(a: MetaDict, b: MetaDict): number {
  let score = 0, wsum = 0;
  const add = (v: number, w: number) => { score += v * w; wsum += w; };

  if (a.codec || b.codec) add(a.codec === b.codec ? 100 : 0, 8);
  if (a.profile || b.profile) add(a.profile === b.profile ? 100 : 0, 5);
  if (typeof a.level === "number" && typeof b.level === "number") add(pctSimilarity(a.level, b.level, 0.5), 4);
  if (a.pix_fmt || b.pix_fmt) add(a.pix_fmt === b.pix_fmt ? 100 : 0, 3);
  if (a.color_space || b.color_space) add(a.color_space === b.color_space ? 100 : 0, 3);

  if (typeof a.width === "number" && typeof b.width === "number") add(pctSimilarity(a.width, b.width, 2), 5);
  if (typeof a.height === "number" && typeof b.height === "number") add(pctSimilarity(a.height, b.height, 2), 5);

  if (typeof a.fps === "number" && typeof b.fps === "number") add(pctSimilarity(a.fps, b.fps, 0.2), 6);

  const brA = (a.bit_rate_stream as number) || (a.bit_rate_container as number) || null;
  const brB = (b.bit_rate_stream as number) || (b.bit_rate_container as number) || null;
  if (typeof brA === "number" && typeof brB === "number") {
    const tol = 0.08 * Math.max(brA, brB);
    add(pctSimilarity(brA, brB, tol), 4);
  }
  if (typeof a.duration === "number" && typeof b.duration === "number") add(pctSimilarity(a.duration, b.duration, 0.2), 2);

  return wsum ? +(score / wsum).toFixed(2) : 0;
}

// ---------- ACTION PRINCIPALE ----------
export async function compareSimilarity(formData: FormData) {
  const a = formData.get("fileA") as File | null;
  const b = formData.get("fileB") as File | null;

  try {
    if (!a || !b) {
      return redirect("/dashboard/similarity?err=" + encodeURIComponent("Deux fichiers sont requis."));
    }

    const bufA = Buffer.from(await a.arrayBuffer());
    const bufB = Buffer.from(await b.arrayBuffer());

    // Cas octet-à-octet identiques
    if (bufA.length === bufB.length) {
      const [ha, hb] = await Promise.all([
        crypto.createHash("sha256").update(bufA).digest("hex"),
        crypto.createHash("sha256").update(bufB).digest("hex"),
      ]);
      if (ha === hb) return redirect("/dashboard/similarity?score=100.00");
    }

    const kindA = kindFromMimeOrExt(a.type || "", a.name);
    const kindB = kindFromMimeOrExt(b.type || "", b.name);
    if (kindA === "unknown" || kindB === "unknown" || kindA !== kindB) {
      return redirect("/dashboard/similarity?err=" + encodeURIComponent("Compare image↔image ou vidéo↔vidéo."));
    }

    let score = 0;
    type BreakdownItem = { label: string; value: number; weight: number };
    const breakdown: BreakdownItem[] = [];
    let metaA: MetaDict = {};
    let metaB: MetaDict = {};

    if (kindA === "image") {
      // VISUEL (hashs)
      const [pAList, pBList, aA, aB, dA, dB] = await Promise.all([
        multiCropPHashes(bufA),
        multiCropPHashes(bufB),
        imageAHash64(bufA), imageAHash64(bufB),
        imageDHash64(bufA), imageDHash64(bufB),
      ]);

      // meilleur appariement pHash multi-crops (min hamming)
      let bestH = 64;
      for (const pa of pAList) for (const pb of pBList) bestH = Math.min(bestH, hamming64(pa, pb));
      const pSim = simFromHamming(bestH);

      const aSim = simFromHamming(hamming64(aA, aB));
      const dSim = simFromHamming(hamming64(dA, dB));

      // META (base)
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "im-"));
      const pathA = path.join(tmpDir, `a_${randHex()}.bin`);
      const pathB = path.join(tmpDir, `b_${randHex()}.bin`);
      await fs.writeFile(pathA, bufA);
      await fs.writeFile(pathB, bufB);
      [metaA, metaB] = await Promise.all([imageMetaSignature(pathA), imageMetaSignature(pathB)]);
      await fs.rm(tmpDir, { recursive: true, force: true });
      const metaSim = metaSimilarityImages(metaA, metaB);

      // couleur & HF (sensibles aux filtres visuels)
      const [colorSim, hfSim] = await Promise.all([
        colorHistogramSimilarity(bufA, bufB),
        highFreqSimilarity(bufA, bufB),
      ]);

      // Pondération (somme ≈ 1)
      const W = { p: 0.35, d: 0.20, a: 0.10, color: 0.20, hf: 0.10, meta: 0.05 };
      score = pSim * W.p + dSim * W.d + aSim * W.a + colorSim * W.color + hfSim * W.hf + metaSim * W.meta;

      breakdown.push(
        { label: "pHash (perceptuel)", value: Math.round(pSim), weight: W.p },
        { label: "dHash (gradient)", value: Math.round(dSim), weight: W.d },
        { label: "aHash (moyenne)", value: Math.round(aSim), weight: W.a },
        { label: "Histogramme couleur", value: Math.round(colorSim), weight: W.color },
        { label: "Hautes fréquences", value: Math.round(hfSim), weight: W.hf },
        { label: "Métadonnées", value: Math.round(metaSim), weight: W.meta },
      );

      if (a.name !== b.name) score = Math.max(0, score - 6.43);

    } else {
      // VIDEO — resolve ffmpeg only when actually needed
      const ffmpegBin = await getFFmpegBin().catch(() => "ffmpeg");
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "v-"));
      const va = path.join(dir, `a_${randHex()}.mp4`);
      const vb = path.join(dir, `b_${randHex()}.mp4`);
      await Promise.all([fs.writeFile(va, bufA), fs.writeFile(vb, bufB)]);

      // Run all 4 in parallel: 2 frames × 2 videos = 4 concurrent ffmpeg + 2 ffprobe.
      const [[sigA, mvA], [sigB, mvB]] = await Promise.all([
        Promise.all([videoHashSignature(va, ffmpegBin), videoMetaSignature(va, ffmpegBin)]),
        Promise.all([videoHashSignature(vb, ffmpegBin), videoMetaSignature(vb, ffmpegBin)]),
      ]);
      await fs.rm(dir, { recursive: true, force: true });
      metaA = mvA;
      metaB = mvB;

      const pHamming = averageHamming(sigA.phashes, sigB.phashes);
      const dHamming = averageHamming(sigA.dhashes, sigB.dhashes);
      const pFrameSim = simFromHamming(pHamming);
      const dFrameSim = simFromHamming(dHamming);
      // Combined frame similarity: 70% pHash + 30% dHash
      const framesSim = pFrameSim * 0.7 + dFrameSim * 0.3;
      const metaSimV = metaSimilarityVideos(mvA, mvB);

      const WV = { frames: 0.72, meta: 0.28 };
      score = framesSim * WV.frames + metaSimV * WV.meta;

      breakdown.push(
        { label: `Frames pHash (2 frames)`, value: Math.round(pFrameSim), weight: WV.frames * 0.7 },
        { label: `Frames dHash (2 frames)`, value: Math.round(dFrameSim), weight: WV.frames * 0.3 },
        { label: "Métadonnées vidéo", value: Math.round(metaSimV), weight: WV.meta },
      );

      if (a.name !== b.name) score = Math.max(0, score - 6.43);
    }

    const finalScore = +score.toFixed(2);
    const details = Buffer.from(JSON.stringify({
      fileA: { name: a.name, size: bufA.length, kind: kindA, meta: metaA },
      fileB: { name: b.name, size: bufB.length, kind: kindB, meta: metaB },
      breakdown,
      score: finalScore,
    })).toString("base64url");

    return redirect(`/dashboard/similarity?score=${finalScore}&details=${details}`);
  } catch (e: any) {
    if (isNextRedirect(e)) throw e;
    return redirect("/dashboard/similarity?err=" + encodeURIComponent(e?.message || "Erreur comparaison"));
  }
}
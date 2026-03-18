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
import { createAdminClient } from "@/lib/supabase/admin";

function randHex(n = 2) {
  return crypto.randomBytes(n).toString("hex");
}
function isNextRedirect(e: unknown) {
  return !!(e && typeof e === "object" && "digest" in (e as any) && String((e as any).digest).startsWith("NEXT_REDIRECT"));
}

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

function hamming64(a: bigint, b: bigint): number {
  let x = a ^ b;
  let c = 0;
  while (x !== 0n) { x &= (x - 1n); c++; }
  return c;
}

function simFromHamming(h: number, bits = 64): number {
  return Math.max(0, Math.min(100, Math.round((1 - h / bits) * 100)));
}

// aHash: resize 8×8 grayscale, compare each pixel to mean — O(64), near-instant
async function aHash(buf: Buffer): Promise<bigint> {
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

// dHash: resize 9×8 grayscale, compare adjacent pixels — O(64), near-instant
async function dHash(buf: Buffer): Promise<bigint> {
  const arr = await sharp(buf).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits = (bits << 1n) | (arr[y * 9 + x] < arr[y * 9 + x + 1] ? 1n : 0n);
    }
  }
  return bits;
}

async function imageScore(bufA: Buffer, bufB: Buffer): Promise<number> {
  const [ahA, ahB, dhA, dhB] = await Promise.all([aHash(bufA), aHash(bufB), dHash(bufA), dHash(bufB)]);
  const aSim = simFromHamming(hamming64(ahA, ahB));
  const dSim = simFromHamming(hamming64(dhA, dhB));
  return aSim * 0.5 + dSim * 0.5;
}

// Extract 1 frame from a video at timestamp t (fast input-seek)
async function extractFrame(videoPath: string, t: number, ffmpegBin: string): Promise<Buffer | null> {
  const tmp = path.join(path.dirname(videoPath), `__f_${randHex()}.png`);
  try {
    await execa(ffmpegBin, [
      "-y", "-ss", String(t), "-i", videoPath,
      "-frames:v", "1", "-vf", "scale=64:-2", tmp,
    ], { timeout: 6_000 });
    const buf = await fs.readFile(tmp);
    await fs.unlink(tmp).catch(() => {});
    return buf;
  } catch {
    await fs.unlink(tmp).catch(() => {});
    return null;
  }
}

async function runComparisonAndRedirect(
  bufA: Buffer, nameA: string, mimeA: string,
  bufB: Buffer, nameB: string, mimeB: string,
): Promise<never> {
  // Identical bytes shortcut
  if (bufA.length === bufB.length) {
    const [ha, hb] = await Promise.all([
      crypto.createHash("sha256").update(bufA).digest("hex"),
      crypto.createHash("sha256").update(bufB).digest("hex"),
    ]);
    if (ha === hb) return redirect("/dashboard/similarity?score=100.00");
  }

  const kindA = kindFromMimeOrExt(mimeA, nameA);
  const kindB = kindFromMimeOrExt(mimeB, nameB);
  if (kindA === "unknown" || kindB === "unknown" || kindA !== kindB) {
    return redirect("/dashboard/similarity?err=" + encodeURIComponent("[SIM-002] Compare image↔image ou vidéo↔vidéo."));
  }

  let score: number;

  if (kindA === "image") {
    score = await imageScore(bufA, bufB);
  } else {
    const ffmpegBin = await getFFmpegBin().catch(() => "ffmpeg");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "v-"));
    const va = path.join(dir, `a_${randHex()}.mp4`);
    const vb = path.join(dir, `b_${randHex()}.mp4`);
    // Write both files in parallel
    await Promise.all([fs.writeFile(va, bufA), fs.writeFile(vb, bufB)]);

    // Extract 1 frame per video at t=1s — no ffprobe needed, fast input-seek
    const [fA, fB] = await Promise.all([
      extractFrame(va, 1, ffmpegBin),
      extractFrame(vb, 1, ffmpegBin),
    ]);
    await fs.rm(dir, { recursive: true, force: true });

    if (!fA || !fB) {
      return redirect("/dashboard/similarity?err=" + encodeURIComponent("[SIM-003] Extraction de frame impossible."));
    }
    score = await imageScore(fA, fB);
  }

  return redirect(`/dashboard/similarity?score=${score.toFixed(2)}`);
}

// ---------- ACTION VIA SUPABASE STORAGE ----------
export async function compareSimilarityByPaths(
  pathA: string, nameA: string, mimeA: string,
  pathB: string, nameB: string, mimeB: string,
) {
  try {
    const supabase = createAdminClient();
    const [dlA, dlB] = await Promise.all([
      supabase.storage.from("video-uploads").download(pathA),
      supabase.storage.from("video-uploads").download(pathB),
    ]);
    supabase.storage.from("video-uploads").remove([pathA, pathB]).catch(() => {});

    if (!dlA.data || !dlB.data) {
      return redirect("/dashboard/similarity?err=" + encodeURIComponent("[SIM-003] Téléchargement depuis le stockage échoué."));
    }

    const bufA = Buffer.from(await dlA.data.arrayBuffer());
    const bufB = Buffer.from(await dlB.data.arrayBuffer());

    await runComparisonAndRedirect(bufA, nameA, mimeA, bufB, nameB, mimeB);
  } catch (e: any) {
    if (isNextRedirect(e)) throw e;
    return redirect("/dashboard/similarity?err=" + encodeURIComponent("[SIM-003] " + (e?.message || "Erreur comparaison")));
  }
}

// ---------- ACTION DIRECTE (backward compat) ----------
export async function compareSimilarity(formData: FormData) {
  const a = formData.get("fileA") as File | null;
  const b = formData.get("fileB") as File | null;

  try {
    if (!a || !b) {
      return redirect("/dashboard/similarity?err=" + encodeURIComponent("[SIM-001] Deux fichiers sont requis."));
    }
    const bufA = Buffer.from(await a.arrayBuffer());
    const bufB = Buffer.from(await b.arrayBuffer());
    await runComparisonAndRedirect(bufA, a.name, a.type, bufB, b.name, b.type);
  } catch (e: any) {
    if (isNextRedirect(e)) throw e;
    return redirect("/dashboard/similarity?err=" + encodeURIComponent("[SIM-003] " + (e?.message || "Erreur comparaison")));
  }
}

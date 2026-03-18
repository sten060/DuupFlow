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

// pHash 64 bits (grayscale, DCT 32x32 → 8x8)
async function imagePHash64(buf: Buffer): Promise<bigint> {
  const N = 32;
  const raw = await sharp(buf).grayscale().resize(N, N, { fit: "fill" }).raw().toBuffer();
  const block: number[] = [];
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0;
      for (let x = 0; x < N; x++) {
        const cx = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N));
        for (let y = 0; y < N; y++) {
          sum += raw[x * N + y] * cx * Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N));
        }
      }
      block.push(sum);
    }
  }
  const sorted = [...block.slice(1)].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  let bits = 0n;
  for (let i = 0; i < 64; i++) {
    const v = i === 0 ? 0 : block[i];
    bits = (bits << 1n) | (v > median ? 1n : 0n);
  }
  return bits;
}

async function extractFrame(videoPath: string, t: number, ffmpegBin: string): Promise<Buffer | null> {
  const tmp = path.join(path.dirname(videoPath), `__frame_${t}_${randHex()}.png`);
  try {
    await execa(ffmpegBin, ["-y", "-ss", String(t), "-i", videoPath, "-frames:v", "1", "-vf", "scale=128:-2", tmp], { timeout: 8_000 });
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
    const [phA, phB] = await Promise.all([imagePHash64(bufA), imagePHash64(bufB)]);
    score = simFromHamming(hamming64(phA, phB));
  } else {
    const ffmpegBin = await getFFmpegBin().catch(() => "ffmpeg");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "v-"));
    const va = path.join(dir, `a_${randHex()}.mp4`);
    const vb = path.join(dir, `b_${randHex()}.mp4`);
    await Promise.all([fs.writeFile(va, bufA), fs.writeFile(vb, bufB)]);

    // Get duration for frame timestamps
    let duration = 30;
    try {
      const ffprobeBin = ffmpegBin.replace(/ffmpeg([^/]*)$/, "ffprobe$1");
      const { stdout } = await execa(ffprobeBin, [
        "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", va,
      ], { timeout: 2_000 });
      const parsed = Number(stdout.trim());
      if (parsed > 0) duration = Math.floor(parsed);
    } catch {}

    // Extract 2 frames (1/4 and 3/4) from both videos in parallel
    const pts = [Math.max(0, Math.floor(duration * 0.25)), Math.max(0, Math.floor(duration * 0.75))];
    const [fA0, fA1, fB0, fB1] = await Promise.all([
      extractFrame(va, pts[0], ffmpegBin),
      extractFrame(va, pts[1], ffmpegBin),
      extractFrame(vb, pts[0], ffmpegBin),
      extractFrame(vb, pts[1], ffmpegBin),
    ]);
    await fs.rm(dir, { recursive: true, force: true });

    const pairs = [[fA0, fB0], [fA1, fB1]].filter(([a, b]) => a && b) as [Buffer, Buffer][];
    if (!pairs.length) {
      return redirect("/dashboard/similarity?err=" + encodeURIComponent("[SIM-003] Extraction de frames impossible."));
    }

    const sims = await Promise.all(pairs.map(async ([a, b]) => {
      const [phA, phB] = await Promise.all([imagePHash64(a), imagePHash64(b)]);
      return simFromHamming(hamming64(phA, phB));
    }));
    score = sims.reduce((s, v) => s + v, 0) / sims.length;
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

// ---------- ACTION DIRECTE (backward compat pour images petites) ----------
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

// src/app/dashboard/similarity/actions.ts
"use server";

import sharp from "sharp";

type Hash64 = bigint;

// Precomputed DCT cosine table — computed once at module load, reused for every pHash
const DCT_N = 32;
const dctCos: number[][] = Array.from({ length: 8 }, (_, u) =>
  Array.from({ length: DCT_N }, (_, x) =>
    Math.cos(((2 * x + 1) * u * Math.PI) / (2 * DCT_N))
  )
);

function hamming64(a: Hash64, b: Hash64): number {
  let x = a ^ b, c = 0;
  while (x !== 0n) { x &= x - 1n; c++; }
  return c;
}
function simFromHamming(h: number, bits = 64): number {
  return Math.max(0, Math.min(100, Math.round((1 - h / bits) * 100)));
}

// pHash — DCT 32×32 → 8×8, cosines precomputed
async function pHash(buf: Buffer): Promise<Hash64> {
  const raw = await sharp(buf).grayscale().resize(DCT_N, DCT_N, { fit: "fill" }).raw().toBuffer();
  const block: number[] = [];
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0;
      for (let x = 0; x < DCT_N; x++) {
        const cx = dctCos[u][x];
        for (let y = 0; y < DCT_N; y++) {
          sum += raw[x * DCT_N + y] * cx * dctCos[v][y];
        }
      }
      block.push(sum);
    }
  }
  const median = [...block.slice(1)].sort((a, b) => a - b)[Math.floor(63 / 2)];
  let bits = 0n;
  for (let i = 0; i < 64; i++) {
    bits = (bits << 1n) | ((i > 0 && block[i] > median) ? 1n : 0n);
  }
  return bits;
}

// dHash — gradient horizontal 9×8
async function dHash(buf: Buffer): Promise<Hash64> {
  const arr = await sharp(buf).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++)
      bits = (bits << 1n) | (arr[y * 9 + x] < arr[y * 9 + x + 1] ? 1n : 0n);
  return bits;
}

// aHash — average luminosity 8×8
async function aHash(buf: Buffer): Promise<Hash64> {
  const arr = await sharp(buf).grayscale().resize(8, 8, { fit: "fill" }).raw().toBuffer();
  let sum = 0;
  for (let i = 0; i < 64; i++) sum += arr[i];
  const avg = sum / 64;
  let bits = 0n;
  for (let i = 0; i < 64; i++)
    bits = (bits << 1n) | (arr[i] >= avg ? 1n : 0n);
  return bits;
}

// Color histogram — 16 bins per R/G/B channel, normalized
async function colorHistogram(buf: Buffer): Promise<number[]> {
  const { data, info } = await sharp(buf)
    .resize(64, 64, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bins = new Array(48).fill(0);
  const ch = info.channels;
  for (let i = 0; i < data.length; i += ch) {
    bins[data[i] >> 4]++;
    bins[16 + (data[i + 1] >> 4)]++;
    bins[32 + (data[i + 2] >> 4)]++;
  }
  const pixels = info.width * info.height;
  return bins.map(v => v / pixels);
}

function histogramSimilarity(hA: number[], hB: number[]): number {
  let inter = 0, union = 0;
  for (let i = 0; i < hA.length; i++) {
    inter += Math.min(hA[i], hB[i]);
    union += Math.max(hA[i], hB[i]);
  }
  return union ? Math.round((inter / union) * 100) : 100;
}

// MSE — mean squared error on 64×64 grayscale, converted to similarity score.
// More sensitive to subtle pixel changes (brightness, contrast, hue, saturation)
// than hash algorithms. Uses sqrt(MSE) with sensitivity threshold.
async function mseSimilarity(bufA: Buffer, bufB: Buffer): Promise<number> {
  const SIZE = 64;
  const [rawA, rawB] = await Promise.all([
    sharp(bufA).grayscale().resize(SIZE, SIZE, { fit: "fill" }).raw().toBuffer(),
    sharp(bufB).grayscale().resize(SIZE, SIZE, { fit: "fill" }).raw().toBuffer(),
  ]);
  let mse = 0;
  for (let i = 0; i < rawA.length; i++) {
    const d = rawA[i] - rawB[i];
    mse += d * d;
  }
  mse /= rawA.length;
  // Convert to similarity: MSE=0 → 100%, sqrt(MSE)=80 → 0%
  // A 7% brightness change yields sqrt(MSE) ≈ 10 → ~87.5% — reflects the subtle change
  return Math.max(0, Math.min(100, Math.round((1 - Math.sqrt(mse) / 80) * 100)));
}

// Texture — local variance in 4×4 blocks of a 32×32 image.
// Sensitive to sharpness changes (unsharp, kernel, grain, contrast).
async function textureVariance(buf: Buffer): Promise<number[]> {
  const SIZE = 32;
  const BLOCK = 8;
  const arr = await sharp(buf).grayscale().resize(SIZE, SIZE, { fit: "fill" }).raw().toBuffer();
  const blocks: number[] = [];
  for (let by = 0; by < SIZE; by += BLOCK) {
    for (let bx = 0; bx < SIZE; bx += BLOCK) {
      let sum = 0, sumSq = 0, n = 0;
      for (let y = by; y < by + BLOCK && y < SIZE; y++) {
        for (let x = bx; x < bx + BLOCK && x < SIZE; x++) {
          const v = arr[y * SIZE + x];
          sum += v; sumSq += v * v; n++;
        }
      }
      const mean = sum / n;
      blocks.push(sumSq / n - mean * mean);
    }
  }
  return blocks;
}

function textureSimilarity(varA: number[], varB: number[]): number {
  // Cosine similarity between variance vectors
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < varA.length; i++) {
    dot += varA[i] * varB[i];
    magA += varA[i] * varA[i];
    magB += varB[i] * varB[i];
  }
  if (magA === 0 && magB === 0) return 100; // both flat → identical texture
  if (magA === 0 || magB === 0) return 0;
  return Math.max(0, Math.min(100, Math.round((dot / Math.sqrt(magA * magB)) * 100)));
}

// Horizontal flip of a buffer image — for mirror (reverse) detection
async function flippedBuffer(buf: Buffer): Promise<Buffer> {
  return sharp(buf).flop().toBuffer();
}

export type PairScore = {
  score: number;        // final weighted score (0–100)
  breakdown: {
    phash: number;      // perceptual structure (DCT)
    dhash: number;      // gradient edges
    ahash: number;      // luminosity
    color: number;      // color distribution
    mse: number;        // pixel-level fidelity
    texture: number;    // sharpness / local variance
    mirrored: boolean;  // true if B appears to be a horizontal flip of A
  };
};

// Score a single pair of thumbnails using all algorithms
async function scorePair(bufA: Buffer, bufB: Buffer): Promise<PairScore> {
  const [
    phA, phB,
    dhA, dhB,
    ahA, ahB,
    histA, histB,
    varA, varB,
    mse,
    flippedA,
  ] = await Promise.all([
    pHash(bufA), pHash(bufB),
    dHash(bufA), dHash(bufB),
    aHash(bufA), aHash(bufB),
    colorHistogram(bufA), colorHistogram(bufB),
    textureVariance(bufA), textureVariance(bufB),
    mseSimilarity(bufA, bufB),
    flippedBuffer(bufA),
  ]);

  // Hashes of mirrored A — detect the `reverse` (horizontal flip) filter
  const [phFlipA, dhFlipA, ahFlipA] = await Promise.all([
    pHash(flippedA),
    dHash(flippedA),
    aHash(flippedA),
  ]);

  const ph = simFromHamming(hamming64(phA, phB));
  const dh = simFromHamming(hamming64(dhA, dhB));
  const ah = simFromHamming(hamming64(ahA, ahB));
  const ch = histogramSimilarity(histA, histB);
  const tx = textureSimilarity(varA, varB);

  // Mirror similarity — how close is B to a horizontal flip of A?
  const phMirror = simFromHamming(hamming64(phFlipA, phB));
  const dhMirror = simFromHamming(hamming64(dhFlipA, dhB));
  const ahMirror = simFromHamming(hamming64(ahFlipA, ahB));
  const mirrorStructScore = phMirror * 0.6 + dhMirror * 0.3 + ahMirror * 0.1;

  // A "mirrored" flag: if B looks more like flip(A) than A itself,
  // and that similarity is > 60%, B is likely a horizontal mirror of A.
  const normalStructScore = ph * 0.6 + dh * 0.3 + ah * 0.1;
  const mirrored = mirrorStructScore > normalStructScore + 10 && mirrorStructScore > 60;

  // Weights (must sum to 1.0):
  // pHash 30% — perceptual structure (sensitive to crops, rotation, flip)
  // dHash 20% — edge gradients (sensitive to sharpness, zoom, structural changes)
  // aHash  5% — luminosity (sensitive to global brightness, gamma)
  // color  20% — color distribution (sensitive to saturation, hue, brightness)
  // MSE   15% — pixel-level (most sensitive to any pixel change)
  // texture 10% — local variance (sensitive to unsharp, grain, contrast, kernel)
  const score = ph * 0.30 + dh * 0.20 + ah * 0.05 + ch * 0.20 + mse * 0.15 + tx * 0.10;

  return {
    score,
    breakdown: { phash: ph, dhash: dh, ahash: ah, color: ch, mse, texture: tx, mirrored },
  };
}

// Compare N frame thumbnails (base64 JPEG) from two files
export async function compareFiles(
  framesA: string[],
  framesB: string[],
): Promise<{ score: number; breakdown: PairScore["breakdown"] } | { error: string }> {
  try {
    if (!framesA.length || !framesB.length) return { error: "Aucun frame reçu" };

    // Compare each frame pair (min count)
    const count = Math.min(framesA.length, framesB.length);
    const pairs = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        scorePair(Buffer.from(framesA[i], "base64"), Buffer.from(framesB[i], "base64"))
      )
    );

    // Average all frame scores
    const avgScore = pairs.reduce((s, p) => s + p.score, 0) / pairs.length;

    // Average breakdown metrics across frames
    const breakdown: PairScore["breakdown"] = {
      phash:   Math.round(pairs.reduce((s, p) => s + p.breakdown.phash, 0)   / pairs.length),
      dhash:   Math.round(pairs.reduce((s, p) => s + p.breakdown.dhash, 0)   / pairs.length),
      ahash:   Math.round(pairs.reduce((s, p) => s + p.breakdown.ahash, 0)   / pairs.length),
      color:   Math.round(pairs.reduce((s, p) => s + p.breakdown.color, 0)   / pairs.length),
      mse:     Math.round(pairs.reduce((s, p) => s + p.breakdown.mse, 0)     / pairs.length),
      texture: Math.round(pairs.reduce((s, p) => s + p.breakdown.texture, 0) / pairs.length),
      mirrored: pairs.some(p => p.breakdown.mirrored),
    };

    return { score: +avgScore.toFixed(2), breakdown };
  } catch (e: any) {
    return { error: e?.message || "Erreur comparaison" };
  }
}

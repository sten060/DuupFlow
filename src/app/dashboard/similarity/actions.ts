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

// RGB Color histogram — 32 bins per channel (was 16), normalized.
// 32 bins = each bin covers 8 luminance levels → twice as sensitive to subtle color changes.
async function colorHistogram(buf: Buffer): Promise<number[]> {
  const { data, info } = await sharp(buf)
    .resize(64, 64, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bins = new Array(96).fill(0); // 3 channels × 32 bins
  const ch = info.channels;
  for (let i = 0; i < data.length; i += ch) {
    bins[data[i] >> 3]++;               // R: value/8 → bin 0-31
    bins[32 + (data[i + 1] >> 3)]++;   // G
    bins[64 + (data[i + 2] >> 3)]++;   // B
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

// Chroma histogram — Cb and Cr channels derived from RGB (BT.601 coefficients).
// Sensitive to: hue, saturation, colorchannelmixer, chroma noise (c1/c2 FFmpeg noise),
// and any filter that shifts the color channels independently of luminance.
// Uses 32 bins per channel (each bin = 4 chroma units of 0-255 range).
async function chromaHistogram(buf: Buffer): Promise<number[]> {
  const { data, info } = await sharp(buf)
    .resize(64, 64, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bins = new Array(64).fill(0); // 32 bins Cb + 32 bins Cr
  const ch = info.channels;
  for (let i = 0; i < data.length; i += ch) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // BT.601: Cb = -0.169R - 0.331G + 0.500B + 128
    //         Cr =  0.500R - 0.419G - 0.081B + 128
    const cb = Math.max(0, Math.min(255, Math.round(-0.169 * r - 0.331 * g + 0.500 * b + 128)));
    const cr = Math.max(0, Math.min(255, Math.round( 0.500 * r - 0.419 * g - 0.081 * b + 128)));
    bins[cb >> 3]++;        // Cb: 32 bins (value/8)
    bins[32 + (cr >> 3)]++; // Cr: 32 bins
  }
  const pixels = info.width * info.height;
  return bins.map(v => v / pixels);
}

// MSE — mean squared error on 96×96 grayscale (was 64×64 → more pixels = more precision).
// More sensitive to subtle pixel changes than hash algorithms.
// Uses sqrt(MSE)/80 sensitivity: 7% brightness change → ~87% similarity (reflects it).
async function mseSimilarity(bufA: Buffer, bufB: Buffer): Promise<number> {
  const SIZE = 96; // increased from 64 for better per-pixel precision
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
  return Math.max(0, Math.min(100, Math.round((1 - Math.sqrt(mse) / 80) * 100)));
}

// Texture — local variance in 4×4 blocks of a 32×32 image.
// Sensitive to sharpness changes (unsharp, kernel, grain/noise, contrast).
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
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < varA.length; i++) {
    dot += varA[i] * varB[i];
    magA += varA[i] * varA[i];
    magB += varB[i] * varB[i];
  }
  if (magA === 0 && magB === 0) return 100;
  if (magA === 0 || magB === 0) return 0;
  return Math.max(0, Math.min(100, Math.round((dot / Math.sqrt(magA * magB)) * 100)));
}

// Horizontal flip of a buffer image — for mirror (reverse filter) detection
async function flippedBuffer(buf: Buffer): Promise<Buffer> {
  return sharp(buf).flop().toBuffer();
}

export type PairScore = {
  score: number;
  breakdown: {
    phash: number;    // perceptual structure (DCT) — robust but less sensitive
    dhash: number;    // gradient edges
    ahash: number;    // luminosity
    color: number;    // RGB color distribution (32 bins/channel)
    mse: number;      // pixel-level fidelity (96×96)
    texture: number;  // sharpness / local variance
    chroma: number;   // Cb/Cr chroma channels — sensitive to noise/hue/saturation
    mirrored: boolean;
  };
};

// Score a single pair of thumbnails using all 7 algorithms
async function scorePair(bufA: Buffer, bufB: Buffer): Promise<PairScore> {
  const [
    phA, phB,
    dhA, dhB,
    ahA, ahB,
    histA, histB,
    chromaA, chromaB,
    varA, varB,
    mse,
    flippedA,
  ] = await Promise.all([
    pHash(bufA), pHash(bufB),
    dHash(bufA), dHash(bufB),
    aHash(bufA), aHash(bufB),
    colorHistogram(bufA), colorHistogram(bufB),
    chromaHistogram(bufA), chromaHistogram(bufB),
    textureVariance(bufA), textureVariance(bufB),
    mseSimilarity(bufA, bufB),
    flippedBuffer(bufA),
  ]);

  // Mirror detection (reverse filter)
  const [phFlipA, dhFlipA, ahFlipA] = await Promise.all([
    pHash(flippedA),
    dHash(flippedA),
    aHash(flippedA),
  ]);

  const ph = simFromHamming(hamming64(phA, phB));
  const dh = simFromHamming(hamming64(dhA, dhB));
  const ah = simFromHamming(hamming64(ahA, ahB));
  const ch = histogramSimilarity(histA, histB);
  const chroma = histogramSimilarity(chromaA, chromaB);
  const tx = textureSimilarity(varA, varB);

  const phMirror = simFromHamming(hamming64(phFlipA, phB));
  const dhMirror = simFromHamming(hamming64(dhFlipA, dhB));
  const ahMirror = simFromHamming(hamming64(ahFlipA, ahB));
  const mirrorStructScore = phMirror * 0.6 + dhMirror * 0.3 + ahMirror * 0.1;
  const normalStructScore = ph * 0.6 + dh * 0.3 + ah * 0.1;
  const mirrored = mirrorStructScore > normalStructScore + 10 && mirrorStructScore > 60;

  // Weights (sum = 1.0):
  // Perceptual hashes (pHash, dHash) are intentionally robust — less sensitive to small
  // changes by design. We reduce their weight and boost pixel-level metrics (MSE, chroma)
  // so that the subtle changes from duplication filters (chroma noise, pixel shift, CRF
  // variation, speed change) register in the final score.
  //
  // pHash    15% — structural fingerprint (strong changes: crop, rotation, flip)
  // dHash    15% — edge gradient (sharpness, zoom, pixel shift)
  // aHash     5% — global luminosity
  // color    18% — RGB distribution (32 bins: saturation, brightness, hue)
  // MSE      20% — pixel-level (most sensitive: CRF variation, any pixel change)
  // texture  10% — local variance (grain, unsharp, contrast)
  // chroma   17% — Cb/Cr channels (chroma noise, hue, saturation, colorchannelmixer)
  const score =
    ph * 0.15 + dh * 0.15 + ah * 0.05 +
    ch * 0.18 + mse * 0.20 + tx * 0.10 + chroma * 0.17;

  return {
    score,
    breakdown: { phash: ph, dhash: dh, ahash: ah, color: ch, mse, texture: tx, chroma, mirrored },
  };
}

export async function compareFiles(
  framesA: string[],
  framesB: string[],
): Promise<{ score: number; breakdown: PairScore["breakdown"] } | { error: string }> {
  try {
    if (!framesA.length || !framesB.length) return { error: "Aucun frame reçu" };

    const count = Math.min(framesA.length, framesB.length);
    const pairs = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        scorePair(Buffer.from(framesA[i], "base64"), Buffer.from(framesB[i], "base64"))
      )
    );

    const avgScore = pairs.reduce((s, p) => s + p.score, 0) / pairs.length;

    const breakdown: PairScore["breakdown"] = {
      phash:   Math.round(pairs.reduce((s, p) => s + p.breakdown.phash, 0)   / pairs.length),
      dhash:   Math.round(pairs.reduce((s, p) => s + p.breakdown.dhash, 0)   / pairs.length),
      ahash:   Math.round(pairs.reduce((s, p) => s + p.breakdown.ahash, 0)   / pairs.length),
      color:   Math.round(pairs.reduce((s, p) => s + p.breakdown.color, 0)   / pairs.length),
      mse:     Math.round(pairs.reduce((s, p) => s + p.breakdown.mse, 0)     / pairs.length),
      texture: Math.round(pairs.reduce((s, p) => s + p.breakdown.texture, 0) / pairs.length),
      chroma:  Math.round(pairs.reduce((s, p) => s + p.breakdown.chroma, 0)  / pairs.length),
      mirrored: pairs.some(p => p.breakdown.mirrored),
    };

    return { score: +avgScore.toFixed(2), breakdown };
  } catch (e: any) {
    return { error: e?.message || "Erreur comparaison" };
  }
}

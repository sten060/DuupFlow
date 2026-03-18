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

// Score a single pair of thumbnails using all 4 methods
async function scorePair(bufA: Buffer, bufB: Buffer): Promise<number> {
  const [phA, phB, dhA, dhB, ahA, ahB, histA, histB] = await Promise.all([
    pHash(bufA), pHash(bufB),
    dHash(bufA), dHash(bufB),
    aHash(bufA), aHash(bufB),
    colorHistogram(bufA), colorHistogram(bufB),
  ]);
  const ph = simFromHamming(hamming64(phA, phB));  // perceptual structure (DCT)
  const dh = simFromHamming(hamming64(dhA, dhB));  // gradient edges
  const ah = simFromHamming(hamming64(ahA, ahB));  // luminosity
  const ch = histogramSimilarity(histA, histB);     // color distribution
  return ph * 0.45 + dh * 0.25 + ah * 0.10 + ch * 0.20;
}

// Compare N frame thumbnails (base64 JPEG) from two files
export async function compareFiles(
  framesA: string[],
  framesB: string[],
): Promise<{ score: number } | { error: string }> {
  try {
    if (!framesA.length || !framesB.length) return { error: "Aucun frame reçu" };

    // Compare each frame pair (min count)
    const count = Math.min(framesA.length, framesB.length);
    const scores = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        scorePair(Buffer.from(framesA[i], "base64"), Buffer.from(framesB[i], "base64"))
      )
    );

    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    return { score: +avg.toFixed(2) };
  } catch (e: any) {
    return { error: e?.message || "Erreur comparaison" };
  }
}

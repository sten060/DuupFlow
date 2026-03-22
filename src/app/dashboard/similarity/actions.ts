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

// Luminance histogram — 64 fine-grained bins on 128×128 grayscale.
// More sensitive than aHash to subtle brightness/contrast/gamma shifts.
// A ±3% brightness change shifts the distribution visibly across bins.
async function lumaHistogram(buf: Buffer): Promise<number[]> {
  const { data, info } = await sharp(buf)
    .grayscale()
    .resize(128, 128, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bins = new Array(64).fill(0);
  for (let i = 0; i < data.length; i++) {
    bins[data[i] >> 2]++; // 64 bins: each covers 4 luminance levels (0-255 → bins 0-63)
  }
  const pixels = info.width * info.height;
  return bins.map(v => v / pixels);
}

// Spatial grid — 8×8 = 64 cells, mean luminance per cell on a 64×64 image.
// Sensitive to zoom, crop offsets, vignette, lens distortion, and any spatial transformation.
async function spatialGrid(buf: Buffer): Promise<number[]> {
  const SIZE = 64;
  const CELLS = 8;
  const CELL = SIZE / CELLS; // 8 pixels per cell side
  const arr = await sharp(buf).grayscale().resize(SIZE, SIZE, { fit: "fill" }).raw().toBuffer();
  const means: number[] = [];
  for (let cy = 0; cy < CELLS; cy++) {
    for (let cx = 0; cx < CELLS; cx++) {
      let sum = 0;
      for (let y = cy * CELL; y < (cy + 1) * CELL; y++) {
        for (let x = cx * CELL; x < (cx + 1) * CELL; x++) {
          sum += arr[y * SIZE + x];
        }
      }
      means.push(sum / (CELL * CELL * 255)); // normalized 0-1
    }
  }
  return means;
}

function spatialGridSimilarity(gA: number[], gB: number[]): number {
  let sum = 0;
  for (let i = 0; i < gA.length; i++) sum += Math.abs(gA[i] - gB[i]);
  const avgDiff = sum / gA.length; // 0-1 range
  return Math.max(0, Math.min(100, Math.round((1 - avgDiff * 7) * 100)));
}

// Gradient magnitude histogram — 32 bins of pixel gradient magnitudes on 64×64.
// Captures the distribution of local edge strengths: sensitive to noise, grain,
// unsharp, sharpness filters, and any change in local contrast.
async function gradientHistogram(buf: Buffer): Promise<number[]> {
  const SIZE = 64;
  const arr = await sharp(buf).grayscale().resize(SIZE, SIZE, { fit: "fill" }).raw().toBuffer();
  const BINS = 32;
  const bins = new Array(BINS).fill(0);
  let count = 0;
  for (let y = 0; y < SIZE - 1; y++) {
    for (let x = 0; x < SIZE - 1; x++) {
      const gx = Math.abs(arr[y * SIZE + x + 1] - arr[y * SIZE + x]);
      const gy = Math.abs(arr[(y + 1) * SIZE + x] - arr[y * SIZE + x]);
      const mag = Math.min(255, gx + gy);
      bins[Math.floor(mag * BINS / 256)]++;
      count++;
    }
  }
  return bins.map(v => v / count);
}

// SSIM — Structural Similarity Index Measure, 8×8 block windowed on 64×64 grayscale.
// Industry gold standard: used by YouTube, Netflix, major video platforms.
// Combines luminance (µ), contrast (σ), and structure (σAB) independently.
// More discriminating than MSE for noise, blur, and local distortions (tblend, grain).
async function ssimSimilarity(bufA: Buffer, bufB: Buffer): Promise<number> {
  const SIZE = 64;
  const BLOCK = 8;
  const C1 = 6.5025;   // (0.01 * 255)²
  const C2 = 58.5225;  // (0.03 * 255)²
  const [rawA, rawB] = await Promise.all([
    sharp(bufA).grayscale().resize(SIZE, SIZE, { fit: "fill" }).raw().toBuffer(),
    sharp(bufB).grayscale().resize(SIZE, SIZE, { fit: "fill" }).raw().toBuffer(),
  ]);
  let ssimSum = 0, count = 0;
  for (let by = 0; by <= SIZE - BLOCK; by += BLOCK) {
    for (let bx = 0; bx <= SIZE - BLOCK; bx += BLOCK) {
      let sA = 0, sB = 0, sA2 = 0, sB2 = 0, sAB = 0, n = 0;
      for (let y = by; y < by + BLOCK; y++) {
        for (let x = bx; x < bx + BLOCK; x++) {
          const a = rawA[y * SIZE + x], b = rawB[y * SIZE + x];
          sA += a; sB += b; sA2 += a * a; sB2 += b * b; sAB += a * b; n++;
        }
      }
      const mA = sA / n, mB = sB / n;
      const vA = sA2 / n - mA * mA;
      const vB = sB2 / n - mB * mB;
      const cv = sAB / n - mA * mB;
      ssimSum += (2 * mA * mB + C1) * (2 * cv + C2) /
                 ((mA * mA + mB * mB + C1) * (vA + vB + C2));
      count++;
    }
  }
  return Math.max(0, Math.min(100, Math.round((ssimSum / count) * 100)));
}

// Color moments — mean, std, skewness per RGB channel (9 values total).
// Captures higher-order distribution statistics missed by histograms.
// Mean → brightness. Std → contrast. Skewness → asymmetric tone distribution.
// Sensitive to: hue shifts, saturation changes, colorchannelmixer, eq.
async function colorMoments(buf: Buffer): Promise<number[]> {
  const { data, info } = await sharp(buf)
    .resize(64, 64, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const pixels = info.width * info.height;
  const moments: number[] = [];
  for (let c = 0; c < 3; c++) {
    let s1 = 0, s2 = 0, s3 = 0;
    for (let i = 0; i < data.length; i += ch) {
      const v = data[i + c] / 255;
      s1 += v; s2 += v * v; s3 += v * v * v;
    }
    const mean = s1 / pixels;
    const variance = Math.max(0, s2 / pixels - mean * mean);
    const std = Math.sqrt(variance);
    const skewRaw = variance > 0
      ? (s3 / pixels - 3 * mean * variance - mean * mean * mean) / (std * std * std)
      : 0;
    moments.push(mean, std, Math.tanh(skewRaw / 3)); // tanh normalises skewness to -1..1
  }
  return moments; // [µR, σR, κR, µG, σG, κG, µB, σB, κB]
}

function colorMomentSimilarity(mA: number[], mB: number[]): number {
  // Weighted L1: mean (×3), std (×2), skewness (×1 — less stable)
  const W = [3, 2, 1, 3, 2, 1, 3, 2, 1];
  const wSum = 18;
  let diff = 0;
  for (let i = 0; i < mA.length; i++) {
    const range = (i % 3 === 2) ? 2 : 1; // skewness lives in -1..1, scale diff accordingly
    diff += W[i] * Math.abs(mA[i] - mB[i]) / range;
  }
  return Math.max(0, Math.min(100, Math.round((1 - (diff / wSum) * 4) * 100)));
}

// Edge orientation histogram — 8 directional bins (0°, 45°, 90°… 315°) on 64×64.
// Captures the structural orientation fingerprint of the frame.
// Sensitive to: rotation, horizontal/vertical flip, zoom distortion, lens correction.
// Social platforms use edge orientation as a structural feature for copy detection.
async function edgeOrientationHistogram(buf: Buffer): Promise<number[]> {
  const SIZE = 64;
  const arr = await sharp(buf).grayscale().resize(SIZE, SIZE, { fit: "fill" }).raw().toBuffer();
  const BINS = 8;
  const bins = new Array(BINS).fill(0);
  let total = 0;
  for (let y = 0; y < SIZE - 1; y++) {
    for (let x = 0; x < SIZE - 1; x++) {
      const gx = arr[y * SIZE + x + 1] - arr[y * SIZE + x];
      const gy = arr[(y + 1) * SIZE + x] - arr[y * SIZE + x];
      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag > 8) { // threshold: only significant edges contribute
        const angle = Math.atan2(gy, gx); // -π to π
        const bin = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * BINS) % BINS;
        bins[bin]++;
        total++;
      }
    }
  }
  return total > 0 ? bins.map(v => v / total) : bins;
}

// Projection profiles — normalised sum of luminance per row (64 values) and per
// column (64 values) = 128-value vector.
// Captures the 1-D spatial content distribution along each axis.
// Very sensitive to: zoom offset, pixel shift, vignette, horizontal/vertical crops.
async function projectionProfiles(buf: Buffer): Promise<number[]> {
  const SIZE = 64;
  const arr = await sharp(buf).grayscale().resize(SIZE, SIZE, { fit: "fill" }).raw().toBuffer();
  const rows = new Array(SIZE).fill(0);
  const cols = new Array(SIZE).fill(0);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      rows[y] += arr[y * SIZE + x];
      cols[x] += arr[y * SIZE + x];
    }
  const maxR = Math.max(...rows) || 1;
  const maxC = Math.max(...cols) || 1;
  return [...rows.map(v => v / maxR), ...cols.map(v => v / maxC)];
}

function projectionSimilarity(pA: number[], pB: number[]): number {
  let sum = 0;
  for (let i = 0; i < pA.length; i++) sum += Math.abs(pA[i] - pB[i]);
  const avgDiff = sum / pA.length;
  return Math.max(0, Math.min(100, Math.round((1 - avgDiff * 4) * 100)));
}

// Horizontal flip of a buffer image — for mirror (reverse filter) detection
async function flippedBuffer(buf: Buffer): Promise<Buffer> {
  return sharp(buf).flop().toBuffer();
}

// Metadata similarity — compares EXIF richness, file size, format, ICC, density, chroma.
// sizeA/sizeB = taille réelle du fichier (pas celle du header 128KB) — crucial pour les vidéos.
async function metadataSimilarity(bufA: Buffer, bufB: Buffer, sizeA?: number, sizeB?: number): Promise<number> {
  const [metaA, metaB] = await Promise.all([
    sharp(bufA, { failOn: "none" }).metadata().catch(() => ({} as sharp.Metadata)),
    sharp(bufB, { failOn: "none" }).metadata().catch(() => ({} as sharp.Metadata)),
  ]);

  let score = 100;

  // Format mismatch (jpeg vs png vs webp) — 15pt
  if (metaA.format && metaB.format && metaA.format !== metaB.format) score -= 15;

  // File size ratio — up to 30pt
  // Utilise la taille réelle du fichier si disponible (les vidéos dépassent 128KB).
  // Sans sizeA/sizeB, bufA.length = bufB.length = 128KB → ratio 1.0 → 0pt (bogue vidéo).
  const realSizeA = sizeA ?? bufA.length;
  const realSizeB = sizeB ?? bufB.length;
  if (realSizeA > 0 && realSizeB > 0) {
    const ratio = Math.min(realSizeA, realSizeB) / Math.max(realSizeA, realSizeB);
    score -= Math.round((1 - ratio) * 30);
  }

  // EXIF richness — up to 40pt
  // Niveau 0 = 0 octets, niveau 2 = ~1500B → ratio 0 → pénalité maximale
  const exifA = metaA.exif?.length ?? 0;
  const exifB = metaB.exif?.length ?? 0;
  if (exifA > 0 || exifB > 0) {
    const exifRatio = Math.min(exifA, exifB) / Math.max(exifA, exifB, 1);
    score -= Math.round((1 - exifRatio) * 40);
  } else {
    // Les deux sans EXIF = même signature technique → pénalité légère
    score -= 5;
  }

  // ICC color profile presence — 10pt (phone photos have ICC, DuupFlow output doesn't)
  if (!!metaA.icc !== !!metaB.icc) score -= 10;

  // Density/DPI — up to 10pt
  const densA = metaA.density ?? 72;
  const densB = metaB.density ?? 72;
  const densRatio = Math.min(densA, densB) / Math.max(densA, densB);
  score -= Math.round((1 - densRatio) * 10);

  // Progressive encoding — 5pt
  if (metaA.isProgressive !== metaB.isProgressive) score -= 5;

  // Chroma subsampling — 5pt (4:2:0 original vs 4:4:4 duplicate)
  if (metaA.chromaSubsampling && metaB.chromaSubsampling &&
      metaA.chromaSubsampling !== metaB.chromaSubsampling) score -= 5;

  // Dimensions — up to 10pt (if crop/resize produces different output dimensions)
  if (metaA.width && metaB.width && metaA.height && metaB.height) {
    const wR = Math.min(metaA.width, metaB.width) / Math.max(metaA.width, metaB.width);
    const hR = Math.min(metaA.height, metaB.height) / Math.max(metaA.height, metaB.height);
    score -= Math.round((1 - (wR + hR) / 2) * 10);
  }

  return Math.max(0, Math.min(100, score));
}

export type PairScore = {
  score: number;
  breakdown: {
    ssim: number;      // Structural Similarity Index (luminance × contrast × structure)
    mse: number;       // pixel-level fidelity (96×96 grayscale)
    spatial: number;   // spatial grid 8×8 (zoom, crop, vignette)
    chroma: number;    // Cb/Cr chroma channels (hue, saturation, chroma noise)
    color: number;     // RGB distribution 32 bins/channel
    luma: number;      // luminance histogram 64 bins (brightness/contrast/gamma)
    colorMom: number;  // color moments mean/std/skew per channel
    phash: number;     // perceptual structure fingerprint (DCT)
    dhash: number;     // edge gradient fingerprint
    edgeOr: number;    // edge orientation histogram 8 directions
    gradient: number;  // gradient magnitude histogram (noise/grain/sharpness)
    proj: number;      // projection profiles row+col (spatial shift)
    texture: number;   // local variance (grain/noise/contrast)
    ahash: number;     // global luminosity
    metadata: number;  // file metadata: EXIF richness, ICC, size, format, DPI, chroma
    filename: number;  // similarité du nom de fichier (100 = identiques, 0 = totalement différents)
    mirrored: boolean;
  };
};

// Score a single pair of thumbnails using all 14 algorithms
async function scorePair(bufA: Buffer, bufB: Buffer): Promise<PairScore> {
  const [
    phA, phB,
    dhA, dhB,
    ahA, ahB,
    histA, histB,
    chromaA, chromaB,
    varA, varB,
    lumaA, lumaB,
    gridA, gridB,
    gradA, gradB,
    momA, momB,
    edgeA, edgeB,
    projA, projB,
    mse,
    ssim,
    flippedA,
  ] = await Promise.all([
    pHash(bufA), pHash(bufB),
    dHash(bufA), dHash(bufB),
    aHash(bufA), aHash(bufB),
    colorHistogram(bufA), colorHistogram(bufB),
    chromaHistogram(bufA), chromaHistogram(bufB),
    textureVariance(bufA), textureVariance(bufB),
    lumaHistogram(bufA), lumaHistogram(bufB),
    spatialGrid(bufA), spatialGrid(bufB),
    gradientHistogram(bufA), gradientHistogram(bufB),
    colorMoments(bufA), colorMoments(bufB),
    edgeOrientationHistogram(bufA), edgeOrientationHistogram(bufB),
    projectionProfiles(bufA), projectionProfiles(bufB),
    mseSimilarity(bufA, bufB),
    ssimSimilarity(bufA, bufB),
    flippedBuffer(bufA),
  ]);

  // Mirror detection (reverse filter)
  const [phFlipA, dhFlipA, ahFlipA] = await Promise.all([
    pHash(flippedA),
    dHash(flippedA),
    aHash(flippedA),
  ]);

  const ph      = simFromHamming(hamming64(phA, phB));
  const dh      = simFromHamming(hamming64(dhA, dhB));
  const ah      = simFromHamming(hamming64(ahA, ahB));
  const ch      = histogramSimilarity(histA, histB);
  const chroma  = histogramSimilarity(chromaA, chromaB);
  const tx      = textureSimilarity(varA, varB);
  const luma    = histogramSimilarity(lumaA, lumaB);
  const spatial = spatialGridSimilarity(gridA, gridB);
  const gradient = histogramSimilarity(gradA, gradB);
  const colorMom = colorMomentSimilarity(momA, momB);
  const edgeOr   = histogramSimilarity(edgeA, edgeB);
  const proj     = projectionSimilarity(projA, projB);

  const phMirror = simFromHamming(hamming64(phFlipA, phB));
  const dhMirror = simFromHamming(hamming64(dhFlipA, dhB));
  const ahMirror = simFromHamming(hamming64(ahFlipA, ahB));
  const mirrorStructScore = phMirror * 0.6 + dhMirror * 0.3 + ahMirror * 0.1;
  const normalStructScore = ph * 0.6 + dh * 0.3 + ah * 0.1;
  const mirrored = mirrorStructScore > normalStructScore + 10 && mirrorStructScore > 60;

  // Weights (sum = 0.85 — 15% reserved for metadata computed at file level)
  // pHash and dHash removed — redistribués sur les métriques restantes.
  //
  // SSIM         13% — structural+luminance+contrast (industry standard, YouTube/Netflix)
  // MSE          11% — raw pixel differences (96×96, catches every pixel change)
  // chroma       10% — Cb/Cr distribution (hue, saturation, chroma noise — very sensitive)
  // gradient     10% — gradient magnitude (sharpness, grain, noise intensity)
  // projection    9% — row+col luminance profiles (spatial shift, any positional change)
  // spatialGrid   9% — spatial content map (zoom, crop offset, vignette, lens)
  // color         8% — RGB histogram (brightness, saturation changes)
  // colorMoments  8% — mean/std/skew per channel (higher-order color stats)
  // luma          7% — luminance histogram 64-bin (brightness/contrast/gamma)
  // metadata     15% — file metadata (EXIF, ICC, format, size, DPI) — added at file level
  const score =
    ssim * 0.13 + mse * 0.11 + chroma * 0.10 +
    gradient * 0.10 + proj * 0.09 + spatial * 0.09 +
    ch * 0.08 + colorMom * 0.08 + luma * 0.07;

  return {
    score,
    breakdown: { ssim, mse, spatial, chroma, color: ch, luma, colorMom, phash: ph, dhash: dh, edgeOr, gradient, proj, texture: tx, ahash: ah, metadata: 100, filename: 100, mirrored },
  };
}

// Similarité de nom de fichier — compare les noms normalisés (sans extension, en minuscules).
// Retourne 0–100 : 100 = identiques, 0 = aucun caractère commun.
function filenameSimilarity(nameA: string, nameB: string): number {
  const norm = (n: string) => n.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const a = norm(nameA);
  const b = norm(nameB);
  if (a === b) return 100;
  if (!a || !b) return 0;
  // Jaccard sur bigrammes
  const bigrams = (s: string) => new Set(Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2)));
  const ba = bigrams(a);
  const bb = bigrams(b);
  const intersection = [...ba].filter(x => bb.has(x)).length;
  const union = new Set([...ba, ...bb]).size;
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

export async function compareFiles(
  framesA: string[],
  framesB: string[],
  rawA?: string,    // base64 of first ~128KB of file A (for metadata analysis)
  rawB?: string,    // base64 of first ~128KB of file B
  sizeA?: number,   // taille réelle du fichier A en octets (obligatoire pour les vidéos)
  sizeB?: number,   // taille réelle du fichier B en octets
  nameA?: string,   // nom du fichier A (avec extension)
  nameB?: string,   // nom du fichier B (avec extension)
): Promise<{ score: number; breakdown: PairScore["breakdown"] } | { error: string }> {
  try {
    if (!framesA.length || !framesB.length) return { error: "Aucun frame reçu" };

    const count = Math.min(framesA.length, framesB.length);

    // Frame-level analysis (visual similarity) + metadata (file-level)
    const [pairs, metadata] = await Promise.all([
      Promise.all(
        Array.from({ length: count }, (_, i) =>
          scorePair(Buffer.from(framesA[i], "base64"), Buffer.from(framesB[i], "base64"))
        )
      ),
      rawA && rawB
        ? metadataSimilarity(Buffer.from(rawA, "base64"), Buffer.from(rawB, "base64"), sizeA, sizeB)
        : Promise.resolve(100), // no raw data → assume identical metadata (neutral)
    ]);

    // Similarité du nom de fichier (0–100). 100 = même nom → 0pt de pénalité.
    const fnSim = (nameA && nameB) ? filenameSimilarity(nameA, nameB) : 100;

    // Frame-level score (82% max) + metadata (13% max) + filename (5% max) = 100%
    const avgFrameScore = pairs.reduce((s, p) => s + p.score, 0) / pairs.length;
    const finalScore = avgFrameScore + metadata * 0.13 + fnSim * 0.05;

    const avg = (key: keyof Omit<PairScore["breakdown"], "mirrored" | "metadata" | "filename">) =>
      Math.round(pairs.reduce((s, p) => s + (p.breakdown[key] as number), 0) / pairs.length);

    const breakdown: PairScore["breakdown"] = {
      ssim:     avg("ssim"),
      mse:      avg("mse"),
      spatial:  avg("spatial"),
      chroma:   avg("chroma"),
      color:    avg("color"),
      luma:     avg("luma"),
      colorMom: avg("colorMom"),
      phash:    avg("phash"),
      dhash:    avg("dhash"),
      edgeOr:   avg("edgeOr"),
      gradient: avg("gradient"),
      proj:     avg("proj"),
      texture:  avg("texture"),
      ahash:    avg("ahash"),
      metadata: Math.round(metadata),
      filename: fnSim,
      mirrored: pairs.some(p => p.breakdown.mirrored),
    };

    return { score: +finalScore.toFixed(2), breakdown };
  } catch (e: any) {
    return { error: e?.message || "Erreur comparaison" };
  }
}

// src/app/dashboard/similarity/actions.ts
"use server";

import sharp from "sharp";

type Hash64 = bigint;

function hamming64(a: Hash64, b: Hash64): number {
  let x = a ^ b;
  let c = 0;
  while (x !== 0n) { x &= (x - 1n); c++; }
  return c;
}

function simFromHamming(h: number, bits = 64): number {
  return Math.max(0, Math.min(100, Math.round((1 - h / bits) * 100)));
}

async function aHash(buf: Buffer): Promise<Hash64> {
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

async function dHash(buf: Buffer): Promise<Hash64> {
  const arr = await sharp(buf).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits = (bits << 1n) | (arr[y * 9 + x] < arr[y * 9 + x + 1] ? 1n : 0n);
    }
  }
  return bits;
}

// Receives two base64 thumbnails (extracted client-side) — no upload, no ffmpeg
export async function compareFiles(
  thumbABase64: string,
  thumbBBase64: string,
): Promise<{ score: number } | { error: string }> {
  try {
    if (thumbABase64 === thumbBBase64) return { score: 100 };

    const bufA = Buffer.from(thumbABase64, "base64");
    const bufB = Buffer.from(thumbBBase64, "base64");

    const [ahA, ahB, dhA, dhB] = await Promise.all([
      aHash(bufA), aHash(bufB), dHash(bufA), dHash(bufB),
    ]);

    const aSim = simFromHamming(hamming64(ahA, ahB));
    const dSim = simFromHamming(hamming64(dhA, dhB));
    return { score: +(aSim * 0.5 + dSim * 0.5).toFixed(2) };
  } catch (e: any) {
    return { error: e?.message || "Erreur comparaison" };
  }
}

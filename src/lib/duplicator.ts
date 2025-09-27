// src/lib/duplicator.ts
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { exiftool } from 'exiftool-vendored';
import ffmpeg from 'fluent-ffmpeg';
import which from 'which';

export const OUT_DIR = path.join(process.cwd(), 'public', 'out');

export async function ensureOutDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

export function uid() {
  return crypto.randomUUID();
}

export function isVideo(mime: string) {
  return /^video\//.test(mime);
}
export function isImage(mime: string) {
  return /^image\//.test(mime);
}

export async function saveUploadToTmp(file: File) {
  await ensureOutDir();
  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const tmp = path.join(OUT_DIR, `tmp_${uid()}.${ext || 'bin'}`);
  await fs.writeFile(tmp, buf);
  return tmp;
}

// fonctions duplicateImage / duplicateVideo (mêmes que je t’ai envoyées avant)…
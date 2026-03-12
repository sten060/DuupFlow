"use server";

import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { exiftool } from "exiftool-vendored";
import { getOutDirForCurrentUser } from "@/app/dashboard/utils";

/* ── constants ── */
const SUPPORTED_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov", ".mkv", ".avi", ".webm"];

const AI_PLATFORMS = [
  { software: "Midjourney v6.1", artist: "Midjourney Bot", creator: "midjourney.com" },
  { software: "DALL-E 3 / OpenAI", artist: "DALL-E", creator: "openai.com" },
  { software: "Stable Diffusion XL", artist: "Stability AI", creator: "stability.ai" },
  { software: "Runway Gen-3 Alpha", artist: "Runway ML", creator: "runwayml.com" },
  { software: "Kling AI v1.5", artist: "Kling AI", creator: "klingai.com" },
  { software: "Pika 2.0", artist: "Pika Labs", creator: "pika.art" },
  { software: "Higgsfield AI", artist: "Higgsfield", creator: "higgsfield.ai" },
  { software: "Adobe Firefly 3", artist: "Adobe Firefly", creator: "firefly.adobe.com" },
  { software: "Leonardo.ai Phoenix", artist: "Leonardo AI", creator: "leonardo.ai" },
  { software: "Ideogram v2", artist: "Ideogram AI", creator: "ideogram.ai" },
];

const HUMAN_CAMERAS = [
  { make: "Canon", model: "EOS R6 Mark II" },
  { make: "Sony", model: "A7 IV" },
  { make: "Nikon", model: "Z8" },
  { make: "Fujifilm", model: "X-T5" },
  { make: "Apple", model: "iPhone 15 Pro" },
];

const HUMAN_SOFTWARE = [
  "Adobe Lightroom 7.2",
  "Adobe Photoshop 25.4",
  "Capture One 23",
  "DaVinci Resolve 19",
  "Final Cut Pro 11.6",
  "Luminar Neo 1.18",
];

const HUMAN_NAMES = [
  "Alex Martin", "Sophie Renaud", "Jordan Lee", "Emma Dubois",
  "Lucas Bernard", "Camille Thomas", "Noah Petit", "Léa Moreau",
  "Antoine Durand", "Manon Lefebvre",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randHex(n = 2) {
  return crypto.randomBytes(n).toString("hex");
}

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function isSupported(name: string) {
  return SUPPORTED_EXTS.includes(extOf(name));
}

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/* ─────────────────────────────────────────────
 * SWITCH 1 — AI → Masquer (appear non-AI)
 * Replace AI metadata with human-like metadata
 * ───────────────────────────────────────────── */
export async function maskAiMetadata(formData: FormData): Promise<{ ok: boolean; count: number; error?: string }> {
  const files = formData.getAll("files") as File[];
  if (!files.length) return { ok: false, count: 0, error: "Aucun fichier reçu." };

  const { dir } = await getOutDirForCurrentUser();
  await fs.mkdir(dir, { recursive: true });

  let count = 0;
  const stamp = todayStamp();

  for (const f of files) {
    const ext = extOf(f.name);
    if (!SUPPORTED_EXTS.includes(ext)) continue;

    const buf = Buffer.from(await f.arrayBuffer());
    const outName = `DuupFlow_${stamp}_nomask_${randHex(3)}${ext}`;
    const outPath = path.join(dir, outName);

    // Write file first
    await fs.writeFile(outPath, buf);

    // Pick random human identity
    const cam = pick(HUMAN_CAMERAS);
    const software = pick(HUMAN_SOFTWARE);
    const artist = pick(HUMAN_NAMES);
    const now = new Date();
    const exifDate = now.toISOString().replace(/[-:]/g, "").split(".")[0];

    try {
      await exiftool.write(
        outPath,
        {
          // Erase AI traces
          Software: software,
          Artist: artist,
          Creator: artist,
          Author: artist,
          Make: cam.make,
          Model: cam.model,
          // Reset dates to look like a real camera shoot
          AllDates: exifDate,
          DateTimeOriginal: exifDate,
          CreateDate: exifDate,
          ModifyDate: exifDate,
          // Generic metadata
          XPTitle: `Photo_${randHex(2)}`,
          XPComment: "original",
          XPAuthor: artist,
          // Wipe common AI generator fields
          ["XMP-dc:Creator"]: artist,
          ["XMP-dc:Rights"]: `© ${now.getFullYear()} ${artist}`,
          ["XMP-xmp:CreatorTool"]: software,
          ["XMP-xmp:ModifyDate"]: now.toISOString(),
          // Clear any AI-specific fields
          ["XMP-plus:LicensorName"]: undefined as any,
          ["XMP-iptcExt:DigitalSourceType"]: undefined as any,
          ["XMP-iptcExt:ArtworkOrObject"]: undefined as any,
        } as any,
        ["-overwrite_original"]
      );
    } catch {
      // exiftool may not support all fields for all formats, continue anyway
    }

    count++;
  }

  return { ok: true, count };
}

/* ─────────────────────────────────────────────
 * SWITCH 2 — Normal → Injecter IA (appear AI-generated)
 * Replace metadata with a known AI platform signature
 * ───────────────────────────────────────────── */
export async function injectAiMetadata(formData: FormData): Promise<{ ok: boolean; count: number; error?: string }> {
  const files = formData.getAll("files") as File[];
  if (!files.length) return { ok: false, count: 0, error: "Aucun fichier reçu." };

  const { dir } = await getOutDirForCurrentUser();
  await fs.mkdir(dir, { recursive: true });

  let count = 0;
  const stamp = todayStamp();

  for (const f of files) {
    const ext = extOf(f.name);
    if (!SUPPORTED_EXTS.includes(ext)) continue;

    const buf = Buffer.from(await f.arrayBuffer());
    const outName = `DuupFlow_${stamp}_aimark_${randHex(3)}${ext}`;
    const outPath = path.join(dir, outName);

    // Write file first
    await fs.writeFile(outPath, buf);

    // Pick random AI platform
    const platform = pick(AI_PLATFORMS);
    const now = new Date();
    const exifDate = now.toISOString().replace(/[-:]/g, "").split(".")[0];

    try {
      await exiftool.write(
        outPath,
        {
          Software: platform.software,
          Artist: platform.artist,
          Creator: platform.creator,
          Author: platform.artist,
          Make: platform.creator,
          Model: platform.software,
          AllDates: exifDate,
          CreateDate: exifDate,
          ModifyDate: exifDate,
          XPTitle: `AI_${randHex(2)}`,
          XPComment: "ai-generated",
          XPAuthor: platform.artist,
          ["XMP-dc:Creator"]: platform.artist,
          ["XMP-dc:Rights"]: `AI-generated by ${platform.creator}`,
          ["XMP-xmp:CreatorTool"]: platform.software,
          ["XMP-xmp:ModifyDate"]: now.toISOString(),
          ["XMP-iptcExt:DigitalSourceType"]: "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
        } as any,
        ["-overwrite_original"]
      );
    } catch {
      // continue
    }

    count++;
  }

  return { ok: true, count };
}

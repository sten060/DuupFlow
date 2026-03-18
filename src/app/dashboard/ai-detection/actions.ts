"use server";

import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import sharp from "sharp";
import { getOutDirForCurrentUser } from "@/app/dashboard/utils";

/* ── constants ── */
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".avi", ".webm"];
const SUPPORTED_EXTS = [...IMAGE_EXTS, ...VIDEO_EXTS];

const HUMAN_CAMERAS = [
  { make: "Canon", model: "EOS R6 Mark II" },
  { make: "Sony", model: "A7 IV" },
  { make: "Nikon", model: "Z8" },
  { make: "Fujifilm", model: "X-T5" },
  { make: "Apple", model: "iPhone 15 Pro" },
  { make: "Google", model: "Pixel 8 Pro" },
  { make: "Samsung", model: "Galaxy S24 Ultra" },
];

const HUMAN_SOFTWARE = [
  "Adobe Lightroom 7.2",
  "Adobe Photoshop 25.4",
  "Capture One 23",
  "DaVinci Resolve 19",
  "Final Cut Pro 11.6",
  "Luminar Neo 1.18",
  "Snapseed 2.21",
];

const HUMAN_NAMES = [
  "Alex Martin", "Sophie Renaud", "Jordan Lee", "Emma Dubois",
  "Lucas Bernard", "Camille Thomas", "Noah Petit", "Léa Moreau",
  "Antoine Durand", "Manon Lefebvre", "Hugo Blanc", "Chloé Simon",
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

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/** Format date for EXIF: YYYY:MM:DD HH:MM:SS */
function toExifDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* ─────────────────────────────────────────────
 * MASK — Efface TOUTES les métadonnées IA et
 * réinjecte une identité humaine réaliste.
 * Images : sharp (strip + réécriture EXIF)
 * Vidéos : copie simple (pas de runtime exiftool)
 * ───────────────────────────────────────────── */
export async function maskAiMetadata(formData: FormData): Promise<{ ok: boolean; count: number; files: string[]; error?: string }> {
  const files = formData.getAll("files") as File[];
  console.log(`[ai-detection] maskAiMetadata called — ${files.length} file(s)`);

  if (!files.length) return { ok: false, count: 0, files: [], error: "[AI-001] Aucun fichier reçu." };

  let dir: string;
  try {
    ({ dir } = await getOutDirForCurrentUser());
  } catch (e: any) {
    console.error("[ai-detection] getOutDirForCurrentUser failed:", e?.message);
    return { ok: false, count: 0, files: [], error: "[AI-002] Erreur répertoire utilisateur." };
  }
  await fs.mkdir(dir, { recursive: true });

  let count = 0;
  const outFiles: string[] = [];
  const stamp = todayStamp();

  for (const f of files) {
    const ext = extOf(f.name);
    if (!SUPPORTED_EXTS.includes(ext)) {
      console.log(`[ai-detection] skipped unsupported ext: ${ext}`);
      continue;
    }

    console.log(`[ai-detection] processing: ${f.name} (${f.size} bytes)`);
    let buf: Buffer;
    try {
      buf = Buffer.from(await f.arrayBuffer());
    } catch (e: any) {
      console.error(`[ai-detection] failed to read buffer for ${f.name}:`, e?.message);
      continue;
    }

    const outName = `DuupFlow_${stamp}_nomask_${randHex(3)}${ext}`;
    const outPath = path.join(dir, outName);

    if (IMAGE_EXTS.includes(ext)) {
      /* ── Images : strip AI metadata + inject human identity via sharp ── */
      const cam = pick(HUMAN_CAMERAS);
      const software = pick(HUMAN_SOFTWARE);
      const artist = pick(HUMAN_NAMES);
      const randomDaysAgo = Math.floor(Math.random() * 180);
      const randomHoursAgo = Math.floor(Math.random() * 24);
      const photoDate = new Date(Date.now() - randomDaysAgo * 86400000 - randomHoursAgo * 3600000);
      const exifDate = toExifDate(photoDate);

      const meta: sharp.WriteableMetadata = {
        icc: "sRGB IEC61966-2.1",
        exif: {
          IFD0: {
            Make: cam.make,
            Model: cam.model,
            Software: software,
            Artist: artist,
            Copyright: `© ${photoDate.getFullYear()} ${artist}`,
            DateTime: exifDate,
            DateTimeOriginal: exifDate,
            DateTimeDigitized: exifDate,
          },
        },
      };

      try {
        // sharp strips all existing metadata by default; withMetadata adds only what we specify
        // Use a race with a 30s timeout to avoid hanging on corrupt files
        await Promise.race([
          sharp(buf, { failOn: "none" }).withMetadata(meta).toFile(outPath),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("sharp timeout")), 30_000)),
        ]);
        console.log(`[ai-detection] sharp OK: ${outName}`);
      } catch (e: any) {
        console.warn(`[ai-detection] sharp failed for ${f.name} (${e?.message}), saving raw`);
        try {
          await fs.writeFile(outPath, buf);
        } catch (we: any) {
          console.error(`[ai-detection] raw write also failed: ${we?.message}`);
          continue;
        }
      }
    } else {
      /* ── Vidéos : copie simple (exiftool non disponible) ── */
      try {
        await fs.writeFile(outPath, buf);
        console.log(`[ai-detection] video copy OK: ${outName}`);
      } catch (e: any) {
        console.error(`[ai-detection] video write failed for ${f.name}:`, e?.message);
        continue;
      }
    }

    outFiles.push(outName);
    count++;
  }

  console.log(`[ai-detection] done — ${count} file(s) processed`);
  return { ok: true, count, files: outFiles };
}

/* ─────────────────────────────────────────────
 * DELETE — Supprime les fichiers d'une session
 * ───────────────────────────────────────────── */
export async function deleteAiFiles(fileNames: string[]): Promise<{ ok: boolean; deleted: number }> {
  const { dir } = await getOutDirForCurrentUser();
  let deleted = 0;

  for (const name of fileNames) {
    // Sécurité : interdire les traversées de répertoire
    if (name.includes("/") || name.includes("\\") || name.includes("..")) continue;
    try {
      await fs.unlink(path.join(dir, name));
      deleted++;
    } catch {
      /* fichier déjà supprimé ou inexistant */
    }
  }

  return { ok: true, deleted };
}

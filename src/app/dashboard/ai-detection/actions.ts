"use server";

import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { exiftool } from "exiftool-vendored";
import { getOutDirForCurrentUser } from "@/app/dashboard/utils";

/* ── constants ── */
const SUPPORTED_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov", ".mkv", ".avi", ".webm"];

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

/* ─────────────────────────────────────────────
 * MASK — Efface TOUTES les métadonnées IA et
 * réinjecte une identité humaine réaliste.
 * Étape 1 : -all= pour vider EXIF/XMP/IPTC/C2PA
 * Étape 2 : réécriture metadata humaine propre
 * ───────────────────────────────────────────── */
export async function maskAiMetadata(formData: FormData): Promise<{ ok: boolean; count: number; files: string[]; error?: string }> {
  const files = formData.getAll("files") as File[];
  if (!files.length) return { ok: false, count: 0, files: [], error: "Aucun fichier reçu." };

  const { dir } = await getOutDirForCurrentUser();
  await fs.mkdir(dir, { recursive: true });

  let count = 0;
  const outFiles: string[] = [];
  const stamp = todayStamp();

  for (const f of files) {
    const ext = extOf(f.name);
    if (!SUPPORTED_EXTS.includes(ext)) continue;

    const buf = Buffer.from(await f.arrayBuffer());
    const outName = `DuupFlow_${stamp}_nomask_${randHex(3)}${ext}`;
    const outPath = path.join(dir, outName);

    await fs.writeFile(outPath, buf);
    outFiles.push(outName);

    /* ── Étape 1 : suppression totale de toutes les métadonnées ── */
    /* -all= supprime EXIF, XMP, IPTC, MakerNotes, C2PA/JUMBF, etc. */
    try {
      await exiftool.write(outPath, {} as any, ["-all=", "-overwrite_original"]);
    } catch {
      /* certains formats peuvent refuser la suppression complète, on continue */
    }

    /* ── Étape 2 : injection d'une identité humaine propre ── */
    const cam = pick(HUMAN_CAMERAS);
    const software = pick(HUMAN_SOFTWARE);
    const artist = pick(HUMAN_NAMES);
    const now = new Date();
    // Date aléatoire dans les 6 derniers mois pour paraître réaliste
    const randomDaysAgo = Math.floor(Math.random() * 180);
    const photoDate = new Date(now.getTime() - randomDaysAgo * 86400000);
    const exifDate = photoDate.toISOString().replace(/[-:]/g, "").split(".")[0];

    try {
      await exiftool.write(
        outPath,
        {
          Software: software,
          Artist: artist,
          Creator: artist,
          Author: artist,
          Make: cam.make,
          Model: cam.model,
          DateTimeOriginal: exifDate,
          CreateDate: exifDate,
          ModifyDate: exifDate,
          XPTitle: `IMG_${randHex(2).toUpperCase()}`,
          XPComment: "original",
          XPAuthor: artist,
          ["XMP-dc:Creator"]: artist,
          ["XMP-dc:Rights"]: `© ${photoDate.getFullYear()} ${artist}`,
          ["XMP-xmp:CreatorTool"]: software,
          ["XMP-xmp:CreateDate"]: photoDate.toISOString(),
          ["XMP-xmp:ModifyDate"]: photoDate.toISOString(),
          // Champ IPTC crucial que Meta/Threads vérifie
          ["XMP-iptcExt:DigitalSourceType"]: "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture",
        } as any,
        ["-overwrite_original"]
      );
    } catch {
      /* continue si le format ne supporte pas tous les champs */
    }

    count++;
  }

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

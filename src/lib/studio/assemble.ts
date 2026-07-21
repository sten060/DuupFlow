// Assemblage "N contenus → 1 source". Le nouveau modèle : le user ajoute
// plusieurs contenus (vidéos ET images) avec une NOTE libre, et on en fait UNE
// seule vidéo source (9:16) que le reste du pipeline monte comme d'habitude
// (captions, réalisateur, variantes). Ça évite de réécrire le moteur de montage.
//
// Ordre d'assemblage : piloté par les NOTES du user (ex. "avant"/"après") — la
// ref donne ensuite le rythme/les coupures par-dessus. (Ordre fin par LLM = à
// venir ; ici heuristique déterministe avant/après + ordre d'ajout.)

import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { UPLOADS_DIR } from "./local-store";
import { runFFmpeg, probeVideo } from "./pipeline";
import type { UploadedVideo } from "./types";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);
const IMAGE_STILL_SEC = 2.5; // durée d'une image fixe dans le montage
const VIDEO_MAX_SEC = 15; // on borne chaque clip pour ne pas exploser la durée

export function isImageAsset(a: UploadedVideo): boolean {
  return a.kind === "image" || IMAGE_EXT.has(path.extname(a.id).toLowerCase());
}

// Score avant/après tiré de la note libre — juste assez pour ordonner une
// transformation. Le reste garde l'ordre d'ajout (stable).
function orderScore(note: string | undefined): number {
  const s = (note ?? "").toLowerCase();
  if (/\bavant\b|\bbefore\b/.test(s)) return 0;
  if (/révél|reveal|bascule|transition/.test(s)) return 1;
  if (/\baprès\b|\bapres\b|\bafter\b|glow|résultat|resultat/.test(s)) return 2;
  return 1; // neutre = au milieu, ordre d'ajout préservé (tri stable)
}

// Ordonne les contenus pour l'assemblage (avant → révélation → après).
export function orderAssets(assets: UploadedVideo[]): UploadedVideo[] {
  return assets
    .map((a, i) => ({ a, i, score: orderScore(a.note) }))
    .sort((x, y) => x.score - y.score || x.i - y.i)
    .map((x) => x.a);
}

// Normalise UN contenu en clip 1080×1920 / 30 fps / audio AAC (silence si
// absent) — pour que tous les clips soient concaténables tels quels.
async function normalizeToClip(
  inputPath: string,
  isImage: boolean,
  durationSec: number,
  outPath: string
): Promise<boolean> {
  let hasAudio = false;
  if (!isImage) {
    try {
      hasAudio = (await probeVideo(inputPath)).hasAudio;
    } catch {
      /* probe échoué → on traite sans audio */
    }
  }
  const D = durationSec.toFixed(2);
  const needSilent = isImage || !hasAudio;

  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  if (isImage) args.push("-loop", "1", "-framerate", "30", "-t", D, "-i", inputPath);
  else args.push("-t", D, "-i", inputPath);
  if (needSilent)
    args.push("-f", "lavfi", "-t", D, "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");

  args.push(
    "-vf",
    "crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)',scale=1080:1920:flags=bicubic,fps=30,format=yuv420p",
    "-map", "0:v:0",
    "-map", needSilent ? "1:a:0" : "0:a:0",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "128k",
    "-r", "30", "-video_track_timescale", "30000",
    "-shortest",
    outPath
  );
  const { code } = await runFFmpeg(args, 180_000);
  return code === 0 && fsSync.existsSync(outPath);
}

// Concatène des clips normalisés (mêmes paramètres) sans ré-encoder.
async function concatClips(clipPaths: string[], outPath: string): Promise<boolean> {
  if (clipPaths.length === 1) {
    await fs.copyFile(clipPaths[0], outPath);
    return fsSync.existsSync(outPath);
  }
  const listPath = `${outPath}.txt`;
  const list = clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  await fs.writeFile(listPath, list, "utf8");
  try {
    const { code } = await runFFmpeg(
      ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0",
       "-i", listPath, "-c", "copy", outPath],
      180_000
    );
    return code === 0 && fsSync.existsSync(outPath);
  } finally {
    await fs.unlink(listPath).catch(() => {});
  }
}

// Assemble tous les contenus en UNE vidéo source 9:16, sauvegardée dans uploads.
// Retourne le nom de fichier (id) de la source combinée, ou null si échec.
export async function assembleAssets(assets: UploadedVideo[]): Promise<string | null> {
  if (assets.length === 0) return null;
  const ordered = orderAssets(assets);
  const combinedId = `combined_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp4`;
  const combinedPath = path.join(UPLOADS_DIR, combinedId);
  const tmp: string[] = [];

  try {
    for (let i = 0; i < ordered.length; i++) {
      const a = ordered[i];
      const inputPath = path.join(UPLOADS_DIR, a.id);
      const isImg = isImageAsset(a);
      let dur = IMAGE_STILL_SEC;
      if (!isImg) {
        try {
          dur = Math.min(VIDEO_MAX_SEC, Math.max(0.5, (await probeVideo(inputPath)).durationSec));
        } catch {
          dur = 6;
        }
      }
      const clip = path.join(UPLOADS_DIR, `${combinedId}.part${i}.mp4`);
      if (await normalizeToClip(inputPath, isImg, dur, clip)) tmp.push(clip);
    }
    if (tmp.length === 0) return null;
    const ok = await concatClips(tmp, combinedPath);
    return ok ? combinedId : null;
  } finally {
    for (const t of tmp) await fs.unlink(t).catch(() => {});
  }
}

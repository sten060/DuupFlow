// Analyse POUSSÉE d'une vidéo brute uploadée : on extrait une grille de frames
// réparties sur toute la durée, puis on demande à la vision de COMPRENDRE la
// vidéo (contexte + timeline de sens : avant/après, révélation…). Le résultat
// est mis en cache sur disque à côté du fichier uploadé, et réutilisé au montage
// (plus besoin de re-lire le rush à la génération).

import fs from "fs/promises";
import fsSync from "fs";
import { analyzeFootage } from "./llm";
import { runFFmpeg } from "./pipeline";
import type { FootageAnalysis } from "./types";

const GRID_COUNT = 9; // 3×3 — assez pour lire un déroulé sans exploser le coût

// Chemin du cache d'analyse pour un fichier uploadé donné.
export function footageCachePath(uploadPath: string): string {
  return `${uploadPath}.analysis.json`;
}

// Extrait GRID_COUNT frames réparties sur toute la durée, en une seule grille
// 3×3 lisible (tuiles 320px). Retourne le base64 PNG, ou null si échec.
async function extractFootageGrid(
  videoPath: string,
  durationSec: number
): Promise<string | null> {
  const out = `${videoPath}.footagegrid.png`;
  const dur = Math.max(1, durationSec);
  const fps = Math.max(0.1, GRID_COUNT / dur);
  try {
    const { code } = await runFFmpeg(
      [
        "-y", "-hide_banner", "-loglevel", "error", "-i", videoPath,
        "-vf",
        `fps=${fps.toFixed(4)},select='between(n\\,0\\,${GRID_COUNT - 1})',scale=320:-1,tile=3x3`,
        "-frames:v", "1", out,
      ],
      60_000
    );
    if (code !== 0 || !fsSync.existsSync(out)) return null;
    return (await fs.readFile(out)).toString("base64");
  } catch {
    return null;
  } finally {
    await fs.unlink(out).catch(() => {});
  }
}

// Analyse poussée d'une vidéo brute. Best-effort : null si extraction ou vision
// indisponible (le montage retombe alors sur la lecture superficielle).
export async function analyzeUploadedFootage(
  videoPath: string,
  durationSec: number
): Promise<FootageAnalysis | null> {
  const grid = await extractFootageGrid(videoPath, durationSec);
  if (!grid) return null;
  return analyzeFootage([grid], GRID_COUNT);
}

// Lit l'analyse en cache pour un fichier uploadé (null si absente/illisible).
export async function readFootageAnalysis(
  uploadPath: string
): Promise<FootageAnalysis | null> {
  try {
    return JSON.parse(
      await fs.readFile(footageCachePath(uploadPath), "utf8")
    ) as FootageAnalysis;
  } catch {
    return null;
  }
}

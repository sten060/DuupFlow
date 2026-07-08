// Stockage disque LOCAL du Studio — aucun cloud.
// Tout vit sous <projet>/.studio-local/ (gitignoré) :
//   uploads/  → vidéos brutes uploadées
//   outputs/  → variantes générées par ffmpeg
// TODO: brancher — remplacer par Supabase Storage quand on sortira du local.

import path from "path";
import fs from "fs/promises";

export const STUDIO_ROOT = path.join(process.cwd(), ".studio-local");
export const UPLOADS_DIR = path.join(STUDIO_ROOT, "uploads");
export const OUTPUTS_DIR = path.join(STUDIO_ROOT, "outputs");

export async function ensureStudioDirs(): Promise<void> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.mkdir(OUTPUTS_DIR, { recursive: true });
}

// Noms de fichiers générés par NOUS uniquement (jamais le nom brut de
// l'utilisateur) — garde anti path-traversal sur toutes les routes.
const SAFE_NAME_RE = /^[A-Za-z0-9_-]+\.(mp4|mov|m4v|webm)$/;

export function isSafeStoredName(name: string): boolean {
  return SAFE_NAME_RE.test(name);
}

// Résout un nom stocké vers son chemin absolu (uploads puis outputs).
// Retourne null si le nom est invalide ou le fichier absent.
export async function resolveStoredFile(name: string): Promise<string | null> {
  if (!isSafeStoredName(name)) return null;
  for (const dir of [OUTPUTS_DIR, UPLOADS_DIR]) {
    const p = path.join(dir, name);
    try {
      await fs.access(p);
      return p;
    } catch {
      /* essaie le dossier suivant */
    }
  }
  return null;
}

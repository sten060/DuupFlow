// src/lib/paths.ts
import path from "path";
import fs from "fs/promises";

export const OUT_DIR = path.join(process.cwd(), "outputs");

/** Crée le dossier de sortie si besoin (idempotent) */
export async function ensureOutDir() {
  try {
    await fs.mkdir(OUT_DIR, { recursive: true });
  } catch (err) {
    console.error("ensureOutDir() error:", err);
  }
}
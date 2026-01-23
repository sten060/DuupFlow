// src/app/dashboard/utils.ts
import path from "path";
import fs from "fs/promises";

// Dossier racine des sorties (public/out)
const OUT_BASE = process.env.OUT_BASE || path.join(process.cwd(), "public", "out");

// Utilisateur local par défaut (pas d'authentification)
const LOCAL_USER_ID = "local";

/** Dossier utilisateur local (garanti) + création si besoin */
export async function getOutDirForCurrentUser() {
  const userDir = path.join(OUT_BASE, LOCAL_USER_ID);
  await fs.mkdir(userDir, { recursive: true });
  return { dir: userDir, userId: LOCAL_USER_ID };
}

/** Version utilisable aussi dans des RSC (pages/listings) */
export async function getOutDirForCurrentUserRSC() {
  return getOutDirForCurrentUser();
}
// src/app/dashboard/images/actions.ts
"use server";

import path from "path";
import fs from "fs/promises";
import { revalidatePath } from "next/cache";
import { getOutDirsForListing, canDeleteOutputs } from "@/app/dashboard/utils";

/* =============================
 * Helpers communs images
 * ============================= */
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const extOf = (name: string) => {
  const p = name.lastIndexOf(".");
  return p >= 0 ? name.slice(p).toLowerCase() : "";
};

/* =============================
 * Liste images (RSC)
 * ============================= */
export async function listOutImages(): Promise<string[]> {
  try {
    // Vue admin : tous les créateurs ; sinon le dossier du créateur affiché.
    const dirs = await getOutDirsForListing();
    const lists = await Promise.all(dirs.map(async ({ dir, userId }) => {
      const names = await fs.readdir(dir).catch(() => [] as string[]);
      return names
        .filter(
          (n) =>
            !n.startsWith(".") &&
            !n.startsWith("tmp_") &&
            !n.startsWith("__in__") &&
            !n.endsWith(".part") &&
            !n.startsWith("__progress_") &&
            !n.startsWith("CMP_") && // compressor outputs live in their own library
            IMAGE_EXTS.includes(extOf(n))
        )
        .map((n) => `/api/out/${userId}/${encodeURIComponent(path.basename(n))}`);
    }));
    return lists.flat();
  } catch {
    return [];
  }
}

/* =============================
 * Vider images
 * ============================= */
export async function clearImages() {
  "use server";
  if (!(await canDeleteOutputs())) return { ok: false }; // rôle VA : ne supprime rien
  try {
    for (const { dir } of await getOutDirsForListing()) {
      const names = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      const toDelete = names
        .filter((d) => d.isFile())
        .map((d) => d.name)
        .filter((n) => !n.startsWith("CMP_") && IMAGE_EXTS.includes(extOf(n)));
      await Promise.all(
        toDelete.map((n) => fs.unlink(path.join(dir, n)).catch(() => {}))
      );
    }
  } catch {}
  revalidatePath("/dashboard/images");
  return { ok: true };
}


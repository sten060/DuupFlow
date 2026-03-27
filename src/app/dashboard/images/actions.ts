// src/app/dashboard/images/actions.ts
"use server";

import path from "path";
import fs from "fs/promises";
import { revalidatePath } from "next/cache";
import { getOutDirForCurrentUser, getOutDirForCurrentUserRSC } from "@/app/dashboard/utils";

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
    const { dir, userId } = await getOutDirForCurrentUserRSC();
    const names = await fs.readdir(dir);

    const finals = names.filter(
      (n) =>
        !n.startsWith(".") &&
        !n.startsWith("tmp_") &&
        !n.startsWith("__in__") &&
        !n.endsWith(".part") &&
        !n.startsWith("__progress_") &&
        IMAGE_EXTS.includes(extOf(n))
    );

    return finals.map((n) => `/api/out/${userId}/${encodeURIComponent(path.basename(n))}`);
  } catch {
    return [];
  }
}

/* =============================
 * Vider images
 * ============================= */
export async function clearImages() {
  "use server";
  try {
    const { dir } = await getOutDirForCurrentUser();
    const names = await fs.readdir(dir, { withFileTypes: true });
    const toDelete = names
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((n) => IMAGE_EXTS.includes(extOf(n)));
    await Promise.all(
      toDelete.map((n) => fs.unlink(path.join(dir, n)).catch(() => {}))
    );
  } catch {}
  revalidatePath("/dashboard/images");
  return { ok: true };
}


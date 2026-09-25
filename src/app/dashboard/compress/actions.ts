// src/app/dashboard/compress/actions.ts
"use server";

import path from "path";
import fs from "fs/promises";
import { revalidatePath } from "next/cache";
import { getOutDirForCurrentUser, getOutDirForCurrentUserRSC } from "@/app/dashboard/utils";

// Compressed outputs all carry this prefix so they never leak into the
// Images / Videos libraries (and vice-versa).
const OUT_PREFIX = "CMP_DuupFlow_";
const ALL_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov", ".mkv", ".avi", ".webm"];
const extOf = (name: string) => {
  const p = name.lastIndexOf(".");
  return p >= 0 ? name.slice(p).toLowerCase() : "";
};

export type CompressedFile = { url: string; name: string; outBytes?: number };

/** List the current user's compressed outputs (RSC). */
export async function listCompressed(): Promise<CompressedFile[]> {
  try {
    const { dir, userId } = await getOutDirForCurrentUserRSC();
    const names = await fs.readdir(dir);
    const finals = names.filter(
      (n) =>
        n.startsWith(OUT_PREFIX) &&
        !n.endsWith(".part") &&
        !n.startsWith("__progress_") &&
        ALL_EXTS.includes(extOf(n)),
    );
    // Size is needed client-side to pick ZIP vs one-by-one download (heavy files).
    return Promise.all(finals.map(async (n) => ({
      url: `/api/out/${userId}/${encodeURIComponent(path.basename(n))}`,
      name: path.basename(n),
      outBytes: await fs.stat(path.join(dir, n)).then((st) => st.size).catch(() => undefined),
    })));
  } catch {
    return [];
  }
}

/** Delete every compressed output for the current user. */
export async function clearCompressed() {
  "use server";
  try {
    const { dir } = await getOutDirForCurrentUser();
    const names = await fs.readdir(dir, { withFileTypes: true });
    const toDelete = names
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((n) => n.startsWith(OUT_PREFIX));
    await Promise.all(toDelete.map((n) => fs.unlink(path.join(dir, n)).catch(() => {})));
  } catch {}
  revalidatePath("/dashboard/compress");
  return { ok: true };
}

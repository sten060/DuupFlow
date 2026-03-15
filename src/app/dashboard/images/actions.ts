// src/app/dashboard/images/actions.ts
"use server";

import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { getOutDirForCurrentUser, getOutDirForCurrentUserRSC } from "@/app/dashboard/utils";

/* =============================
 * Helpers communs images
 * ============================= */
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const randSuffix = () => crypto.randomBytes(2).toString("hex");
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
 * DUPLICATION IMAGES (➡ API)
 * ============================= */
export async function duplicateImages(formData: FormData) {
  "use server";

  // 1) Entrées du formulaire
  const filesAll = formData.getAll("files") as File[];
  if (!filesAll || filesAll.length === 0) {
    throw new Error("Aucune image reçue.");
  }
  if (filesAll.length > 25) {
    throw new Error("Vous pouvez envoyer 25 fichiers maximum.");
  }
  const files = filesAll.slice(0, 25);

  const count = Math.max(1, Number(formData.get("count") ?? 1));

  // trois familles de filtres (cases indépendantes)
  const fundamentals = formData.get("fundamentals") !== null;
  const visuals = formData.get("visuals") !== null;
  const semi = formData.get("semi") !== null;
  const reverse = formData.get("reverse") !== null;

  // 2) URL absolue de l’API locale
  const hdrs = headers();
  const origin =
    hdrs.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const apiUrl = new URL("/api/duplicate-image", origin).toString();

  // 3) Transfert vers l’API (1 fichier ➡ 1 appel)
  for (const f of files) {
    if (!f.type?.startsWith("image/")) continue;

    const fd = new FormData();
    fd.append("files", f); // l'API attend "files"
    fd.append("count", String(count));
    if (fundamentals) fd.append("fundamentals", "1");
    if (visuals) fd.append("visuals", "1");
    if (semi) fd.append("semi", "1"); // <-- NOUVEAU drapeau (lu par l’API si implémenté)
    if (reverse) fd.append("reverse", "1");
    
    const cookieHeader = cookies().toString();
    const res = await fetch(apiUrl, {
      method: "POST",
      body: fd,
      headers: { Cookie: cookieHeader },
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.error || "Échec de la duplication (API).");
    }
  }

  // 4) Rafraîchit la page
  revalidatePath("/dashboard/images");
  redirect("/dashboard/images?ok=1");
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

/* ===========================================================
 * (Facultatif) Pipeline image dispo pour d’autres appels
 * =========================================================== */
export async function _noop() { return null; }
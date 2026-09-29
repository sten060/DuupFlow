"use server";

import { planLockMessageForCurrentUser } from "@/lib/plan-gate";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { enhanceImage } from "@/lib/ai/enhance";
import { getOutDirForCurrentUser } from "@/app/dashboard/utils";

function randName() {
  return crypto.randomBytes(4).toString("hex");
}

export async function enhanceAction(formData: FormData) {
  // Plan gratuit : aucune amélioration (src/lib/free-plan.ts).
  const planLock = await planLockMessageForCurrentUser();
  if (planLock) return { ok: false as const, error: planLock };
  try {
    const file = formData.get("image") as File | null;
    const restore = Number(formData.get("restore") ?? 0.7);
    const smooth = Number(formData.get("smooth") ?? 0.5);

    if (!file || file.size === 0) throw new Error("Aucune image fournie.");

    const buf = Buffer.from(await file.arrayBuffer());
    const { dir, userId } = await getOutDirForCurrentUser();
    const name = `enhance_${randName()}.jpg`;
    const filePath = path.join(dir, name);
    await fs.writeFile(filePath, buf);

    const site =
      (process.env.NEXT_PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000").replace(/\/+$/, "");

    const imageUrl = `${site}/out/${userId}/${encodeURIComponent(name)}`;
    const enhancedUrl = await enhanceImage({ imageUrl, restore, smooth });

    return { ok: true, url: enhancedUrl };
  } catch (err: any) {
    console.error("Enhance error:", err);
    return { ok: false, error: err.message || "Erreur inconnue" };
  }
}
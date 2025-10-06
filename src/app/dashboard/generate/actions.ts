"use server";

import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getOutDirForCurrentUser } from "@/app/dashboard/utils";
import { generateImage } from "@/lib/ai/replicate";

function randSuffix() {
  return crypto.randomBytes(2).toString("hex");
}

function buildPrompt({
  decor,
  tenue,
  accessoires,
  style,
}: {
  decor?: string;
  tenue?: string;
  accessoires?: string;
  style?: string;
}) {
  const base =
    "Ultra photorealistic fashion photo of the SAME person as the reference photo. Preserve exact identity, face structure, body shape and skin tone. Sharp focus, realistic lighting, natural skin, professional color grading.";
  const parts = [
    decor && `Background / decor: ${decor}`,
    tenue && `Outfit / clothing: ${tenue}`,
    accessoires && `Accessories / props: ${accessoires}`,
    style && `Style / mood / lighting: ${style}`,
  ]
    .filter(Boolean)
    .join(". ");
  return parts ? `${base} ${parts}.` : base;
}

export async function generateAction(formData: FormData) {
  // lecture des champs
  const n = Math.max(1, Math.min(8, Number(formData.get("n") ?? 3))); // 1..8
  const decor = String(formData.get("decor") || "").trim() || undefined;
  const tenue = String(formData.get("tenue") || "").trim() || undefined;
  const accessoires = String(formData.get("accessoires") || "").trim() || undefined;
  const style = String(formData.get("style") || "").trim() || undefined;

  const file = formData.get("image") as File | null;

  // dossier utilisateur (public/out/<userId>)
  const { dir: outDir, userId } = await getOutDirForCurrentUser();

  // URL publique du site (pour exposer la source à Replicate)
  const site =
  (process.env.NEXT_PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL || "")
    .replace(/\/+$/, "") || "http://localhost:3000";

  // 1) si l’utilisateur a donné une image, on la sauve pour obtenir une URL publique
  let imageUrl: string | undefined = undefined;
  if (file && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const base = file.name.replace(/\.[^.]+$/, "");
    const name = `${base || "ref"}_${randSuffix()}.${ext}`;
    await fs.writeFile(path.join(outDir, name), buf);
    imageUrl = `${site}/out/${userId}/${encodeURIComponent(name)}`;
  }

  // 2) prompt consolidé
  const prompt = buildPrompt({ decor, tenue, accessoires, style });

  // 3) appel Replicate (renvoie des URLs d’images)
  const outputs = (await generateImage({
    prompt,
    imageUrl,
    numOutputs: n,
  })) as string[]; // Replicate renvoie généralement string[] d’URLs

  if (!outputs || outputs.length === 0) {
    throw new Error("Aucune image générée par le modèle.");
  }

  // 4) on télécharge les sorties et on les stocke dans le dossier user
const savedRelative: string[] = [];
let idx = 1;

for (const url of outputs) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("✖ Erreur fetch :", res.status, res.statusText);
      continue;
    }
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    const name = `gen_${Date.now()}_${idx}_${randSuffix()}.jpg`;
    await fs.writeFile(path.join(outDir, name), buf);
    savedRelative.push(`/out/${userId}/${encodeURIComponent(name)}`);
    idx++;
  } catch (err) {
    console.error("⚠️ Erreur pendant le téléchargement :", err);
    // on ignore les ratés individuels
  }
}

// 5) rafraîchit l’onglet images et redirige
revalidatePath("/dashboard/images");
redirect("/dashboard/images?generated=1");
}
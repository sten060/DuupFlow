"use server";

import crypto from "crypto";
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

/**
 * Nouvelle version : ne télécharge rien côté serveur.
 * Retourne simplement { ok, urls } ou { ok:false, error }.
 */
export async function generateAction(formData: FormData): Promise<
  | { ok: true; urls: string[] }
  | { ok: false; error: string }
> {
  try {
    // champs
    const n = Math.max(1, Math.min(8, Number(formData.get("n") ?? 3)));
    const decor = String(formData.get("decor") || "").trim() || undefined;
    const tenue = String(formData.get("tenue") || "").trim() || undefined;
    const accessoires = String(formData.get("accessoires") || "").trim() || undefined;
    const style = String(formData.get("style") || "").trim() || undefined;

    const file = formData.get("image") as File | null;

    // dossier user (on l’invoque pour récupérer userId même si on ne sauvegarde pas ici)
    const { userId } = await getOutDirForCurrentUser();

    // URL publique du site si jamais on devait exposer l’image d’entrée
    const site =
      (process.env.NEXT_PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL || "")
        .replace(/\/+$/, "") || "http://localhost:3000";

    // si l’utilisateur a fourni une image, on la passe telle quelle via blob URL (RSC ne peut pas lire ici),
    // donc on ne la persiste pas côté serveur pour éviter Cloudflare. On envoie sans image si absent.
    let imageUrl: string | undefined = undefined;

    // NOTE: pour un vrai “image-to-image”, si le modèle exige une URL publique,
    // on re-basculera vers un upload client -> Supabase Storage, puis on donnera cette URL au modèle.

    const prompt = buildPrompt({ decor, tenue, accessoires, style });

    const outputs = (await generateImage({
      prompt,
      imageUrl,
      numOutputs: n,
    })) as string[];

    if (!outputs || outputs.length === 0) {
      return { ok: false, error: "Aucune image générée par le modèle." };
    }

    // succès — on renvoie juste les URLs (hébergées par Replicate)
    return { ok: true, urls: outputs };
  } catch (err: any) {
    console.error("generateAction error:", err);
    return { ok: false, error: err?.message ?? "Erreur inconnue côté serveur." };
  }
}
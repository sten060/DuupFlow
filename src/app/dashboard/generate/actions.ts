"use server";

const REPLICATE_API = "https://zeno-replicate-proxy-33x2.vercel.app";
const VERSION = process.env.INSTANT_ID_VERSION!;
const AUTH = { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` };

type GenResult =
  | { ok: true; urls: string[] }
  | { ok: false; error: string };

export async function generateAction(formData: FormData): Promise<GenResult> {
  try {
    const file = formData.get("image") as unknown as File | null;
    const prompt = (formData.get("prompt") || "").toString().trim();
    const variants = Number(formData.get("variants") || 4) || 4;
    const seedStr = (formData.get("seed") || "").toString().trim();
    const seed = seedStr ? Number(seedStr) : undefined;
    // slider 0..1 où 0 = très fidèle, 1 = plus libre
    const fidelity = Number(formData.get("strength") || 0.6); 

    if (!file || file.size === 0) return { ok: false, error: "Aucune image reçue." };

    // 1) Upload du fichier sur Replicate pour obtenir une URL publique
    const fd = new FormData();
    fd.append("file", file, (file as any).name ?? "image.jpg");

    const upRes = await fetch(`${REPLICATE_API}/files`, {
      method: "POST",
      headers: AUTH as any,
      body: fd,
    });

    if (!upRes.ok) {
      const err = await upRes.text();
      return { ok: false, error: `Échec upload: ${err}` };
    }
    const uploaded = (await upRes.json()) as { url: string };
    const imgUrl = uploaded.url;

    // 2) Créer la prédiction (JSON, pas multipart)
    // NB: Instant-ID demande 2 entrées: 
    //  - id_image = image d’identité (visage de référence)
    //  - image    = image à modifier/garder la compo
    // Pour ton use-case "varier à partir de l’original", on passe la même URL aux 2.
    const input: Record<string, any> = {
      prompt,
      id_image: imgUrl,
      image: imgUrl,
      // mapping fidélité (0 = très fidèle -> control fort)
      // beaucoup de builds Instant-ID exposent "control_strength" ou "style_strength".
      // On inverse pour que "fidelity" 0 = fort contrôle.
      control_strength: 1 - fidelity,
      num_samples: variants,
      // options usuelles, tolérées par la plupart des versions
      guidance_scale: 3.5,
      // seed facultative si fournie
      ...(seed !== undefined ? { seed } : {}),
      // safety
      safety_checker: false,
    };

    const predRes = await fetch(
      `${REPLICATE_API}/models/instant-id/versions/${VERSION}/predictions`,
      {
        method: "POST",
        headers: {
          ...AUTH,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input }),
      }
    );

    if (!predRes.ok) {
      const err = await predRes.text();
      return { ok: false, error: `Création prédiction: ${err}` };
    }

    const pred = await predRes.json();

    // 3) Polling jusqu’au résultat
    let prediction = pred;
    const id = pred.id as string;

    for (let i = 0; i < 60; i++) { // ~60s max
      const r = await fetch(`${REPLICATE_API}/predictions/${id}`, { headers: AUTH as any });
      prediction = await r.json();
      if (prediction.status === "succeeded") break;
      if (prediction.status === "failed" || prediction.status === "canceled") {
        const e = prediction.error ? JSON.stringify(prediction.error) : "échec modèle";
        return { ok: false, error: e };
      }
      await new Promise((res) => setTimeout(res, 1000));
    }

    const output = (prediction.output ?? []) as string[];
    if (!output.length) return { ok: false, error: "Aucun résultat renvoyé par le modèle." };

    return { ok: true, urls: output };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Erreur inconnue." };
  }
}
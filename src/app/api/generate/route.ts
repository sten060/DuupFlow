import { NextResponse } from "next/server";
import Replicate from "replicate";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

export const runtime = "nodejs";

async function fileToDataUrl(file: File) {
  const ab = await file.arrayBuffer();
  const out = await sharp(Buffer.from(ab), { sequentialRead: true })
    .rotate()
    .png({ compressionLevel: 9 })
    .toBuffer();
  return `data:image/png;base64,${out.toString("base64")}`;
}

type Ok = { ok: true; urls: string[] };
type Err = { ok: false; error: string };

export async function POST(req: Request) {
  try {
    console.log("HIT /api/generate");

    // Vérifier que le token Replicate est configuré
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json<Err>(
        { ok: false, error: "REPLICATE_API_TOKEN non configuré dans .env.local" },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("image") as File | null;
    const promptRaw = (form.get("prompt") || "").toString().trim();
    const variants = Math.max(1, Math.min(4, Number(form.get("variants") || 1)));
    const output_quality = Math.max(60, Math.min(100, Number(form.get("output_quality") || 90)));
    const seedStr = (form.get("seed") || "").toString().trim();
    const seed = /^\d+$/.test(seedStr) ? Number(seedStr) : undefined;

    if (!file || file.size === 0) {
      return NextResponse.json<Err>({ ok: false, error: "Aucune image reçue." }, { status: 400 });
    }

    const dataUrl = await fileToDataUrl(file);
    console.log("dataUrl length:", dataUrl.length, "file.size:", file.size);

    // Initialiser le client Replicate
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Créer le dossier de destination pour les images IA
    const aiDir = path.join(process.cwd(), "public", "out", "local", "ai-generated");
    await fs.mkdir(aiDir, { recursive: true });

    // Générer toutes les variantes et les sauvegarder localement
    const localUrls: string[] = [];

    for (let i = 0; i < variants; i++) {
      const currentSeed = seed !== undefined ? seed + i : undefined;

      console.log(`Génération variante ${i + 1}/${variants} (seed: ${currentSeed || "auto"})`);

      const output = await replicate.run(
        "qwen/qwen-image-edit" as any,
        {
          input: {
            image: dataUrl,
            prompt: promptRaw,
            output_quality,
            ...(currentSeed !== undefined ? { seed: currentSeed } : {}),
          },
        }
      ) as any;

      // Extraire l'URL de l'image générée
      let imageUrl: string | null = null;
      if (typeof output === "string") {
        imageUrl = output;
      } else if (Array.isArray(output) && output.length > 0) {
        imageUrl = output[0];
      } else if (output?.url) {
        imageUrl = output.url;
      }

      if (!imageUrl) {
        console.warn("Pas d'URL d'image dans la réponse:", output);
        continue;
      }

      console.log(`Téléchargement de l'image depuis: ${imageUrl}`);

      // Télécharger l'image depuis Replicate
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error(`Échec du téléchargement de l'image ${i + 1}:`, response.statusText);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      console.log(`Image ${i + 1} téléchargée: ${buffer.length} bytes`);

      // Sauvegarder l'image localement
      const filename = `ai_${crypto.randomBytes(8).toString("hex")}.png`;
      const filepath = path.join(aiDir, filename);
      await fs.writeFile(filepath, buffer);

      // URL locale pour accéder à l'image
      const localUrl = `/out/local/ai-generated/${filename}`;
      localUrls.push(localUrl);

      console.log(`Image ${i + 1} sauvegardée: ${localUrl}`);
    }

    console.log(`${localUrls.length} image(s) générée(s) et sauvegardée(s)`);
    return NextResponse.json<Ok>({ ok: true, urls: localUrls });

  } catch (e: any) {
    console.error("generate fatal:", e);
    return NextResponse.json<Err>(
      { ok: false, error: e?.message || "Erreur lors de la génération" },
      { status: 500 }
    );
  }
}
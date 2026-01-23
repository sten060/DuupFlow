import { NextResponse } from "next/server";
import Replicate from "replicate";
import sharp from "sharp";
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

    // Générer toutes les variantes
    const allUrls: string[] = [];

    for (let i = 0; i < variants; i++) {
      const currentSeed = seed !== undefined ? seed + i : undefined;

      console.log(`Génération variante ${i + 1}/${variants} (seed: ${currentSeed || "auto"})`);

      const output = await replicate.run(
        "qwen/qwen-image-edit:c6b44935661f6941e37eb29dce27d7b10deb82dd9ec49a85dc2f31d51352eba2",
        {
          input: {
            image: dataUrl,
            prompt: promptRaw,
            output_quality,
            ...(currentSeed !== undefined ? { seed: currentSeed } : {}),
          },
        }
      ) as any;

      // Replicate renvoie soit une URL, soit un array d'URLs
      if (typeof output === "string") {
        allUrls.push(output);
      } else if (Array.isArray(output)) {
        allUrls.push(...output);
      } else if (output?.url) {
        allUrls.push(output.url);
      } else {
        console.warn("Format de sortie inattendu:", output);
      }
    }

    console.log(`${allUrls.length} image(s) générée(s)`);
    return NextResponse.json<Ok>({ ok: true, urls: allUrls });

  } catch (e: any) {
    console.error("generate fatal:", e);
    return NextResponse.json<Err>(
      { ok: false, error: e?.message || "Erreur lors de la génération" },
      { status: 500 }
    );
  }
}
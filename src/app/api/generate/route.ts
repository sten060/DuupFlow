// src/app/api/generate/route.ts
import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

const REPLICATE_API = "https://api.replicate.com/v1";
const MODEL = "qwen/qwen-image-edit";

type Ok = { ok: true; urls: string[] };
type Err = { ok: false; error: string };

async function createPrediction(input: Record<string, any>, token: string) {
  const res = await fetch(`${REPLICATE_API}/models/${MODEL}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait", // on attend la fin côté Replicate
    },
    body: JSON.stringify({ input }),
  });
  if (res.ok) return res.json();
  const text = await res.text().catch(() => "");
  throw new Error(`Create prediction: ${res.status} ${text}`);
}

// Normalise l’image d’entrée et renvoie une dataURL JPG (qualité = output_quality)
async function normalizeToDataUrl(file: File, quality: number) {
  const ab = await file.arrayBuffer();
  const inputBuf = Buffer.from(ab);

  // On encode en PNG pour ne rien perdre avant l'envoi à l'IA
  const out = await sharp(inputBuf, { sequentialRead: true })
    .rotate()
    .png({ compressionLevel: 9 })
    .toBuffer();

  const b64 = out.toString("base64");
  return `data:image/png;base64,${b64}`;
}

export async function POST(req: Request) {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return NextResponse.json<Err>(
        { ok: false, error: "REPLICATE_API_TOKEN manquant." },
        { status: 500 }
      );
    }

    // ---------- Lire le formulaire ----------
    const form = await req.formData();
    const file = form.get("image") as File | null;
    const promptRaw = (form.get("prompt") || "").toString().trim();

    const variants = Math.max(1, Math.min(4, Number(form.get("variants") || 1)));
    const output_quality = Math.max(60, Math.min(100, Number(form.get("output_quality") || 90)));

    const seedStr = (form.get("seed") || "").toString().trim();
    const seed = seedStr && /^\d+$/.test(seedStr) ? Number(seedStr) : undefined;

    if (!file || file.size === 0) {
      return NextResponse.json<Err>(
        { ok: false, error: "Aucune image reçue." },
        { status: 400 }
      );
    }
    if (!promptRaw) {
      return NextResponse.json<Err>(
        { ok: false, error: "Prompt manquant." },
        { status: 400 }
      );
    }

    // ---------- Normaliser l’image en entrée ----------
    const dataUrl = await normalizeToDataUrl(file, output_quality);

    // ---------- Cadrage anti-rotation / anti-cartoon ----------
    const wantsBgChange = /\b(background|fond|d[ée]cor|mur|salle de sport|gym|studio|remplace( r|z)? le (fond|d[ée]cor)|replace the background)\b/i
      .test(promptRaw);

    const prefix = wantsBgChange
      ? "Keep the person exactly as in the original: same face identity, body proportions, pose, camera angle and phone remain unchanged. Preserve original lighting and perspective. Replace only the background. "
      : "";

    const antiFlip =
      " Keep original orientation and framing as in the input. Do not rotate, do not mirror, do not flip horizontally or vertically. Preserve left-right consistency.";

    const suffix = " Photorealistic, natural skin texture, no cartoon, no painting, no illustration.";

    const finalPrompt = `${prefix}${promptRaw}${antiFlip}${suffix}`;

    // ---------- Lancer les variantes + convertir en JPG ----------
    const urls: string[] = [];

    for (let i = 0; i < variants; i++) {
      const effectiveSeed = seed !== undefined ? seed + i : undefined;

      const input: Record<string, any> = {
        image: dataUrl,
        prompt: finalPrompt,
        output_quality, // utilisé pour l'input; la sortie modèle reste libre (souvent webp)
      };
      if (effectiveSeed !== undefined) input.seed = effectiveSeed;

      let prediction: any;
      try {
        prediction = await createPrediction(input, token);
      } catch (e: any) {
        const msg = String(e?.message || "");
        if (msg.includes("422")) {
          delete input.seed;
          prediction = await createPrediction(input, token);
        } else {
          throw e;
        }
      }

      // Sortie modèle : souvent array d'URLs (webp)
      const out = prediction?.output;
      const outs: string[] = Array.isArray(out) ? out : (typeof out === "string" ? [out] : []);

      for (const u of outs) {
        if (typeof u !== "string") continue;

        try {
          // 1) Télécharger l’image renvoyée par Replicate
          const res = await fetch(u, { cache: "no-store" });
          const buf = Buffer.from(await res.arrayBuffer());

          // 2) Convertir en JPG qualité 90
          const jpg = await sharp(buf)
  .rotate()
  .jpeg({
    quality: 95,
    mozjpeg: true,
    chromaSubsampling: "4:4:4",
    progressive: true,
  })
  .sharpen(0.6)
  .toBuffer();

          // 3) Encoder en data URL (option: uploader sur ton storage et renvoyer une URL publique)
          const b64 = jpg.toString("base64");
          const dataUrlJpg = `data:image/jpeg;base64,${b64}`;
          urls.push(dataUrlJpg);
        } catch {
          // En cas d’échec, on garde l’URL d’origine (au pire .webp)
          urls.push(u);
        }
      }
    }

    if (urls.length === 0) {
      return NextResponse.json<Err>(
        { ok: false, error: "Aucune image retournée." },
        { status: 502 }
      );
    }

    return NextResponse.json<Ok>({ ok: true, urls }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json<Err>(
      { ok: false, error: e?.message || "Erreur serveur." },
      { status: 500 }
    );
  }
}
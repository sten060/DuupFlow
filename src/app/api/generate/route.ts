// src/app/api/generate/route.ts
import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

// ⚠️ on n'utilise PLUS le token côté Render
const PROXY_URL = "https://zeno-replicate-proxy-clean.onrender.com/api/replicate";
console.log("ZENO using proxy:", PROXY_URL);

type Ok = { ok: true; urls: string[] };
type Err = { ok: false; error: string };

async function createPrediction(input: Record<string, any>) {
  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }), // le proxy attend { input: {...} }
  });
  if (res.ok) return res.json();
  const text = await res.text().catch(() => "");
  throw new Error(`Create prediction (proxy): ${res.status} ${text}`);
}

// Normalise l’image d’entrée -> DataURL PNG (sans perte)
async function normalizeToDataUrl(file: File) {
  const ab = await file.arrayBuffer();
  const inputBuf = Buffer.from(ab);
  const out = await sharp(inputBuf, { sequentialRead: true }).rotate().png({ compressionLevel: 9 }).toBuffer();
  const b64 = out.toString("base64");
  return `data:image/png;base64,${b64}`;
}

export async function POST(req: Request) {
  try {
    console.log("HIT /api/generate"); // <- visible dans les logs Render

    const form = await req.formData();
    console.log("🧾 FormData keys:", Array.from(form.keys()));
    const file = form.get("image") as File | null;
    const promptRaw = (form.get("prompt") || "").toString().trim();

    const variants = Math.max(1, Math.min(4, Number(form.get("variants") || 1)));
    const output_quality = Math.max(60, Math.min(100, Number(form.get("output_quality") || 90)));

    const seedStr = (form.get("seed") || "").toString().trim();
    const seed = seedStr && /^\d+$/.test(seedStr) ? Number(seedStr) : undefined;

    if (!file || file.size === 0) {
      return NextResponse.json<Err>({ ok: false, error: "Aucune image reçue." }, { status: 400 });
    }
    if (!promptRaw) {
      return NextResponse.json<Err>({ ok: false, error: "Prompt manquant." }, { status: 400 });
    }

    const dataUrl = await normalizeToDataUrl(file);

    const wantsBgChange = /\b(background|fond|d[ée]cor|mur|salle de sport|gym|studio|remplace( r|z)? le (fond|d[ée]cor)|replace the background)\b/i.test(promptRaw);
    const prefix = wantsBgChange
      ? "Keep the person exactly as in the original: same face identity, body proportions, pose, camera angle and phone remain unchanged. Preserve original lighting and perspective. Replace only the background. "
      : "";
    const antiFlip = " Keep original orientation and framing as in the input. Do not rotate, do not mirror, do not flip horizontally or vertically. Preserve left-right consistency.";
    const suffix = " Photorealistic, natural skin texture, no cartoon, no painting, no illustration.";
    const finalPrompt = `${prefix}${promptRaw}${antiFlip}${suffix}`;

    const urls: string[] = [];

    for (let i = 0; i < variants; i++) {
      const effectiveSeed = seed !== undefined ? seed + i : undefined;

      const input: Record<string, any> = {
        image: dataUrl,
        prompt: finalPrompt,
        output_quality,
      };
      if (effectiveSeed !== undefined) input.seed = effectiveSeed;

      let prediction: any;
      try {
        prediction = await createPrediction(input);
      } catch (e: any) {
        const msg = String(e?.message || "");
        if (msg.includes("422")) {
          delete input.seed;
          prediction = await createPrediction(input);
        } else {
          throw e;
        }
      }

      const out = prediction?.output;
      const outs: string[] = Array.isArray(out) ? out : (typeof out === "string" ? [out] : []);
      for (const u of outs) {
        if (typeof u !== "string") continue;
        try {
          const res = await fetch(u, { cache: "no-store" });
          const buf = Buffer.from(await res.arrayBuffer());
          const jpg = await sharp(buf)
            .rotate()
            .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: "4:4:4", progressive: true })
            .sharpen(0.6)
            .toBuffer();
          const b64 = jpg.toString("base64");
          urls.push(`data:image/jpeg;base64,${b64}`);
        } catch {
          urls.push(u);
        }
      }
    }

    if (urls.length === 0) {
      return NextResponse.json<Err>({ ok: false, error: "Aucune image retournée." }, { status: 502 });
    }
    return NextResponse.json<Ok>({ ok: true, urls }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json<Err>({ ok: false, error: e?.message || "Erreur serveur." }, { status: 500 });
  }
}
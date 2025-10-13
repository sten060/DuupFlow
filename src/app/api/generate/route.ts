// src/app/api/generate/route.ts
import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

// 👉 ton proxy Render (pas l'API Replicate)
const PROXY_URL = "https://zeno-replicate-proxy-clean.onrender.com/api/replicate";

type Ok = { ok: true; urls: string[] };
type Err = { ok: false; error: string };

async function normalizeToDataUrl(file: File) {
  const ab = await file.arrayBuffer();
  const inputBuf = Buffer.from(ab);
  // PNG sans perte (évite les surprises avec JPEG)
  const out = await sharp(inputBuf, { sequentialRead: true }).png({ compressionLevel: 9 }).toBuffer();
  const b64 = out.toString("base64");
  return `data:image/png;base64,${b64}`;
}

export async function POST(req: Request) {
  try {
    console.log("HIT /api/generate");

    const form = await req.formData();

    // logs utiles visibles dans les logs Render
    console.log("🧾 FormData keys:", Array.from(form.keys()));

    const file = form.get("image") as File | null;
    const promptRaw = (form.get("prompt") || "").toString().trim();
    const variants = Math.max(1, Math.min(4, Number(form.get("variants")) || 1));
    const output_quality = Math.max(60, Math.min(100, Number(form.get("output_quality")) || 90));
    const seedStr = (form.get("seed") || "").toString().trim();
    const seed = seedStr && /^-?\d+$/.test(seedStr) ? Number(seedStr) : undefined;

    if (!file || file.size === 0) {
      return NextResponse.json<Err>({ ok: false, error: "Aucune image reçue." }, { status: 400 });
    }

    // ➜ Convertit VRAIMENT en DataURL (c’est ce que ton proxy attend pour uploader vers Replicate)
    const dataUrl = await normalizeToDataUrl(file);
    console.log("📦 dataUrl length:", dataUrl.length, "file.size:", file.size);

    // ➜ Envoi au proxy Render (JSON { input: ... })
    const r = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: {
          image: dataUrl,       // <-- IMPORTANT
          prompt: promptRaw,
          variants,
          output_quality,
          seed,
        },
      }),
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`Proxy error ${r.status}: ${t}`);
    }

    const j = await r.json();
    return NextResponse.json<Ok>(j);
  } catch (e: any) {
    console.error("generate error:", e?.stack || e);
    return NextResponse.json<Err>({ ok: false, error: e?.message || "Erreur inconnue" }, { status: 500 });
  }
}
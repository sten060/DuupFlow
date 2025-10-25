import { NextResponse } from "next/server";
import sharp from "sharp";
export const runtime = "nodejs";

const PROXY_URL =
  process.env.ZENO_PROXY_URL ||
  "https://zeno-replicate-proxy-clean.onrender.com/api/replicate";

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

    const input: Record<string, any> = {
      image: dataUrl,
      prompt: promptRaw,
      variants,
      output_quality,
      ...(seed !== undefined ? { seed } : {}),
    };

    const r = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ input }),
    });

    const text = await r.text();
    if (!r.ok) {
      console.error("generate error:", r.status, text);
      return new NextResponse(text, { status: r.status, headers: { "Content-Type": "application/json" } });
    }

    const j = JSON.parse(text);
    return NextResponse.json<Ok>({ ok: true, urls: j.urls || [] });
  } catch (e: any) {
    console.error("generate fatal:", e);
    return NextResponse.json<Err>({ ok: false, error: e?.message || "Erreur" }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import crypto from "crypto";
import { exiftool } from "exiftool-vendored";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ ok: false, error: "no file" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const outDir = path.join(process.cwd(), "public/out/test");
    await fs.mkdir(outDir, { recursive: true });

    const name = `dup_${Date.now()}_${crypto.randomBytes(3).toString("hex")}.jpg`;
    const outPath = path.join(outDir, name);

    console.log("[API_DUP] start:", outPath);

    const scale = 0.8 + Math.random() * 0.4;
    const rotate = Math.random() * 10 - 5;
    const brightness = 0.8 + Math.random() * 0.4;

    await sharp(buffer)
      .resize(Math.round(1024 * scale))
      .rotate(rotate)
      .modulate({ brightness })
      .jpeg({ quality: 50 })
      .toFile(outPath);

    await exiftool.write(outPath, {
      Artist: "ZENO_TEST",
      Comment: `rot=${rotate.toFixed(2)} scale=${scale.toFixed(2)} bright=${brightness.toFixed(2)}`,
    });

    console.log("[API_DUP] done:", outPath);

    return NextResponse.json({ ok: true, name });
  } catch (e: any) {
    console.error("[API_DUP] ERR:", e);
    return NextResponse.json({ ok: false, error: e.message });
  }
}
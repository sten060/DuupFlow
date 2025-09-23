// src/app/api/out/zip/route.ts
import path from "path";
import fs from "fs/promises";
import JSZip from "jszip";

export async function GET() {
  const OUT_DIR = path.join(process.cwd(), "public", "out");

  const zip = new JSZip();

  try {
    const files = await fs.readdir(OUT_DIR);
    if (!files.length) {
      return new Response("Aucun fichier à zipper.", { status: 404 });
    }

    for (const name of files) {
      const full = path.join(OUT_DIR, name);
      const stat = await fs.stat(full);
      if (stat.isFile()) {
        const data = await fs.readFile(full);
        zip.file(name, data);
      }
    }

    const content = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="generated_files.zip"`,
      },
    });
  } catch (err: any) {
    return new Response(`ZIP error: ${err?.message || err}`, { status: 500 });
  }
}
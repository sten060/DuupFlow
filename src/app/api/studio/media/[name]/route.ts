// GET /api/studio/media/[name] — sert un fichier local du studio
// (upload brut ou variante générée) avec support des requêtes Range,
// indispensable pour la lecture/seek dans <video>.

import fsSync from "fs";
import fs from "fs/promises";
import { Readable } from "stream";
import { resolveStoredFile } from "@/lib/studio/local-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

export async function GET(
  req: Request,
  { params }: { params: { name: string } }
) {
  const filePath = await resolveStoredFile(params.name);
  if (!filePath) {
    return new Response("Fichier introuvable", { status: 404 });
  }

  const { size } = await fs.stat(filePath);
  const ext = params.name.slice(params.name.lastIndexOf("."));
  const contentType = MIME[ext] ?? "application/octet-stream";

  const range = req.headers.get("range");
  const m = range?.match(/^bytes=(\d*)-(\d*)$/);

  // Réponse partielle (seek du <video>)
  if (m && (m[1] !== "" || m[2] !== "")) {
    const start = m[1] === "" ? Math.max(0, size - Number(m[2])) : Number(m[1]);
    const end = m[1] !== "" && m[2] !== "" ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    const stream = Readable.toWeb(
      fsSync.createReadStream(filePath, { start, end })
    ) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
      },
    });
  }

  // Réponse complète
  const stream = Readable.toWeb(fsSync.createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
    },
  });
}

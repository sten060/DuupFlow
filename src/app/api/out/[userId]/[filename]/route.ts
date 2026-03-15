import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { createClient } from "@/lib/supabase/server";

const OUT_BASE = process.env.OUT_BASE ?? path.join(os.tmpdir(), "duupflow");

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { userId: string; filename: string } }
) {
  // Authenticate the request
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Only allow users to access their own files
  if (user.id !== params.userId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const filename = decodeURIComponent(params.filename);

  // Prevent path traversal
  if (filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Nom de fichier invalide" }, { status: 400 });
  }

  const filePath = path.join(OUT_BASE, params.userId, filename);

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType =
    ext === ".mp4" ? "video/mp4" :
    ext === ".mov" ? "video/quicktime" :
    ext === ".mkv" ? "video/x-matroska" :
    ext === ".webm" ? "video/webm" :
    ext === ".avi" ? "video/x-msvideo" :
    ext === ".png" ? "image/png" :
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
    ext === ".webp" ? "image/webp" :
    "application/octet-stream";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}

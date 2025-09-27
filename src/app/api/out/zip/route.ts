// src/app/api/out/zip/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import archiver from "archiver";
import fs from "fs/promises";
import path from "path";
import { getOutDirForCurrentUser } from "@/app/dashboard/utils"; // adapte si ton fichier s'appelle différemment

const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".avi", ".webm"];
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

function extOf(n: string) {
  const p = n.lastIndexOf(".");
  return p >= 0 ? n.slice(p).toLowerCase() : "";
}

export async function GET(req: Request) {
  // 1) Dossier perso de l'utilisateur connecté
  const { dir } = await getOutDirForCurrentUser();

  // 2) Filtre optionnel: ?type=videos | images (sinon tout)
  const url = new URL(req.url);
  const type = url.searchParams.get("type"); // "videos" | "images" | null

  // 3) Liste des fichiers finaux (pas les temporaires)
  const names = await fs.readdir(dir).catch(() => []);
  const files = names.filter((n) => {
    if (n.startsWith(".") || n.startsWith("tmp_") || n.includes("__in__") || n.endsWith(".part")) {
      return false;
    }
    const ext = extOf(n);
    if (type === "videos") return VIDEO_EXTS.includes(ext);
    if (type === "images") return IMAGE_EXTS.includes(ext);
    return true; // pas de type ⇒ tout
  });

  if (files.length === 0) {
    return new NextResponse("Aucun fichier à zipper pour ce filtre.", { status: 404 });
  }

  // 4) Crée un zip en streaming
  const archive = archiver("zip", { zlib: { level: 9 } });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      archive.on("data", (chunk) => controller.enqueue(chunk as Uint8Array));
      archive.on("end", () => controller.close());
      archive.on("error", (err) => controller.error(err));

      for (const name of files) {
        archive.file(path.join(dir, name), { name });
      }
      archive.finalize().catch((e) => controller.error(e));
    },
  });

  const filename =
    type === "videos" ? "videos.zip" :
    type === "images" ? "images.zip" :
    "generated_files.zip";

  return new NextResponse(stream as any, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
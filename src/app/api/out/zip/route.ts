// src/app/api/out/zip/route.ts
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import archiver from "archiver";
import { getOutDirForCurrentUserRSC } from "@/app/dashboard/utils";

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".avi", ".webm"];

function extOf(name: string) {
  const p = name.lastIndexOf(".");
  return p >= 0 ? name.slice(p).toLowerCase() : "";
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { dir, userId } = await getOutDirForCurrentUserRSC();
  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") || "all") as
    | "all" | "images" | "videos";

  const entries = await fs.readdir(dir, { withFileTypes: true });

  const files = entries
    .filter((d) => d.isFile())
    .map((d) => d.name)
    // on enlève les temporaires/partiels
    .filter((n) =>
      !n.startsWith(".") &&
      !n.startsWith("tmp_") &&
      !n.startsWith("__in__") &&
      !n.startsWith("__progress_") &&
      !n.endsWith(".part")
    )
    // filtre par scope
    .filter((n) => {
      if (scope === "images") return IMAGE_EXTS.includes(extOf(n));
      if (scope === "videos") return VIDEO_EXTS.includes(extOf(n));
      return true; // "all"
    });

  // Prépare un flux ZIP en réponse
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("warning", () => {});
  archive.on("error", (err) => { throw err; });
  archive.on("data", (chunk) => writer.write(chunk));
  archive.on("end", () => writer.close());

  // Ajoute les fichiers
  for (const name of files) {
    archive.file(path.join(dir, name), { name });
  }
  archive.finalize();

  const fileName =
    scope === "images" ? `images_${userId}.zip`
    : scope === "videos" ? `videos_${userId}.zip`
    : `out_${userId}.zip`;

  return new NextResponse(readable as any, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
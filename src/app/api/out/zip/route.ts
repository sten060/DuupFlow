// src/app/api/out/zip/route.ts
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import archiver from "archiver";
import { getOutDirForCurrentUserRSC } from "@/app/dashboard/utils";
import { createAdminClient } from "@/lib/supabase/admin";

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".avi", ".webm"];
const OUTPUT_BUCKET = "video-outputs";

function extOf(name: string) {
  const p = name.lastIndexOf(".");
  return p >= 0 ? name.slice(p).toLowerCase() : "";
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { dir, userId } = await getOutDirForCurrentUserRSC();
  const url = new URL(req.url);

  const channel = url.searchParams.get("channel") || "all";
  const scope = (url.searchParams.get("scope") || "all") as "all" | "images" | "videos";
  const filesParam = url.searchParams.get("files");
  const specificFiles = filesParam ? filesParam.split(",").filter(Boolean) : null;

  function matchesFilters(name: string) {
    if (name.startsWith(".") || name.startsWith("tmp_") || name.startsWith("__in__") || name.startsWith("__progress_") || name.endsWith(".part")) return false;
    if (specificFiles) return specificFiles.includes(name);
    if (scope === "images" && !IMAGE_EXTS.includes(extOf(name))) return false;
    if (scope === "videos" && !VIDEO_EXTS.includes(extOf(name))) return false;
    if (channel === "simple" && !name.startsWith("SIMPLE_DuupFlow_")) return false;
    if (channel === "advanced" && !name.startsWith("ADVANCED_DuupFlow_")) return false;
    return true;
  }

  // Try filesystem first (local dev / VPS with persistent storage)
  const fsEntries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const fsFiles = fsEntries
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter(matchesFilters);

  // ZIP stream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("warning", () => {});
  archive.on("error", (err) => { throw err; });
  archive.on("data", (chunk) => writer.write(chunk));
  archive.on("end", () => writer.close());

  if (fsFiles.length > 0) {
    // Local filesystem — append files directly
    for (const name of fsFiles) {
      archive.file(path.join(dir, name), { name });
    }
    archive.finalize();
  } else {
    // Supabase Storage (Railway / Vercel) — download each file into the archive
    (async () => {
      try {
        const supabase = createAdminClient();
        const { data, error } = await supabase.storage
          .from(OUTPUT_BUCKET)
          .list(userId, { limit: 500, sortBy: { column: "created_at", order: "desc" } });

        if (error || !data) { archive.finalize(); return; }

        const names = data.map((f) => f.name).filter(matchesFilters);

        for (const name of names) {
          const { data: blob, error: dlErr } = await supabase.storage
            .from(OUTPUT_BUCKET)
            .download(`${userId}/${name}`);
          if (dlErr || !blob) continue;
          const buf = Buffer.from(await blob.arrayBuffer());
          archive.append(buf, { name });
        }
      } finally {
        archive.finalize();
      }
    })();
  }

  const fileName =
    channel === "simple"
      ? `DuupFlow_simple.zip`
      : channel === "advanced"
      ? `DuupFlow_advanced.zip`
      : `DuupFlow_out.zip`;

  return new NextResponse(readable as any, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

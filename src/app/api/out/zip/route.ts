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

/**
 * How many Supabase downloads to fire in parallel before appending to the
 * archive. 4 is a sweet spot: ~4× faster than sequential without saturating
 * memory (each parallel download buffers one file).
 */
const SUPABASE_DOWNLOAD_CONCURRENCY = 4;

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

  // Try filesystem first (local dev / Railway with volume)
  const fsEntries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const fsFiles = fsEntries
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter(matchesFilters);

  // ── ZIP stream wiring ──────────────────────────────────────────────────
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  // Output files are already-compressed media (JPEG, MP4) that don't shrink
  // with deflate. `store: true` skips compression entirely → ~10× faster
  // (~100 MB/s vs ~5 MB/s on level 9) for near-identical output size.
  const archive = archiver("zip", { store: true });

  // Single abort path — used on client disconnect, archiver errors, or
  // writer failures. Prevents the ERR_INVALID_STATE crash that happened
  // when archive.on("data") fired after the client had already closed.
  let aborted = false;
  const abort = (reason: unknown) => {
    if (aborted) return;
    aborted = true;
    try { archive.destroy(reason as Error | undefined); } catch {}
    writer.abort(reason).catch(() => {});
  };

  // Client disconnect (tab closed, network drop, browser timeout)
  const reqSignal = (req as Request).signal;
  if (reqSignal) {
    if (reqSignal.aborted) {
      abort(new Error("client_aborted_before_start"));
    } else {
      reqSignal.addEventListener("abort", () => abort(new Error("client_aborted")));
    }
  }

  archive.on("warning", () => {});
  archive.on("error", (err) => {
    console.error("[zip] archiver error:", err.message);
    abort(err);
  });
  archive.on("data", (chunk) => {
    if (aborted) return;
    writer.write(chunk).catch((err) => {
      // Most common cause: client closed the connection while we were
      // still streaming data — perfectly normal, just stop cleanly.
      console.warn("[zip] writer.write failed (likely client closed):", err?.message);
      abort(err);
    });
  });
  archive.on("end", () => {
    if (aborted) return;
    writer.close().catch(() => {});
  });

  if (fsFiles.length > 0) {
    // Local filesystem — archiver streams each file from disk (no buffering)
    console.log(`[zip] FS path: ${fsFiles.length} file(s) for ${userId}`);
    for (const name of fsFiles) {
      if (aborted) break;
      archive.file(path.join(dir, name), { name });
    }
    archive.finalize();
  } else {
    // Supabase Storage — download with limited concurrency
    (async () => {
      try {
        const supabase = createAdminClient();
        const { data, error } = await supabase.storage
          .from(OUTPUT_BUCKET)
          .list(userId, { limit: 500, sortBy: { column: "created_at", order: "desc" } });

        if (error || !data) {
          console.warn("[zip] Supabase list failed:", error?.message);
          if (!aborted) archive.finalize();
          return;
        }

        const names = data.map((f) => f.name).filter(matchesFilters);
        console.log(`[zip] Supabase path: ${names.length} file(s) for ${userId}, concurrency=${SUPABASE_DOWNLOAD_CONCURRENCY}`);

        // Concurrency-limited parallel downloads, append in order received
        for (let i = 0; i < names.length; i += SUPABASE_DOWNLOAD_CONCURRENCY) {
          if (aborted) break;
          const batch = names.slice(i, i + SUPABASE_DOWNLOAD_CONCURRENCY);
          const downloaded = await Promise.all(
            batch.map(async (name) => {
              const { data: blob, error: dlErr } = await supabase.storage
                .from(OUTPUT_BUCKET)
                .download(`${userId}/${name}`);
              if (dlErr || !blob) {
                console.warn(`[zip] download failed for ${name}:`, dlErr?.message);
                return null;
              }
              return { name, buf: Buffer.from(await blob.arrayBuffer()) };
            }),
          );
          for (const r of downloaded) {
            if (aborted) break;
            if (r) archive.append(r.buf, { name: r.name });
          }
        }
      } finally {
        if (!aborted) archive.finalize();
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

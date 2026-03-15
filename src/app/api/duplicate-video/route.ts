import os from "os";
import path from "path";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import { processVideos } from "@/app/dashboard/videos/processVideos";
import { getOutDirForCurrentUser } from "@/app/dashboard/utils";
import { createAdminClient } from "@/lib/supabase/admin";

const INPUT_BUCKET = "video-uploads";
const OUTPUT_BUCKET = "video-outputs";

export const maxDuration = 300; // seconds — Vercel Pro/Enterprise

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e: any) {
    const msg = e?.message || String(e) || "Erreur lecture formulaire";
    console.error("[duplicate-video] formData error:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Resolve user context while request cookies are still available
  let dir: string;
  let userId: string;
  try {
    ({ dir, userId } = await getOutDirForCurrentUser());
  } catch (e: any) {
    const msg = e?.message || String(e) || "Erreur authentification";
    console.error("[duplicate-video] getOutDir error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Check if files are coming via Supabase Storage paths (Vercel) or direct upload (local)
  const storagePaths = formData.getAll("storagePaths") as string[];
  const fileNames = formData.getAll("fileNames") as string[];
  const hasStoragePaths = storagePaths.length > 0;

  // Download files from Supabase Storage to /tmp when using the storage-based flow
  type PreDownloaded = { name: string; tmpPath: string };
  let preDownloadedFiles: PreDownloaded[] | undefined;
  const tmpFilesToClean: string[] = [];

  if (hasStoragePaths) {
    const supabase = createAdminClient();
    preDownloadedFiles = [];

    for (let i = 0; i < storagePaths.length; i++) {
      const storagePath = storagePaths[i];
      const fileName = fileNames[i] ?? path.basename(storagePath);

      const { data, error } = await supabase.storage
        .from(INPUT_BUCKET)
        .download(storagePath);

      if (error || !data) {
        return NextResponse.json(
          { error: `Téléchargement storage échoué: ${error?.message ?? "inconnu"}` },
          { status: 500 }
        );
      }

      const ext = path.extname(fileName) || ".mp4";
      const tmpPath = path.join(os.tmpdir(), `duup_in_${Date.now()}_${i}${ext}`);
      await fs.writeFile(tmpPath, Buffer.from(await data.arrayBuffer()));
      tmpFilesToClean.push(tmpPath);
      preDownloadedFiles.push({ name: fileName, tmpPath });
    }

    // Delete input objects from storage now that we have them locally
    await supabase.storage.from(INPUT_BUCKET).remove(storagePaths).catch(() => {});
  }

  // Stream progress updates via Server-Sent Events
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      // Send an SSE comment every 20 s so Vercel/proxies don't drop the
      // idle connection before ffmpeg finishes encoding.
      const keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch {}
      }, 20_000);

      try {
        const { channel, outputPaths } = await processVideos(
          formData,
          async (pct, msg) => { send({ percent: pct, msg }); },
          dir,
          preDownloadedFiles
        );

        // Upload outputs to Supabase Storage only when no persistent volume is available
        const hasVolume = !!process.env.OUT_BASE;
        if (!hasVolume && hasStoragePaths && outputPaths.length > 0) {
          const supabase = createAdminClient();
          await supabase.storage.createBucket(OUTPUT_BUCKET, { public: false, fileSizeLimit: 524288000 }).catch(() => {});
          await supabase.storage.updateBucket(OUTPUT_BUCKET, { public: false, fileSizeLimit: 524288000 }).catch(() => {});

          send({ percent: 99, msg: "Sauvegarde…" });
          for (const outPath of outputPaths) {
            const outName = path.basename(outPath);
            const storageKey = `${userId}/${outName}`;
            const fileBuffer = await fs.readFile(outPath);
            const { error: uploadError } = await supabase.storage
              .from(OUTPUT_BUCKET)
              .upload(storageKey, fileBuffer, { contentType: "video/mp4", upsert: true });
            if (uploadError) {
              console.error("[duplicate-video] upload error:", uploadError.message, "file:", outName);
              throw new Error(`Sauvegarde échouée (${outName}): ${uploadError.message}`);
            }
            await fs.unlink(outPath).catch(() => {});
          }
        }
        // With a persistent volume (OUT_BASE), files stay on disk — no upload needed

        send({ percent: 100, msg: "Terminé ✔", done: true, userId, channel });
      } catch (e: any) {
        send({ percent: -1, msg: e?.message || "Erreur FFmpeg", error: true });
      } finally {
        clearInterval(keepalive);
        // Clean up any temp input files
        for (const p of tmpFilesToClean) {
          await fs.unlink(p).catch(() => {});
        }
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

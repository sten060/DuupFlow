import os from "os";
import path from "path";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import { processVideos } from "@/app/dashboard/videos/processVideos";
import { getOutDirForCurrentUser, cleanupOldFiles } from "@/app/dashboard/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkUsage, incrementUsage } from "@/lib/usage";

const INPUT_BUCKET = "video-uploads";
const OUTPUT_BUCKET = "video-outputs";

export const maxDuration = 300;

export async function POST(req: Request) {
  void cleanupOldFiles(2 * 60 * 60 * 1000);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e: any) {
    const msg = e?.message || String(e) || "Erreur lecture formulaire";
    console.error("[duplicate-video] formData error:", msg);
    return NextResponse.json({ error: msg, code: "VID-001" }, { status: 400 });
  }

  // ── Usage check (Solo plan limits) ────────────────────────────────────────
  // Count the number of videos requested (each storagePath = 1 video)
  const storagePaths = formData.getAll("storagePaths") as string[];
  const requestedCount = Math.max(1, storagePaths.length || 1);

  const usageCheck = await checkUsage("videos", requestedCount);
  if (!usageCheck.allowed) {
    return NextResponse.json(
      {
        error: usageCheck.message ?? "Limite de duplications vidéos atteinte.",
        code: "VID-LIMIT",
        limitReached: true,
        current: usageCheck.current,
        limit: usageCheck.limit,
      },
      { status: 429 }
    );
  }

  // Resolve user context while request cookies are still available
  let dir: string;
  let userId: string;
  try {
    ({ dir, userId } = await getOutDirForCurrentUser());
  } catch (e: any) {
    const msg = e?.message || String(e) || "Erreur authentification";
    console.error("[duplicate-video] getOutDir error:", msg);
    return NextResponse.json({ error: msg, code: "VID-002" }, { status: 500 });
  }

  const fileNames    = formData.getAll("fileNames")    as string[];
  const directUploadIds = formData.getAll("directUploadIds") as string[];
  const hasStoragePaths = storagePaths.length > 0;
  const hasDirectUploads = directUploadIds.length > 0;

  const encoder = new TextEncoder();
  const tmpFilesToClean: string[] = [];

  // Track whether generation was successful so we can increment usage
  const usageUserId = usageCheck.userId;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      const keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch {}
      }, 20_000);

      let errorCode = "VID-004";
      let generationSucceeded = false;

      try {
        type PreDownloaded = { name: string; tmpPath: string };
        let preDownloadedFiles: PreDownloaded[] | undefined;

        if (hasDirectUploads) {
          // Files were already uploaded directly to /tmp via /api/upload-direct
          errorCode = "VID-003";
          const VALID_PREFIX = path.join(os.tmpdir(), "duup_direct_");
          preDownloadedFiles = directUploadIds.map((uploadId, i) => {
            // Validate ID to prevent path traversal: must start with expected prefix after join
            if (!/^duup_direct_[\w.-]+$/.test(uploadId)) {
              throw new Error(`ID d'upload invalide : ${uploadId}`);
            }
            const tmpPath = path.join(os.tmpdir(), uploadId);
            if (!tmpPath.startsWith(VALID_PREFIX)) {
              throw new Error(`Chemin d'upload invalide`);
            }
            tmpFilesToClean.push(tmpPath);
            const name = fileNames[i] ?? uploadId;
            return { name, tmpPath };
          });
          send({ percent: 5, msg: "Fichiers reçus, traitement en cours…" });
        } else if (hasStoragePaths) {
          errorCode = "VID-003";
          const supabase = createAdminClient();
          preDownloadedFiles = new Array(storagePaths.length);
          send({ percent: 0, msg: `Récupération ${storagePaths.length} fichier${storagePaths.length > 1 ? "s" : ""}…` });

          let doneDl = 0;
          await Promise.all(storagePaths.map(async (storagePath, i) => {
            const fileName = fileNames[i] ?? path.basename(storagePath);

            const { data, error } = await supabase.storage
              .from(INPUT_BUCKET)
              .download(storagePath);

            if (error || !data) {
              throw new Error(`Récupération storage échouée : ${error?.message ?? "inconnu"}`);
            }

            const ext     = path.extname(fileName) || ".mp4";
            const tmpPath = path.join(os.tmpdir(), `duup_in_${Date.now()}_${i}${ext}`);
            await fs.writeFile(tmpPath, Buffer.from(await data.arrayBuffer()));
            tmpFilesToClean.push(tmpPath);
            preDownloadedFiles![i] = { name: fileName, tmpPath };

            doneDl++;
            send({ percent: Math.round((doneDl / storagePaths.length) * 8), msg: `Récupération ${doneDl}/${storagePaths.length}…` });
          }));

          await supabase.storage.from(INPUT_BUCKET).remove(storagePaths).catch(() => {});
        }

        errorCode = "VID-004";
        const { channel, outputPaths, skippedCount } = await processVideos(
          formData,
          async (pct, msg) => { send({ percent: 8 + Math.round(pct * 0.91), msg }); },
          dir,
          preDownloadedFiles,
        );

        errorCode = "VID-005";
        const hasVolume = !!process.env.OUT_BASE;
        if (!hasVolume && (hasStoragePaths || hasDirectUploads) && outputPaths.length > 0) {
          const supabase = createAdminClient();
          await supabase.storage.createBucket(OUTPUT_BUCKET, { public: false, fileSizeLimit: 524288000 }).catch(() => {});
          await supabase.storage.updateBucket(OUTPUT_BUCKET, { public: false, fileSizeLimit: 524288000 }).catch(() => {});

          send({ percent: 99, msg: "Sauvegarde…" });
          await Promise.all(outputPaths.map(async (outPath) => {
            const outName    = path.basename(outPath);
            const storageKey = `${userId}/${outName}`;
            const fileBuffer = await fs.readFile(outPath);
            const { error: uploadError } = await supabase.storage
              .from(OUTPUT_BUCKET)
              .upload(storageKey, fileBuffer, { contentType: "video/mp4", upsert: true });
            if (uploadError) {
              console.error("[duplicate-video] upload error:", uploadError.message, "file:", outName);
              throw new Error(`Sauvegarde échouée (${outName}) : ${uploadError.message}`);
            }
            await fs.unlink(outPath).catch(() => {});
          }));
        }

        generationSucceeded = true;
        const warning = skippedCount > 0
          ? `⚠ ${skippedCount} duplication(s) ont échoué (erreur FFmpeg) — ${outputPaths.length} générée(s) sur ${outputPaths.length + skippedCount} demandée(s). Réessayez pour les vidéos manquantes.`
          : undefined;
        send({ percent: 100, msg: warning ?? "Terminé ✔", done: true, userId, channel, warning });
      } catch (e: any) {
        send({ percent: -1, msg: e?.message || "Erreur FFmpeg", error: true, code: errorCode });
      } finally {
        clearInterval(keepalive);
        for (const p of tmpFilesToClean) {
          await fs.unlink(p).catch(() => {});
        }

        // Increment usage after successful generation
        if (generationSucceeded && usageUserId) {
          incrementUsage(usageUserId, "videos", requestedCount).catch(console.error);
        }

        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

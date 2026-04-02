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

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no",
};

// ── Server-side job registry ────────────────────────────────────────────────
// Module-level singleton: survives across requests in the same Railway process.
// When a client's SSE connection drops and reconnects with the same jobId,
// we replay buffered events + forward live ones — NO FFmpeg restart, NO temp
// file re-read, NO duplicate output files.
type JobEntry = {
  events: object[];   // all SSE data events buffered (keepalives excluded)
  done: boolean;
  tmpPaths: string[]; // source temp files — only deleted once job.done = true
};
const jobRegistry = new Map<string, JobEntry>();

export async function POST(req: Request) {
  void cleanupOldFiles(1 * 60 * 60 * 1000);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e: any) {
    const msg = e?.message || String(e) || "Erreur lecture formulaire";
    console.error("[duplicate-video] formData error:", msg);
    return NextResponse.json({ error: msg, code: "VID-001" }, { status: 400 });
  }

  const jobId = (formData.get("jobId") as string | null) || null;
  const encoder = new TextEncoder();

  // ── Reconnect path ────────────────────────────────────────────────────────
  // Client re-POSTed after a transient network drop with the same jobId.
  // The original processing continues uninterrupted on Railway.
  // We just replay buffered events + forward live events to the new SSE stream.
  if (jobId && jobRegistry.has(jobId)) {
    const job = jobRegistry.get(jobId)!;

    return new Response(
      new ReadableStream({
        async start(controller) {
          let i = 0;
          const fwd = (data: object) => {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            } catch {}
          };

          // Replay all past events, then poll for new ones until job completes
          while (true) {
            while (i < job.events.length) fwd(job.events[i++]);
            if (job.done) break;
            await new Promise(r => setTimeout(r, 50));
          }
          // Flush any final events emitted between last poll and done = true
          while (i < job.events.length) fwd(job.events[i++]);

          try { controller.close(); } catch {}
        },
      }),
      { headers: SSE_HEADERS }
    );
  }

  // ── New job path ──────────────────────────────────────────────────────────
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

  let dir: string;
  let userId: string;
  try {
    ({ dir, userId } = await getOutDirForCurrentUser());
  } catch (e: any) {
    const msg = e?.message || String(e) || "Erreur authentification";
    console.error("[duplicate-video] getOutDir error:", msg);
    return NextResponse.json({ error: msg, code: "VID-002" }, { status: 500 });
  }

  const fileNames       = formData.getAll("fileNames")       as string[];
  const directUploadIds = formData.getAll("directUploadIds") as string[];
  const hasStoragePaths  = storagePaths.length > 0;
  const hasDirectUploads = directUploadIds.length > 0;

  const usageUserId = usageCheck.userId;

  // Register job — reconnects will find it here
  const jobEntry: JobEntry = { events: [], done: false, tmpPaths: [] };
  if (jobId) jobRegistry.set(jobId, jobEntry);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        // Buffer every data event for reconnect replay
        jobEntry.events.push(data);
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      // Keepalives keep the TCP connection alive but are NOT buffered —
      // a reconnect client doesn't need to replay them.
      const keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch {}
      }, 20_000);

      let errorCode = "VID-004";
      let generationSucceeded = false;

      try {
        type PreDownloaded = { name: string; tmpPath: string };
        let preDownloadedFiles: PreDownloaded[] | undefined;

        if (hasDirectUploads) {
          errorCode = "VID-003";
          const VALID_PREFIX = path.join(os.tmpdir(), "duup_direct_");
          preDownloadedFiles = directUploadIds.map((uploadId, i) => {
            if (!/^duup_direct_[\w.-]+$/.test(uploadId)) {
              throw new Error(`ID d'upload invalide : ${uploadId}`);
            }
            const tmpPath = path.join(os.tmpdir(), uploadId);
            if (!tmpPath.startsWith(VALID_PREFIX)) {
              throw new Error(`Chemin d'upload invalide`);
            }
            // Track in jobEntry.tmpPaths — deleted only when job.done = true
            jobEntry.tmpPaths.push(tmpPath);
            const name = fileNames[i] || path.basename(uploadId);
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
            const fileName = fileNames[i] || path.basename(storagePath);
            const { data, error } = await supabase.storage.from(INPUT_BUCKET).download(storagePath);
            if (error || !data) {
              throw new Error(`Récupération storage échouée : ${error?.message ?? "inconnu"}`);
            }
            const ext     = path.extname(fileName) || ".mp4";
            const tmpPath = path.join(os.tmpdir(), `duup_in_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}${ext}`);
            await fs.writeFile(tmpPath, Buffer.from(await data.arrayBuffer()));
            jobEntry.tmpPaths.push(tmpPath);
            preDownloadedFiles![i] = { name: fileName, tmpPath };
            doneDl++;
            send({ percent: Math.round((doneDl / storagePaths.length) * 8), msg: `Récupération ${doneDl}/${storagePaths.length}…` });
          }));

          await supabase.storage.from(INPUT_BUCKET).remove(storagePaths).catch(() => {});
        }

        errorCode = "VID-004";
        const hasVolume = !!process.env.OUT_BASE;
        const { channel, outputPaths, skippedCount } = await processVideos(
          formData,
          async (pct, msg) => { send({ percent: 8 + Math.round(pct * 0.91), msg }); },
          dir,
          preDownloadedFiles,
          hasVolume
            ? async (outPath) => {
                const name = path.basename(outPath);
                send({ fileReady: { name, url: `/api/out/${userId}/${name}` } });
              }
            : undefined,
        );

        errorCode = "VID-005";
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
              throw new Error(`Sauvegarde échouée — contactez le support. [VID-005]`);
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
        const userMsg = errorCode === "VID-004"
          ? "Une erreur est survenue pendant le traitement. Contactez le support."
          : errorCode === "VID-005"
          ? "Erreur lors de la sauvegarde du fichier."
          : errorCode === "VID-003"
          ? "Erreur lors du chargement du fichier source."
          : "Une erreur inattendue est survenue.";
        console.error(`[duplicate-video] ${errorCode}:`, e?.message);
        send({ percent: -1, msg: `[${errorCode}] ${userMsg}`, error: true, code: errorCode });
      } finally {
        clearInterval(keepalive);
        // Mark job done BEFORE deleting temp files so any active reconnect
        // streams can flush their remaining buffered events first.
        jobEntry.done = true;
        // Now safe to delete source temp files
        for (const p of jobEntry.tmpPaths) {
          await fs.unlink(p).catch(() => {});
        }
        // Keep entry in registry for 2 min to handle late reconnects gracefully
        if (jobId) setTimeout(() => jobRegistry.delete(jobId), 120_000);

        if (generationSucceeded && usageUserId) {
          incrementUsage(usageUserId, "videos", requestedCount).catch(console.error);
        }

        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

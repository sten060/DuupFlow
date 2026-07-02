// SSE-based image duplication — mirrors duplicate-video/route.ts pattern.
// Processes each image/copy server-side and emits fileReady events so the
// client can show files as they finish and the stop button works correctly.
import os from "os";
import path from "path";
import fs from "fs/promises";
import { getServerT } from "@/lib/i18n/server";
import { getOutDirForCurrentUser, cleanupOldFiles } from "@/app/dashboard/utils";
import { checkUsage, incrementUsage } from "@/lib/usage";
import { runImageOp } from "@/lib/imageProcessingLimiter";
import { imageJobRegistry } from "./jobRegistry";
import { processImage, randHex, type Flags } from "@/lib/image-pipeline";

export const maxDuration = 300;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no",
};

/* ============== helpers ============== */
const toBool = (v: FormDataEntryValue | null) =>
  v !== null && String(v) !== "false" && String(v) !== "0";



/* ============== SSE handler ============== */
export async function POST(req: Request) {
  const t = await getServerT();

  void cleanupOldFiles(1 * 60 * 60 * 1000);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: t("errors.image.invalidForm") }, { status: 400 });
  }

  const jobId = (form.get("jobId") as string | null) || null;
  const encoder = new TextEncoder();

  // ── Reconnect path ──────────────────────────────────────────────────────────
  // Client re-POSTed with the same jobId after a reload / leaving the page. The
  // original processing keeps running server-side; replay buffered events + live.
  if (jobId && imageJobRegistry.has(jobId)) {
    const job = imageJobRegistry.get(jobId)!;
    return new Response(
      new ReadableStream({
        async start(controller) {
          let i = 0;
          const fwd = (d: object) => { try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(d)}\n\n`)); } catch {} };
          while (true) {
            while (i < job.events.length) fwd(job.events[i++]);
            if (job.done) break;
            await new Promise((r) => setTimeout(r, 50));
          }
          while (i < job.events.length) fwd(job.events[i++]);
          try { controller.close(); } catch {}
        },
      }),
      { headers: SSE_HEADERS },
    );
  }

  // Reattach miss — finished + aged out, or the process restarted. Tell the client
  // it's stale so it shows the library instead of starting a new (file-less) job.
  if (form.get("reconnectOnly") === "1") {
    return new Response(
      encoder.encode(`data: ${JSON.stringify({ done: true, stale: true })}\n\n`),
      { headers: SSE_HEADERS },
    );
  }

  const directUploadIds = form.getAll("directUploadIds") as string[];
  const fileNames       = form.getAll("fileNames")       as string[];
  const count           = Math.max(1, Number(form.get("count") ?? 1));
  const flags: Flags    = {
    fundamentals: toBool(form.get("fundamentals")),
    visuals:      toBool(form.get("visuals")),
    semi:         toBool(form.get("semivisuals")) || toBool(form.get("semi")),
    reverse:      toBool(form.get("reverse")),
  };
  const userCountry  = (form.get("country") as string) || "";
  const useIphoneMeta = toBool(form.get("iphoneMeta"));

  if (directUploadIds.length === 0) {
    return Response.json({ error: t("errors.image.noImage") }, { status: 400 });
  }

  // Usage check — must be called before ReadableStream constructor so cookies are accessible
  const totalImages = directUploadIds.length * count;
  const usageCheck = await checkUsage("images", totalImages);
  if (!usageCheck.allowed) {
    return Response.json(
      {
        error: usageCheck.message ?? t("errors.image.limitReached"),
        code: "IMG-LIMIT",
        limitReached: true,
        plan: usageCheck.plan,
        current: usageCheck.current,
        limit: usageCheck.limit,
      },
      { status: 429 }
    );
  }

  // Resolve user dir before creating ReadableStream (cookies still readable here)
  let dir: string;
  let userId: string;
  try {
    ({ dir, userId } = await getOutDirForCurrentUser());
  } catch (e: any) {
    return Response.json({ error: e?.message || t("errors.image.authError") }, { status: 500 });
  }

  const VALID_PREFIX = path.join(os.tmpdir(), "duup_direct_");

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  let processedOk = 0;
  const jobEntry: { events: object[]; done: boolean } = { events: [], done: false };
  if (jobId) imageJobRegistry.set(jobId, jobEntry);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        jobEntry.events.push(data);
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
      };

      const keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch {}
      }, 20_000);

      try {
        const totalTasks = directUploadIds.length * count;
        let done = 0;

        for (let i = 0; i < directUploadIds.length; i++) {
          const uploadId = directUploadIds[i];

          // Security: validate ID format to prevent path traversal
          if (!/^duup_direct_[\w.-]+$/.test(uploadId)) {
            send({ error: true, msg: t("errors.image.invalidId", { id: uploadId }) });
            continue;
          }
          const tmpPath = path.join(os.tmpdir(), uploadId);
          if (!tmpPath.startsWith(VALID_PREFIX)) {
            send({ error: true, msg: t("errors.image.invalidPath") });
            continue;
          }

          const fileName = fileNames[i] ?? uploadId;
          const ext = path.extname(fileName).toLowerCase() || ".jpg";

          let buf: Buffer;
          try {
            buf = await fs.readFile(tmpPath);
          } catch {
            send({ error: true, msg: t("errors.image.readFailed", { name: fileName }) });
            continue;
          }

          for (let c = 0; c < count; c++) {
            try {
              const rand = randHex(4);
              // runImageOp caps how many sharp pipelines run at once across ALL
              // requests → prevents a burst of image jobs from OOM-ing the box.
              const { data, outExt } = await runImageOp(() =>
                processImage(buf, ext, flags, { country: userCountry || undefined, iphoneMeta: useIphoneMeta })
              );
              const outName = `DuupFlow_${stamp}_img${i + 1}_c${c + 1}_${Date.now()}${rand}${outExt}`;
              const outPath = path.join(dir, outName);

              await fs.mkdir(dir, { recursive: true }).catch(() => {});
              await fs.writeFile(outPath, data);

              done++;
              processedOk++;
              const pct = Math.round((done / totalTasks) * 100);
              const url = `/api/out/${userId}/${outName}`;

              send({
                percent: pct,
                msg: `${done}/${totalTasks} image(s) traitée(s)…`,
                fileReady: { name: outName, url },
              });
            } catch (e: any) {
              // Per-copy isolation: one bad image/copy must not abort the whole
              // batch (and the copies that DID succeed are still billed below).
              console.error(`[duplicate-image] copy failed (${fileName}):`, e?.message);
              send({ error: true, msg: t("errors.image.copyFailed", { name: fileName }) });
            }
          }

          // Clean up temp input file after all copies of this image are done
          await fs.unlink(tmpPath).catch(() => {});
        }

        const _lim = usageCheck.limit;
        const _newCount = (usageCheck.current ?? 0) + processedOk;
        const usageWarning =
          (usageCheck.plan === "free" || usageCheck.plan === "solo") &&
          Number.isFinite(_lim) && _lim > 0 && _newCount >= _lim * 0.8 && _newCount < _lim
            ? { current: _newCount, limit: _lim, plan: usageCheck.plan }
            : undefined;
        send({ percent: 100, msg: "Terminé ✔", done: true, processedOk, usageWarning });
      } catch (e: any) {
        console.error("[duplicate-image] error:", e?.message);
        send({ error: true, msg: t("errors.image.processingFailed"), code: "IMG-002" });
      } finally {
        clearInterval(keepalive);
        // Mark done so an active reconnect flushes remaining buffered events, then
        // keep the entry ~2 min for late reconnects before dropping it.
        jobEntry.done = true;
        if (jobId) setTimeout(() => imageJobRegistry.delete(jobId), 120_000);
        // Bill for whatever actually succeeded, even if the batch threw partway —
        // otherwise already-produced copies would be free (quota bypass).
        if (processedOk > 0 && usageCheck.userId) {
          incrementUsage(usageCheck.userId, "images", processedOk).catch(console.error);
        }
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// GET /api/studio/zip/[jobId] — télécharge toutes les variantes d'un job
// en une archive .zip (streamée, compression "store" : la vidéo ne se
// compresse pas, inutile de brûler du CPU).

import path from "path";
import { PassThrough, Readable } from "stream";
import archiver from "archiver";
import { getJobSnapshot } from "@/lib/studio/jobs";
import { OUTPUTS_DIR, isSafeStoredName } from "@/lib/studio/local-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { jobId: string } }
) {
  const job = getJobSnapshot(params.jobId);
  if (!job) return new Response("Job introuvable", { status: 404 });
  if (job.reels.length === 0) {
    return new Response("Aucun reel généré pour ce job", { status: 404 });
  }

  const zip = archiver("zip", { store: true });
  const pass = new PassThrough();
  zip.pipe(pass);

  for (const reel of job.reels) {
    if (!isSafeStoredName(reel.id)) continue;
    // name: nom lisible dans l'archive (variante_N.mp4)
    zip.file(path.join(OUTPUTS_DIR, reel.id), { name: reel.fileName });
  }
  void zip.finalize();

  return new Response(Readable.toWeb(pass) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="duupflow-reels-${params.jobId.slice(4, 14)}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}

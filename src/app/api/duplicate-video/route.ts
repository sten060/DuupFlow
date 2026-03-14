import path from "path";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import { processVideos } from "@/app/dashboard/videos/processVideos";
import { getOutDirForCurrentUser } from "@/app/dashboard/utils";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // Resolve user context while request cookies are still available
    const { dir, userId } = await getOutDirForCurrentUser();
    const jobId = Math.random().toString(36).slice(2, 8);
    const progressPath = path.join(dir, `__progress_${jobId}.json`);

    async function writeProgress(pct: number, msg: string) {
      await fs.writeFile(
        progressPath,
        JSON.stringify({ percent: pct, msg, at: Date.now() })
      ).catch(() => {});
    }

    // Write initial progress immediately so frontend can start polling
    await writeProgress(0, "Démarrage…");

    // Fire-and-forget: process videos in background, response returns immediately
    void (async () => {
      try {
        await processVideos(formData, writeProgress, dir);
        await writeProgress(100, "Terminé ✔");
        setTimeout(() => fs.unlink(progressPath).catch(() => {}), 1500);
      } catch (e: any) {
        console.error("duplicate-video processing error:", e);
        await writeProgress(-1, e?.message || "Erreur FFmpeg");
        setTimeout(() => fs.unlink(progressPath).catch(() => {}), 8000);
      }
    })();

    return NextResponse.json({ ok: true, jobId, userId });
  } catch (e: any) {
    console.error("duplicate-video route error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Erreur" }, { status: 500 });
  }
}

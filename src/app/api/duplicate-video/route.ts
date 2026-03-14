import { NextResponse } from "next/server";
import { processVideos } from "@/app/dashboard/videos/processVideos";
import { getOutDirForCurrentUser } from "@/app/dashboard/utils";

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur lecture formulaire" }, { status: 400 });
  }

  // Resolve user context while request cookies are still available
  let dir: string;
  let userId: string;
  try {
    ({ dir, userId } = await getOutDirForCurrentUser());
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur authentification" }, { status: 500 });
  }

  // Stream progress updates via Server-Sent Events so the frontend
  // knows what's happening without relying on fire-and-forget background tasks.
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      try {
        await processVideos(
          formData,
          async (pct, msg) => { send({ percent: pct, msg }); },
          dir
        );
        send({ percent: 100, msg: "Terminé ✔", done: true, userId });
      } catch (e: any) {
        send({ percent: -1, msg: e?.message || "Erreur FFmpeg", error: true });
      } finally {
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

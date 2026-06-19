import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requestStop } from "../jobRegistry";

export const runtime = "nodejs";

// Explicit "Stop" from the client. The encode runs in-process and survives a
// client disconnect by design, so cancelling needs this dedicated signal: we
// look the job up in the shared registry and fire its abort, which SIGKILLs the
// running ffmpeg and halts the remaining copies server-side.
export async function POST(req: Request) {
  // Require a session — prevents anonymous callers from cancelling jobs.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) {
    return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 });
  }

  let jobId = "";
  try {
    const body = await req.json().catch(() => null);
    jobId = (body?.jobId as string) || "";
  } catch {}

  if (!jobId) {
    return NextResponse.json({ ok: false, error: "jobId manquant" }, { status: 400 });
  }

  const stopped = requestStop(jobId);
  return NextResponse.json({ ok: stopped });
}

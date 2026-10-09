import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { requireWorkspaceAccess, canManageWorkspaces } from "@/lib/workspaces";
import { listBriefVideos, addBriefVideo, BRIEF_VIDEOS_MAX, BRIEF_VIDEO_MAX_BYTES } from "@/lib/brief-videos";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Vidéos du brief d'un créateur (tout membre qui y a accès, VA compris). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const t = await getServerT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });
  if (!(await requireWorkspaceAccess(user.id, params.id))) return NextResponse.json({ error: t("errors.workspaces.notFound") }, { status: 404 });
  return NextResponse.json({ videos: await listBriefVideos(params.id), max: BRIEF_VIDEOS_MAX });
}

/** Ajoute UNE vidéo (multipart, champ « file ») — propriétaire ou manager.
 *  Répond tout de suite ; l'analyse continue en tâche de fond. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const t = await getServerT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });
  const access = await requireWorkspaceAccess(user.id, params.id);
  if (!access) return NextResponse.json({ error: t("errors.workspaces.notFound") }, { status: 404 });
  if (!canManageWorkspaces(access.ctx.role)) return NextResponse.json({ error: t("errors.workspaces.forbidden") }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: t("errors.workspaces.saveFailed") }, { status: 400 });
  if (file.size > BRIEF_VIDEO_MAX_BYTES) return NextResponse.json({ error: t("errors.workspaces.videoTooBig", { name: file.name }) }, { status: 413 });
  if ((await listBriefVideos(params.id)).length >= BRIEF_VIDEOS_MAX) {
    return NextResponse.json({ error: t("errors.workspaces.videosFull", { max: String(BRIEF_VIDEOS_MAX) }) }, { status: 400 });
  }

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_bvid_"));
  const ext = file.name.match(/\.[a-z0-9]+$/i)?.[0] || ".mp4";
  const tmp = path.join(dir, `video${ext}`);
  try {
    await fs.writeFile(tmp, Buffer.from(await file.arrayBuffer()));
  } catch {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    return NextResponse.json({ error: t("errors.workspaces.saveFailed") }, { status: 500 });
  }
  const r = await addBriefVideo(params.id, dir, tmp, file.name); // supprime `dir` lui-même
  if (!r.ok) return NextResponse.json({ error: r.error, videos: await listBriefVideos(params.id) }, { status: 400 });
  return NextResponse.json({ video: r.video, videos: await listBriefVideos(params.id) });
}

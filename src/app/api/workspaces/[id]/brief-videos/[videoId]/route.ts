import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { requireWorkspaceAccess, canManageWorkspaces } from "@/lib/workspaces";
import { readBriefVideoThumb, removeBriefVideo, listBriefVideos } from "@/lib/brief-videos";

export const dynamic = "force-dynamic";

/** Vignette d'une vidéo du brief — tout membre qui a accès au créateur. */
export async function GET(_req: NextRequest, { params }: { params: { id: string; videoId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  if (!(await requireWorkspaceAccess(user.id, params.id))) return new NextResponse(null, { status: 404 });
  const buf = await readBriefVideoThumb(params.id, params.videoId);
  if (!buf) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400, immutable" },
  });
}

/** Retire une vidéo du brief (et son analyse) — propriétaire ou manager. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; videoId: string } }) {
  const t = await getServerT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });
  const access = await requireWorkspaceAccess(user.id, params.id);
  if (!access) return NextResponse.json({ error: t("errors.workspaces.notFound") }, { status: 404 });
  if (!canManageWorkspaces(access.ctx.role)) return NextResponse.json({ error: t("errors.workspaces.forbidden") }, { status: 403 });
  const ok = await removeBriefVideo(params.id, params.videoId);
  if (!ok) return NextResponse.json({ error: t("errors.workspaces.notFound") }, { status: 404 });
  return NextResponse.json({ ok: true, videos: await listBriefVideos(params.id) });
}

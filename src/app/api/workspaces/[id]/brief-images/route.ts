import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { requireWorkspaceAccess, canManageWorkspaces } from "@/lib/workspaces";
import { listBriefImages, addBriefImage, BRIEF_IMAGES_MAX, BRIEF_IMAGE_MAX_BYTES } from "@/lib/brief-images";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Images du brief d'un créateur (tout membre qui y a accès, VA compris). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const t = await getServerT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });
  const access = await requireWorkspaceAccess(user.id, params.id);
  if (!access) return NextResponse.json({ error: t("errors.workspaces.notFound") }, { status: 404 });
  return NextResponse.json({ images: await listBriefImages(params.id), max: BRIEF_IMAGES_MAX });
}

/** Ajoute une ou plusieurs images (multipart, champ « files ») — propriétaire ou manager. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const t = await getServerT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("errors.auth.notAuthenticated") }, { status: 401 });
  const access = await requireWorkspaceAccess(user.id, params.id);
  if (!access) return NextResponse.json({ error: t("errors.workspaces.notFound") }, { status: 404 });
  if (!canManageWorkspaces(access.ctx.role)) return NextResponse.json({ error: t("errors.workspaces.forbidden") }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return NextResponse.json({ error: t("errors.workspaces.saveFailed") }, { status: 400 });

  const added = [];
  const errors: string[] = [];
  for (const f of files) {
    if (f.size > BRIEF_IMAGE_MAX_BYTES) { errors.push(t("errors.workspaces.imageTooBig", { name: f.name })); continue; }
    const r = await addBriefImage(params.id, Buffer.from(await f.arrayBuffer()), f.name);
    if (r.ok) added.push(r.image);
    else { errors.push(r.error); if (/Maximum/.test(r.error)) break; }
  }
  return NextResponse.json(
    { images: await listBriefImages(params.id), added, errors },
    { status: added.length ? 200 : 400 },
  );
}

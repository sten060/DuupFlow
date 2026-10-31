// DELETE /api/ai-editor/reference { projectId } → retire la vidéo de référence du
// projet (fichier + analyse). La matière et les variantes restent.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { removeReference } from "@/lib/ai-editor/store";
import { editorScopeForUser } from "@/lib/ai-editor/scope";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const { storeKey: sk } = await editorScopeForUser(user.id, req);

  const body = (await req.json().catch(() => null)) as { projectId?: unknown } | null;
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  if (!/^[\w-]{1,80}$/.test(projectId)) return NextResponse.json({ error: "projectId invalide." }, { status: 400 });

  const ok = await removeReference(sk, projectId);
  return NextResponse.json({ ok });
}

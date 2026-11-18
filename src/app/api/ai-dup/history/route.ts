// GET    /api/ai-dup/history       — les dernières duplications IA du créateur
//                                    actif (sous « Dupliquer », chacune avec « Voir »).
// DELETE /api/ai-dup/history?id=…  — supprime une duplication (copies + entrée).
// Les duplications de plus de 5 jours sont supprimées d'office (history.ts).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { editorScopeForUser } from "@/lib/ai-editor/scope";
import { listHistory, deleteHistory } from "@/lib/ai-dup/history";
import { getAiDupJob, forgetAiDupJob } from "@/lib/ai-dup/jobs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const { storeKey } = await editorScopeForUser(user.id, req);
  const items = (await listHistory(storeKey)).map((it) => {
    // Un lancement en cours vit en mémoire : c'est lui qui fait foi.
    const live = getAiDupJob(it.id, storeKey);
    return live && !live.finishedAt
      ? { ...it, running: true, done: live.copies.filter((c) => c.status === "done").length }
      : it;
  });
  return NextResponse.json({ items });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const { storeKey } = await editorScopeForUser(user.id, req);
  if (!forgetAiDupJob(id, storeKey)) return NextResponse.json({ error: "Cette duplication est encore en cours : attends qu'elle se termine pour la supprimer." }, { status: 409 });
  if (!(await deleteHistory(id, storeKey))) return NextResponse.json({ error: "Duplication introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

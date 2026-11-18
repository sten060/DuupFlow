// GET /api/ai-dup/job?id=aid_… — état d'un lancement (progression + copies).
// Le client l'interroge toutes les ~2 s tant que le ticket n'est pas terminé.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { editorScopeForUser } from "@/lib/ai-editor/scope";
import { findAiDupJob } from "@/lib/ai-dup/jobs";
import { publicJob } from "@/lib/ai-dup/public-job";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id") ?? "";
  const { storeKey } = await editorScopeForUser(user.id, req);
  const job = await findAiDupJob(id, storeKey);
  // Ticket perdu = serveur redémarré : les copies finies restent dans la bibliothèque.
  if (!job) return NextResponse.json({ error: "Lancement introuvable (le serveur a peut-être redémarré). Les copies déjà terminées sont dans ta bibliothèque Duplication.", code: "gone" }, { status: 404 });
  return NextResponse.json({ job: publicJob(job) });
}

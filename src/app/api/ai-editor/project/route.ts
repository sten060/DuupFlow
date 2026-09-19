// GET  /api/ai-editor/project        → dernier projet du user (restauration)
// GET  /api/ai-editor/project?id=xxx → un projet précis
// POST /api/ai-editor/project        → crée un projet VIDE (étape référence passée :
//   la réf est optionnelle, mais l'upload de matière a besoin d'un projet).
// (Sert aussi de source au serveur MCP.)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createProject, getLatestProject, getProject } from "@/lib/ai-editor/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  const project = id ? await getProject(user.id, id) : await getLatestProject(user.id);
  return NextResponse.json({ project: project ?? null });
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  // RÉUTILISE un projet encore vierge plutôt que d'en créer un nouveau : chaque
  // rechargement de page repasserait ici, et on a déjà vu un compte accumuler
  // des dizaines de projets fantômes.
  const latest = await getLatestProject(user.id);
  if (latest && !latest.reference && !latest.materials.length && !latest.variants.length) {
    return NextResponse.json({ project: latest });
  }
  const project = await createProject(user.id);
  return NextResponse.json({ project });
}

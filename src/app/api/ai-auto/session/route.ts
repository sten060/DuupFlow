// POST /api/ai-auto/session
// Ouvre une session « IA automatique » : un projet Éditeur IA vierge qui
// servira de conteneur (matière uploadée + duplications rendues). On réutilise
// le store de l'Éditeur IA tel quel — mêmes fichiers, même moteur, même GC.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createProject } from "@/lib/ai-editor/store";
import { editorScopeForUser } from "@/lib/ai-editor/scope";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { storeKey } = await editorScopeForUser(user.id, req);
  const project = await createProject(storeKey);
  return NextResponse.json({ projectId: project.id });
}

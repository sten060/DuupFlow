// GET /api/ai-editor/project        → dernier projet du user (restauration)
// GET /api/ai-editor/project?id=xxx → un projet précis
// (Servira aussi de source au futur serveur MCP.)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLatestProject, getProject } from "@/lib/ai-editor/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  const project = id ? await getProject(user.id, id) : await getLatestProject(user.id);
  return NextResponse.json({ project: project ?? null });
}

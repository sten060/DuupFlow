// POST /api/ai-editor/chat/stop — bouton « Arrêter » du Claude intégré.
//
// Coupe le tour en cours sur la conversation du projet : l'appel à Claude est
// interrompu en plein milieu, les outils suivants ne partent pas et les rendus
// de variantes lancés pendant ce tour sont annulés (quota rendu). La route du
// chat (/api/ai-editor/chat) termine proprement le tour et prévient l'écran.

import { NextRequest, NextResponse } from "next/server";
import { getLatestProject } from "@/lib/ai-editor/store";
import { chatContext as context } from "@/lib/ai-editor/chat-context";
import { stopRun } from "@/lib/ai-editor/builtin-chat";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const c = await context(req);
  if ("error" in c) return c.error;
  const project = await getLatestProject(c.scope.storeKey);
  const stopped = project ? stopRun(c.scope.storeKey, project.id) : false;
  return NextResponse.json({ ok: true, stopped });
}

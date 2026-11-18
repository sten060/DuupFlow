// POST /api/ai-dup/drive { jobId, indexes? } — envoie les copies terminées
//   d'un lancement dans le dossier Drive d'export (créateur actif inclus).
// GET  /api/ai-dup/drive?id=dx_… — suivi de l'envoi.
// Réutilise l'export Drive de l'Éditeur IA (envoi par blocs avec reprise).

import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { editorScopeForUser } from "@/lib/ai-editor/scope";
import { startDriveExport, getDriveExport } from "@/lib/ai-editor/drive-export";
import { creatorOutDir } from "@/lib/creator-out-dir";
import { findAiDupJob } from "@/lib/ai-dup/jobs";

export const dynamic = "force-dynamic";

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  return user;
}

export async function POST(req: NextRequest) {
  const user = await auth();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { jobId?: string; indexes?: number[] } | null;
  const scope = await editorScopeForUser(user.id, req);
  const job = await findAiDupJob(String(body?.jobId ?? ""), scope.storeKey);
  if (!job) return NextResponse.json({ error: "Lancement introuvable." }, { status: 404 });

  const wanted = Array.isArray(body?.indexes) ? new Set(body!.indexes) : null;
  const dir = creatorOutDir(scope.storeKey);
  const files = job.copies
    .filter((c) => c.status === "done" && c.fileName && !c.expired && (!wanted || wanted.has(c.index)))
    .map((c) => ({ id: `${job.id}#${c.index + 1}`, name: c.fileName!, path: path.join(dir, path.basename(c.fileName!)) }));
  if (!files.length) return NextResponse.json({ error: "Aucune copie terminée à envoyer." }, { status: 400 });

  const r = await startDriveExport({
    storeKey: scope.storeKey, ownerId: scope.ctx.ownerId, userId: user.id, projectId: job.projectId,
    variantIds: [], creator: scope.workspace?.name ?? null,
    workspace: scope.workspace ? { id: scope.workspace.id, name: scope.workspace.name } : null,
    files,
  });
  if (!("folderId" in r)) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ exportId: r.id, folderName: r.folderName });
}

export async function GET(req: NextRequest) {
  const user = await auth();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const { storeKey } = await editorScopeForUser(user.id, req);
  const x = getDriveExport(req.nextUrl.searchParams.get("id") ?? "");
  if (!x || x.storeKey !== storeKey) return NextResponse.json({ error: "Envoi introuvable." }, { status: 404 });
  return NextResponse.json({
    status: x.status, folderName: x.folderName, error: x.error ?? null,
    done: x.files.filter((f) => f.status === "done").length, total: x.files.length,
    folderUrl: `https://drive.google.com/drive/folders/${x.folderId}`,
  });
}

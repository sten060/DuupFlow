// POST /api/ai-dup/start — lance une « Duplication IA en 1 clic ».
// Corps : { projectId, materialId, mode: "invisible" | "variations", copies, indications?, replaceCaption? }
// La vidéo a déjà été déposée dans le projet conteneur (/api/ai-auto/session
// puis /api/ai-editor/material). Renvoie le ticket à suivre (/api/ai-dup/job).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { editorScopeForUser, briefBlock } from "@/lib/ai-editor/scope";
import { startAiDupJob } from "@/lib/ai-dup/jobs";
import { publicJob } from "@/lib/ai-dup/public-job";
import { effectivePlanForUser } from "@/lib/usage";
import { payerFor } from "@/lib/ai-editor/chat-context";

export const dynamic = "force-dynamic";

const STATUS = { bad_request: 400, not_found: 404, not_ready: 409, plan_required: 402, quota: 429, tokens: 402 } as const;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const scope = await editorScopeForUser(user.id, req);
  // Tokens Claude payés par le propriétaire du compte (même règle que le Claude intégré).
  const [plan, payerId] = await Promise.all([effectivePlanForUser(user.id), payerFor(user.id, scope.ctx.ownerId)]);
  const r = await startAiDupJob({
    payerId,
    plan,
    userId: user.id,
    storeKey: scope.storeKey,
    projectId: String(body.projectId ?? ""),
    materialId: String(body.materialId ?? ""),
    mode: body.mode as "invisible" | "variations",
    copies: Number(body.copies),
    indications: typeof body.indications === "string" ? body.indications : "",
    replaceCaption: body.replaceCaption === true,
    brief: briefBlock(scope),
  });
  if ("error" in r) return NextResponse.json({ error: r.error, code: r.code }, { status: STATUS[r.code] });
  return NextResponse.json({ job: publicJob(r.job) });
}

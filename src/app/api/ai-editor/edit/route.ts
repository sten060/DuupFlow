// ── EXPORT DE L'ÉDITEUR MANUEL ───────────────────────────────────────────────
// POST /api/ai-editor/edit  (JSON { projectId, variantId, plan, label? })
//   → lance le rendu du plan RETOUCHÉ en tâche de fond (ticket), renvoie { jobId }.
// GET  /api/ai-editor/edit?jobId=…
//   → état du ticket ({ status, queued, variantId?, error? }).
//
// QUOTA : décision produit (Sten, 17/09/2026) — la retouche manuelle d'une
// variante est OFFERTE. La variante d'origine a déjà consommé 1 « vidéo » à sa
// création (create_variant / generate) ; corriger une faute de frappe ne doit
// pas se repayer. On ne passe donc VOLONTAIREMENT PAS par reserveUsage ici —
// ce n'est pas un oubli. Garde-fou observabilité : chaque export est tracé
// (usage_events kind "ai_editor_render") ; si un profil abuse un jour
// (dizaines d'exports par variante), on posera un plafond à ce moment-là.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/ai-editor/store";
import { startRenderJob, getRenderJob, cancelRenderJob } from "@/lib/ai-editor/render-jobs";
import { logAiEditorRender } from "@/lib/usage";
import type { EditPlan } from "@/lib/ai-editor/plan-types";

export const dynamic = "force-dynamic";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  return user;
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = await req.json().catch(() => null) as { projectId?: string; variantId?: string; plan?: EditPlan; label?: string } | null;
  const projectId = String(body?.projectId || "");
  const variantId = String(body?.variantId || "");
  const plan = body?.plan;
  if (!projectId || !variantId || !plan || typeof plan !== "object") {
    return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  }
  if (!Array.isArray(plan.segments) || plan.segments.length === 0) {
    return NextResponse.json({ error: "Le montage doit contenir au moins un plan." }, { status: 422 });
  }

  const project = await getProject(user.id, projectId);
  const variant = project?.variants.find((v) => v.id === variantId);
  if (!project || !variant) return NextResponse.json({ error: "Variante introuvable." }, { status: 404 });

  // Toutes les matières citées doivent appartenir AU projet (une matière d'un
  // autre projet/user ne doit jamais entrer dans un rendu).
  const known = new Set(project.materials.map((m) => m.id));
  const cited = [
    ...plan.segments.map((s) => s?.materialId),
    ...plan.segments.flatMap((s) => (s?.overlays ?? []).map((o) => o?.materialId)),
    plan.audio?.materialId,
  ].filter((id): id is string => typeof id === "string" && id.length > 0);
  const orphan = cited.find((id) => !known.has(id));
  if (orphan) return NextResponse.json({ error: `Matière inconnue dans le montage (${orphan}).` }, { status: 422 });

  const label = (typeof body?.label === "string" && body.label.trim())
    ? body.label.trim().slice(0, 80)
    : `${variant.label || "Variante"} · retouche`;

  const job = startRenderJob(user.id, projectId, { ...plan, label }, {
    derivedFrom: variantId,
    onDone: () => logAiEditorRender(user.id), // trace (gratuit — voir en-tête)
  });
  console.log(`[ai-editor/edit] export retouche lancé · user=${user.id} · variante=${variantId} · job=${job.id}`);
  return NextResponse.json({ jobId: job.id });
}

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const jobId = req.nextUrl.searchParams.get("jobId") || "";
  const job = getRenderJob(jobId);
  if (!job || job.userId !== user.id) return NextResponse.json({ error: "Ticket introuvable." }, { status: 404 });

  return NextResponse.json({
    status: job.status,                              // running | done | failed
    queued: job.status === "running" && job.renderStartedAt == null, // attend son tour
    variantId: job.result?.variant.id ?? null,
    error: job.error,
  });
}

// DELETE /api/ai-editor/edit?jobId=… → annule le rendu en cours (tue le ffmpeg,
// libère le créneau). L'export étant gratuit, il n'y a rien à rembourser.
export async function DELETE(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const jobId = req.nextUrl.searchParams.get("jobId") || "";
  const job = getRenderJob(jobId);
  if (!job || job.userId !== user.id) return NextResponse.json({ error: "Ticket introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true, result: cancelRenderJob(job) });
}

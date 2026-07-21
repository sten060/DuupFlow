// POST /api/studio/chat-edit — retouche le plan d'un reel en langage naturel.
// Body : { plan: ReelPlan, message: string } → { plan: Partial<ReelPlan>, reply }
// L'IA interprète la demande et renvoie les champs à changer (textes + style).

import { chatEditPlan } from "@/lib/studio/llm";
import type { ReelPlan } from "@/lib/studio/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(req: Request) {
  let body: { plan?: ReelPlan; message?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }
  const plan = body.plan;
  const message = (body.message ?? "").trim();
  if (!plan || !message) {
    return Response.json({ error: "plan + message requis" }, { status: 400 });
  }

  const layout = plan.layout;
  const src = plan.sourceDurationSec ?? plan.durationSec;
  const result = await chatEditPlan(
    {
      hook: plan.hook,
      reveals: plan.reveals ?? [],
      hookFontFrac: layout?.hookFontFrac ?? layout?.fontFrac ?? 0.05,
      fontFrac: layout?.fontFrac ?? 0.033,
      hookYFrac: layout?.hookYFrac ?? 0.32,
      stackYFrac: layout?.stackYFrac ?? 0.46,
      uppercase: plan.uppercase ?? false,
      durationSec: plan.durationSec,
      sourceDurationSec: src,
      revealAtSec: plan.revealAtSec ?? [],
    },
    message
  );
  if (!result) {
    return Response.json(
      { error: "IA indisponible (clé API manquante ou crédits Anthropic épuisés)" },
      { status: 503 }
    );
  }

  // Construit le plan partiel à renvoyer (le client fusionne).
  const e = result.edits;
  const patch: Partial<ReelPlan> = {};
  if (typeof e.hook === "string") patch.hook = e.hook;
  if (Array.isArray(e.reveals)) patch.reveals = e.reveals.filter((x): x is string => typeof x === "string");
  if (typeof e.uppercase === "boolean") patch.uppercase = e.uppercase;
  if (typeof e.durationSec === "number" && Number.isFinite(e.durationSec)) {
    patch.durationSec = Math.max(0.5, Math.min(e.durationSec, src));
  }
  if (Array.isArray(e.revealAtSec)) {
    patch.revealAtSec = e.revealAtSec
      .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
      .map((t) => Math.max(0.1, Math.min(t, (patch.durationSec ?? plan.durationSec) - 0.2)));
  }

  const layoutPatch: Record<string, number> = {};
  for (const k of ["hookFontFrac", "fontFrac", "hookYFrac", "stackYFrac"] as const) {
    if (typeof e[k] === "number") layoutPatch[k] = e[k] as number;
  }
  if (Object.keys(layoutPatch).length > 0) {
    patch.layout = { ...(layout ?? ({} as ReelPlan["layout"])), ...layoutPatch } as ReelPlan["layout"];
  }

  return Response.json({ plan: patch, reply: result.reply });
}

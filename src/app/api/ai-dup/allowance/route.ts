// GET /api/ai-dup/allowance — tokens IA disponibles pour la Duplication IA :
// volume offert restant ce mois-ci (partagé avec le Claude intégré de
// l'Éditeur IA) + solde de tokens du propriétaire du compte.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { editorScopeForUser } from "@/lib/ai-editor/scope";
import { effectivePlanForUser } from "@/lib/usage";
import { payerFor } from "@/lib/ai-editor/chat-context";
import { allowanceFor } from "@/lib/ai-dup/billing";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const scope = await editorScopeForUser(user.id, req);
  const [plan, payerId] = await Promise.all([effectivePlanForUser(user.id), payerFor(user.id, scope.ctx.ownerId)]);
  const a = await allowanceFor(payerId, plan).catch(() => null);
  if (!a) return NextResponse.json({ error: "Solde indisponible." }, { status: 503 });
  return NextResponse.json({ allowance: a });
}

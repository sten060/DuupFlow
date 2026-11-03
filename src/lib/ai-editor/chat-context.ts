// Contexte commun des routes du Claude intégré (/api/ai-editor/chat/*) :
// user connecté, Éditeur IA ouvert, plan payant, créateur affiché, et le
// propriétaire du compte (c'est lui qui paie).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { editorScopeForUser } from "@/lib/ai-editor/scope";
import { aiEditorOpenFor } from "@/lib/ai-editor/access";
import { effectivePlanForUser } from "@/lib/usage";
import { isFreePlan } from "@/lib/free-plan";
import { createAdminClient } from "@/lib/supabase/admin";

/** Qui paie : l'hôte pour un invité (VA, manager), sinon le user lui-même.
 *  Lu directement dans profiles : ne dépend pas du contexte des espaces, qui
 *  retombe sur « soi-même » en cas d'erreur (un invité aurait alors son propre
 *  volume inclus). */
async function payerFor(userId: string, fromScope: string | null | undefined): Promise<string> {
  if (fromScope && fromScope !== userId) return fromScope;
  const { data } = await createAdminClient().from("profiles").select("is_guest, host_user_id").eq("id", userId).maybeSingle();
  const p = data as { is_guest?: boolean | null; host_user_id?: string | null } | null;
  return p?.is_guest && p.host_user_id ? p.host_user_id : userId;
}

export async function chatContext(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return { error: NextResponse.json({ error: "Non authentifié.", code: "AUTH" }, { status: 401 }) };
  if (!aiEditorOpenFor(user.email)) return { error: NextResponse.json({ error: "L'Éditeur IA n'est pas encore ouvert sur ce compte.", code: "CLOSED" }, { status: 403 }) };
  const plan = await effectivePlanForUser(user.id);
  if (isFreePlan(plan)) return { error: NextResponse.json({ error: "Claude intégré est inclus dans les plans payants. Choisis un plan pour l'utiliser.", code: "PLAN" }, { status: 403 }) };
  const scope = await editorScopeForUser(user.id, req);
  const ownerId = await payerFor(user.id, scope.ctx.ownerId); // c'est le propriétaire du compte qui paie
  return { user, plan, scope, ownerId };
}

"use server";

// Templates de la duplication SIMPLE : même logique que le duplicateur Avancé
// (templates nommés, enregistrés DANS LE COMPTE → retrouvés sur tous les
// appareils). Même table Supabase `user_templates` (pas de migration) : un
// template Simple est rangé sous le nom « simple::<nom> », et l'Avancé ignore
// ces noms (advanced/templateActions.ts).
// Contenu : le formulaire complet (packs, intensités, options, captions,
// sous-titres) — ce que VideoFormSimpleClient.snapshot() renvoie.

import { createClient } from "@/lib/supabase/server";

const SIMPLE_TEMPLATE_PREFIX = "simple::";
export type SimpleTemplate = { name: string; settings: Record<string, unknown> };

const MAX_NAME = 60;

export async function getSimpleTemplates(): Promise<SimpleTemplate[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("user_templates")
    .select("name, ranges")
    .eq("user_id", user.id)
    .like("name", `${SIMPLE_TEMPLATE_PREFIX}%`)
    .order("created_at", { ascending: true });
  return ((data ?? []) as { name: string; ranges: Record<string, unknown> }[])
    .map((r) => ({ name: r.name.slice(SIMPLE_TEMPLATE_PREFIX.length), settings: r.ranges ?? {} }));
}

export async function saveSimpleTemplate(name: string, settings: Record<string, unknown>): Promise<void> {
  const clean = String(name ?? "").trim().slice(0, MAX_NAME);
  if (!clean || !settings || typeof settings !== "object") return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("user_templates")
    .upsert(
      { user_id: user.id, name: `${SIMPLE_TEMPLATE_PREFIX}${clean}`, ranges: settings, updated_at: new Date().toISOString() },
      { onConflict: "user_id,name" },
    );
}

export async function deleteSimpleTemplate(name: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("user_templates")
    .delete()
    .eq("user_id", user.id)
    .eq("name", `${SIMPLE_TEMPLATE_PREFIX}${String(name ?? "")}`);
}

"use server";

import { createClient } from "@/lib/supabase/server";

type RangeState = Record<string, { enabled: boolean; min: number; max: number }>;
export type Template = { name: string; ranges: RangeState };

/** Fetch all templates for the current user. */
export async function getTemplates(): Promise<Template[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("user_templates")
    .select("name, ranges")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (data ?? []) as Template[];
}

/** Save (upsert) a template. */
export async function saveTemplate(name: string, ranges: RangeState): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("user_templates")
    .upsert(
      { user_id: user.id, name, ranges, updated_at: new Date().toISOString() },
      { onConflict: "user_id,name" },
    );
}

/** Delete a template by name. */
export async function deleteTemplate(name: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("user_templates")
    .delete()
    .eq("user_id", user.id)
    .eq("name", name);
}

/**
 * Migrate templates from localStorage (sent by the client) to Supabase.
 * Only inserts templates that don't already exist in Supabase (no overwrites).
 * Called once per user on first load after migration.
 */
export async function migrateTemplatesFromLocal(templates: Template[]): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || templates.length === 0) return;

  // Get existing template names to avoid overwriting
  const { data: existing } = await supabase
    .from("user_templates")
    .select("name")
    .eq("user_id", user.id);

  const existingNames = new Set((existing ?? []).map((t: { name: string }) => t.name));
  const toInsert = templates
    .filter((t) => !existingNames.has(t.name))
    .map((t) => ({ user_id: user.id, name: t.name, ranges: t.ranges }));

  if (toInsert.length > 0) {
    await supabase.from("user_templates").insert(toInsert);
  }
}

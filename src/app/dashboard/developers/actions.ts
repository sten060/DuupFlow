"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveEffectivePlan } from "@/lib/api-auth";
import { createApiKey, revokeApiKey } from "@/lib/api-keys";

// Every action re-verifies the session user AND that they're on Pro — never
// trust the client. Key creation/usage is a Pro-only feature.
async function currentProUserId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié.");
  const plan = await resolveEffectivePlan(user.id);
  if (plan !== "pro") throw new Error("L'API DuupFlow nécessite un plan Pro.");
  return user.id;
}

/** Create a key and return the plaintext ONCE (never retrievable again). */
export async function createKeyAction(name: string): Promise<{ key: string }> {
  const userId = await currentProUserId();
  const { key } = await createApiKey(userId, name);
  revalidatePath("/dashboard/developers");
  return { key };
}

export async function revokeKeyAction(keyId: string): Promise<{ ok: boolean }> {
  const userId = await currentProUserId();
  await revokeApiKey(userId, keyId);
  revalidatePath("/dashboard/developers");
  return { ok: true };
}

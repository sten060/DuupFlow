"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getServerT, type ServerT } from "@/lib/i18n/server";
import { resolveEffectivePlan } from "@/lib/api-auth";
import { createApiKey, deleteApiKey, MAX_KEYS_PER_USER } from "@/lib/api-keys";

// Every action re-verifies the session user AND that they're on Pro — never
// trust the client. Key creation/usage is a Pro-only feature. Error messages
// are localized (FR/EN) so they read correctly in the dashboard.
async function currentProUserId(t: ServerT): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error(t("dashboard.developers.errNotAuth"));
  const plan = await resolveEffectivePlan(user.id);
  if (plan !== "pro") throw new Error(t("dashboard.developers.errProRequired"));
  return user.id;
}

/** Create a key and return the plaintext ONCE (never retrievable again). */
export async function createKeyAction(name: string): Promise<{ key: string }> {
  const t = await getServerT();
  const userId = await currentProUserId(t);
  try {
    const { key } = await createApiKey(userId, name);
    revalidatePath("/dashboard/developers");
    return { key };
  } catch (e: any) {
    if (e?.message === "MAX_KEYS_REACHED") {
      throw new Error(t("dashboard.developers.errMaxKeys", { max: String(MAX_KEYS_PER_USER) }));
    }
    throw e;
  }
}

export async function deleteKeyAction(keyId: string): Promise<{ ok: boolean }> {
  const t = await getServerT();
  const userId = await currentProUserId(t);
  await deleteApiKey(userId, keyId);
  revalidatePath("/dashboard/developers");
  return { ok: true };
}

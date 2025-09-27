"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

type State = { error?: string };

export async function loginAction(
  _prevState: State | undefined,
  formData: FormData
): Promise<State | void> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Email et mot de passe requis." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Cookies écrits côté serveur → la page protégée verra la session
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
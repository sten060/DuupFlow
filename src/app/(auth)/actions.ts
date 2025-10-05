"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return redirect(`/login?err=${encodeURIComponent(error.message)}`);
  }
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const supabase = createClient();

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return redirect(`/register?err=${encodeURIComponent(error.message)}`);
  }
  // selon config, mail de confirmation – on renvoie vers login
  redirect("/login?ok=1");
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/");
}
// src/lib/auth/requireSession.ts
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function requireSession(nextUrl: string = "/dashboard") {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    // renvoie vers /login avec le 'next' pour revenir au dashboard après connexion
    redirect(`/login?next=${encodeURIComponent(nextUrl)}`);
  }

  return session; // utile si tu veux récupérer user.id
}
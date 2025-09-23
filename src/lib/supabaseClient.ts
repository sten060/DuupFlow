// src/lib/supabaseClient.ts
import { cookies } from "next/headers";
import { createBrowserClient } from "@supabase/ssr";
import { createServerClient } from "@supabase/ssr";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Client côté navigateur (forms / boutons) */
export function createClientBrowser() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON);
}

/** Client côté serveur (RSC/Server Actions) avec gestion cookies */
export function createClientServer() {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      get(name: string) {
        return cookies().get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookies().set(name, value, options);
      },
      remove(name: string, options: any) {
        cookies().set(name, "", { ...options, maxAge: 0 });
      },
    },
  });
}

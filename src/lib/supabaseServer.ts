// src/lib/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Client pour les Server Components (RSC) -> lecture seule des cookies.
 * Evite l'erreur "Cookies can only be modified..."
 */
export function createClientServer() {
  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      // no-op en RSC : pas d'écriture !
      set() {},
      remove() {},
    },
  });
}

/**
 * Client pour les Server Actions & Route Handlers -> écriture OK.
 */
export function createClientAction() {
  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options?: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options?: CookieOptions) {
        cookieStore.set({ name, value: "", maxAge: 0, ...options });
      },
    },
  });
}
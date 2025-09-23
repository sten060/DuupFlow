// src/lib/supabaseClient.ts
import { createBrowserClient, createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// --------- Client navigateur (pages React client) ----------
export function createClientBrowser() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return supabase;
}

// --------- Client serveur (Server Components / Actions) ----------
export function createClientServer() {
  const cookieStore = cookies();

  // IMPORTANT : on passe un OBJET { cookies: { get, set, remove } }, pas une fonction
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(
          name: string,
          value: string,
          options?: CookieOptions
        ) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options?: CookieOptions) {
          cookieStore.set(name, "", { ...options, maxAge: 0 });
        },
      },
    }
  );

  return supabase;
}

// Exports pratiques
export const createClient = typeof window === "undefined" ? createClientServer : createClientBrowser;
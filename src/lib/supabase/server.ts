// src/lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ⚠️ NOTE: fonction ASYNC
export async function createClient() {
  const cookieStore = await cookies(); // << OBLIGATOIRE en Next 15

  return createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      // En RSC, l’écriture est interdite → on NO-OP ou on encapsule dans try/catch
      set(name: string, value: string, options?: any) {
        try {
          cookieStore.set(name, value, options);
        } catch {}
      },
      remove(name: string, options?: any) {
        try {
          cookieStore.set(name, "", { ...options, maxAge: 0 });
        } catch {}
      },
    },
  });
}
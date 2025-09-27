import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function createSbRSC() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // en RSC on ne lit QUE les cookies, jamais d'écriture
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}
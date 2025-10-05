import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function createClientRSC() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // 🚫 AUCUNE écriture côté RSC :
        set() {},
        remove() {},
      },
    }
  );
}

export async function getSessionRSC() {
  const sb = createClientRSC();
  const { data: { session } } = await sb.auth.getSession();
  return session ?? null;
}
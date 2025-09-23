// src/lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Client Supabase pour les Server Components (lecture seule).
 * -> pas d'écriture de cookies ici, sinon Next 15 jette une erreur.
 */
export const createClient = async () => {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // IMPORTANT: uniquement getAll (lecture). setAll est un no-op.
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      // ne surtout pas écrire en RSC
      setAll() {
        /* noop: aucune écriture côté RSC */
      },
    },
  });
};
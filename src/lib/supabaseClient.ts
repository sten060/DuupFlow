// src/lib/supabaseClient.ts
import { createBrowserClient, createServerClient } from "@supabase/ssr";

/**
 * Client Supabase pour le NAVIGATEUR (pages "use client")
 * - Utilisé dans /login et /register
 */
export function createClientBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Client Supabase pour le SERVEUR (Server Components/Actions)
 * - Tu l’utiliseras plus tard dans le dashboard si besoin
 * - Signature simple pour éviter les erreurs actuelles
 */
export function createClientServer(cookies: any) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies }
  );
}
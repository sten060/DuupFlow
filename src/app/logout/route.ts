// src/app/logout/route.ts
import { NextResponse } from "next/server";
import { createClientServer } from "@/lib/supabaseServer";

export async function POST() {
  // ⚠️ important : ajouter `await`
  const supabase = await createClientServer();

  await supabase.auth.signOut();

  return NextResponse.redirect(
    new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
  );
}
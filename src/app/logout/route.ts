// src/app/logout/route.ts
import { NextResponse } from "next/server";
import { createClientAction } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const supabase = createClientAction();
  await supabase.auth.signOut();

  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`);
}
// POST /api/auth/otp
// Server-side gate for the magic-link (OTP) sign-in/sign-up flow.
//
// Rejects disposable / throwaway email domains BEFORE any account can be
// created, then sends the magic link via Supabase. Enforced here on the server
// (not just in the client) so it can't be skipped from the form.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDisposableEmail, emailDomain } from "@/lib/email-validation";

export const dynamic = "force-dynamic";

const DISPOSABLE_MESSAGE = "Merci d'utiliser une adresse email permanente.";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const emailRedirectTo =
    typeof body.emailRedirectTo === "string" ? body.emailRedirectTo : undefined;

  // Basic shape check — a valid domain is required to evaluate it.
  if (!email || !emailDomain(email)) {
    return NextResponse.json(
      { error: "Adresse email invalide." },
      { status: 400 },
    );
  }

  // Disposable-domain gate.
  if (isDisposableEmail(email)) {
    return NextResponse.json({ error: DISPOSABLE_MESSAGE }, { status: 422 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

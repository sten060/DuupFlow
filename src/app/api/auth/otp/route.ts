// POST /api/auth/otp
// Server-side gate for the magic-link (OTP) sign-in/sign-up flow.
//
// Rejects disposable / throwaway email domains BEFORE any account can be
// created, then sends the magic link via Supabase. Enforced here on the server
// (not just in the client) so it can't be skipped from the form.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDisposableEmail, isAllowedEmailDomain, emailDomain } from "@/lib/email-validation";
import { hasDisposableMx } from "@/lib/email-validation-server";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const t = await getServerT();
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const emailRedirectTo =
    typeof body.emailRedirectTo === "string" ? body.emailRedirectTo : undefined;
  // "login" → never create an account (a missing account must surface as an
  // error so the login screen can tell the user to register). "signup"
  // (default) keeps the create-on-first-link behaviour used by /register.
  const isLogin = body.mode === "login";

  // Basic shape check — a valid domain is required to evaluate it.
  if (!email || !emailDomain(email)) {
    return NextResponse.json(
      { error: "Adresse email invalide." },
      { status: 400 },
    );
  }

  // Email-domain gate — runs BEFORE signInWithOtp so no magic link is ever sent
  // to a rejected address.
  //   • SIGNUP → strict allowlist: only known providers can create an account,
  //     so no disposable (or custom) domain can ever register.
  //   • LOGIN  → looser disposable check only, so legitimate existing accounts on
  //     custom domains are never locked out, while a throwaway address still
  //     can't be used to sign in.
  const rejected = isLogin
    ? isDisposableEmail(email) || (await hasDisposableMx(email))
    : !isAllowedEmailDomain(email);
  if (rejected) {
    return NextResponse.json({ error: t("errors.disposableEmail") }, { status: 422 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
      ...(isLogin ? { shouldCreateUser: false } : {}),
    },
  });

  if (error) {
    // In login mode, a non-existent account surfaces here (shouldCreateUser
    // is false) — normalise it into a "no_account" code the UI can act on.
    if (
      isLogin &&
      (error.status === 422 ||
        /signup|not allowed|not found|no user|does not exist/i.test(error.message || ""))
    ) {
      return NextResponse.json({ code: "no_account" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

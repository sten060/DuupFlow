import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { driveAuthUrl, driveOAuthConfigured } from "@/lib/google-drive-oauth";

export const dynamic = "force-dynamic";

/** « Connecter Google Drive » → fenêtre d'autorisation Google. Propriétaire du
 *  compte uniquement : un invité exporte dans le Drive de son propriétaire. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const back = (q: string) => NextResponse.redirect(new URL(`/dashboard/settings?drive=${q}#google-drive`, origin));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));
  if (!driveOAuthConfigured()) return back("not_configured");

  const { data: profile } = await createAdminClient().from("profiles").select("is_guest").eq("id", user.id).single();
  if (profile?.is_guest) return back("guest");

  // Anti-CSRF : le retour de Google doit rapporter ce même jeton.
  const state = crypto.randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(driveAuthUrl(origin, state));
  res.cookies.set("duup_drive_state", state, { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", path: "/", maxAge: 600 });
  // Page où revenir après Google (uniquement nos pages du dashboard).
  const ret = req.nextUrl.searchParams.get("return");
  if (ret && /^\/dashboard\/[a-z-]+$/.test(ret)) res.cookies.set("duup_drive_return", ret, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}

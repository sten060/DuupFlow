import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeDriveCode, saveDriveLink, ownerDriveAccess, ownerDriveToken, ensureCreatorFolder } from "@/lib/google-drive-oauth";

export const dynamic = "force-dynamic";

/** Retour de Google après « Autoriser » : on garde l'accès (chiffré) et on crée
 *  tout de suite les dossiers Drive (un par créateur). */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const back = (q: string) => {
    const ret = req.cookies.get("duup_drive_return")?.value;
    const to = ret && /^\/dashboard\/[a-z-]+$/.test(ret) ? `${ret}?drive=${q}` : `/dashboard/settings?drive=${q}#google-drive`;
    const res = NextResponse.redirect(new URL(to, origin));
    res.cookies.delete("duup_drive_state");
    res.cookies.delete("duup_drive_return");
    return res;
  };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return back("denied"); // le user a refusé dans la fenêtre Google
  const state = params.get("state");
  if (!state || state !== req.cookies.get("duup_drive_state")?.value) return back("expired");
  const code = params.get("code");
  if (!code) return back("error");

  const { data: profile } = await createAdminClient().from("profiles").select("is_guest").eq("id", user.id).single();
  if (profile?.is_guest) return back("guest");

  try {
    const { refreshToken, email } = await exchangeDriveCode(code, origin);
    await saveDriveLink(user.id, refreshToken, email);
    // Un dossier « <Créateur> — DuupFlow » par créateur, tout de suite visible ;
    // un compte sans créateurs (Solo) a son dossier général « DuupFlow variantes ».
    const { data: wss, error: wsErr } = await createAdminClient().from("workspaces").select("id, name").eq("owner_user_id", user.id);
    const creators = (!wsErr && wss ? wss : []) as { id: string; name: string }[];
    if (creators.length) {
      const { token } = await ownerDriveToken(user.id);
      for (const w of creators) {
        await ensureCreatorFolder(user.id, w, token).catch((e) => console.error("[drive] dossier créateur :", (e as Error).message));
      }
    } else {
      await ownerDriveAccess(user.id);
    }
    return back("connected");
  } catch (e) {
    console.error("[google/drive/callback]", (e as Error).message);
    return back(/Drive n'a pas été accordé/.test((e as Error).message) ? "scope" : "error");
  }
}

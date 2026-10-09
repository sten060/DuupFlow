import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAccess } from "@/lib/workspaces";
import { ensureCreatorFolder, driveFolderUrl, publicOrigin } from "@/lib/google-drive-oauth";

export const dynamic = "force-dynamic";

/** « Ouvrir le dossier Drive » d'un créateur : garantit le dossier
 *  « <Créateur> — DuupFlow » (créé / renommé si besoin) puis redirige dessus. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // Adresse publique (pas l'adresse interne du serveur derrière le proxy Railway).
  const origin = publicOrigin(req);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));
  const access = await requireWorkspaceAccess(user.id, params.id);
  if (!access) return NextResponse.redirect(new URL("/dashboard/workspaces", origin));
  try {
    const { folderId } = await ensureCreatorFolder(access.ctx.ownerId, access.workspace);
    return NextResponse.redirect(driveFolderUrl(folderId));
  } catch (e) {
    console.error("[workspaces/drive]", (e as Error).message);
    return NextResponse.redirect(new URL("/dashboard/settings?drive=error#google-drive", origin));
  }
}

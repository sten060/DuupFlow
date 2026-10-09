import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDriveLink, deleteDriveLink, driveOAuthConfigured, driveFolderUrl, DRIVE_FOLDER_NAME } from "@/lib/google-drive-oauth";

export const dynamic = "force-dynamic";

/** Qui est le propriétaire du compte (un invité utilise le Drive de son hôte). */
async function account(userId: string): Promise<{ ownerId: string; isGuest: boolean }> {
  const { data } = await createAdminClient().from("profiles").select("is_guest, host_user_id").eq("id", userId).single();
  const p = data as { is_guest: boolean | null; host_user_id: string | null } | null;
  return p?.is_guest && p.host_user_id ? { ownerId: p.host_user_id, isGuest: true } : { ownerId: userId, isGuest: false };
}

/** État de la connexion Drive du compte. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const { ownerId, isGuest } = await account(user.id);
  const link = await getDriveLink(ownerId);
  return NextResponse.json({
    configured: driveOAuthConfigured(),
    connected: !!link,
    isGuest,
    email: link?.google_email ?? null,
    folderName: DRIVE_FOLDER_NAME,
    folderUrl: link?.export_folder_id ? driveFolderUrl(link.export_folder_id) : null,
    connectedAt: link?.connected_at ?? null,
  });
}

/** Déconnecter Google Drive (propriétaire uniquement) — l'accès est aussi révoqué chez Google. */
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const { ownerId, isGuest } = await account(user.id);
  if (isGuest) return NextResponse.json({ error: "Seul le propriétaire du compte peut déconnecter Google Drive." }, { status: 403 });
  await deleteDriveLink(ownerId);
  return NextResponse.json({ ok: true });
}

// src/lib/google-drive-oauth.ts
//
// CONNEXION GOOGLE DRIVE DU COMPTE (côté serveur) — pour que Claude puisse
// exporter une variante dans le Drive du user SANS page ouverte (MCP).
//
// Le propriétaire du compte clique une fois « Connecter Google Drive » :
//   • même client Google que l'import Drive du navigateur (NEXT_PUBLIC_GOOGLE_CLIENT_ID)
//     + son secret côté serveur (GOOGLE_CLIENT_SECRET) ;
//   • autorisation légère `drive.file` : DuupFlow ne voit QUE ce qu'il crée
//     lui-même (aucune vérification Google requise) ;
//   • on garde le jeton de rafraîchissement, CHIFFRÉ (AES-256-GCM) en base ;
//   • DuupFlow crée le dossier « DuupFlow variantes » dans son Drive et y dépose
//     tous les exports. C'est ensuite Claude qui trie, avec son propre connecteur.
//
// Le dossier est recréé automatiquement s'il a été supprimé ou mis à la corbeille.

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const DRIVE_FOLDER_NAME = "DuupFlow variantes";
const SCOPES = ["https://www.googleapis.com/auth/drive.file", "openid", "email"];
const DRIVE_API = "https://www.googleapis.com/drive/v3";

/** Identifiants du client Google, nettoyés : un espace ou des guillemets collés
 *  par erreur dans la variable d'env (fréquent au copier-coller) cassaient tout. */
function clientId(): string { return (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "").trim().replace(/^"|"$/g, ""); }
function clientSecret(): string { return (process.env.GOOGLE_CLIENT_SECRET ?? "").trim().replace(/^"|"$/g, ""); }

export function driveOAuthConfigured(): boolean {
  return !!(clientId() && clientSecret());
}

export function driveRedirectUri(origin: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || origin).replace(/\/$/, "");
  return `${base}/api/google/drive/callback`;
}

export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

/* ── Chiffrement du jeton (clé dérivée d'un secret serveur déjà présent) ── */

function key(): Buffer {
  const secret = process.env.DRIVE_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Aucun secret serveur pour chiffrer le jeton Drive.");
  return crypto.createHash("sha256").update(`duupflow-drive-token:${secret}`).digest();
}
function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}
function decrypt(blob: string): string {
  const [v, iv, tag, data] = blob.split(".");
  if (v !== "v1") throw new Error("Format de jeton inconnu.");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}

/* ── OAuth ── */

export function driveAuthUrl(origin: string, state: string): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: driveRedirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",   // → jeton de rafraîchissement (accès durable)
    prompt: "consent",        // → le jeton est renvoyé même si l'accès a déjà été donné
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeDriveCode(code: string, origin: string): Promise<{ refreshToken: string; email: string | null }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: driveRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  const d = (await res.json().catch(() => ({}))) as { refresh_token?: string; id_token?: string; scope?: string; error_description?: string };
  if (!res.ok || !d.refresh_token) throw new Error(d.error_description || "Google n'a pas renvoyé d'accès durable.");
  if (!d.scope?.includes("drive.file")) throw new Error("L'accès à Google Drive n'a pas été accordé (case décochée ?).");
  let email: string | null = null;
  try {
    const payload = JSON.parse(Buffer.from((d.id_token ?? "").split(".")[1] ?? "", "base64url").toString("utf8"));
    email = typeof payload.email === "string" ? payload.email : null;
  } catch { /* email facultatif */ }
  return { refreshToken: d.refresh_token, email };
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const d = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!res.ok || !d.access_token) {
    if (d.error === "invalid_grant") throw new DriveNotConnectedError("L'accès Google Drive a expiré ou a été retiré : reconnecte Google Drive dans DuupFlow → Paramètres.");
    throw new Error("Google Drive refuse l'accès pour l'instant, réessaie.");
  }
  return d.access_token;
}

export class DriveNotConnectedError extends Error {}

/* ── Base ── */

type LinkRow = { owner_user_id: string; google_email: string | null; refresh_token_enc: string; export_folder_id: string | null; connected_at: string };

export async function getDriveLink(ownerId: string): Promise<LinkRow | null> {
  const { data, error } = await createAdminClient()
    .from("google_drive_links")
    .select("owner_user_id, google_email, refresh_token_enc, export_folder_id, connected_at")
    .eq("owner_user_id", ownerId)
    .maybeSingle();
  if (error) return null; // migration 060 absente → « pas connecté »
  return (data as LinkRow | null) ?? null;
}

export async function saveDriveLink(ownerId: string, refreshToken: string, email: string | null): Promise<void> {
  const { error } = await createAdminClient().from("google_drive_links").upsert({
    owner_user_id: ownerId,
    google_email: email,
    refresh_token_enc: encrypt(refreshToken),
    export_folder_id: null, // recréé (ou retrouvé) au premier usage
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Enregistrement impossible : ${error.message}`);
}

export async function deleteDriveLink(ownerId: string): Promise<void> {
  const link = await getDriveLink(ownerId);
  if (link) {
    // Révocation côté Google (best-effort) : DuupFlow perd vraiment l'accès.
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(link.refresh_token_enc))}`, { method: "POST" });
    } catch { /* déjà révoqué */ }
  }
  await createAdminClient().from("google_drive_links").delete().eq("owner_user_id", ownerId);
}

/** Jeton Drive frais du propriétaire (sans toucher aux dossiers). */
export async function ownerDriveToken(ownerId: string): Promise<{ token: string; email: string | null; link: LinkRow }> {
  if (!driveOAuthConfigured()) throw new DriveNotConnectedError("L'export Google Drive n'est pas encore configuré sur le serveur DuupFlow (GOOGLE_CLIENT_SECRET).");
  const link = await getDriveLink(ownerId);
  if (!link) throw new DriveNotConnectedError("Google Drive n'est pas connecté : le propriétaire du compte doit cliquer « Connecter Google Drive » dans DuupFlow → Paramètres (une seule fois).");
  return { token: await refreshAccessToken(decrypt(link.refresh_token_enc)), email: link.google_email, link };
}

/**
 * Comptes SANS créateurs : jeton frais + dossier général « DuupFlow variantes »
 * garanti (créé au premier usage, recréé s'il a été supprimé).
 */
export async function ownerDriveAccess(ownerId: string): Promise<{ token: string; folderId: string; email: string | null }> {
  const { token, link } = await ownerDriveToken(ownerId);

  let folderId = link.export_folder_id;
  if (folderId) {
    const r = await fetch(`${DRIVE_API}/files/${encodeURIComponent(folderId)}?fields=id,trashed`, { headers: { Authorization: `Bearer ${token}` } });
    const f = r.ok ? ((await r.json()) as { trashed?: boolean }) : null;
    if (!f || f.trashed) folderId = null;
  }
  if (!folderId) {
    const r = await fetch(`${DRIVE_API}/files?fields=id`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
    });
    if (!r.ok) throw new Error(`Création du dossier « ${DRIVE_FOLDER_NAME} » impossible (${r.status}).`);
    folderId = ((await r.json()) as { id: string }).id;
    await createAdminClient().from("google_drive_links")
      .update({ export_folder_id: folderId, updated_at: new Date().toISOString() })
      .eq("owner_user_id", ownerId);
  }
  return { token, folderId, email: link.google_email };
}


/* ── Un dossier Drive PAR CRÉATEUR : « <Créateur> — DuupFlow » ─────────────────
   Retrouvé par une ÉTIQUETTE invisible (appProperties duupflowWorkspaceId), pas
   par son nom : renommer le créateur renomme le dossier, sans jamais créer de
   doublon. drive.file permet de chercher les dossiers que DuupFlow a créés. */

export function creatorFolderName(creatorName: string): string {
  return `${creatorName.trim().slice(0, 80)} — DuupFlow`;
}

const folderCache = new Map<string, { id: string; name: string; at: number }>();

async function findCreatorFolder(token: string, workspaceId: string): Promise<{ id: string; name: string } | null> {
  const q = encodeURIComponent(
    `mimeType = 'application/vnd.google-apps.folder' and trashed = false and appProperties has { key='duupflowWorkspaceId' and value='${workspaceId}' }`,
  );
  const r = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id,name)&pageSize=5`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return (((await r.json()) as { files?: { id: string; name: string }[] }).files ?? [])[0] ?? null;
}

/** Dossier du créateur garanti (créé, ou renommé s'il ne porte plus le bon nom). */
export async function ensureCreatorFolder(
  ownerId: string,
  workspace: { id: string; name: string },
  tokenIn?: string,
): Promise<{ token: string; folderId: string; folderName: string }> {
  const token = tokenIn ?? (await ownerDriveToken(ownerId)).token;
  const wanted = creatorFolderName(workspace.name);
  const key = `${ownerId}:${workspace.id}`;
  const cached = folderCache.get(key);
  let folder: { id: string; name: string } | null =
    cached && Date.now() - cached.at < 10 * 60_000 ? { id: cached.id, name: cached.name } : await findCreatorFolder(token, workspace.id);

  if (folder && cached) {
    // Le cache peut pointer vers un dossier supprimé entre-temps : vérification légère.
    const r = await fetch(`${DRIVE_API}/files/${encodeURIComponent(folder.id)}?fields=id,trashed`, { headers: { Authorization: `Bearer ${token}` } });
    const f = r.ok ? ((await r.json()) as { trashed?: boolean }) : null;
    if (!f || f.trashed) folder = await findCreatorFolder(token, workspace.id);
  }

  if (!folder) {
    const r = await fetch(`${DRIVE_API}/files?fields=id,name`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: wanted,
        mimeType: "application/vnd.google-apps.folder",
        appProperties: { duupflowWorkspaceId: workspace.id },
        description: `Exports DuupFlow du créateur « ${workspace.name} ».`,
      }),
    });
    if (!r.ok) throw new Error(`Création du dossier « ${wanted} » impossible (${r.status}).`);
    folder = (await r.json()) as { id: string; name: string };
  } else if (folder.name !== wanted) {
    // Créateur renommé dans DuupFlow → le dossier suit.
    await fetch(`${DRIVE_API}/files/${encodeURIComponent(folder.id)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: wanted }),
    }).catch(() => {});
    folder = { id: folder.id, name: wanted };
  }
  folderCache.set(key, { id: folder.id, name: folder.name, at: Date.now() });
  return { token, folderId: folder.id, folderName: folder.name };
}

/** Best-effort, sans bloquer l'écran : crée / renomme le dossier d'un créateur
 *  si le Drive du compte est connecté (création ou renommage d'un créateur). */
export function syncCreatorFolderInBackground(ownerId: string, workspace: { id: string; name: string }): void {
  void (async () => {
    if (!driveOAuthConfigured() || !(await getDriveLink(ownerId))) return;
    await ensureCreatorFolder(ownerId, workspace);
  })().catch((e) => console.error("[drive] dossier créateur :", (e as Error).message));
}

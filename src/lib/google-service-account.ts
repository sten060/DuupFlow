// src/lib/google-service-account.ts
//
// Accès Google Drive SERVEUR → SERVEUR via un compte de service (pas de
// connexion du user, pas de navigateur). Utilisé par le MCP de l'Éditeur IA :
//   • export_to_drive : dépose les variantes rendues dans un dossier fixe ;
//   • add_material    : lit un fichier / dossier Drive partagé avec le compte.
//
// Configuration (Railway + .env.local) :
//   GOOGLE_SERVICE_ACCOUNT_JSON = la clé JSON complète du compte de service
//                                 (téléchargée depuis Google Cloud, sur une ligne)
//   DRIVE_EXPORT_FOLDER_ID      = l'id du dossier « Exports DuupFlow »
//
// ⚠️ Un compte de service n'a PAS d'espace de stockage (règle Google) : il peut
// LIRE ce qu'on partage avec lui, mais ne peut CRÉER des fichiers que dans un
// Drive PARTAGÉ (Google Workspace). Dans le « Mon Drive » d'un compte Gmail,
// Google répond storageQuotaExceeded → on le traduit en message clair.
//
// Aucune dépendance : JWT RS256 signé avec `crypto`, appels REST avec fetch.

import crypto from "crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

type ServiceAccountKey = { client_email: string; private_key: string; token_uri?: string };

let cached: { token: string; exp: number } | null = null;

export function serviceAccountKey(): ServiceAccountKey | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const k = JSON.parse(raw) as ServiceAccountKey;
    if (!k.client_email || !k.private_key) return null;
    // Une clé collée dans une variable d'env perd souvent ses vrais retours à la ligne.
    return { ...k, private_key: k.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

/** Email du compte de service — celui avec lequel partager le dossier. */
export function serviceAccountEmail(): string | null {
  return serviceAccountKey()?.client_email ?? null;
}

export function driveExportFolderId(): string | null {
  return process.env.DRIVE_EXPORT_FOLDER_ID?.trim() || null;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** Jeton d'accès Drive (mis en cache jusqu'à 5 min avant expiration). */
export async function driveAccessToken(): Promise<string> {
  if (cached && cached.exp - 300 > Date.now() / 1000) return cached.token;
  const key = serviceAccountKey();
  if (!key) throw new DriveConfigError("GOOGLE_SERVICE_ACCOUNT_JSON absente ou invalide.");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: key.client_email,
    scope: DRIVE_SCOPE,
    aud: key.token_uri || TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const signature = crypto.createSign("RSA-SHA256").update(`${header}.${claims}`).sign(key.private_key);
  const assertion = `${header}.${claims}.${b64url(signature)}`;
  const res = await fetch(key.token_uri || TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !data.access_token) throw new DriveConfigError(`Connexion Google refusée : ${data.error_description ?? res.status}`);
  cached = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
  return data.access_token;
}

export class DriveConfigError extends Error {}

/** Traduit une erreur Drive en message actionnable pour Claude / le user. */
export function explainDriveError(status: number, body: string): string {
  const email = serviceAccountEmail() ?? "le compte de service";
  if (/storageQuotaExceeded|do not have storage quota/i.test(body)) {
    return `Google refuse l'envoi : un compte de service n'a pas d'espace de stockage. Le dossier d'export doit se trouver dans un DRIVE PARTAGÉ (Google Workspace), avec ${email} ajouté comme membre (Gestionnaire de contenu). Dans le « Mon Drive » d'un compte Gmail, l'envoi est impossible.`;
  }
  if (status === 404) return `Dossier ou fichier introuvable pour ${email}. Vérifie l'id et que l'élément est bien partagé avec ${email}.`;
  if (status === 403) return `Accès refusé par Google Drive pour ${email} : partage l'élément avec ce compte (droit Éditeur pour un dossier d'export, Lecteur suffit pour lire).`;
  if (status === 429) return "Google Drive limite le débit pour l'instant : réessaie dans une minute.";
  return `Erreur Google Drive (${status}) : ${body.slice(0, 200)}`;
}

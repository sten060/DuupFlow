// DuupFlow API key management — server-side only.
//
// Security model: the plaintext key is shown to the user exactly ONCE at
// creation and never stored. We persist only its SHA-256 hash (for O(1)
// lookup on incoming requests) plus a display prefix + last 4 chars.
//
// This module is fully isolated: it only touches the new `api_keys` table via
// the service-role client. Nothing here modifies existing dashboard behaviour.

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const KEY_PREFIX = "dflw_live_";

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  last4: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

/** Generate a fresh key. The plaintext (`key`) is returned once and never stored. */
export function generateApiKey() {
  const secret = crypto.randomBytes(24).toString("base64url"); // 32 url-safe chars
  const key = `${KEY_PREFIX}${secret}`;
  return { key, hash: hashApiKey(key), prefix: key.slice(0, 14), last4: key.slice(-4) };
}

/** Create a key for a user. Returns the plaintext key (show once) + row metadata. */
export async function createApiKey(userId: string, name: string): Promise<{ key: string; row: ApiKeyRow }> {
  const admin = createAdminClient();
  const { key, hash, prefix, last4 } = generateApiKey();
  const { data, error } = await admin
    .from("api_keys")
    .insert({
      user_id: userId,
      name: (name || "").trim().slice(0, 60) || "API key",
      key_hash: hash,
      key_prefix: prefix,
      last4,
    })
    .select("id, name, key_prefix, last4, created_at, last_used_at, revoked_at")
    .single();
  if (error) throw new Error(error.message);
  return { key, row: data as ApiKeyRow };
}

/** List a user's keys (metadata only — never the hash or plaintext). */
export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("api_keys")
    .select("id, name, key_prefix, last4, created_at, last_used_at, revoked_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data as ApiKeyRow[] | null) ?? [];
}

/** Revoke one of the user's keys (scoped to user_id so users can't revoke others'). */
export async function revokeApiKey(userId: string, keyId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("user_id", userId)
    .is("revoked_at", null);
}

/** Validate a raw key from an incoming API request. Returns the owner or null. */
export async function validateApiKey(rawKey: string): Promise<{ userId: string; keyId: string } | null> {
  if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", hashApiKey(rawKey))
    .maybeSingle();
  if (!data || (data as { revoked_at: string | null }).revoked_at) return null;
  const row = data as { id: string; user_id: string };
  // Fire-and-forget usage timestamp; failure must never block the request.
  admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id).then(
    () => {},
    () => {},
  );
  return { userId: row.user_id, keyId: row.id };
}

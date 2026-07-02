// DuupFlow API authentication — resolves an incoming request's API key into an
// authenticated actor (user + effective plan) and enforces Pro-only access.
//
// Isolated by design: reads only the existing `profiles` table and the new
// `api_keys` table (via validateApiKey). It never mutates dashboard state, so a
// bug here can only ever break /api/v1/* requests — never the dashboard.

import { validateApiKey } from "@/lib/api-keys";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/api-rate-limit";
import type { PlanType } from "@/lib/plans";

// Per-key request cap. Generous for automation, low enough to blunt abuse.
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

export type ApiActor = { userId: string; keyId: string; plan: PlanType };
export type ApiAuthResult = { ok: true; actor: ApiActor } | { ok: false; response: Response };

/** Standard API error envelope. */
export function apiError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

/**
 * Resolve the effective plan for a user. Mirrors the logic in usage.ts:
 * guests inherit their host's plan; legacy `has_paid` without a plan → pro.
 * Replicated here (rather than imported) to keep the API layer isolated.
 */
export async function resolveEffectivePlan(userId: string): Promise<PlanType> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, has_paid, is_guest, host_user_id")
    .eq("id", userId)
    .single();
  if (!profile) return "free";

  const p = profile as { plan: string | null; has_paid: boolean | null; is_guest: boolean | null; host_user_id: string | null };
  let plan = p.plan;
  if (p.is_guest && p.host_user_id) {
    const { data: host } = await admin.from("profiles").select("plan").eq("id", p.host_user_id).single();
    plan = (host as { plan: string | null } | null)?.plan ?? plan;
  }
  if (!plan) plan = p.has_paid ? "pro" : "free";
  return plan === "pro" || plan === "solo" ? plan : "free";
}

/**
 * Authenticate an incoming API request via `Authorization: Bearer dflw_live_…`.
 * Returns the actor on success, or a ready-to-return error Response.
 * API access is Pro-only.
 */
export async function authenticateApiRequest(req: Request): Promise<ApiAuthResult> {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, response: apiError(401, "missing_key", "Missing API key. Send header 'Authorization: Bearer dflw_live_…'.") };
  }

  const valid = await validateApiKey(match[1].trim());
  if (!valid) {
    return { ok: false, response: apiError(401, "invalid_key", "Invalid or revoked API key.") };
  }

  // Rate limit per key.
  const rl = checkRateLimit(`key:${valid.keyId}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.allowed) {
    const res = apiError(429, "rate_limited", `Rate limit exceeded (${RATE_LIMIT}/min). Retry in ${rl.retryAfter}s.`);
    res.headers.set("Retry-After", String(rl.retryAfter));
    res.headers.set("X-RateLimit-Limit", String(rl.limit));
    res.headers.set("X-RateLimit-Remaining", "0");
    res.headers.set("X-RateLimit-Reset", String(Math.ceil(rl.resetAt / 1000)));
    return { ok: false, response: res };
  }

  const plan = await resolveEffectivePlan(valid.userId);
  if (plan !== "pro") {
    return { ok: false, response: apiError(403, "plan_required", "The DuupFlow API requires a Pro plan.") };
  }

  return { ok: true, actor: { userId: valid.userId, keyId: valid.keyId, plan } };
}

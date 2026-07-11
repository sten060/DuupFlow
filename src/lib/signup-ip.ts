// Server-only anti-abuse helper: caps how many distinct accounts a single client
// IP can create, to slow repeat free-trial farming. Best-effort throughout — a
// missing IP or any DB error returns "allowed" so infra hiccups (or a legit user
// behind an unknown proxy) can never be blocked by mistake.
//
// Backed by the `signup_ips` table (migration 051). Enforced only on the SIGNUP
// path of /api/auth/otp — never on login.
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Tune these to taste. Allow up to 2 distinct accounts per IP within a 30-day
// window; the 3rd+ new account from that IP is refused.
export const MAX_ACCOUNTS_PER_IP = 2;
export const WINDOW_DAYS = 30;

/**
 * Real client IP behind Railway's proxy. `x-forwarded-for` is a comma-separated
 * chain "client, proxy1, proxy2…" — the first entry is the original client.
 * Falls back to `x-real-ip`. Returns null when nothing usable is present.
 */
export function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  return real || null;
}

/**
 * Decide whether a NEW signup from `ip` is allowed, and record it if so.
 * - Returns { allowed: true } when the IP is under the cap (and inserts the row).
 * - Returns { allowed: false } only when the IP already holds >= the cap of
 *   distinct accounts inside the window.
 * An already-known email (re-request of a magic link) is always allowed and
 * never counts twice.
 */
export async function checkAndRecordSignupIp(
  email: string,
  ip: string | null,
): Promise<{ allowed: boolean }> {
  // No usable IP → can't enforce, don't block.
  if (!ip) return { allowed: true };

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { allowed: true };

  try {
    const admin = createAdminClient();

    // Already recorded (returning email / link resend) → allow, refresh nothing.
    const { data: existing } = await admin
      .from("signup_ips")
      .select("email")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (existing) return { allowed: true };

    // Count distinct accounts already created from this IP within the window.
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await admin
      .from("signup_ips")
      .select("email", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", since);

    // On a count error, fail open (don't block a legit user on a DB glitch).
    if (countErr) return { allowed: true };

    if ((count ?? 0) >= MAX_ACCOUNTS_PER_IP) {
      return { allowed: false };
    }

    // Under the cap → record this new account and allow it.
    await admin.from("signup_ips").insert({ email: normalizedEmail, ip });
    return { allowed: true };
  } catch {
    // Any unexpected failure → fail open.
    return { allowed: true };
  }
}

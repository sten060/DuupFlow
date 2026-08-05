/**
 * Comp (offert) Pro access by email — grants full Pro to specific accounts
 * WITHOUT any Stripe subscription. Mirrors the AI_EDITOR_ALLOWLIST pattern.
 *
 * Source of truth: the env var `COMP_PRO_EMAILS` (comma-separated emails).
 * These accounts:
 *   - skip the pricing/checkout gate at signup (onboarding),
 *   - are provisioned directly as plan='pro', has_paid=true (no pending_plan),
 *   - are durable: with no stripe_subscription_id, the billing-sync cron and the
 *     dashboard self-heal never touch them (they can't be reverted to free).
 *
 * To revoke: remove the email from COMP_PRO_EMAILS. (The profile row keeps
 * plan='pro' until manually reset in SQL — the env var only controls the
 * automatic grant at signup, not an ongoing override.)
 */
export function compProEmails(): string[] {
  return (process.env.COMP_PRO_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** True when `email` is on the comp-Pro allowlist. Case-insensitive. */
export function isCompProEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return compProEmails().includes(email.trim().toLowerCase());
}

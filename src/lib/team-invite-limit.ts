import { teamSeatsForPlan } from "@/lib/plans";

/**
 * Team guest limit per host = seats of the host's plan: Pro 3, Agence 10.
 *
 * The env var `TEAM_INVITE_BONUS_EMAILS` (comma-separated host emails) grants
 * one extra guest slot to the listed accounts — same pattern as
 * COMP_PRO_EMAILS. To revoke, remove the email from the env var: the extra
 * slot disappears on the next invite attempt, existing guests are untouched.
 */
export const TEAM_INVITE_BASE_LIMIT = 3;

export function teamInviteLimitFor(
  email: string | null | undefined,
  plan: string | null | undefined = "pro",
): number {
  const base = teamSeatsForPlan(plan) || TEAM_INVITE_BASE_LIMIT;
  if (!email) return base;
  const bonus = (process.env.TEAM_INVITE_BONUS_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return bonus.includes(email.trim().toLowerCase()) ? base + 1 : base;
}

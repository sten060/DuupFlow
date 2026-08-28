/**
 * Team guest limit per host. Base: 3 (Pro plan).
 *
 * The env var `TEAM_INVITE_BONUS_EMAILS` (comma-separated host emails) grants
 * one extra guest slot (4) to the listed accounts — same pattern as
 * COMP_PRO_EMAILS. To revoke, remove the email from the env var: the extra
 * slot disappears on the next invite attempt, existing guests are untouched.
 */
export const TEAM_INVITE_BASE_LIMIT = 3;

export function teamInviteLimitFor(email: string | null | undefined): number {
  if (!email) return TEAM_INVITE_BASE_LIMIT;
  const bonus = (process.env.TEAM_INVITE_BONUS_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return bonus.includes(email.trim().toLowerCase())
    ? TEAM_INVITE_BASE_LIMIT + 1
    : TEAM_INVITE_BASE_LIMIT;
}

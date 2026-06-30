// Server-side disposable-email detection.
//
// Backed by the maintained `disposable-email-domains` npm package (tens of
// thousands of throwaway domains) rather than a hand-kept hardcoded list — a
// `npm update` refreshes it.
//
// IMPORTANT — we never treat the following as disposable, even if a future
// list revision were to flag them:
//   • Apple mainstream (icloud.com, me.com, mac.com) — millions of real users.
//   • Legitimate privacy relays — these forward to a permanent inbox and are
//     used by real, paying-capable customers protecting their address:
//       - privaterelay.appleid.com  (Apple Hide My Email)
//       - duck.com                  (DuckDuckGo Email Protection)
//       - mozmail.com               (Mozilla Firefox Relay) — a legit Mozilla
//         privacy product, NOT a throwaway service, so we allow it.

import disposableDomains from "disposable-email-domains";

/** Domains we must always accept, regardless of the disposable list. */
const ALLOWLIST = new Set<string>([
  "icloud.com",
  "me.com",
  "mac.com",
  "privaterelay.appleid.com",
  "duck.com",
  "mozmail.com",
]);

const DISPOSABLE = new Set<string>(
  (disposableDomains as string[]).map((d) => d.toLowerCase()),
);

/** Extract the lowercased domain from an email, or null if it's malformed. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

/**
 * True when the email's domain is a known disposable/throwaway provider.
 * Allowlisted mainstream + privacy-relay domains always return false.
 */
export function isDisposableEmail(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;
  if (ALLOWLIST.has(domain)) return false;
  return DISPOSABLE.has(domain);
}

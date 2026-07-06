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

// Supplementary blocklist — throwaway domains the npm package hasn't caught yet
// (new temp-mail services appear constantly). Add offenders as they show up.
const EXTRA_DISPOSABLE = new Set<string>([
  "freetemporarymail.com",
  "temporarymail.com",
  "temp-mail.io",
  "tempmail.plus",
  "tempmailo.com",
  "minuteinbox.com",
  "internxt.com",
  "mailtemp.net",
  "temporary-mail.net",
]);

// Heuristic net for the long tail — domains whose name screams "throwaway".
// Keeps specific service tokens so legit domains aren't caught by accident.
const DISPOSABLE_PATTERN =
  /(tempo?rary?mail|temp-?mail|throwaway|disposable|trash-?mail|guerrillamail|mailinator|10minutemail|minute-?mail|yopmail|fake-?(inbox|mail)|sharklasers|mohmal|emailondeck|moakt|inboxkitten|drop-?mail|maildrop|getnada|burner-?mail|discard\.?mail)/i;

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
  if (DISPOSABLE.has(domain) || EXTRA_DISPOSABLE.has(domain)) return true;
  return DISPOSABLE_PATTERN.test(domain);
}

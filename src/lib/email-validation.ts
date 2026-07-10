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
  // Rotating throwaway domains seen abusing signup (also caught by their MX,
  // see email-validation-server.ts — kept here as a fast static fallback).
  "adsprite.com",
  "cadebek.com",
  "aratrin.com",
  "fishnone.com",
  "afterdo.com",
  "asitrai.com",
  "doefy.com",
  "luxudata.com",
  "missyoutoo.fun",
  // Self-hosted-MX temp-mail domain (MX = mail.bevriz.com). Also caught by its
  // MX server IP in email-validation-server.ts, which covers its siblings too.
  "bevriz.com",
]);

// Heuristic net for the long tail — domains whose name screams "throwaway".
// Keeps specific service tokens so legit domains aren't caught by accident.
const DISPOSABLE_PATTERN =
  /(tempo?rary?mail|temp-?mail|throwaway|disposable|trash-?mail|guerrillamail|mailinator|10minutemail|minute-?mail|yopmail|fake-?(inbox|mail)|sharklasers|mohmal|emailondeck|moakt|inboxkitten|drop-?mail|maildrop|getnada|burner-?mail|discard\.?mail)/i;

// Strict allowlist of accepted email providers for NEW signups. Registration is
// limited to these domains — every other domain (disposable services AND custom/
// company domains alike) is refused. This guarantees no throwaway address can
// ever create an account, at the cost of not accepting custom domains. Add a
// provider (or a specific trusted client/agency domain) here on request.
export const ALLOWED_EMAIL_DOMAINS = new Set<string>([
  // Google
  "gmail.com", "googlemail.com",
  // Microsoft
  "outlook.com", "outlook.fr", "outlook.be", "hotmail.com", "hotmail.fr",
  "hotmail.be", "hotmail.co.uk", "live.com", "live.fr", "live.be", "msn.com",
  // Apple (incl. Hide My Email relay → forwards to a real inbox)
  "icloud.com", "me.com", "mac.com", "privaterelay.appleid.com",
  // Yahoo / AOL
  "yahoo.com", "yahoo.fr", "yahoo.co.uk", "ymail.com", "rocketmail.com", "aol.com",
  // Proton
  "proton.me", "protonmail.com", "protonmail.ch", "pm.me",
  // Privacy relays (forward to a permanent inbox)
  "duck.com", "mozmail.com",
  // France — ISPs & webmail
  "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr", "neuf.fr", "laposte.net",
  "bbox.fr", "numericable.fr",
  // French-speaking Belgium / Switzerland / Canada
  "bluewin.ch", "videotron.ca", "sympatico.ca",
  // Other majors
  "gmx.com", "gmx.fr", "gmx.net", "gmx.de", "zoho.com", "mail.com", "hey.com",
  "yandex.com", "fastmail.com", "tutanota.com", "tuta.com",
  // Germany / Europe
  "web.de", "t-online.de",
]);

/**
 * True when the email's domain is on the strict allowlist of accepted providers.
 * Used to gate NEW signups; login uses the looser disposable check so legitimate
 * existing accounts on custom domains are never locked out.
 */
export function isAllowedEmailDomain(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;
  return ALLOWED_EMAIL_DOMAINS.has(domain);
}

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

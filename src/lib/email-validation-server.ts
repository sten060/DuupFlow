// Server-only helper (uses the Node `dns` module). Imported only by the
// /api/auth/otp route — never from a client component.
import { promises as dns } from "dns";
import { emailDomain } from "./email-validation";

// Disposable/throwaway email services rotate through hundreds of random front
// domains that a static blocklist can never keep up with. We catch them at the
// mail-server level, matched TWO ways because different services hide the shared
// infrastructure differently:
//
//   1. By MX exchange HOST — services that share one MX host (adsprite,
//      cadebek… → wallywatts.com) across every front domain.
//   2. By the MX server's resolved IP — services (e.g. bevriz.com and its
//      siblings) that self-host MX at mail.<domain>, so every front domain has
//      a DIFFERENT MX host, but they all point to the SAME server IP. Host
//      matching can't see this; IP matching catches the whole network in one
//      shot.
//
// Legit providers (iCloud, ForwardEmail, Hostinger…) keep their own MX host and
// IPs, so neither list touches them.
const DISPOSABLE_MX_HOSTS = [
  "wallywatts.com",
  "wabblywabble.com",
];

// Server IPs behind known disposable mail hosts. Add offenders as they appear.
const DISPOSABLE_MX_IPS = new Set<string>([
  "134.199.177.23", // temp-mail service behind bevriz.com and its sibling domains
]);

function hostIsDisposable(exchange: string): boolean {
  const host = exchange.toLowerCase().replace(/\.$/, "");
  return DISPOSABLE_MX_HOSTS.some((bad) => host === bad || host.endsWith("." + bad));
}

/**
 * True when the email's domain routes its mail through a known disposable mail
 * server — matched by MX host OR by the MX server's resolved IP. Best-effort: a
 * missing MX record or a lookup failure returns false so a DNS hiccup can never
 * block a legitimate signup.
 */
export async function hasDisposableMx(email: string): Promise<boolean> {
  const domain = emailDomain(email);
  if (!domain) return false;

  let records: { exchange: string }[];
  try {
    records = await dns.resolveMx(domain);
  } catch {
    return false;
  }
  if (!records?.length) return false;

  // 1) Host-based match — cheap, no extra lookup.
  if (records.some((r) => hostIsDisposable(r.exchange))) return true;

  // 2) IP-based match — resolve each MX host to its addresses and compare.
  //    Catches self-hosted-MX services whose front domains rotate but share one
  //    server IP.
  for (const r of records) {
    const host = r.exchange.replace(/\.$/, "");
    try {
      const ips = await dns.resolve4(host);
      if (ips.some((ip) => DISPOSABLE_MX_IPS.has(ip))) return true;
    } catch {
      // Ignore this host and keep checking the others.
    }
  }

  return false;
}

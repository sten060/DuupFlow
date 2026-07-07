// Server-only helper (uses the Node `dns` module). Imported only by the
// /api/auth/otp route — never from a client component.
import { promises as dns } from "dns";
import { emailDomain } from "./email-validation";

// Disposable/throwaway email services rotate through hundreds of random front
// domains (adsprite.com, cadebek.com, doefy.com, …) that a static blocklist can
// never keep up with — but they all point their MX at the SAME mail servers.
// Blocking by MX host therefore catches every current AND future front domain
// of the same service in one shot, with no false positives on legit providers
// (iCloud, ForwardEmail, Hostinger… keep their own MX and are untouched).
const DISPOSABLE_MX_HOSTS = [
  "wallywatts.com",
  "wabblywabble.com",
];

/**
 * True when the email's domain routes its mail through a known disposable mail
 * server. Best-effort: a missing MX record or a lookup failure returns false so
 * a DNS hiccup can never block a legitimate signup.
 */
export async function hasDisposableMx(email: string): Promise<boolean> {
  const domain = emailDomain(email);
  if (!domain) return false;
  try {
    const records = await dns.resolveMx(domain);
    return records.some((r) => {
      const host = r.exchange.toLowerCase().replace(/\.$/, "");
      return DISPOSABLE_MX_HOSTS.some((bad) => host === bad || host.endsWith("." + bad));
    });
  } catch {
    return false;
  }
}

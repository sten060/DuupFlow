/**
 * First-touch acquisition tracking.
 *
 * Captures UTM parameters + referrer + landing path on the visitor's FIRST
 * page-load and persists them to localStorage. Once captured, subsequent
 * page loads are no-ops (first-touch attribution — the very first source
 * is the only one that ever sticks).
 *
 * The captured payload is written to `public.user_acquisition` once the
 * user finishes signup (see `flushAcquisition` below). RLS on that table
 * accepts an insert only when `auth.uid() = user_id`, so the flush runs
 * from the browser using the regular Supabase client.
 *
 * All entry points are browser-only — every function guards `window`
 * access so it's safe to import from server components.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const STORAGE_KEY = "acq";

export type AcquisitionData = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  referrer: string | null;
  landing_path: string | null;
};

/** First-touch capture. Reads UTM params + referrer + pathname from the
 * current `window` state and writes them to localStorage. If a payload is
 * already stored, this is a no-op (we never overwrite an earlier source). */
export function captureAcquisition(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(STORAGE_KEY)) return;

    const params = new URLSearchParams(window.location.search);
    const utm = (k: string): string | null => {
      const v = params.get(k);
      return v && v.trim() ? v.trim() : null;
    };

    let source: string | null = utm("utm_source");
    let medium: string | null = utm("utm_medium");
    const referrer = document.referrer || null;

    // Fallback when no utm_source is present:
    //   • no referrer at all       → "direct"
    //   • referrer from another host → host of referrer (medium "referral")
    //   • referrer from same host   → "direct" (intra-site nav)
    if (!source) {
      if (!referrer) {
        source = "direct";
      } else {
        try {
          const refHost = new URL(referrer).hostname || null;
          if (refHost && refHost !== window.location.hostname) {
            source = refHost;
            if (!medium) medium = "referral";
          } else {
            source = "direct";
          }
        } catch {
          source = "direct";
        }
      }
    }

    const data: AcquisitionData = {
      source,
      medium,
      campaign:    utm("utm_campaign"),
      content:     utm("utm_content"),
      term:        utm("utm_term"),
      referrer,
      landing_path: window.location.pathname || null,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage disabled (privacy mode, quota exceeded, ...). Skip silently.
  }
}

/** Read the captured payload. Returns null when nothing is stored or the
 * stored value is malformed. */
export function readAcquisition(): AcquisitionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as AcquisitionData;
  } catch {
    return null;
  }
}

/** Drop the captured payload from localStorage. Called once the row has been
 * inserted into `user_acquisition` so a same-browser re-login of the same
 * user (or another user) doesn't duplicate the insert. */
export function clearAcquisition(): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
}

/**
 * Persist the captured payload to `public.user_acquisition` for the given
 * user. Best-effort:
 *   • returns silently if nothing was captured
 *   • swallows any DB error (RLS, conflict on PK, network) so signup
 *     callers never crash because of tracking
 *
 * Idempotent at the call-site level: on success we clear localStorage so a
 * second call (e.g. accidental React re-mount) becomes a no-op. The PK on
 * user_id also protects against duplicate rows if the clear didn't happen.
 */
export async function flushAcquisition(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  if (!userId) return;
  const data = readAcquisition();
  if (!data) return;
  try {
    const { error } = await supabase
      .from("user_acquisition")
      .insert({
        user_id:      userId,
        source:       data.source,
        medium:       data.medium,
        campaign:     data.campaign,
        content:      data.content,
        term:         data.term,
        referrer:     data.referrer,
        landing_path: data.landing_path,
      });
    if (!error) clearAcquisition();
  } catch {
    // Never block / break signup on a tracking failure.
  }
}

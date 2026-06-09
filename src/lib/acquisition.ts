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

const STORAGE_KEY      = "acq";
const VISITOR_ID_KEY   = "acq_visitor_id";
const CLICK_COOLDOWN_PREFIX = "acq_click_";
// One ping per UTM combo per 30 minutes per browser — drops accidental
// duplicates from refreshes / back-button navigation.
const CLICK_COOLDOWN_MS = 30 * 60 * 1000;

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
 * Read or lazily create an anonymous visitor id (UUID v4) stored in
 * localStorage. Lets us count "unique visitors per campaign" without ever
 * knowing who the visitor is. Resets if the user clears their storage.
 */
export function getOrCreateVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    // Use crypto.randomUUID when available (modern browsers); fallback to
    // a sufficiently-random hex string for older ones.
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    window.localStorage.setItem(VISITOR_ID_KEY, id);
    return id;
  } catch {
    return null;
  }
}

/**
 * Push the current UTM data to Microsoft Clarity as custom tags so the user
 * can filter sessions / recordings by source / medium / campaign in the
 * Clarity dashboard. Idempotent (Clarity itself dedupes tag writes per
 * session). Silent no-op if Clarity hasn't loaded yet — the call is queued
 * via Clarity's own bootstrap shim and replayed when the bundle initializes.
 */
function tagClarityWithUTM(payload: {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
}): void {
  if (typeof window === "undefined") return;
  const c = (window as unknown as { clarity?: (...args: unknown[]) => void }).clarity;
  if (typeof c !== "function") return;
  try {
    if (payload.source)   c("set", "utm_source",   payload.source);
    if (payload.medium)   c("set", "utm_medium",   payload.medium);
    if (payload.campaign) c("set", "utm_campaign", payload.campaign);
  } catch {
    // Never let Clarity break the page.
  }
}

/**
 * Send one click ping to /api/track-click for the CURRENT URL's UTM data
 * (not the first-touch snapshot — clicks are per-landing, not per-attribution).
 * Throttled per UTM-combo per browser via a localStorage timestamp to avoid
 * spam from refreshes / back-forward navigation.
 *
 * Also pushes the UTM values to Clarity so the dashboard's "Custom tags"
 * filter list is populated. Both side-effects are best-effort.
 */
export function trackClickIfUTM(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = (k: string): string | null => {
      const v = params.get(k);
      return v && v.trim() ? v.trim() : null;
    };

    const source   = utm("utm_source");
    const medium   = utm("utm_medium");
    const campaign = utm("utm_campaign");
    const content  = utm("utm_content");
    const term     = utm("utm_term");
    const referrer = document.referrer || null;

    // Tag Clarity unconditionally when UTMs exist — populates filter dropdowns
    // even for visitors who never sign up.
    if (source || medium || campaign) {
      tagClarityWithUTM({ source, medium, campaign });
    }

    // Skip pure noise: no UTM AND no referrer = direct-typed, not a "click".
    if (!source && !referrer) return;

    // Cooldown: skip if we've already pinged for this UTM combo in the
    // last CLICK_COOLDOWN_MS for this browser.
    const utmKey = [source, medium, campaign, content].join("|");
    const flagKey = `${CLICK_COOLDOWN_PREFIX}${utmKey}`;
    let last = 0;
    try { last = parseInt(window.localStorage.getItem(flagKey) || "0", 10) || 0; } catch {}
    const now = Date.now();
    if (now - last < CLICK_COOLDOWN_MS) return;
    try { window.localStorage.setItem(flagKey, String(now)); } catch {}

    const payload = {
      visitor_id:   getOrCreateVisitorId(),
      source, medium, campaign, content, term,
      referrer,
      landing_path: window.location.pathname || null,
    };

    // Fire-and-forget. keepalive lets the browser finish the request even
    // if the user navigates away immediately.
    fetch("/api/track-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Silent — analytics must never break the page.
  }
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

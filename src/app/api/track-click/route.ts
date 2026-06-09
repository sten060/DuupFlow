import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/track-click
 *
 * Records a landing-page click into public.acquisition_clicks. Called by
 * the browser-side AcquisitionTracker the first time a UTM-tagged URL is
 * loaded in a given session (the client throttles re-tries to avoid spam).
 *
 * Best-effort: any failure returns 200 with `{ ok: true }` so the tracker
 * never has to retry — losing one click is never worth slowing a page load.
 *
 * Payload contract:
 *   {
 *     visitor_id?  : string  (uuid generated and stored in localStorage)
 *     source?      : string  (utm_source)
 *     medium?      : string  (utm_medium)
 *     campaign?    : string  (utm_campaign)
 *     content?     : string  (utm_content)
 *     term?        : string  (utm_term)
 *     referrer?    : string  (document.referrer)
 *     landing_path?: string  (window.location.pathname)
 *   }
 *
 * If the payload carries no `source` AND no `referrer`, we skip — that's
 * a direct-typed visit with nothing to attribute.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      visitor_id, source, medium, campaign,
      content, term, referrer, landing_path,
    } = body ?? {};

    // Reject totally empty pings (no UTM, no referrer) — pure noise.
    if (!source && !referrer) {
      return NextResponse.json({ ok: true });
    }

    // Truncate to keep abuse out of the table (longest legit value ~ 200 chars).
    const trim = (v: unknown): string | null => {
      if (typeof v !== "string") return null;
      const t = v.trim();
      if (!t) return null;
      return t.slice(0, 500);
    };

    const admin = createAdminClient();
    await admin.from("acquisition_clicks").insert({
      visitor_id:   trim(visitor_id),
      source:       trim(source),
      medium:       trim(medium),
      campaign:     trim(campaign),
      content:      trim(content),
      term:         trim(term),
      referrer:     trim(referrer),
      landing_path: trim(landing_path),
    });
  } catch {
    // Never block / never crash — tracking failures must not bubble up.
  }
  return NextResponse.json({ ok: true });
}

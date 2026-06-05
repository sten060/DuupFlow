"use client";

/**
 * Tags the current Microsoft Clarity session with non-PII attributes so we
 * can filter session replays by user segment in the Clarity dashboard.
 *
 * What gets tagged (NO email, NO content):
 *   • plan      'free' | 'solo' | 'pro'
 *   • segment   'fantome' | 'active' | 'payant'
 *   • identify  user_id (Supabase auth uid) — lets us cross-reference replays
 *               with Supabase usage events / Stripe customer
 *
 * Segment definition mirrors the analytics views (mig. 025):
 *   • payant  → has_paid AND NOT payment_overdue AND plan IN (solo,pro)
 *   • active  → at least one live action in usage_events, but not payant
 *   • fantome → no live action at all
 *
 * The component is rendered by the dashboard layout, so it only runs once
 * per page-load for authenticated dashboard users. It does NOT fetch anything
 * client-side — props are computed server-side and passed down.
 *
 * Implementation notes:
 *   • Clarity's bootstrap IIFE in src/app/layout.tsx defines `window.clarity`
 *     as a queue-pushing function the moment its script tag is parsed. Any
 *     call we make before the real Clarity bundle finishes loading is queued
 *     and replayed automatically — so we don't need a "wait for clarity" loop.
 *   • We still guard with `typeof window.clarity === "function"` to avoid a
 *     ReferenceError in case the script is blocked (ad-blockers, CSP).
 */

import { useEffect } from "react";

type ClarityFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    clarity?: ClarityFn;
  }
}

export type ClaritySegment = "fantome" | "active" | "payant";
export type ClarityPlan = "free" | "solo" | "pro";

export default function ClaritySessionTags({
  userId,
  plan,
  segment,
}: {
  userId: string;
  plan: ClarityPlan;
  segment: ClaritySegment;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const clarity = window.clarity;
    if (typeof clarity !== "function") return;

    try {
      // Custom tags — filterable in Clarity → Filters → Custom tags.
      clarity("set", "plan", plan);
      clarity("set", "segment", segment);

      // identify(customId, customSessionId?, customPageId?, friendlyName?)
      // We pass only the Supabase user id. No email or display name (PII).
      clarity("identify", userId);
    } catch {
      // Never let Clarity break the dashboard.
    }
  }, [userId, plan, segment]);

  return null;
}

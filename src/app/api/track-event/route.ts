import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/track-event
 *
 * Records an anonymous LP behaviour event into public.web_events. Called by
 * the browser-side track() helper (page_viewed / scroll_depth / click).
 *
 * The visitor_id MUST be the same one used for acquisition_clicks
 * (localStorage "acq_visitor_id" via getOrCreateVisitorId) so an arrival can
 * be joined to the actions that follow it within the journey window.
 *
 * Best-effort: any failure returns 200 so the tracker never retries — losing
 * one event is never worth slowing a page load.
 *
 * Payload:
 *   { name: string, visitor_id: string, context?: Record<string, unknown> }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, visitor_id, context } = body ?? {};

    const trim = (v: unknown): string | null => {
      if (typeof v !== "string") return null;
      const t = v.trim();
      if (!t) return null;
      return t.slice(0, 80);
    };

    const cleanName = trim(name);
    const cleanVisitor = trim(visitor_id);
    // No name or no visitor → nothing we can join later. Skip.
    if (!cleanName || !cleanVisitor) {
      return NextResponse.json({ ok: true });
    }

    // Keep context a small flat object — never trust the client blindly.
    const safeContext =
      context && typeof context === "object" && !Array.isArray(context)
        ? context
        : {};

    const admin = createAdminClient();
    await admin.from("web_events").insert({
      name: cleanName,
      visitor_id: cleanVisitor,
      context: safeContext,
    });
  } catch {
    // Never block / never crash — tracking failures must not bubble up.
  }
  return NextResponse.json({ ok: true });
}

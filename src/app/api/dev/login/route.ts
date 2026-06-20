import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

// ────────────────────────────────────────────────────────────────────────
// LOCAL-ONLY dev login. Visit /api/dev/login while running `npm run dev`:
// it provisions a throwaway Pro account and signs you straight into the
// dashboard (no Google / magic-link round-trip). Hard-disabled in production.
// Safe to delete once you no longer need it.
// ────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

const DEV_EMAIL = "devlocal@duupflow.com";
const DEV_PASSWORD = "DuupDev!2024";

function isLocal(req: NextRequest): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const host = req.headers.get("host") ?? "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

export async function GET(req: NextRequest) {
  if (!isLocal(req)) {
    return new NextResponse("Not available", { status: 404 });
  }

  const admin = createAdminClient();

  // 1) Ensure the dev auth user exists with a known password + confirmed email.
  let userId: string | null = null;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
    email_confirm: true,
  });
  if (created?.user) {
    userId = created.user.id;
  } else {
    // Already exists → locate it, then (re)set password + confirm in case it
    // was first created via OAuth (no password).
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      userId = list?.users.find((u) => u.email === DEV_EMAIL)?.id ?? null;
      if (!list || list.users.length < 1000) break;
    }
    if (userId) {
      await admin.auth.admin.updateUserById(userId, {
        password: DEV_PASSWORD,
        email_confirm: true,
      });
    }
  }
  if (!userId) {
    return NextResponse.json(
      { error: "could not provision dev user", detail: createErr?.message ?? null },
      { status: 500 },
    );
  }

  // 2) Ensure a profile (Pro so every module is unlocked for testing). Mirrors
  // the fields written by /api/onboarding/complete to satisfy NOT NULL columns.
  await admin.from("profiles").upsert({
    id: userId,
    first_name: "Dev",
    agency_name: "Dev Local",
    is_guest: false,
    plan: "pro",
    email_sequence: "free",
    email_sequence_updated_at: new Date().toISOString(),
    variation_ia_announced_at: new Date().toISOString(),
    onboarding_platforms: [],
    onboarding_source: null,
  });

  // Reset onboarding so the auto first-time flow shows. Best-effort: needs
  // migration 033. If the column doesn't exist yet, login still works and you
  // can preview everything via the "Revoir la visite" button on the dashboard.
  await admin.from("profiles").update({ onboarding_progress: {} }).eq("id", userId);

  // 3) Sign in on a response-bound client so the refreshed session cookies
  // ride along with the redirect (canonical @supabase/ssr pattern).
  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    },
  );
  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
  });
  if (signErr) {
    return NextResponse.json({ error: signErr.message }, { status: 500 });
  }

  return res;
}

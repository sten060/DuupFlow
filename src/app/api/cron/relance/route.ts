/**
 * Daily cron — sends a J+1 relance email to free users who signed up
 * more than 24h ago and haven't paid yet.
 *
 * Called automatically by Vercel Cron at 10:00 UTC every day.
 * Protected by CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRelanceEmail } from "@/lib/emails";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Free users who signed up between 24h and 48h ago (to avoid sending twice)
  const now = new Date();
  const from = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const to   = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, first_name")
    .eq("email_sequence", "free")
    .gte("email_sequence_updated_at", from)
    .lte("email_sequence_updated_at", to);

  if (error) {
    console.error("[cron/relance] Supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!profiles?.length) {
    return NextResponse.json({ sent: 0 });
  }

  // Fetch email addresses from auth.users
  let sent = 0;
  await Promise.allSettled(
    profiles.map(async (profile) => {
      const { data } = await admin.auth.admin.getUserById(profile.id);
      const email = data?.user?.email;
      if (!email) return;
      await sendRelanceEmail(email, profile.first_name ?? "");
      sent++;
    })
  );

  console.log(`[cron/relance] Sent relance to ${sent}/${profiles.length} free users`);
  return NextResponse.json({ sent });
}

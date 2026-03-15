// GET /api/cron/cleanup
// Called by Railway's HTTP cron or any uptime monitor.
// Secured by CRON_SECRET env var — requests must pass
//   Authorization: Bearer <CRON_SECRET>
// Set CRON_SECRET to any long random string in Railway env vars.

import { NextRequest, NextResponse } from "next/server";
import { cleanupOldFiles } from "@/app/dashboard/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const maxAgeHours = Number(req.nextUrl.searchParams.get("hours") ?? "2");
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

  const deleted = await cleanupOldFiles(maxAgeMs);
  console.log(`[cron/cleanup] deleted ${deleted} files older than ${maxAgeHours}h`);

  return NextResponse.json({ ok: true, deleted, maxAgeHours });
}

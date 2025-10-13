import { NextResponse } from "next/server";

// (Render pings this route; just return 200)
export async function GET() {
  return NextResponse.json({ ok: true, uptime: process.uptime() });
}
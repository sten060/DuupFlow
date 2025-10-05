// src/app/api/out/clear/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export async function GET() {
  const supabase = createClient();
  const bucket = process.env.SUPABASE_BUCKET!;

  const { data: list, error } = await supabase.storage.from(bucket).list("", { limit: 500 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const names = (list ?? []).map((o) => o.name!).filter(Boolean);
  if (names.length === 0) return NextResponse.json({ ok: true, deleted: 0 });

  const { error: delErr } = await supabase.storage.from(bucket).remove(names);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: names.length });
}
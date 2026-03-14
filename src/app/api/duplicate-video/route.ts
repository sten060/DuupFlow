import { NextResponse } from "next/server";
import { processVideos } from "@/app/dashboard/videos/processVideos";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const channel = await processVideos(formData);
    return NextResponse.json({ ok: true, channel });
  } catch (e: any) {
    console.error("duplicate-video error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Erreur" }, { status: 500 });
  }
}

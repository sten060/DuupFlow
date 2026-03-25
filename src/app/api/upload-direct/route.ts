import os from "os";
import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

// Guard: only alphanumeric, dash, underscore, dot, space — prevents path traversal
function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._\- ]/g, "_").slice(0, 200);
}

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!req.body) {
    return NextResponse.json({ error: "Corps de la requête manquant" }, { status: 400 });
  }

  const fileName = safeName(req.nextUrl.searchParams.get("fileName") || "upload.bin");
  const ext = path.extname(fileName) || ".mp4";
  const uploadId = `duup_direct_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
  const tmpPath = path.join(os.tmpdir(), uploadId);

  try {
    // Use arrayBuffer() instead of Readable.fromWeb() — avoids the Node.js
    // TransformStream bug (controller[kState].transformAlgorithm is not a function)
    // that crashes under concurrent parallel uploads.
    const buffer = Buffer.from(await req.arrayBuffer());
    await fs.writeFile(tmpPath, buffer);
  } catch (e: any) {
    return NextResponse.json({ error: `Erreur écriture : ${e.message}` }, { status: 500 });
  }

  return NextResponse.json({ uploadId, name: fileName });
}

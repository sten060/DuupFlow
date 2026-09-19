// POST /api/ai-editor/edit/caption  (JSON { caption, aspect? }) → image/png
// Rasterise UNE caption avec le MOTEUR DE RENDU (captionPng) : l'aperçu de
// l'éditeur manuel affiche exactement ce que l'export incrustera — pas une
// imitation navigateur. Le PNG couvre tout le cadre (position comprise) :
// le client le pose en calque plein cadre sur le lecteur.
//
// Coût : ~100 ms de sharp par rendu. Le client débounce et met en cache ;
// on borne quand même la taille du JSON pour ne pas rasteriser n'importe quoi.

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { captionPng } from "@/lib/ai-editor/render";
import type { EditCaption } from "@/lib/ai-editor/plan-types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CANVAS: Record<string, [number, number]> = { "9:16": [1080, 1920], "1:1": [1080, 1080], "16:9": [1920, 1080] };

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const raw = await req.text().catch(() => "");
  if (raw.length > 20_000) return NextResponse.json({ error: "Caption trop volumineuse." }, { status: 413 });
  let body: { caption?: EditCaption; aspect?: string };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  const c = body.caption;
  if (!c || typeof c !== "object" || (typeof c.text !== "string" && !Array.isArray(c.spans))) {
    return NextResponse.json({ error: "Caption manquante." }, { status: 400 });
  }
  const [W, H] = CANVAS[body.aspect ?? "9:16"] ?? CANVAS["9:16"];

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "duup_capprev_"));
  const out = path.join(dir, "caption.png");
  try {
    await captionPng(c, W, H, out);
    const buf = await fs.readFile(out);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" },
    });
  } catch (e) {
    console.error("[ai-editor/edit/caption] rasterisation échouée:", (e as Error)?.message);
    return NextResponse.json({ error: "Rendu de la caption impossible." }, { status: 422 });
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

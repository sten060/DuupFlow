// Vignette d'une image jointe à la conversation du Claude intégré.

import { NextRequest, NextResponse } from "next/server";
import { chatContext } from "@/lib/ai-editor/chat-context";
import { getLatestProject } from "@/lib/ai-editor/store";
import { readChatImage } from "@/lib/ai-editor/builtin-chat";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const c = await chatContext(req);
  if ("error" in c) return c.error;
  const project = await getLatestProject(c.scope.storeKey);
  const img = project ? await readChatImage(c.scope.storeKey, project.id, params.id) : null;
  if (!img) return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  return new NextResponse(new Uint8Array(img.buf), { headers: { "Content-Type": img.mime, "Cache-Control": "private, max-age=86400" } });
}

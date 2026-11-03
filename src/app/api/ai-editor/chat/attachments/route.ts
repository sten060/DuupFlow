// /api/ai-editor/chat/attachments — images jointes à un message du Claude
// intégré. POST multipart { file } → { id } ; l'id est ensuite passé dans
// POST /api/ai-editor/chat { images: [id] }. Images seulement (pas de vidéos).

import { NextRequest, NextResponse } from "next/server";
import { chatContext } from "@/lib/ai-editor/chat-context";
import { getLatestProject, createProject } from "@/lib/ai-editor/store";
import { saveChatImage, MAX_CHAT_IMAGE_BYTES } from "@/lib/ai-editor/builtin-chat";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const c = await chatContext(req);
  if ("error" in c) return c.error;
  // Refus AVANT de lire le corps : formData() garde tout en mémoire.
  if (Number(req.headers.get("content-length") || 0) > MAX_CHAT_IMAGE_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "Image trop lourde (5 Mo max).", code: "IMAGE_TOO_BIG" }, { status: 413 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucune image reçue.", code: "IMAGE_NONE" }, { status: 400 });
  if (file.size > MAX_CHAT_IMAGE_BYTES) return NextResponse.json({ error: "Image trop lourde (5 Mo max).", code: "IMAGE_TOO_BIG" }, { status: 413 });
  const project = (await getLatestProject(c.scope.storeKey)) ?? (await createProject(c.scope.storeKey));
  const id = await saveChatImage(c.scope.storeKey, project.id, Buffer.from(await file.arrayBuffer()));
  if (!id) return NextResponse.json({ error: "Seules les images JPG, PNG ou WebP sont acceptées.", code: "IMAGE_TYPE" }, { status: 415 });
  return NextResponse.json({ id });
}

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { editorScopeForUser } from "@/lib/ai-editor/scope";
import { aiEditorOpenFor } from "@/lib/ai-editor/access";
import { ingestDuplicates, isPlainOutName, SEND_TO_EDITOR_MAX } from "@/lib/ai-editor/mcp-duplicate";
import { readableOutKeys, OUT_BASE } from "@/app/dashboard/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/* « Envoyer vers l'éditeur » des pages Duplication : les copies choisies
   deviennent de la matière du projet en cours de l'Éditeur IA — exactement
   ce que fait Claude avec send_duplicates_to_editor, mais à la main. */

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  return user;
}

/** Le bouton s'affiche-t-il ? (éditeur ouvert à ce compte) + la limite par envoi. */
export async function GET() {
  const user = await currentUser();
  return NextResponse.json({ available: !!user && aiEditorOpenFor(user.email), max: SEND_TO_EDITOR_MAX });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!aiEditorOpenFor(user.email)) return NextResponse.json({ error: "L'Éditeur IA n'est pas encore ouvert sur ce compte." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const urls: string[] = Array.isArray(body?.urls) ? body.urls.filter((u: unknown): u is string => typeof u === "string") : [];
  if (!urls.length) return NextResponse.json({ error: "Aucun fichier." }, { status: 400 });
  if (urls.length > SEND_TO_EDITOR_MAX) {
    return NextResponse.json({ error: `Maximum ${SEND_TO_EDITOR_MAX} fichiers par envoi.`, code: "TOO_MANY", max: SEND_TO_EDITOR_MAX }, { status: 400 });
  }

  // Chaque lien = /api/out/<dossier>/<fichier> d'un dossier que ce compte peut lire
  // (vue admin : ceux de tous ses créateurs).
  const files: { absPath: string; name: string }[] = [];
  const refused: string[] = [];
  const readable = await readableOutKeys(user.id);
  for (const u of urls) {
    const m = /^\/api\/out\/([\w-]+)\/([^/?#]+)/.exec(u);
    const name = m ? decodeURIComponent(m[2]) : "";
    if (!m || !isPlainOutName(name) || !readable.has(m[1])) { refused.push(name || u); continue; }
    files.push({ absPath: path.join(OUT_BASE, m[1], name), name });
  }

  // Destination : l'éditeur de l'espace affiché (créateur, ou vue admin).
  const { storeKey } = await editorScopeForUser(user.id, req);
  const { projectId, results } = files.length
    ? await ingestDuplicates(storeKey, files, "Copie dupliquée par DuupFlow", "dashboard/send_to_editor")
    : { projectId: null, results: [] };
  const all = [...results, ...refused.map((name) => ({ name, ok: false as const, error: "fichier non accessible." }))];
  return NextResponse.json({ projectId, added: all.filter((r) => r.ok).length, results: all });
}

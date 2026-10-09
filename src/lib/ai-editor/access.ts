// src/lib/ai-editor/access.ts
//
// Qui voit l'Éditeur IA ? Même règle que la page /dashboard/ai-editor :
// liste blanche (AI_EDITOR_ALLOWLIST), sinon ouvert à tous si AI_EDITOR_LIVE=1.

export function aiEditorOpenFor(email: string | null | undefined): boolean {
  const e = (email || "").trim().toLowerCase();
  const allowlist = (process.env.AI_EDITOR_ALLOWLIST || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (e && allowlist.includes(e)) return true;
  return process.env.AI_EDITOR_LIVE === "1";
}

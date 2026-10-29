// GET /api/dashboard/activity — données du dashboard d'accueil.
//
//   ?metric=duplications | edits   → courbe (buckets) + total
//          &range=today | 7d | 30d  → aujourd'hui (par heure) ou N jours (par jour)
//          &ws=all | <workspaceId>  → filtre créateur
//          &tz=<minutes>            → Date.getTimezoneOffset() du navigateur
//   ?metric=logs                    → dernières duplications de l'équipe
//
// Source : usage_events (une ligne par action livrée, cf. usage.ts). Périmètre :
// le propriétaire + ses invités (un VA ne voit que sa propre activité).
//
// Courbe Duplications = video_duplication SAUF les rendus de l'Éditeur IA, qui
// consomment aussi le quota vidéo :
//   · lignes récentes : meta.origin === "ai_editor" (migration 061) ;
//   · lignes anciennes (sans meta) : un ai_editor_render du même user écrit dans
//     les mêmes secondes (les deux sont tracés au même onDone).
// Vidéos éditées = ai_editor_render.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceContext } from "@/lib/workspaces";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Ev = {
  id: string;
  user_id: string;
  kind: string;
  qty: number;
  created_at: string;
  workspace_id?: string | null;
  meta?: { origin?: string; label?: string } | null;
};

const DAY = 24 * 60 * 60 * 1000;
const PAIR_WINDOW_MS = 15_000;
const MAX_ROWS = 10_000;

/** Le user, son équipe et ses créateurs visibles. */
async function scopeFor(userId: string) {
  const admin = createAdminClient();
  const ctx = await getWorkspaceContext(userId);
  const ownerId = ctx.ownerId ?? userId;

  // Un VA ne voit que sa propre activité ; tous les autres voient l'équipe.
  let team: string[] = [userId];
  if (!(ctx.enabled && ctx.role === "va")) {
    const { data: invs } = await admin
      .from("team_invitations")
      .select("guest_user_id")
      .eq("host_user_id", ownerId)
      .eq("status", "accepted");
    const guests = ((invs ?? []) as { guest_user_id: string | null }[])
      .map((i) => i.guest_user_id)
      .filter((id): id is string => !!id);
    team = Array.from(new Set([ownerId, ...guests]));
  }

  const workspaces = ctx.enabled
    ? ctx.workspaces.map((w) => ({ id: w.id, name: w.name, color: w.color }))
    : [];
  return { team, workspaces };
}

/** Les événements des 30 derniers jours (créateur + provenance si dispo). */
async function loadEvents(team: string[], sinceMs: number): Promise<Ev[]> {
  const admin = createAdminClient();
  const since = new Date(sinceMs).toISOString();
  const kinds = ["video_duplication", "image_duplication", "ai_editor_render"];
  const base = (cols: string) =>
    admin
      .from("usage_events")
      .select(cols)
      .in("user_id", team)
      .in("kind", kinds)
      .eq("source", "live")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);

  const full = await base("id, user_id, kind, qty, created_at, workspace_id, meta");
  if (!full.error) return (full.data ?? []) as unknown as Ev[];
  // Migration 061 pas encore appliquée : pas de créateur ni de provenance.
  const lite = await base("id, user_id, kind, qty, created_at");
  return (lite.data ?? []) as unknown as Ev[];
}

/** Une ligne video_duplication est-elle en fait un rendu de l'Éditeur IA ? */
function editorRenderMatcher(events: Ev[]) {
  const renders = new Map<string, number[]>();
  for (const e of events) {
    if (e.kind !== "ai_editor_render") continue;
    const list = renders.get(e.user_id) ?? [];
    list.push(Date.parse(e.created_at));
    renders.set(e.user_id, list);
  }
  return (e: Ev): boolean => {
    if (e.meta?.origin === "ai_editor") return true;
    if (e.meta?.origin) return false; // provenance connue et ≠ éditeur
    const t = Date.parse(e.created_at);
    return (renders.get(e.user_id) ?? []).some((r) => Math.abs(r - t) <= PAIR_WINDOW_MS);
  };
}

/** Début (UTC ms) du jour local contenant `ms`, pour un décalage `tz` (min). */
function localDayStart(ms: number, tz: number): number {
  const local = ms - tz * 60_000;
  return local - (((local % DAY) + DAY) % DAY) + tz * 60_000;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const metric = sp.get("metric") ?? "duplications";
  const range = sp.get("range") === "today" ? "today" : sp.get("range") === "30d" ? "30d" : "7d";
  const ws = sp.get("ws") || "all";
  const tzRaw = Number(sp.get("tz"));
  const tz = Number.isFinite(tzRaw) && Math.abs(tzRaw) <= 14 * 60 ? tzRaw : 0;

  const now = Date.now();
  const { team, workspaces } = await scopeFor(user.id);
  const events = await loadEvents(team, now - 31 * DAY);
  const isEditorRender = editorRenderMatcher(events);

  // ── Journal des dernières duplications ────────────────────────────────────
  if (metric === "logs") {
    const items = events
      .filter((e) => e.kind === "image_duplication" || (e.kind === "video_duplication" && !isEditorRender(e)))
      .slice(0, 12);
    const ids = Array.from(new Set(items.map((e) => e.user_id)));
    const names = new Map<string, string | null>();
    if (ids.length) {
      const { data } = await createAdminClient().from("profiles").select("id, first_name").in("id", ids);
      for (const p of (data ?? []) as { id: string; first_name: string | null }[]) names.set(p.id, p.first_name);
    }
    const wsById = new Map(workspaces.map((w) => [w.id, w]));
    return NextResponse.json({
      items: items.map((e) => ({
        id: e.id,
        at: e.created_at,
        type: e.kind === "image_duplication" ? "image" : "video",
        qty: e.qty,
        who: { isMe: e.user_id === user.id, name: names.get(e.user_id) ?? null },
        creator: e.workspace_id ? wsById.get(e.workspace_id) ?? null : null,
        label: e.meta?.label ?? null,
        origin: e.meta?.origin ?? null,
      })),
    });
  }

  // ── Courbe ────────────────────────────────────────────────────────────────
  const pick = (e: Ev) =>
    metric === "edits"
      ? e.kind === "ai_editor_render"
      // Courbe = duplications VIDÉO uniquement (décision Sten) ; le journal,
      // lui, montre aussi les images.
      : e.kind === "video_duplication" && !isEditorRender(e);
  const inWs = (e: Ev) => ws === "all" || e.workspace_id === ws;

  const today = localDayStart(now, tz);
  const buckets: { t: string; v: number }[] = [];
  let start: number;
  let step: number;
  if (range === "today") {
    start = today;
    step = 60 * 60 * 1000;
    // Seulement les heures déjà écoulées : les heures à venir feraient
    // retomber la courbe à zéro.
    const hours = Math.min(24, Math.floor((now - start) / step) + 1);
    for (let h = 0; h < hours; h++) buckets.push({ t: new Date(start + h * step).toISOString(), v: 0 });
  } else {
    const n = range === "30d" ? 30 : 7;
    start = today - (n - 1) * DAY;
    step = DAY;
    for (let d = 0; d < n; d++) buckets.push({ t: new Date(start + d * DAY).toISOString(), v: 0 });
  }

  let total = 0;
  // Activité plus ancienne que la période affichée (sur les 31 derniers jours) :
  // le dashboard dit alors « rien sur cette période » plutôt que « pas encore
  // d'activité », qui laissait croire que l'historique avait disparu.
  let hasHistory = false;
  for (const e of events) {
    if (pick(e) && inWs(e)) hasHistory = true;
  }
  for (const e of events) {
    if (!pick(e) || !inWs(e)) continue;
    const t = Date.parse(e.created_at);
    if (t < start) continue;
    const i = Math.floor((t - start) / step);
    if (i < 0 || i >= buckets.length) continue;
    buckets[i].v += e.qty;
    total += e.qty;
  }

  return NextResponse.json({ metric, range, buckets, total, hasHistory, workspaces });
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/lib/i18n/context";
import {
  WorkspaceAvatar,
  switchCreator,
  WORKSPACES_CHANGED,
  type WorkspacesPayload,
  type WorkspaceItem,
} from "../components/WorkspaceSwitcher";

/* Page « Tes créateurs » (workspaces Pro & Agence).

   FLUIDITÉ : chaque action met l'écran à jour TOUT DE SUITE (optimiste), la
   requête part en arrière-plan, et l'état est rétabli si le serveur refuse.
   Jamais de router.refresh() ici : il relançait tout le rendu serveur du
   dashboard à chaque clic. Le sélecteur de la sidebar est prévenu par
   l'évènement WORKSPACES_CHANGED (detail.from = "page" → on ne se recharge pas
   soi-même). */

type Member = { userId: string; email: string; name: string | null; role: "manager" | "va"; workspaceIds: string[] };
type Payload = WorkspacesPayload & { team: Member[]; unavailable?: boolean; driveConnected?: boolean; driveConfigured?: boolean };
type T = (k: string, v?: Record<string, string | number>) => string;

// Même palette que src/lib/workspaces.ts (WORKSPACE_COLORS) — le serveur valide.
const COLORS = ["#6366F1", "#A78BFA", "#EC4899", "#F43F5E", "#F59E0B", "#10B981", "#14B8A6", "#38BDF8", "#64748B"];
const BRIEF_MAX = 4000;

const SURFACE = { background: "var(--app-surface)", border: "1px solid var(--app-border)" } as const;
const SUBTLE = { background: "var(--app-surface-2)", border: "1px solid var(--app-border)" } as const;
const INPUT = { background: "var(--app-bg)", border: "1px solid var(--app-border-strong)" } as const;
const GRADIENT = "linear-gradient(135deg,#6366F1,#38BDF8)";

/** Prévient le sélecteur de la sidebar sans que la page se recharge elle-même. */
function notifySidebar() {
  window.dispatchEvent(new CustomEvent(WORKSPACES_CHANGED, { detail: { from: "page" } }));
}

/** Requête JSON → { ok, data } ; jamais d'exception. */
async function api(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: {} };
  }
}

/* ── Petites briques ─────────────────────────────────────────────────────── */

function Modal({ title, onClose, children, width = "max-w-2xl" }: { title: string; onClose: () => void; children: React.ReactNode; width?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4"
      style={{ background: "rgba(8,10,20,0.55)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className={`w-full ${width} max-h-[90vh] overflow-y-auto rounded-2xl p-7 sm:p-8`}
        style={{ background: "linear-gradient(var(--app-surface), var(--app-surface)), var(--app-bg)", border: "1px solid var(--app-border)", boxShadow: "0 30px 80px rgba(0,0,0,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <h2 className="text-xl font-bold tracking-tight text-[var(--app-text)]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer"
            className="h-9 w-9 -mr-2 -mt-1 rounded-xl flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-surface-2)] transition">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function Btn({
  children, onClick, variant = "secondary", color, disabled, type = "button", className = "",
}: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "dangerSolid";
  color?: string; disabled?: boolean; type?: "button" | "submit"; className?: string;
}) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50";
  if (variant === "primary") {
    return <button type={type} onClick={onClick} disabled={disabled} className={`${base} text-white hover:brightness-110 ${className}`} style={{ background: color ?? GRADIENT }}>{children}</button>;
  }
  if (variant === "dangerSolid") {
    return <button type={type} onClick={onClick} disabled={disabled} className={`${base} text-white bg-red-600 hover:bg-red-700 ${className}`}>{children}</button>;
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} text-[var(--app-text)] hover:bg-[var(--app-surface-2)] ${className}`}
      style={{ border: "1px solid var(--app-border-strong)" }}>
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--app-text-faint)] mb-2">{children}</p>;
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function WorkspacesClient({ initial }: { initial?: Payload }) {
  const { t } = useTranslation();
  const [data, setData] = useState<Payload | null>(initial ?? null);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fenêtres : création / édition, brief, assignation des VA, suppression.
  const [editing, setEditing] = useState<{ id: string | null; name: string; color: string } | null>(null);
  const [briefFor, setBriefFor] = useState<{ ws: WorkspaceItem; text: string } | null>(null);
  const [assigning, setAssigning] = useState<{ ws: WorkspaceItem; userIds: string[] } | null>(null);
  const [deleting, setDeleting] = useState<WorkspaceItem | null>(null);
  // Images du brief (chargées à l'ouverture de la fenêtre du brief).
  const [briefImages, setBriefImages] = useState<{ id: string; name: string }[] | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  // Vidéos qui marchent (analysées en tâche de fond côté serveur).
  type BriefVideoItem = { id: string; name: string; durationSec: number; status: "analyzing" | "ready" | "failed"; error?: string };
  const [briefVideos, setBriefVideos] = useState<BriefVideoItem[] | null>(null);
  const [vidBusy, setVidBusy] = useState<string | null>(null); // nom du fichier en cours d'envoi
  const [vidError, setVidError] = useState<string | null>(null);

  // Retour de la fenêtre Google (?drive=connected|denied|…) → petit message.
  const [driveNotice, setDriveNotice] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("drive");
    if (!q) return;
    const ok = q === "connected";
    setDriveNotice({ ok, text: ok ? t("dashboard.workspaces.driveConnectedNotice") : t(`dashboard.drive.${q === "denied" ? "denied" : q === "scope" ? "scope" : "error"}`) });
    window.history.replaceState({}, "", window.location.pathname);
  }, [t]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initial) load(); // données déjà rendues par le serveur → pas de second chargement
    // Changement venu de la sidebar → on resynchronise ; les nôtres sont ignorés.
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { from?: string; workspaceId?: string } | undefined;
      if (detail?.from === "page") return;
      // Bascule depuis la sidebar : on met juste le badge « Actif » à jour, instantanément.
      if (detail?.from === "switcher" && detail.workspaceId) {
        const id = detail.workspaceId;
        setData((d) => (d ? { ...d, activeId: id } : d));
        return;
      }
      load();
    };
    window.addEventListener(WORKSPACES_CHANGED, onChange);
    return () => window.removeEventListener(WORKSPACES_CHANGED, onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  /** Mise à jour optimiste : applique tout de suite, rétablit si le serveur refuse. */
  async function optimistic(apply: (d: Payload) => Payload, request: () => Promise<{ ok: boolean; data: Record<string, unknown> }>) {
    if (!data) return false;
    const before = data;
    setError(null);
    setData(apply(data));
    const r = await request();
    if (!r.ok) {
      setData(before);
      setError(String(r.data.error ?? t("dashboard.workspaces.errGeneric")));
      return false;
    }
    notifySidebar();
    return true;
  }

  if (loading) return <Skeleton />;

  if (data?.unavailable) {
    return (
      <div>
        <Header t={t} />
        <div className="rounded-2xl p-8 mt-8 text-[15px] font-medium text-[var(--app-text-muted)]" style={SURFACE}>
          {t("dashboard.workspaces.unavailable")}
        </div>
      </div>
    );
  }

  /* ── Plan sans workspaces : on explique et on montre la porte d'entrée. ── */
  if (!data?.enabled) {
    return (
      <div>
        <Header t={t} />
        <div className="rounded-2xl p-8 mt-8 max-w-3xl" style={SURFACE}>
          <h2 className="text-xl font-bold text-[var(--app-text)]">{t("dashboard.workspaces.upsellTitle")}</h2>
          <p className="mt-2 text-[15px] font-medium text-[var(--app-text-muted)] leading-relaxed">{t("dashboard.workspaces.upsellLead")}</p>
          <ul className="mt-5 space-y-2.5 text-[15px] font-medium text-[var(--app-text)]">
            <li>✅ {t("dashboard.workspaces.upsellPro")}</li>
            <li>✅ {t("dashboard.workspaces.upsellAgency")}</li>
            <li>✅ {t("dashboard.workspaces.upsellRoles")}</li>
          </ul>
          <Link href="/dashboard/abonnement?upgrade=1" className="mt-7 inline-flex rounded-xl px-5 py-3 text-sm font-bold text-white transition hover:brightness-110" style={{ background: GRADIENT }}>
            {t("dashboard.workspaces.upsellCta")}
          </Link>
        </div>
      </div>
    );
  }

  const canManage = data.role !== "va";
  const isOwner = data.role === "owner";
  const atLimit = data.total >= data.limit;
  const vas = data.team.filter((m) => m.role === "va");
  const pct = data.limit > 0 ? Math.min(100, Math.round((data.total / data.limit) * 100)) : 0;

  /* ── Actions (toutes optimistes) ── */

  function select(id: string) {
    // Même bascule que la sidebar (cookie + écrans + sidebar) — l'écouteur plus
    // haut met le badge « Actif » à jour.
    switchCreator(id);
  }

  async function submitEdit() {
    if (!editing || !editing.name.trim()) return;
    const name = editing.name.trim();
    const color = editing.color;
    if (editing.id) {
      const id = editing.id;
      setEditing(null);
      await optimistic(
        (d) => ({ ...d, workspaces: d.workspaces.map((w) => (w.id === id ? { ...w, name, color } : w)) }),
        () => api(`/api/workspaces/${id}`, "PATCH", { name, color }),
      );
      return;
    }
    // Création : il faut l'id du serveur → on attend la réponse (une requête).
    setSaving(true);
    const r = await api("/api/workspaces", "POST", { name, color });
    setSaving(false);
    if (!r.ok) { setError(String(r.data.error ?? t("dashboard.workspaces.errGeneric"))); return; }
    const ws = r.data.workspace as WorkspaceItem;
    setEditing(null);
    setData((d) => (d ? { ...d, workspaces: [...d.workspaces, ws], total: d.total + 1 } : d));
    notifySidebar(); // la sidebar recharge la liste (nouveau créateur)
    switchCreator(ws.id); // et on bascule dessus, partout
  }

  function openBrief(w: WorkspaceItem) {
    setBriefFor({ ws: w, text: w.brief ?? "" });
    setBriefImages(null);
    setImgError(null);
    void fetch(`/api/workspaces/${w.id}/brief-images`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setBriefImages(Array.isArray(d.images) ? d.images : []))
      .catch(() => setBriefImages([]));
    setBriefVideos(null);
    setVidError(null);
    void fetch(`/api/workspaces/${w.id}/brief-videos`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setBriefVideos(Array.isArray(d.videos) ? d.videos : []))
      .catch(() => setBriefVideos([]));
  }

  /** Met à jour le compteur de vidéos affiché sur la carte du créateur. */
  function setVideoCount(wsId: string, n: number) {
    setData((d) => (d ? { ...d, workspaces: d.workspaces.map((w) => (w.id === wsId ? { ...w, briefVideoCount: n } : w)) } : d));
  }

  // Tant qu'une vidéo s'analyse et que la fenêtre est ouverte : on relit son état.
  const briefWsId = briefFor?.ws.id ?? null;
  const analyzing = !!briefVideos?.some((v) => v.status === "analyzing");
  useEffect(() => {
    if (!briefWsId || !analyzing) return;
    const timer = setInterval(() => {
      void fetch(`/api/workspaces/${briefWsId}/brief-videos`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d.videos)) setBriefVideos(d.videos); })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [briefWsId, analyzing]);

  async function uploadBriefVideos(wsId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = 5 - (briefVideos?.length ?? 0);
    const list = Array.from(files).slice(0, Math.max(0, room));
    setVidError(null);
    if (list.length === 0) { setVidError(t("dashboard.workspaces.videosFull")); return; }
    // Une par une : chaque vidéo peut peser jusqu'à 300 Mo.
    for (const f of list) {
      setVidBusy(f.name);
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`/api/workspaces/${wsId}/brief-videos`, { method: "POST", body: fd }).then(async (res) => ({ ok: res.ok, d: await res.json().catch(() => ({})) })).catch(() => ({ ok: false, d: {} as Record<string, unknown> }));
      if (Array.isArray(r.d.videos)) { setBriefVideos(r.d.videos as BriefVideoItem[]); setVideoCount(wsId, (r.d.videos as unknown[]).length); }
      if (!r.ok) { setVidError(String(r.d.error ?? t("dashboard.workspaces.errGeneric"))); break; }
    }
    setVidBusy(null);
    if (files.length > list.length) setVidError(t("dashboard.workspaces.videosFull"));
  }

  async function deleteBriefVideo(wsId: string, videoId: string) {
    const before = briefVideos;
    const next = (briefVideos ?? []).filter((v) => v.id !== videoId);
    setBriefVideos(next); // optimiste
    setVideoCount(wsId, next.length);
    const r = await api(`/api/workspaces/${wsId}/brief-videos/${videoId}`, "DELETE");
    if (!r.ok) {
      setBriefVideos(before);
      setVideoCount(wsId, before?.length ?? 0);
      setVidError(String(r.data.error ?? t("dashboard.workspaces.errGeneric")));
    }
  }

  /** Met à jour le compteur d'images affiché sur la carte du créateur. */
  function setImageCount(wsId: string, n: number) {
    setData((d) => (d ? { ...d, workspaces: d.workspaces.map((w) => (w.id === wsId ? { ...w, briefImageCount: n } : w)) } : d));
  }

  async function uploadBriefImages(wsId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = 10 - (briefImages?.length ?? 0);
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (list.length === 0) { setImgError(t("dashboard.workspaces.imagesFull")); return; }
    setImgBusy(true);
    setImgError(null);
    const fd = new FormData();
    list.forEach((f) => fd.append("files", f));
    const r = await fetch(`/api/workspaces/${wsId}/brief-images`, { method: "POST", body: fd }).then(async (res) => ({ ok: res.ok, d: await res.json().catch(() => ({})) })).catch(() => ({ ok: false, d: {} as Record<string, unknown> }));
    setImgBusy(false);
    if (Array.isArray(r.d.images)) { setBriefImages(r.d.images); setImageCount(wsId, r.d.images.length); }
    const errs = Array.isArray(r.d.errors) ? (r.d.errors as string[]) : [];
    if (!r.ok || errs.length) setImgError(errs[0] ?? String(r.d.error ?? t("dashboard.workspaces.errGeneric")));
    if (files.length > list.length) setImgError(t("dashboard.workspaces.imagesFull"));
  }

  async function deleteBriefImage(wsId: string, imageId: string) {
    const before = briefImages;
    const next = (briefImages ?? []).filter((i) => i.id !== imageId);
    setBriefImages(next); // optimiste
    setImageCount(wsId, next.length);
    const r = await api(`/api/workspaces/${wsId}/brief-images/${imageId}`, "DELETE");
    if (!r.ok) {
      setBriefImages(before);
      setImageCount(wsId, before?.length ?? 0);
      setImgError(String(r.data.error ?? t("dashboard.workspaces.errGeneric")));
    }
  }

  function saveBrief() {
    if (!briefFor) return;
    const { ws, text } = briefFor;
    setBriefFor(null);
    void optimistic(
      (d) => ({ ...d, workspaces: d.workspaces.map((w) => (w.id === ws.id ? { ...w, brief: text.trim() } : w)) }),
      () => api(`/api/workspaces/${ws.id}`, "PATCH", { brief: text }),
    );
  }

  function saveAssign() {
    if (!assigning) return;
    const { ws, userIds } = assigning;
    setAssigning(null);
    void optimistic(
      (d) => ({
        ...d,
        team: d.team.map((m) => {
          const has = m.workspaceIds.includes(ws.id);
          const want = userIds.includes(m.userId);
          if (has === want) return m;
          return { ...m, workspaceIds: want ? [...m.workspaceIds, ws.id] : m.workspaceIds.filter((x) => x !== ws.id) };
        }),
      }),
      () => api(`/api/workspaces/${ws.id}/members`, "PUT", { userIds }),
    );
  }

  function confirmDelete() {
    if (!deleting) return;
    const ws = deleting;
    setDeleting(null);
    void optimistic(
      (d) => {
        const workspaces = d.workspaces.filter((w) => w.id !== ws.id);
        return {
          ...d,
          workspaces,
          total: d.total - 1,
          activeId: d.activeId === ws.id ? workspaces[0]?.id ?? null : d.activeId,
          team: d.team.map((m) => ({ ...m, workspaceIds: m.workspaceIds.filter((x) => x !== ws.id) })),
        };
      },
      () => api(`/api/workspaces/${ws.id}`, "DELETE"),
    );
  }

  function changeRole(userId: string, role: "manager" | "va") {
    void optimistic(
      (d) => ({ ...d, team: d.team.map((m) => (m.userId === userId ? { ...m, role, workspaceIds: role === "manager" ? [] : m.workspaceIds } : m)) }),
      () => api("/api/team/role", "PATCH", { userId, role }),
    );
  }

  return (
    <div>
      <Header t={t}>
        {canManage && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl px-4 py-2.5 min-w-[150px]" style={SURFACE}>
              <p className="text-sm font-bold text-[var(--app-text)] tabular-nums">
                {t("dashboard.workspaces.counter", { count: data.total, max: data.limit })}
              </p>
              <div className="mt-1.5 h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--app-surface-2)" }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: atLimit ? "#F59E0B" : GRADIENT }} />
              </div>
            </div>
            <Btn variant="primary" disabled={atLimit} onClick={() => { setError(null); setEditing({ id: null, name: "", color: COLORS[data.total % COLORS.length] }); }} className="px-5 py-3">
              <span className="text-base leading-none">+</span> {t("dashboard.workspaces.add")}
            </Btn>
          </div>
        )}
      </Header>

      {/* Limite atteinte sur Pro → l'Agence en monte jusqu'à 15. */}
      {canManage && atLimit && (
        <div className="mt-6 rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-3"
          style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)" }}>
          <span className="flex items-center gap-2 text-[15px] font-semibold text-[var(--app-text)]">
            <span aria-hidden>⚡</span>
            {data.ownerPlan === "pro"
              ? t("dashboard.workspaces.limitPro", { max: data.limit })
              : t("dashboard.workspaces.limitAgency", { max: data.limit })}
          </span>
          {data.ownerPlan === "pro" && isOwner && (
            <Link href="/dashboard/abonnement?upgrade=1" className="rounded-xl px-4 py-2 text-sm font-bold text-white transition hover:brightness-110" style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}>
              {t("dashboard.workspaces.upgradeAgency")}
            </Link>
          )}
        </div>
      )}

      {driveNotice && (
        <div className={`mt-6 rounded-xl px-4 py-3 text-sm font-semibold ${driveNotice.ok ? "text-emerald-700" : "text-red-600"}`}
          style={driveNotice.ok ? { background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.30)" } : { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.30)" }}>
          {driveNotice.text}
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-red-600" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.30)" }}>
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="opacity-70 hover:opacity-100" aria-label="Fermer">✕</button>
        </div>
      )}

      {/* ── Les créateurs ── */}
      {data.workspaces.length === 0 ? (
        <div className="mt-8 rounded-2xl p-8 text-center text-[15px] font-medium text-[var(--app-text-muted)]" style={SURFACE}>
          {t("dashboard.workspaces.vaNoWorkspace")}
        </div>
      ) : (
        <div className="mt-7 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {data.workspaces.map((w) => {
            const assigned = vas.filter((m) => m.workspaceIds.includes(w.id));
            const isActive = w.id === data.activeId;
            return (
              <div
                key={w.id}
                className="rounded-2xl p-5 flex flex-col transition-shadow"
                style={{
                  ...SURFACE,
                  ...(isActive ? { border: `1.5px solid ${w.color}`, boxShadow: `0 10px 30px -18px ${w.color}` } : {}),
                }}
              >
                {/* En-tête */}
                <div className="flex items-center gap-3.5">
                  <WorkspaceAvatar name={w.name} color={w.color} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold text-[var(--app-text)] leading-tight">{w.name}</p>
                    {isActive ? (
                      <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: w.color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: w.color }} />
                        {t("dashboard.workspaces.activeBadge")}
                      </span>
                    ) : (
                      <button type="button" onClick={() => select(w.id)}
                        className="mt-1 text-xs font-bold text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition">
                        {t("dashboard.workspaces.select")} →
                      </button>
                    )}
                  </div>
                </div>

                {/* Brief */}
                <button
                  type="button"
                  onClick={() => openBrief(w)}
                  className="mt-5 w-full text-left rounded-xl px-4 py-3.5 transition hover:brightness-[0.98]"
                  style={SUBTLE}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-bold text-[var(--app-text)]"><span aria-hidden>📝</span>{t("dashboard.workspaces.briefLabel")}</span>
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={w.brief || w.briefImageCount || w.briefVideoCount
                        ? { background: "rgba(16,185,129,0.14)", color: "#059669" }
                        : { background: "rgba(245,158,11,0.16)", color: "#B45309" }}
                    >
                      {w.brief || w.briefImageCount || w.briefVideoCount ? t("dashboard.workspaces.briefWritten") : t("dashboard.workspaces.briefEmpty")}
                    </span>
                  </span>
                  {/* Aperçu court : le brief complet s'ouvre au clic (fenêtre du brief). */}
                  <span
                    className="mt-1.5 text-[13px] leading-relaxed text-[var(--app-text-muted)] overflow-hidden"
                    style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}
                  >
                    {w.brief ? w.brief.replace(/\s+/g, " ").slice(0, 280) : t("dashboard.workspaces.briefCta")}
                  </span>
                  {(!!w.briefImageCount || !!w.briefVideoCount) && (
                    <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-[var(--app-text)]">
                      {!!w.briefImageCount && <span className="inline-flex items-center gap-1.5"><span aria-hidden>🖼️</span>{t("dashboard.workspaces.imagesCount", { count: w.briefImageCount })}</span>}
                      {!!w.briefVideoCount && <span className="inline-flex items-center gap-1.5"><span aria-hidden>🎬</span>{t("dashboard.workspaces.videosCount", { count: w.briefVideoCount })}</span>}
                    </span>
                  )}
                </button>

                {/* Dossier Google Drive du créateur : « <Créateur> — DuupFlow » */}
                <div className="mt-3 flex items-center gap-2.5 rounded-xl px-4 py-3" style={SUBTLE}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/app/icons8-google-drive-96.png" alt="" className="h-5 w-5 object-contain shrink-0" />
                  {data.driveConnected ? (
                    <>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--app-text)]">{w.name} — DuupFlow</span>
                      <a href={`/api/workspaces/${w.id}/drive`} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 text-xs font-bold text-indigo-600 hover:text-indigo-500">
                        {t("dashboard.workspaces.driveOpen")} ↗
                      </a>
                    </>
                  ) : isOwner && data.driveConfigured ? (
                    <>
                      <span className="min-w-0 flex-1 text-[13px] font-medium text-[var(--app-text-muted)]">{t("dashboard.workspaces.driveNotConnected")}</span>
                      <a href="/api/google/drive/connect?return=/dashboard/workspaces" className="shrink-0 text-xs font-bold text-indigo-600 hover:text-indigo-500">
                        {t("dashboard.workspaces.driveConnect")} →
                      </a>
                    </>
                  ) : (
                    <span className="min-w-0 flex-1 text-[13px] font-medium text-[var(--app-text-muted)]">{t("dashboard.workspaces.driveNotConnected")}</span>
                  )}
                </div>

                {/* VA assignés */}
                {canManage && (
                  <div className="mt-5">
                    <SectionLabel>{t("dashboard.workspaces.assignedVas")}</SectionLabel>
                    {assigned.length === 0 ? (
                      <p className="text-[13px] font-medium text-[var(--app-text-muted)]">{t("dashboard.workspaces.noVa")}</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {assigned.map((m) => (
                          <span key={m.userId} className="text-xs font-semibold px-2.5 py-1 rounded-lg text-[var(--app-text)]" style={SUBTLE}>
                            {m.name ?? m.email}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {canManage && (
                  <div className="mt-auto pt-5 flex items-center gap-2">
                    <Btn onClick={() => { setError(null); setEditing({ id: w.id, name: w.name, color: w.color }); }}>
                      {t("dashboard.workspaces.edit")}
                    </Btn>
                    <Btn onClick={() => setAssigning({ ws: w, userIds: assigned.map((m) => m.userId) })}>
                      {t("dashboard.workspaces.assign")}
                    </Btn>
                    {data.total > 1 && !w.isDefault && (
                      <button
                        type="button"
                        onClick={() => setDeleting(w)}
                        title={t("dashboard.workspaces.delete")}
                        aria-label={t("dashboard.workspaces.delete")}
                        className="ml-auto h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-red-600 transition hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                        style={{ border: "1px solid rgba(239,68,68,0.35)" }}
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Rôles de l'équipe (propriétaire uniquement) ── */}
      {isOwner && (
        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight text-[var(--app-text)] mb-4">{t("dashboard.workspaces.rolesTitle")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            {([
              { k: "Owner", icon: "👑" },
              { k: "Manager", icon: "🧭" },
              { k: "Va", icon: "🎬" },
            ] as const).map(({ k, icon }) => (
              <div key={k} className="rounded-2xl p-5" style={SURFACE}>
                <p className="flex items-center gap-2 text-base font-bold text-[var(--app-text)]"><span aria-hidden>{icon}</span>{t(`dashboard.workspaces.role${k}`)}</p>
                <p className="mt-1.5 text-sm font-medium leading-relaxed text-[var(--app-text-muted)]">{t(`dashboard.workspaces.role${k}Desc`)}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl p-5" style={SURFACE}>
            {data.team.length === 0 ? (
              <p className="text-[15px] font-medium text-[var(--app-text-muted)]">
                {t("dashboard.workspaces.noMembers")}{" "}
                <Link href="/dashboard/settings" className="font-bold text-indigo-600 hover:text-indigo-500">{t("dashboard.workspaces.inviteLink")} →</Link>
              </p>
            ) : (
              <div className="space-y-2.5">
                {data.team.map((m) => {
                  const mine = data.workspaces.filter((w) => m.workspaceIds.includes(w.id));
                  return (
                    <div key={m.userId} className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3.5" style={SUBTLE}>
                      <span className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: GRADIENT }}>
                        {(m.name ?? m.email)[0]?.toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-bold text-[var(--app-text)]">{m.name ?? m.email}</p>
                        <p className="truncate text-[13px] text-[var(--app-text-muted)]">
                          {m.email}
                          {m.role === "va" && (
                            <> · {mine.length > 0 ? mine.map((w) => w.name).join(", ") : t("dashboard.workspaces.vaNone")}</>
                          )}
                        </p>
                      </div>
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.userId, e.target.value === "manager" ? "manager" : "va")}
                        aria-label={t("dashboard.workspaces.roleLabel")}
                        className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--app-text)] outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 cursor-pointer"
                        style={INPUT}
                      >
                        <option value="va">{t("dashboard.workspaces.roleVa")}</option>
                        <option value="manager">{t("dashboard.workspaces.roleManager")}</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Fenêtre : créer / modifier ── */}
      {editing && (
        <Modal title={editing.id ? t("dashboard.workspaces.editTitle") : t("dashboard.workspaces.addTitle")} onClose={() => !saving && setEditing(null)} width="max-w-xl">
          <form onSubmit={(e) => { e.preventDefault(); void submitEdit(); }} className="space-y-6">
            <div className="flex items-center gap-4">
              <WorkspaceAvatar name={editing.name || "?"} color={editing.color} size={56} />
              <input
                autoFocus
                value={editing.name}
                maxLength={60}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder={t("dashboard.workspaces.namePlaceholder")}
                className="flex-1 rounded-xl px-4 py-3 text-[15px] font-semibold text-[var(--app-text)] placeholder:font-normal placeholder-[var(--app-text-faint)] outline-none focus:ring-2 focus:ring-indigo-500/40"
                style={INPUT}
              />
            </div>
            <div>
              <SectionLabel>{t("dashboard.workspaces.colorLabel")}</SectionLabel>
              <div className="flex flex-wrap gap-2.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditing({ ...editing, color: c })}
                    className="h-10 w-10 rounded-xl transition hover:scale-105 flex items-center justify-center"
                    style={{ background: c, boxShadow: editing.color === c ? `0 0 0 2px var(--app-bg), 0 0 0 4px ${c}` : "none" }}
                    aria-label={c}
                  >
                    {editing.color === c && <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg>}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            <Btn type="submit" variant="primary" disabled={saving || !editing.name.trim()} className="w-full py-3">
              {saving ? t("dashboard.workspaces.presetSaving") : editing.id ? t("dashboard.workspaces.save") : t("dashboard.workspaces.create")}
            </Btn>
          </form>
        </Modal>
      )}

      {/* ── Fenêtre : brief du créateur pour l'éditeur ── */}
      {briefFor && (
        <Modal title={t("dashboard.workspaces.briefTitle", { name: briefFor.ws.name })} onClose={() => setBriefFor(null)}>
          <p className="text-[15px] font-medium text-[var(--app-text-muted)] leading-relaxed">{t("dashboard.workspaces.briefLead")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["briefTip1", "briefTip2", "briefTip3", "briefTip4", "briefTip5"] as const).map((k) => (
              <span key={k} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-[var(--app-text)]" style={SUBTLE}>
                {t(`dashboard.workspaces.${k}`)}
              </span>
            ))}
          </div>
          <textarea
            value={briefFor.text}
            readOnly={!canManage}
            maxLength={BRIEF_MAX}
            onChange={(e) => setBriefFor({ ...briefFor, text: e.target.value })}
            placeholder={t("dashboard.workspaces.briefPlaceholder")}
            rows={11}
            className="mt-5 w-full rounded-xl px-4 py-3 text-[15px] leading-relaxed text-[var(--app-text)] placeholder-[var(--app-text-faint)] outline-none focus:ring-2 focus:ring-indigo-500/40 resize-y"
            style={INPUT}
          />
          <div className="mt-2 flex justify-between text-[13px] font-medium text-[var(--app-text-muted)]">
            <span>{canManage ? t("dashboard.workspaces.briefAuto") : t("dashboard.workspaces.briefReadOnly")}</span>
            <span className="tabular-nums">{briefFor.text.length}/{BRIEF_MAX}</span>
          </div>

          {/* Images de référence : permanentes, vues par Claude avec le texte. */}
          <div className="mt-6">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-sm font-bold text-[var(--app-text)]">
                🖼️ {t("dashboard.workspaces.imagesTitle")}{" "}
                <span className="font-semibold text-[var(--app-text-muted)] tabular-nums">({briefImages?.length ?? 0}/10)</span>
              </p>
              {canManage && (
                <label className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-surface-2)] ${imgBusy || (briefImages?.length ?? 0) >= 10 ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
                  style={{ border: "1px solid var(--app-border-strong)" }}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => { void uploadBriefImages(briefFor.ws.id, e.target.files); e.target.value = ""; }}
                  />
                  {imgBusy ? t("dashboard.workspaces.imagesUploading") : `+ ${t("dashboard.workspaces.imagesAdd")}`}
                </label>
              )}
            </div>
            <p className="text-[13px] font-medium text-[var(--app-text-muted)] mb-3">{t("dashboard.workspaces.imagesLead")}</p>
            {briefImages === null ? (
              <div className="grid grid-cols-5 gap-2">{[0, 1, 2].map((i) => <div key={i} className="aspect-square rounded-xl bg-[var(--app-surface-2)] animate-pulse" />)}</div>
            ) : briefImages.length === 0 ? (
              <p className="rounded-xl px-4 py-4 text-[13px] font-medium text-[var(--app-text-muted)] text-center" style={SUBTLE}>{t("dashboard.workspaces.imagesEmpty")}</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {briefImages.map((img) => (
                  <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl" style={SUBTLE}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/workspaces/${briefFor.ws.id}/brief-images/${img.id}`} alt={img.name} title={img.name} className="h-full w-full object-cover" loading="lazy" />
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => void deleteBriefImage(briefFor.ws.id, img.id)}
                        aria-label={t("dashboard.workspaces.imagesRemove")}
                        title={t("dashboard.workspaces.imagesRemove")}
                        className="absolute top-1.5 right-1.5 h-7 w-7 rounded-lg flex items-center justify-center bg-black/65 text-white opacity-90 sm:opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {imgError && <p className="mt-2 text-sm font-semibold text-red-600">{imgError}</p>}
          </div>

          {/* Vidéos qui marchent : analysées comme une référence, descriptif lu par Claude. */}
          <div className="mt-6">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-sm font-bold text-[var(--app-text)]">
                🎬 {t("dashboard.workspaces.videosTitle")}{" "}
                <span className="font-semibold text-[var(--app-text-muted)] tabular-nums">({briefVideos?.length ?? 0}/5)</span>
              </p>
              {canManage && (
                <label className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-surface-2)] ${vidBusy || (briefVideos?.length ?? 0) >= 5 ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
                  style={{ border: "1px solid var(--app-border-strong)" }}>
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => { void uploadBriefVideos(briefFor.ws.id, e.target.files); e.target.value = ""; }}
                  />
                  {vidBusy ? t("dashboard.workspaces.videosUploading") : `+ ${t("dashboard.workspaces.videosAdd")}`}
                </label>
              )}
            </div>
            <p className="text-[13px] font-medium text-[var(--app-text-muted)] mb-3">{t("dashboard.workspaces.videosLead")}</p>
            {briefVideos === null ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{[0, 1].map((i) => <div key={i} className="h-24 rounded-xl bg-[var(--app-surface-2)] animate-pulse" />)}</div>
            ) : briefVideos.length === 0 && !vidBusy ? (
              <p className="rounded-xl px-4 py-4 text-[13px] font-medium text-[var(--app-text-muted)] text-center" style={SUBTLE}>{t("dashboard.workspaces.videosEmpty")}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {briefVideos.map((v) => (
                  <div key={v.id} className="group relative flex items-center gap-3 rounded-xl p-2 pr-10" style={SUBTLE}>
                    <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--app-surface-2)] flex items-center justify-center">
                      {v.status === "ready" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/workspaces/${briefFor.ws.id}/brief-videos/${v.id}`} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : v.status === "analyzing" ? (
                        <span className="h-5 w-5 rounded-full border-2 border-[var(--app-text-faint)] border-t-transparent animate-spin" />
                      ) : (
                        <span aria-hidden>⚠️</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-[var(--app-text)]" title={v.name}>{v.name}</p>
                      <p className={`text-xs font-semibold ${v.status === "ready" ? "text-emerald-600" : v.status === "failed" ? "text-red-600" : "text-[var(--app-text-muted)]"}`}>
                        {v.status === "ready" ? t("dashboard.workspaces.videoReady") : v.status === "failed" ? (v.error ?? t("dashboard.workspaces.videoFailed")) : t("dashboard.workspaces.videoAnalyzing")}
                        <span className="text-[var(--app-text-faint)] font-medium"> · {Math.round(v.durationSec)} s</span>
                      </p>
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => void deleteBriefVideo(briefFor.ws.id, v.id)}
                        aria-label={t("dashboard.workspaces.videosRemove")}
                        title={t("dashboard.workspaces.videosRemove")}
                        className="absolute top-1/2 -translate-y-1/2 right-2 h-7 w-7 rounded-lg flex items-center justify-center bg-black/65 text-white opacity-90 sm:opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                ))}
                {vidBusy && (
                  <div className="flex items-center gap-3 rounded-xl p-2" style={SUBTLE}>
                    <div className="h-16 w-12 shrink-0 rounded-lg bg-[var(--app-surface-2)] animate-pulse" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-[var(--app-text)]">{vidBusy}</p>
                      <p className="text-xs font-semibold text-[var(--app-text-muted)]">{t("dashboard.workspaces.videosUploading")}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {vidError && <p className="mt-2 text-sm font-semibold text-red-600">{vidError}</p>}
          </div>
          {canManage && (
            <Btn variant="primary" color={briefFor.ws.color} onClick={saveBrief} className="mt-6 w-full py-3">
              {t("dashboard.workspaces.save")}
            </Btn>
          )}
        </Modal>
      )}

      {/* ── Fenêtre : assigner des VA ── */}
      {assigning && (
        <Modal title={t("dashboard.workspaces.assignTitle", { name: assigning.ws.name })} onClose={() => setAssigning(null)} width="max-w-xl">
          <p className="text-[15px] font-medium text-[var(--app-text-muted)] leading-relaxed mb-5">{t("dashboard.workspaces.assignLead")}</p>
          {vas.length === 0 ? (
            <p className="rounded-xl px-4 py-4 text-[15px] font-medium text-[var(--app-text-muted)]" style={SUBTLE}>
              {t("dashboard.workspaces.noVaInTeam")}
            </p>
          ) : (
            <div className="space-y-2">
              {vas.map((m) => {
                const checked = assigning.userIds.includes(m.userId);
                return (
                  <label key={m.userId} className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition hover:brightness-[0.98]" style={{ ...SUBTLE, ...(checked ? { borderColor: assigning.ws.color } : {}) }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setAssigning({
                        ...assigning,
                        userIds: checked ? assigning.userIds.filter((u) => u !== m.userId) : [...assigning.userIds, m.userId],
                      })}
                      className="h-4 w-4 accent-indigo-600"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-bold text-[var(--app-text)]">{m.name ?? m.email}</span>
                      <span className="block truncate text-[13px] text-[var(--app-text-muted)]">{m.email}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <Btn variant="primary" disabled={vas.length === 0} onClick={saveAssign} className="mt-6 w-full py-3">
            {t("dashboard.workspaces.save")}
          </Btn>
        </Modal>
      )}

      {/* ── Fenêtre : supprimer ── */}
      {deleting && (
        <Modal title={t("dashboard.workspaces.deleteTitle", { name: deleting.name })} onClose={() => setDeleting(null)} width="max-w-lg">
          <p className="text-[15px] font-medium text-[var(--app-text-muted)] leading-relaxed">{t("dashboard.workspaces.deleteLead")}</p>
          <div className="mt-7 grid grid-cols-2 gap-3">
            <Btn onClick={() => setDeleting(null)} className="py-3">{t("dashboard.workspaces.cancel")}</Btn>
            <Btn variant="dangerSolid" onClick={confirmDelete} className="py-3">{t("dashboard.workspaces.deleteConfirm")}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Header({ t, children }: { t: T; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600 mb-2">{t("dashboard.workspaces.eyebrow")}</p>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--app-text)]">{t("dashboard.workspaces.title")}</h1>
        <p className="mt-2 text-[15px] font-medium text-[var(--app-text-muted)] max-w-2xl leading-relaxed">{t("dashboard.workspaces.subtitle")}</p>
      </div>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-20 rounded bg-[var(--app-surface-2)]" />
      <div className="mt-3 h-8 w-64 rounded-lg bg-[var(--app-surface-2)]" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-[var(--app-surface-2)]" />
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
        {[0, 1, 2].map((i) => <div key={i} className="h-64 rounded-2xl bg-[var(--app-surface-2)]" />)}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/lib/i18n/context";

/* Sélecteur de créateur (workspace) en haut de la sidebar — plans Pro & Agence.
   Invisible pour tout autre compte (l'API renvoie enabled: false).

   Les écrans qui modifient les workspaces émettent WORKSPACES_CHANGED : le
   sélecteur se recharge sans rafraîchir la page. */

export const WORKSPACES_CHANGED = "duup:workspaces-changed";
/** Valeur spéciale : la VUE ADMIN du propriétaire (voit tous les créateurs). */
export const ADMIN_VIEW = "admin";

/* ── Créateur AFFICHÉ, partagé par tous les écrans ───────────────────────────
   Changé à l'instant du clic : mémorisé dans le cookie duup_ws (envoyé avec
   TOUTES les requêtes — pages, actions serveur, médias, téléchargements) et
   dans l'en-tête x-duup-ws des appels API. Le serveur revérifie l'accès à
   chaque requête. → bascule instantanée, sans rechargement de page. */
const WS_COOKIE = "duup_ws";
let currentWs: string | null = null;

export function getCurrentWorkspaceId(): string | null { return currentWs; }
/** Paramètre à ajouter aux URL de médias (vidéo, image, zip) : `&ws=…`. */
export function wsParam(): string { return currentWs ? `&ws=${currentWs}` : ""; }

function readWsCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = /(?:^|;\s*)duup_ws=([^;]+)/.exec(document.cookie);
  return m ? decodeURIComponent(m[1]) : null;
}
function setCurrentWorkspace(id: string | null) {
  currentWs = id;
  if (typeof document === "undefined") return;
  document.cookie = id
    ? `${WS_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`
    : `${WS_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** Bascule de créateur (ou vers la vue admin) — utilisable depuis n'importe quel écran. */
export function switchCreator(id: string) {
  if (id === currentWs) return;
  setCurrentWorkspace(id);
  window.dispatchEvent(new CustomEvent(WORKSPACES_CHANGED, { detail: { from: "switcher", workspaceId: id } }));
  // En arrière-plan : mémorise le créateur actif en base (MCP par défaut, autres
  // appareils). La vue admin n'est qu'un mode d'affichage : rien à enregistrer.
  if (id !== ADMIN_VIEW) {
    void fetch("/api/workspaces/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: id }),
    }).catch(() => {});
  }
}

/** Appelle `cb` à chaque changement de créateur (pour recharger une liste, etc.). */
export function useCreatorSwitch(cb: (workspaceId: string) => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    const onChange = (e: Event) => {
      const id = (e as CustomEvent).detail?.workspaceId as string | undefined;
      if ((e as CustomEvent).detail?.from === "switcher" && id) ref.current(id);
    };
    window.addEventListener(WORKSPACES_CHANGED, onChange);
    return () => window.removeEventListener(WORKSPACES_CHANGED, onChange);
  }, []);
}

const WS_SCOPED = /\/api\/(ai-editor|ai-auto|workspaces\/settings)/;
if (typeof window !== "undefined" && !(window as unknown as { __duupWsFetch?: boolean }).__duupWsFetch) {
  (window as unknown as { __duupWsFetch?: boolean }).__duupWsFetch = true;
  currentWs = readWsCookie();
  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const sameOrigin = url.startsWith("/") || url.startsWith(window.location.origin);
      if (currentWs && sameOrigin && WS_SCOPED.test(url)) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (!headers.has("x-duup-ws")) headers.set("x-duup-ws", currentWs);
        return orig(input, { ...init, headers });
      }
    } catch { /* en cas de doute : requête d'origine, inchangée */ }
    return orig(input, init);
  };
}

export type WorkspaceItem = { id: string; name: string; color: string; isDefault: boolean; brief?: string; briefImageCount?: number; briefVideoCount?: number };
export type WorkspacesPayload = {
  enabled: boolean;
  role: "owner" | "manager" | "va";
  ownerPlan: string;
  limit: number;
  total: number;
  workspaces: WorkspaceItem[];
  activeId: string | null;
};

/** Pastille d'un créateur : ses initiales sur sa couleur. */
export function WorkspaceAvatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg font-bold text-white"
      style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Pastille de la vue admin. */
function AdminAvatar({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg text-white"
      style={{ width: size, height: size, background: "linear-gradient(135deg,#0F172A,#475569)", fontSize: Math.round(size * 0.5) }}
      aria-hidden
    >
      👑
    </span>
  );
}

export default function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useTranslation();
  const [data, setData] = useState<WorkspacesPayload | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces", { cache: "no-store" });
      if (!res.ok) return;
      const d = (await res.json()) as WorkspacesPayload;
      setData(d);
      if (!d.enabled) { setCurrentWorkspace(null); setShown(null); return; }
      // Ce que le navigateur affichait déjà (cookie), s'il est toujours permis ;
      // sinon le créateur actif enregistré.
      // sinon d.activeId (vue admin par défaut pour le propriétaire).
      const fromCookie = readWsCookie();
      const ok = (fromCookie === ADMIN_VIEW && d.role === "owner") || (!!fromCookie && d.workspaces.some((w) => w.id === fromCookie));
      const pick = ok ? fromCookie : d.activeId;
      if (pick !== currentWs) setCurrentWorkspace(pick);
      setShown(pick);
    } catch { /* sélecteur masqué : l'app reste utilisable */ }
  }, []);

  useEffect(() => {
    load();
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { from?: string; workspaceId?: string } | undefined;
      if (detail?.from === "switcher" && detail.workspaceId) { setShown(detail.workspaceId); return; }
      load();
    };
    window.addEventListener(WORKSPACES_CHANGED, onChange);
    return () => window.removeEventListener(WORKSPACES_CHANGED, onChange);
  }, [load]);

  // Fermeture au clic extérieur / Échap.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!data?.enabled) return null;

  const isOwner = data.role === "owner";
  const isAdmin = shown === ADMIN_VIEW && isOwner;
  const active = isAdmin ? null : data.workspaces.find((w) => w.id === shown) ?? null;
  const canManage = data.role !== "va";

  function toggle() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 248) });
    setOpen((o) => !o);
  }

  function choose(id: string) {
    setOpen(false);
    switchCreator(id);
  }

  return (
    <div className={collapsed ? "px-2 mb-3" : "px-3 mb-3"}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        title={collapsed ? (isAdmin ? t("dashboard.workspaces.adminView") : active?.name ?? t("dashboard.workspaces.noneAssigned")) : undefined}
        className={[
          "w-full flex items-center rounded-xl transition hover:bg-[var(--app-surface)]",
          collapsed ? "justify-center p-1.5" : "gap-2.5 px-2.5 py-2",
        ].join(" ")}
        style={{ border: "1px solid var(--app-border)" }}
      >
        {isAdmin ? (
          <AdminAvatar size={collapsed ? 30 : 28} />
        ) : active ? (
          <WorkspaceAvatar name={active.name} color={active.color} size={collapsed ? 30 : 28} />
        ) : (
          <span className="h-7 w-7 rounded-lg shrink-0" style={{ background: "var(--app-surface)", border: "1px dashed var(--app-border-strong)" }} />
        )}
        {!collapsed && (
          <>
            <span className="flex-1 min-w-0 text-left">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-faint)] leading-none mb-1">
                {isAdmin ? t("dashboard.workspaces.adminLabel") : t("dashboard.workspaces.switcherLabel")}
              </span>
              <span className="block truncate text-sm font-bold text-[var(--app-text)] leading-tight">
                {isAdmin ? t("dashboard.workspaces.adminAll") : active?.name ?? t("dashboard.workspaces.noneAssigned")}
              </span>
            </span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[var(--app-text-faint)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m7 15 5 5 5-5" /><path d="m7 9 5-5 5 5" />
            </svg>
          </>
        )}
      </button>

      {/* Portail : la sidebar a un backdrop-filter + overflow qui clipperaient le menu. */}
      {open && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-[190]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[200] rounded-2xl border p-2"
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              borderColor: "var(--app-border)",
              background: "linear-gradient(var(--app-surface), var(--app-surface)), var(--app-bg)",
              boxShadow: "0 18px 44px rgba(0,0,0,.35)",
            }}
          >
            {/* Vue admin : uniquement le propriétaire du compte. */}
            {isOwner && (
              <div className="mb-1.5 pb-1.5" style={{ borderBottom: "1px solid var(--app-border)" }}>
                <button
                  type="button"
                  onClick={() => choose(ADMIN_VIEW)}
                  className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-[var(--app-surface-2)]"
                >
                  <AdminAvatar size={26} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[var(--app-text)]">{t("dashboard.workspaces.adminView")}</span>
                    <span className="block truncate text-[11px] font-medium text-[var(--app-text-muted)]">{t("dashboard.workspaces.adminHint")}</span>
                  </span>
                  {isAdmin && (
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
                  )}
                </button>
              </div>
            )}
            <div className="flex items-center justify-between px-2.5 pt-1 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-faint)]">
                {t("dashboard.workspaces.switcherTitle")}
              </span>
              {canManage && (
                <span className="text-[10px] font-bold text-[var(--app-text-faint)]">
                  {data.total}/{data.limit}
                </span>
              )}
            </div>
            <div className="max-h-[50vh] overflow-y-auto space-y-0.5">
              {data.workspaces.length === 0 && (
                <p className="px-2.5 py-3 text-xs text-[var(--app-text-muted)] leading-relaxed">
                  {t("dashboard.workspaces.vaNoWorkspace")}
                </p>
              )}
              {data.workspaces.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => choose(w.id)}
                  className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-[var(--app-surface-2)]"
                >
                  <WorkspaceAvatar name={w.name} color={w.color} size={26} />
                  <span className="flex-1 truncate text-sm font-semibold text-[var(--app-text)]">{w.name}</span>
                  {w.id === shown && (
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-1.5 pt-1.5" style={{ borderTop: "1px solid var(--app-border)" }}>
              <Link
                href="/dashboard/workspaces"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {canManage ? <><path d="M12 5v14" /><path d="M5 12h14" /></> : <><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></>}
                </svg>
                {canManage ? t("dashboard.workspaces.manageLink") : t("dashboard.workspaces.viewLink")}
              </Link>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

/** Remonte son contenu (état neuf) à chaque changement de créateur — vue
 *  admin comprise : l'écran repart instantanément sur les données du nouvel
 *  espace, sans rechargement de page. */
export function WorkspaceKeyed({ children }: { children: React.ReactNode }) {
  // « init » au premier rendu (identique serveur/navigateur → pas d'erreur
  // d'hydratation) ; le contenu charge déjà le bon espace grâce au cookie.
  const [key, setKey] = useState<string>("init");
  useCreatorSwitch((id) => setKey(id));
  return <div key={key} className="contents">{children}</div>;
}

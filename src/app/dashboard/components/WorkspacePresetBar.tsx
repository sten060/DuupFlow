"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { WorkspaceAvatar, WORKSPACES_CHANGED } from "./WorkspaceSwitcher";

/* Réglages de duplication PAR CRÉATEUR (workspaces, Pro & Agence).

   Posée en haut d'un formulaire de duplication :
     • au chargement, et à chaque changement de créateur dans la sidebar, les
       réglages enregistrés pour ce créateur sont APPLIQUÉS au formulaire
       (ils passent après les « derniers réglages » mémorisés par le navigateur) ;
     • propriétaire et managers peuvent enregistrer les réglages actuels comme
       ceux du créateur — ses VA les retrouvent alors tout seuls.

   Invisible pour un compte sans workspaces : le formulaire se comporte comme
   avant. */

export type PresetModule = "images" | "videoSimple" | "videoAdvanced";

type State = {
  workspace: { id: string; name: string; color: string };
  hasSettings: boolean;
  canSave: boolean;
};

export default function WorkspacePresetBar<S extends Record<string, unknown>>({
  module,
  apply,
  snapshot,
}: {
  module: PresetModule;
  /** Applique des réglages enregistrés au formulaire. */
  apply: (settings: S) => void;
  /** Les réglages actuels du formulaire, à enregistrer. */
  snapshot: () => S;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<State | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // `apply` change à chaque rendu du formulaire : on garde la dernière version
  // sans relancer le chargement.
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/workspaces/settings?module=${module}`, { cache: "no-store" });
        const d = await res.json();
        if (cancelled) return;
        if (!d?.enabled || !d.workspace) { setState(null); return; }
        setState({ workspace: d.workspace, hasSettings: !!d.settings, canSave: !!d.canSave });
        setMsg(null);
        if (d.settings && typeof d.settings === "object") applyRef.current(d.settings as S);
      } catch {
        if (!cancelled) setState(null);
      }
    }
    load();
    const onChange = () => load();
    window.addEventListener(WORKSPACES_CHANGED, onChange);
    return () => { cancelled = true; window.removeEventListener(WORKSPACES_CHANGED, onChange); };
  }, [module]);

  if (!state) return null;
  const { workspace } = state;

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/workspaces/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, workspaceId: workspace.id, settings: snapshot() }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setState((s) => (s ? { ...s, hasSettings: true } : s));
        setMsg({ ok: true, text: t("dashboard.workspaces.presetSaved", { name: workspace.name }) });
      } else {
        setMsg({ ok: false, text: d.error ?? t("dashboard.workspaces.errGeneric") });
      }
    } catch {
      setMsg({ ok: false, text: t("dashboard.workspaces.errGeneric") });
    }
    setSaving(false);
  }

  return (
    <div
      className="rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3"
      style={{ background: `${workspace.color}12`, border: `1px solid ${workspace.color}40` }}
    >
      <WorkspaceAvatar name={workspace.name} color={workspace.color} size={30} />
      <div className="flex-1 min-w-[180px]">
        <p className="text-sm font-semibold text-[var(--app-text)]">
          {state.hasSettings
            ? t("dashboard.workspaces.presetApplied", { name: workspace.name })
            : t("dashboard.workspaces.presetNone", { name: workspace.name })}
        </p>
        {msg && (
          <p className={`text-xs mt-0.5 ${msg.ok ? "text-emerald-500" : "text-red-400"}`}>{msg.text}</p>
        )}
        {!msg && !state.canSave && !state.hasSettings && (
          <p className="text-xs mt-0.5 text-[var(--app-text-faint)]">{t("dashboard.workspaces.presetVaHint")}</p>
        )}
      </div>
      {state.canSave && (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-xl px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: workspace.color }}
        >
          {saving
            ? t("dashboard.workspaces.presetSaving")
            : t("dashboard.workspaces.presetSave", { name: workspace.name })}
        </button>
      )}
    </div>
  );
}

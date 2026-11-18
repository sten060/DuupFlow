"use client";

// Templates de la duplication Simple — même LOGIQUE que le duplicateur Avancé
// (templates nommés, enregistrés dans le compte via Supabase, un clic charge,
// × supprime, Reset remet l'état d'ouverture), dans le design actuel de la
// page (carte en verre, bouton dégradé, templates en cartes cliquables).
// Un template = le formulaire complet (packs, intensités, options, captions,
// sous-titres).

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { getSimpleTemplates, saveSimpleTemplate, deleteSimpleTemplate, type SimpleTemplate } from "./templateActions";

const BRAND: React.CSSProperties = {
  background: "linear-gradient(180deg,#6366F1,#4F46E5 55%,#4338CA)",
  boxShadow: "0 8px 20px -10px rgba(79,70,229,0.85), inset 0 1px 0 rgba(255,255,255,0.35)",
};

export default function SimpleTemplates<S extends Record<string, unknown>>({
  apply, snapshot, onReset,
}: {
  apply: (s: S) => void;
  snapshot: () => S;
  /** Remet le formulaire dans son état d'ouverture. */
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<SimpleTemplate[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);

  // Réponse inattendue (action serveur en échec, recompilation…) = liste vide.
  const refresh = async () => {
    const list = await getSimpleTemplates().catch(() => null);
    setTemplates(Array.isArray(list) ? list : []);
  };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(id);
  }, [flash]);

  const onSave = async () => {
    const n = name.trim();
    if (!n || saving) return;
    setSaving(true);
    try {
      await saveSimpleTemplate(n, snapshot());
      await refresh();
      setName("");
      setCurrent(n);
      setFlash(t("textOverlay.tplSaved", { name: n }));
    } finally {
      setSaving(false);
    }
  };
  const onLoad = (tpl: SimpleTemplate) => {
    apply(tpl.settings as S);
    setCurrent(tpl.name);
    setFlash(t("textOverlay.tplApplied", { name: tpl.name }));
  };
  const onDelete = async (n: string) => {
    setTemplates((l) => l.filter((x) => x.name !== n)); // optimiste
    if (current === n) setCurrent(null);
    await deleteSimpleTemplate(n).catch(() => {});
    await refresh();
  };

  return (
    <section data-tour-id="simple-templates" className="duup-glass duup-glass--carte rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500/15 text-indigo-500" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--app-text)]">{t("dashboard.videosAdvanced.templatesTitle")}</h3>
            <p className="mt-0.5 text-[12px] leading-snug text-[var(--app-text-muted)]">
              {flash ? <span className="font-semibold text-emerald-500">{flash}</span> : t("textOverlay.tplDesc")}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => { onReset(); setCurrent(null); setFlash(t("textOverlay.tplReset")); }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
          {t("textOverlay.tplReset")}
        </button>
      </div>

      {/* Enregistrer les réglages actuels */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void onSave(); } }}
          placeholder={t("textOverlay.tplPlaceholder")}
          maxLength={60}
          className="min-w-0 flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2.5 text-sm text-[var(--app-text)] placeholder-[var(--app-text-faint)] outline-none transition focus:border-indigo-400/70 focus:ring-2 focus:ring-indigo-500/15"
        />
        <button type="button" onClick={() => void onSave()} disabled={!name.trim() || saving}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${name.trim() && !saving ? "text-white" : "duup-btn cursor-not-allowed text-[var(--app-text-faint)]"}`}
          style={name.trim() && !saving ? BRAND : undefined}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
          {saving ? "…" : t("textOverlay.tplSave")}
        </button>
      </div>

      {/* Mes templates */}
      {templates.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-[var(--app-border-strong)] px-4 py-3 text-center text-[12px] text-[var(--app-text-faint)]">
          {t("textOverlay.tplEmpty")}
        </p>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => {
            const on = current === tpl.name;
            return (
              <div key={tpl.name}
                className={`group relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition ${on ? "border-indigo-400/70 bg-indigo-500/10 ring-1 ring-indigo-400/30" : "border-[var(--app-border)] bg-[var(--app-surface)] hover:border-indigo-400/50"}`}>
                <button type="button" onClick={() => onLoad(tpl)} title={t("vid.tpl.load")} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[12px] font-bold ${on ? "bg-indigo-500 text-white" : "bg-[var(--app-surface-2)] text-[var(--app-text-muted)]"}`}>
                    {tpl.name.trim().charAt(0).toUpperCase() || "T"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-[var(--app-text)]">{tpl.name}</span>
                    <span className="block text-[11px] text-[var(--app-text-faint)]">{on ? t("textOverlay.tplActive") : t("textOverlay.tplClick")}</span>
                  </span>
                </button>
                <button type="button" onClick={() => void onDelete(tpl.name)} title={t("vid.tpl.delete")} aria-label={t("vid.tpl.delete")}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--app-text-faint)] opacity-0 transition hover:bg-rose-500/10 hover:text-rose-500 focus:opacity-100 group-hover:opacity-100">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

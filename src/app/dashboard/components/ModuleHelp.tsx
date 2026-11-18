"use client";

// Aide du dashboard. Le bouton « Documentation » de chaque module
// (<ModuleHelp slug=… />) ouvre un panneau latéral avec l'aide de CE module,
// sans quitter la page. Le contenu vient de la même source que le centre
// d'aide public (helpCenterContent.ts) : résumé, premières étapes, encadrés
// « bon à savoir », sommaire, et lien vers la page complète du site.
// Rien n'est réécrit ici. Le chatbot et la page Aide lisent la même source
// (help-modules.tsx, support/page.tsx).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/lib/i18n/context";
import { publicPath } from "@/lib/i18n/routes";
import { HELP_CATEGORIES, HELP_DOCS, type HelpDoc } from "@/components/marketing/helpCenterContent";
import type { Block } from "@/components/marketing/apiDocsContent";

type Lang = "fr" | "en";

/** **gras** et `code` du contenu, aux couleurs du dashboard. */
export function AppRich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((p, i) =>
        p.startsWith("`") && p.endsWith("`") ? (
          <code key={i} className="rounded bg-[var(--app-surface-2)] px-1 py-0.5 font-mono text-[0.88em]">{p.slice(1, -1)}</code>
        ) : p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold text-[var(--app-text)]">{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** Adresse publique de la page d'aide dans la langue du dashboard. */
export function helpDocUrl(slug: string, lang: Lang, anchor?: string): string {
  return `${publicPath(lang, `/docs/${slug}`)}${anchor ? `#${anchor}` : ""}`;
}

/** Panneau d'aide d'une page (contrôlé). Rendu dans <body> : un parent en
 *  backdrop-filter piégerait le `fixed`. */
export function HelpPanel({ doc: docProp, onClose }: { doc: HelpDoc | null; onClose: () => void }) {
  const { t, locale } = useTranslation();
  const lang: Lang = locale === "fr" ? "fr" : "en";
  const [mounted, setMounted] = useState(false);
  // Page ouverte depuis « Voir aussi » (reste dans le panneau).
  const [shown, setShown] = useState<HelpDoc | null>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => setShown(null), [docProp]);
  const doc = docProp ? (shown ?? docProp) : null;
  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc, onClose]);
  if (!mounted || !doc) return null;

  const sections = doc.sections[lang];
  const all = sections.flatMap((s) => s.blocks);
  const steps = all.find((b): b is Extract<Block, { type: "steps" }> => b.type === "steps");
  const tips = all.filter((b): b is Extract<Block, { type: "callout" }> => b.type === "callout");
  const cat = HELP_CATEGORIES.find((c) => c.id === doc.category);
  const related = (doc.related ?? []).map((sl) => HELP_DOCS.find((d) => d.slug === sl)).filter((d): d is HelpDoc => !!d);

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={doc.title[lang]}>
      <button type="button" aria-label={t("dashboard.help.close")} onClick={onClose} className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-[var(--app-border)] font-normal shadow-2xl"
        style={{ background: "var(--app-bg)", color: "var(--app-text)" }}
      >
        <header className="flex items-start gap-3 border-b border-[var(--app-border)] px-6 pb-5 pt-6">
          <div className="min-w-0 flex-1">
            {cat && <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-faint)]">{cat.emoji} {cat.title[lang]}</p>}
            <h2 className="mt-1.5 text-[19px] font-semibold leading-snug">
              {doc.title[lang]}
              {doc.badge === "beta" && <span className="ml-2 rounded-full bg-indigo-500/15 px-2 py-0.5 align-middle text-[10.5px] font-semibold uppercase tracking-wider text-indigo-500">Beta</span>}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--app-text-muted)]">{doc.summary[lang]}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("dashboard.help.close")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <div key={doc.slug} className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {steps && (
            <section>
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--app-text-faint)]">{t("dashboard.help.steps")}</h3>
              <ol className="space-y-2.5">
                {steps.items.map((it, i) => (
                  <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-[var(--app-text)]">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white" style={{ background: "linear-gradient(180deg,#6366F1,#4F46E5)" }}>{i + 1}</span>
                    <span><AppRich text={it} /></span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {tips.length > 0 && (
            <section>
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--app-text-faint)]">{t("dashboard.help.tips")}</h3>
              <div className="space-y-2.5">
                {tips.map((b, i) => (
                  <div key={i} className={`rounded-xl px-3.5 py-3 text-[13px] leading-relaxed ring-1 ${b.tone === "warn" ? "bg-amber-500/10 ring-amber-500/25" : "bg-indigo-500/10 ring-indigo-500/20"} text-[var(--app-text)]`}>
                    <span className="mr-1.5" aria-hidden>{b.tone === "warn" ? "⚠️" : "💡"}</span>
                    <AppRich text={b.text} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {related.length > 0 && (
            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--app-text-faint)]">{t("dashboard.help.related")}</h3>
              <div className="grid gap-2">
                {related.map((r) => (
                  <button key={r.slug} type="button" onClick={() => setShown(r)}
                    className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2.5 text-left transition hover:border-indigo-400/50 hover:bg-[var(--app-surface-2)]">
                    <span className="block text-[13px] font-semibold text-[var(--app-text)]">
                      {r.title[lang]}
                      {r.badge === "beta" && <span className="ml-2 rounded-full bg-indigo-500/15 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-indigo-500">Beta</span>}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-[var(--app-text-muted)]">{r.summary[lang]}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--app-text-faint)]">{t("dashboard.help.sections")}</h3>
            <ul className="divide-y divide-[var(--app-border)] rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={helpDocUrl(doc.slug, lang, s.id)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] text-[var(--app-text)] transition hover:bg-[var(--app-surface-2)]">
                    {s.title}
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[var(--app-text-faint)]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M7 17l9.2-9.2M17 17V7H7" /></svg>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="flex flex-col gap-2 border-t border-[var(--app-border)] px-6 py-4 sm:flex-row">
          <a href={helpDocUrl(doc.slug, lang)} target="_blank" rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold text-white"
            style={{ background: "linear-gradient(180deg,#6366F1,#4F46E5 55%,#4338CA)" }}>
            {t("dashboard.help.full")}
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M7 17l9.2-9.2M17 17V7H7" /></svg>
          </a>
          <a href="/dashboard/support"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--app-border)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]">
            {t("dashboard.help.allHelp")}
          </a>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

function DocIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

/** Bouton « Documentation » d'un module : ouvre l'aide de la page `slug`. */
export function ModuleHelp({ slug, className }: { slug: string; className?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const doc = HELP_DOCS.find((d) => d.slug === slug) ?? null;
  if (!doc) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-tour-id="module-help"
        aria-label={t("dashboard.docs.button")}
        title={t("dashboard.docs.button")}
        className={className ?? "ws-pill inline-flex items-center gap-2 rounded-full p-2 sm:px-3.5 sm:py-1.5 text-sm font-medium text-[var(--app-text-muted)] hover:text-[var(--app-text)]"}
      >
        <DocIcon className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">{t("dashboard.docs.button")}</span>
      </button>
      <HelpPanel doc={open ? doc : null} onClose={() => setOpen(false)} />
    </>
  );
}

/** Bouton qui ouvre une page publique (ex. la doc de l'API) dans un onglet. */
export function ExternalDocLink({ path }: { path: string }) {
  const { t, locale } = useTranslation();
  return (
    <a href={publicPath(locale === "fr" ? "fr" : "en", path)} target="_blank" rel="noopener noreferrer" title={t("dashboard.docs.button")}
      className="ws-pill inline-flex items-center gap-2 rounded-full p-2 sm:px-3.5 sm:py-1.5 text-sm font-medium text-[var(--app-text-muted)] hover:text-[var(--app-text)]">
      <DocIcon className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">{t("dashboard.docs.button")}</span>
    </a>
  );
}

/** Blocs du contenu partagé, aux couleurs du dashboard (chatbot, page Aide).
 *  Les schémas du site (blocs « visual ») sont pensés pour le thème clair du
 *  site : ils ne sont pas repris ici. */
export function HelpBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-3.5 text-[14px] font-normal leading-relaxed text-[var(--app-text)]">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "p": return <p key={i}><AppRich text={b.text} /></p>;
          case "list": return (
            <ul key={i} className="space-y-2">
              {b.items.map((it, j) => <li key={j} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400/80" /><span><AppRich text={it} /></span></li>)}
            </ul>
          );
          case "steps": return (
            <ol key={i} className="space-y-2">
              {b.items.map((it, j) => <li key={j} className="flex gap-2.5"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-500/15 text-[11px] font-semibold text-indigo-500">{j + 1}</span><span><AppRich text={it} /></span></li>)}
            </ol>
          );
          case "table": return (
            <div key={i} className="overflow-x-auto rounded-xl border border-[var(--app-border)]">
              <table className="w-full border-collapse text-left text-[12.5px]">
                <thead><tr className="bg-[var(--app-surface-2)]">{b.head.map((h, j) => <th key={j} className="px-3 py-2 font-semibold text-[var(--app-text)]">{h}</th>)}</tr></thead>
                <tbody>{b.rows.map((r, j) => <tr key={j} className="border-t border-[var(--app-border)] align-top">{r.map((c, k) => <td key={k} className={`px-3 py-2 ${k === 0 ? "font-medium text-[var(--app-text)]" : ""}`}><AppRich text={c} /></td>)}</tr>)}</tbody>
              </table>
            </div>
          );
          case "callout": return (
            <div key={i} className={`rounded-xl px-3.5 py-3 ring-1 ${b.tone === "warn" ? "bg-amber-500/10 ring-amber-500/25" : "bg-indigo-500/10 ring-indigo-500/20"}`}>
              <span className="mr-1.5" aria-hidden>{b.tone === "warn" ? "⚠️" : "💡"}</span><AppRich text={b.text} />
            </div>
          );
          case "code": return <pre key={i} className="overflow-x-auto rounded-xl bg-[var(--app-surface-2)] p-3 font-mono text-[12px]">{b.code}</pre>;
          default: return null;
        }
      })}
    </div>
  );
}

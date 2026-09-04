"use client";

// ══════════════════════════════════════════════════════════════════════════
// ARTICLES D'AIDE — réservés au widget de chat.
//
// La documentation des modules (docs-content.tsx) explique COMMENT une
// fonctionnalité marche : elle est ouverte depuis le module concerné, à côté
// du formulaire. Ces articles-ci répondent à autre chose — « ça n'a pas marché
// comme prévu, pourquoi ? ». Ils n'ont pas leur place dans la doc d'un module
// (ils la parasiteraient) mais ce sont les questions que le support reçoit.
//
// Même forme que buildAllDocs() : le widget les affiche et les indexe sans
// traitement particulier.
// ══════════════════════════════════════════════════════════════════════════

import type { DocModule } from "./docs-content";

type T = (key: string, vars?: Record<string, string | number>) => string;

const icon = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

/** Liste à puces — le terme avant le « — » est mis en gras (lecture en diagonale). */
function bulletList(lines: string[]) {
  return (
    <ul className="space-y-3.5">
      {lines.map((l, i) => {
        const idx = l.indexOf("—");
        const name = idx > -1 ? l.slice(0, idx).trim() : null;
        const rest = idx > -1 ? l.slice(idx + 1).trim() : l;
        return (
          <li key={i} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400/80" />
            <span>{name && <strong className="text-[var(--app-text)]">{name}</strong>}{name ? " — " : ""}{rest}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Liste numérotée — pour les marches à suivre (l'ordre compte). */
function stepList(lines: string[]) {
  return (
    <ol className="space-y-3.5">
      {lines.map((l, i) => {
        const idx = l.indexOf("—");
        const name = idx > -1 ? l.slice(0, idx).trim() : null;
        const rest = idx > -1 ? l.slice(idx + 1).trim() : l;
        return (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-[11px] font-bold text-indigo-400">{i + 1}</span>
            <span>{name && <strong className="text-[var(--app-text)]">{name}</strong>}{name ? " — " : ""}{rest}</span>
          </li>
        );
      })}
    </ol>
  );
}

function callout(text: string) {
  return (
    <p className="rounded-xl px-4 py-3.5 text-[var(--app-text-muted)]" style={{ background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.22)" }}>
      {text}
    </p>
  );
}

/** « Mes vidéos sont détectées comme non-originales » */
function detectedBody(t: T) {
  return (
    <div className="space-y-5">
      <p>{t("help.detected.intro")}</p>
      {bulletList([
        t("help.detected.light"),
        t("help.detected.tooMany"),
      ])}
      {callout(t("help.detected.reco"))}
    </div>
  );
}

/* ─────────────────────────── Éditeur IA ─────────────────────────── */
/* Ce module n'a pas de documentation dans son écran (pas de bouton
   « Documentations » : la page est déjà un pas-à-pas). Ces articles sont donc
   le SEUL endroit où le parcours complet est écrit. */

function editorHowBody(t: T) {
  return (
    <div className="space-y-5">
      <p>{t("help.editor.how.intro")}</p>
      {stepList([
        t("help.editor.how.s1"),
        t("help.editor.how.s2"),
        t("help.editor.how.s3"),
        t("help.editor.how.s4"),
      ])}
      {callout(t("help.editor.how.reco"))}
    </div>
  );
}

function editorRefBody(t: T) {
  return (
    <div className="space-y-5">
      <p>{t("help.editor.ref.intro")}</p>
      {bulletList([
        t("help.editor.ref.mine"),
        t("help.editor.ref.competitor"),
        t("help.editor.ref.input"),
      ])}
      {callout(t("help.editor.ref.reco"))}
    </div>
  );
}

function editorPromptBody(t: T) {
  return (
    <div className="space-y-5">
      <p>{t("help.editor.prompt.intro")}</p>
      {bulletList([
        t("help.editor.prompt.look"),
        t("help.editor.prompt.several"),
        t("help.editor.prompt.iterate"),
        t("help.editor.prompt.describe"),
      ])}
      {callout(t("help.editor.prompt.reco"))}
    </div>
  );
}

function editorNoVariantBody(t: T) {
  return (
    <div className="space-y-5">
      <p>{t("help.editor.novariant.intro")}</p>
      {bulletList([
        t("help.editor.novariant.connector"),
        t("help.editor.novariant.ref"),
        t("help.editor.novariant.material"),
        t("help.editor.novariant.quota"),
      ])}
      {callout(t("help.editor.novariant.reco"))}
    </div>
  );
}

function editorLimitsBody(t: T) {
  return (
    <div className="space-y-5">
      <p>{t("help.editor.limits.intro")}</p>
      {bulletList([
        t("help.editor.limits.material"),
        t("help.editor.limits.editorial"),
        t("help.editor.limits.motion"),
      ])}
      {callout(t("help.editor.limits.reco"))}
    </div>
  );
}

export function buildEditorArticles(t: T): DocModule {
  return {
    id: "help-editor",
    label: t("help.editor.group"),
    icon: icon(<><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z" /><path d="M18.5 15.5l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z" /></>),
    docs: [
      { title: t("help.editor.how.title"), body: editorHowBody(t) },
      { title: t("help.editor.ref.title"), body: editorRefBody(t) },
      { title: t("help.editor.prompt.title"), body: editorPromptBody(t) },
      { title: t("help.editor.novariant.title"), body: editorNoVariantBody(t) },
      { title: t("help.editor.limits.title"), body: editorLimitsBody(t) },
    ],
  };
}

export function buildHelpArticles(t: T): DocModule {
  return {
    id: "help",
    label: t("help.group"),
    icon: icon(<><circle cx="12" cy="12" r="9" /><path d="M9.6 9.2a2.5 2.5 0 1 1 3.3 2.9c-.6.2-.9.8-.9 1.4v.4" /><circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" /></>),
    docs: [{ title: t("help.detected.title"), body: detectedBody(t) }],
  };
}

"use client";

// Page Aide du dashboard (ex-Support) : recherche, toutes les pages du centre
// d'aide rangées par rubrique (un clic ouvre le panneau d'aide, sans quitter
// le dashboard), les problèmes fréquents, puis le contact. Même source que le
// site et que les boutons « Documentation » des modules (helpCenterContent.ts).

import { useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { HELP_CATEGORIES, HELP_DOCS, type HelpDoc } from "@/components/marketing/helpCenterContent";
import { HelpPanel, HelpBlocks, ExternalDocLink } from "../components/ModuleHelp";

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function SupportPage() {
  const { t, locale } = useTranslation();
  const lang: "fr" | "en" = locale === "fr" ? "fr" : "en";
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<HelpDoc | null>(null);

  const words = norm(q).split(/\s+/).filter(Boolean);
  const hay = useMemo(
    () => new Map(HELP_DOCS.map((d) => [d.slug, norm([d.title[lang], d.summary[lang], ...d.sections[lang].map((s) => s.title), ...d.faq[lang].map((f) => f.q)].join(" "))])),
    [lang],
  );
  const groups = HELP_CATEGORIES
    .map((c) => ({ c, docs: HELP_DOCS.filter((d) => d.category === c.id && (!words.length || words.every((w) => hay.get(d.slug)!.includes(w)))) }))
    .filter((g) => g.docs.length);
  const trouble = HELP_DOCS.find((d) => d.slug === "depannage");

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-6 py-10">
      {/* En-tête + recherche */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--app-text)]">{t("dashboard.help.pageTitle")}</h1>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">{t("dashboard.help.pageLead")}</p>
          <div className="relative mt-5 max-w-xl">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-faint)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("dashboard.help.search")}
              aria-label={t("dashboard.help.search")}
              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] py-2.5 pl-10 pr-3.5 text-sm text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-text-faint)] focus:border-indigo-400/70 focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>
        </div>
        <ExternalDocLink path="/docs" />
      </header>

      {/* Pages d'aide par rubrique */}
      {groups.length === 0 && <p className="text-sm text-[var(--app-text-muted)]">{t("dashboard.help.noResult")}</p>}
      {groups.map(({ c, docs }) => (
        <section key={c.id}>
          <h2 className="text-[15px] font-semibold text-[var(--app-text)]">{c.emoji} {c.title[lang]}</h2>
          <p className="mt-0.5 text-[13px] text-[var(--app-text-muted)]">{c.lead[lang]}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((d) => (
              <button
                key={d.slug}
                type="button"
                onClick={() => setOpen(d)}
                className="duup-glass duup-glass--carte group flex flex-col rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:border-indigo-400/50"
              >
                <span className="text-[14px] font-semibold text-[var(--app-text)]">
                  {d.title[lang]}
                  {d.badge === "beta" && <span className="ml-2 rounded-full bg-indigo-500/15 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-indigo-500">Beta</span>}
                </span>
                <span className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-[var(--app-text-muted)]">{d.summary[lang]}</span>
                <span className="mt-3 text-[12px] font-semibold text-indigo-500 opacity-80 transition group-hover:opacity-100">{t("dashboard.help.open")} →</span>
              </button>
            ))}
          </div>
        </section>
      ))}

      {/* Problèmes fréquents (page Dépannage, en entier) */}
      {!words.length && trouble && (
        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 sm:p-6">
          <h2 className="text-[15px] font-semibold text-[var(--app-text)]">🛠️ {t("dashboard.help.troubleTitle")}</h2>
          <div className="mt-4 space-y-5">
            {trouble.sections[lang].filter((s) => s.id !== "contact").map((s) => (
              <div key={s.id}>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--app-text-faint)]">{s.title}</h3>
                <HelpBlocks blocks={s.blocks} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      <section>
        <h2 className="text-[15px] font-semibold text-[var(--app-text)]">💬 {t("dashboard.help.contactTitle")}</h2>
        <p className="mt-0.5 text-[13px] text-[var(--app-text-muted)]">{t("dashboard.support.subtitle")}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <a href="https://t.me/DuupFlow_Support" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 transition hover:bg-[var(--app-surface-2)]">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#229ED9]/10">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#229ED9]" fill="currentColor" aria-hidden>
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-[var(--app-text)]">{t("dashboard.support.telegram")}</span>
              <span className="mt-0.5 block text-xs text-[var(--app-text-faint)]">{t("dashboard.support.telegramDesc")}</span>
            </span>
          </a>
          <a href="mailto:hello@duupflow.com"
            className="flex items-center gap-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 transition hover:bg-[var(--app-surface-2)]">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/10">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-[var(--app-text)]">{t("dashboard.support.email")}</span>
              <span className="mt-0.5 block text-xs text-[var(--app-text-faint)]">{t("dashboard.support.emailDesc")}</span>
            </span>
          </a>
        </div>
      </section>

      <HelpPanel doc={open} onClose={() => setOpen(null)} />
    </div>
  );
}

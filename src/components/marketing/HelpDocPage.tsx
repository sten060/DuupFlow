"use client";

// Centre d'aide public — V1 « texte d'abord » (une page par fonctionnalité).
// Même mise en page que /docs/api (thème clair Lunera) : sommaire collant à
// gauche, sections en cartes, FAQ. Le contenu vit dans helpCenterContent.ts ;
// la V2 pourra refaire le design en gardant les mêmes URL.

import Link from "@/components/LocaleLink";
import { useEffect, useState } from "react";
import { Label, CTA_GRAD, SECTION_LEAD } from "@/components/landing/shell";
import { BlockView, Rich } from "./ApiDocsPage";
import type { Lang } from "./apiDocsContent";
import { HELP_DOCS, HELP_UI, type HelpDoc } from "./helpCenterContent";

export function HelpDocPage({ doc, lang }: { doc: HelpDoc; lang: Lang }) {
  const ui = HELP_UI[lang];
  const sections = doc.sections[lang];
  const faq = doc.faq[lang];
  const toc = [...sections.map((s) => ({ id: s.id, title: s.title })), ...(faq.length ? [{ id: "faq", title: ui.faq }] : [])];
  const [active, setActive] = useState(toc[0]?.id);

  // Sommaire : surligne la section visible.
  useEffect(() => {
    const els = toc.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [doc.slug, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const others = HELP_DOCS.filter((d) => d.slug !== doc.slug);

  return (
    <main className="px-4 pb-24 sm:px-6">
      <header className="mx-auto max-w-[1120px] pb-10 pt-6 sm:pt-10">
        <nav className="mb-5 text-[13px] text-[#8a8f99]" aria-label="Breadcrumb">
          <Link href="/docs" className="hover:text-[#1a1a1a]">{ui.title}</Link>
          <span className="mx-2">/</span>
          <span className="text-[#3a3f4b]">{doc.title[lang]}</span>
        </nav>
        <Label>{ui.label}</Label>
        <h1 className="mt-5 font-semibold tracking-[-0.03em] text-[#1a1a1a]" style={{ fontSize: "clamp(32px, 4.6vw, 52px)", lineHeight: 1.06 }}>
          {doc.title[lang]}
        </h1>
        <p className={`mt-4 max-w-[720px] ${SECTION_LEAD}`}>{doc.summary[lang]}</p>
      </header>

      <div className="mx-auto grid max-w-[1120px] gap-10 lg:grid-cols-[220px_1fr]">
        <nav className="hidden lg:block" aria-label={ui.toc}>
          <div className="sticky top-28">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8f99]">{ui.toc}</p>
            <ul className="space-y-0.5 border-l border-black/[0.08]">
              {toc.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className={`-ml-px block border-l-2 py-1.5 pl-3 text-[13.5px] transition ${
                      active === s.id ? "border-[#4f7bff] font-medium text-[#1a1a1a]" : "border-transparent text-[#605f5f] hover:text-[#1a1a1a]"
                    }`}
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="min-w-0 space-y-6">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-28 rounded-[24px] bg-white p-6 ring-1 ring-black/[0.06] sm:p-7">
              <h2 className="text-[21px] font-semibold tracking-[-0.02em] text-[#1a1a1a]">{s.title}</h2>
              <div className="mt-4 space-y-4">
                {s.blocks.map((b, i) => <BlockView key={i} b={b} lang={lang} />)}
              </div>
            </section>
          ))}

          {faq.length > 0 && (
            <section id="faq" className="scroll-mt-28 rounded-[24px] bg-white p-6 ring-1 ring-black/[0.06] sm:p-7">
              <h2 className="text-[21px] font-semibold tracking-[-0.02em] text-[#1a1a1a]">{ui.faq}</h2>
              <div className="mt-4 divide-y divide-black/[0.06]">
                {faq.map((f, i) => (
                  <div key={i} className="py-4 first:pt-0 last:pb-0">
                    <h3 className="text-[15.5px] font-semibold text-[#1a1a1a]">{f.q}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-[#3a3f4b]"><Rich text={f.a} /></p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Autres pages du centre d'aide */}
          <section className="rounded-[24px] p-6 ring-1 ring-black/[0.06] sm:p-7" style={{ background: "linear-gradient(180deg,#fcfcfe 0%,#f1f3f7 100%)" }}>
            <h2 className="text-[17px] font-semibold text-[#1a1a1a]">{ui.more}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {others.map((d) => (
                <Link key={d.slug} href={`/docs/${d.slug}`} className="rounded-full bg-white px-3.5 py-1.5 text-[13.5px] font-medium text-[#1a1a1a] ring-1 ring-black/[0.08] transition hover:ring-[#4f7bff]/40">
                  {d.title[lang]}
                </Link>
              ))}
              <Link href="/docs/api" className="rounded-full bg-white px-3.5 py-1.5 text-[13.5px] font-medium text-[#1a1a1a] ring-1 ring-black/[0.08] transition hover:ring-[#4f7bff]/40">API</Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

/* Index du centre d'aide : une carte par fonctionnalité. */
export function HelpIndexPage({ lang }: { lang: Lang }) {
  const ui = HELP_UI[lang];
  return (
    <main className="px-4 pb-24 sm:px-6">
      <header className="mx-auto max-w-[1120px] pb-10 pt-6 sm:pt-10">
        <Label>{ui.label}</Label>
        <h1 className="mt-5 font-semibold tracking-[-0.03em] text-[#1a1a1a]" style={{ fontSize: "clamp(32px, 4.6vw, 52px)", lineHeight: 1.06 }}>
          {ui.title}
        </h1>
        <p className={`mt-4 max-w-[720px] ${SECTION_LEAD}`}>{ui.lead}</p>
      </header>
      <div className="mx-auto grid max-w-[1120px] gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {HELP_DOCS.map((d) => (
          <Link key={d.slug} href={`/docs/${d.slug}`} className="group rounded-[22px] bg-white p-6 ring-1 ring-black/[0.06] transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(20,40,90,0.10)] hover:ring-[#4f7bff]/30">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[#1a1a1a]">{d.title[lang]}</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[#605f5f]">{d.summary[lang]}</p>
            <span className="mt-4 inline-block text-[13.5px] font-semibold" style={{ backgroundImage: CTA_GRAD, WebkitBackgroundClip: "text", color: "transparent" }}>{ui.read} →</span>
          </Link>
        ))}
        <Link href="/docs/api" className="group rounded-[22px] bg-white p-6 ring-1 ring-black/[0.06] transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(20,40,90,0.10)] hover:ring-[#4f7bff]/30">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[#1a1a1a]">API</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-[#605f5f]">{ui.apiSummary}</p>
          <span className="mt-4 inline-block text-[13.5px] font-semibold" style={{ backgroundImage: CTA_GRAD, WebkitBackgroundClip: "text", color: "transparent" }}>{ui.read} →</span>
        </Link>
      </div>
    </main>
  );
}

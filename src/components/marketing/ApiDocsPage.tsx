"use client";

// Page publique « Documentation API » (thème clair Lunera, cf. landing/README.md).
// Le contenu vit dans apiDocsContent.ts ; ce fichier ne fait que la mise en page :
// sommaire collant à gauche, sections numérotées point par point, blocs de code
// copiables, tableaux.

import Link from "next/link";
import { useEffect, useState } from "react";
import { Label, CTA_GRAD, SECTION_LEAD } from "@/components/landing/shell";
import { SECTIONS, SUMMARY, UI, type Block, type Lang } from "./apiDocsContent";

const TELEGRAM = "https://t.me/DuupFlow_Support";

/** `code` et **gras** dans les textes du contenu. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("`") && p.endsWith("`") ? (
          <code key={i} className="rounded-md bg-[#eef1f8] px-1.5 py-0.5 font-mono text-[0.86em] text-[#2b3a67]">
            {p.slice(1, -1)}
          </code>
        ) : p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold text-[#1a1a1a]">{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function CodeBlock({ code, label, copyLabel, copiedLabel }: { code: string; label?: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl bg-[#0f1325] ring-1 ring-black/10">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/45">{label ?? "JSON"}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            });
          }}
          className="rounded-md px-2 py-1 text-[11px] font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 text-[12.5px] leading-relaxed text-[#dfe6ff]">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

function BlockView({ b, lang }: { b: Block; lang: Lang }) {
  const ui = UI[lang];
  switch (b.type) {
    case "p":
      return <p className="text-[15px] leading-relaxed text-[#3a3f4b]"><Rich text={b.text} /></p>;
    case "list":
      return (
        <ul className="space-y-2">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-[#3a3f4b]">
              <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#4f7bff]" />
              <span><Rich text={it} /></span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="space-y-2.5">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-[#3a3f4b]">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                style={{ background: CTA_GRAD }}
              >
                {i + 1}
              </span>
              <span className="pt-0.5"><Rich text={it} /></span>
            </li>
          ))}
        </ol>
      );
    case "code":
      return <CodeBlock code={b.code} label={b.label} copyLabel={ui.copy} copiedLabel={ui.copied} />;
    case "table":
      return (
        <div className="overflow-x-auto rounded-2xl ring-1 ring-black/[0.07]">
          <table className="w-full min-w-[520px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="bg-[#f6f7f9]">
                {b.head.map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#605f5f]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i} className="border-t border-black/[0.06] align-top">
                  {r.map((c, j) => (
                    <td key={j} className={`px-4 py-2.5 leading-relaxed ${j === 0 ? "font-medium text-[#1a1a1a]" : "text-[#3a3f4b]"}`}>
                      {j === 0 && /^[a-z_]+$/.test(c) ? <code className="font-mono text-[13px] text-[#2b3a67]">{c}</code> : <Rich text={c} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "callout":
      return (
        <div
          className={`rounded-2xl px-4 py-3.5 text-[14.5px] leading-relaxed ring-1 ${
            b.tone === "warn" ? "bg-[#fff8ec] text-[#5b4517] ring-[#f3dcae]" : "bg-[#f1f5ff] text-[#28365e] ring-[#d6e1ff]"
          }`}
        >
          <Rich text={b.text} />
        </div>
      );
    case "endpoint":
      return (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#f6f7f9] px-4 py-3 ring-1 ring-black/[0.06]">
          <span
            className={`rounded-md px-2 py-0.5 font-mono text-[12px] font-bold ${
              b.method === "GET" ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"
            }`}
          >
            {b.method}
          </span>
          <code className="font-mono text-[14px] font-semibold text-[#1a1a1a]">/api/v1{b.path}</code>
          <span className="text-[13.5px] text-[#605f5f]">{b.summary}</span>
        </div>
      );
  }
}

export default function ApiDocsPage({ lang }: { lang: Lang }) {
  const ui = UI[lang];
  const sections = SECTIONS[lang];
  const [active, setActive] = useState(sections[0]?.id);

  // Sommaire : surligne la section visible.
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections]);

  return (
    <main className="px-4 pb-24 sm:px-6">
      {/* En-tête */}
      <header className="mx-auto max-w-[1120px] pb-10 pt-6 sm:pt-10">
        <Label>{ui.label}</Label>
        <h1 className="mt-5 font-semibold tracking-[-0.03em] text-[#1a1a1a]" style={{ fontSize: "clamp(32px, 4.6vw, 52px)", lineHeight: 1.06 }}>
          {ui.h1}
        </h1>
        <p className={`mt-4 max-w-[720px] ${SECTION_LEAD}`}>{ui.lead}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/${lang}/pricing`}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(79,123,255,0.30)] transition hover:opacity-95"
            style={{ background: CTA_GRAD }}
          >
            {ui.cta} <span aria-hidden>→</span>
          </Link>
          <a
            href={TELEGRAM}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-[#1a1a1a] ring-1 ring-black/10 transition hover:bg-[#f6f7f9]"
          >
            {ui.ctaSecondary}
          </a>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1120px] gap-10 lg:grid-cols-[220px_1fr]">
        {/* Sommaire */}
        <nav className="hidden lg:block" aria-label={ui.toc}>
          <div className="sticky top-28">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8f99]">{ui.toc}</p>
            <ul className="space-y-0.5 border-l border-black/[0.08]">
              {sections.map((s) => (
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
          {/* Résumé */}
          <section
            className="rounded-[24px] p-6 ring-1 ring-black/[0.06] shadow-[0_18px_48px_rgba(20,40,90,0.08)]"
            style={{ background: "linear-gradient(180deg,#fcfcfe 0%,#f1f3f7 100%)" }}
          >
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[#1a1a1a]">{ui.summaryTitle}</h2>
            <ul className="mt-4 space-y-2.5">
              {SUMMARY[lang].map((it, i) => (
                <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed text-[#3a3f4b]">
                  <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#7c5cff]" />
                  <span><Rich text={it} /></span>
                </li>
              ))}
            </ul>
          </section>

          {/* Sections */}
          {sections.map((s) => (
            <section
              key={s.id}
              id={s.id}
              className="scroll-mt-28 rounded-[24px] bg-white p-6 ring-1 ring-black/[0.06] sm:p-7"
            >
              <h2 className="text-[21px] font-semibold tracking-[-0.02em] text-[#1a1a1a]">{s.title}</h2>
              <div className="mt-4 space-y-4">
                {s.blocks.map((b, i) => (
                  <BlockView key={i} b={b} lang={lang} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

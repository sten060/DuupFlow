"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";
import LanguageSwitch from "@/components/LanguageSwitch";
import { TIKTOK_GUIDE } from "./content";

export default function TikTokGuideClient() {
  const { t, locale } = useTranslation();
  const [active, setActive] = useState<string>(TIKTOK_GUIDE[0]?.id ?? "");

  // Scroll-spy: highlight the chapter whose section sits near the top of the viewport.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive((visible[0].target as HTMLElement).id);
      },
      { rootMargin: "-15% 0px -75% 0px", threshold: 0 },
    );
    TIKTOK_GUIDE.forEach((c) => {
      const el = document.getElementById(c.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const go = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <main className="relative p-6">
      <div
        className="fixed top-0 left-56 right-0 h-[500px] pointer-events-none"
        style={{
          background:
            "radial-gradient(800px 400px at 50% -100px, rgba(56,189,248,.10), transparent 70%)",
        }}
      />

      <style>{`
        .guide-prose h3{font-size:1.15rem;font-weight:700;color:#fff;margin:1.8rem 0 .55rem}
        .guide-prose p{color:rgba(255,255,255,.7);line-height:1.75;margin:.6rem 0}
        .guide-prose ul,.guide-prose ol{color:rgba(255,255,255,.7);line-height:1.75;margin:.6rem 0 .6rem 1.25rem}
        .guide-prose ul{list-style:disc}
        .guide-prose ol{list-style:decimal}
        .guide-prose li{margin:.3rem 0}
        .guide-prose strong{color:#fff;font-weight:600}
      `}</style>

      <div className="relative mx-auto flex max-w-5xl gap-10">
        {/* Article */}
        <article className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/dashboard/videos/advanced"
              className="text-sm text-white/50 transition hover:text-white/80"
            >
              ← {t("dashboard.tiktokGuide.back")}
            </Link>
            <LanguageSwitch />
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            {t("dashboard.tiktokGuide.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-white/55">{t("dashboard.tiktokGuide.subtitle")}</p>

          <div className="mt-12 space-y-16">
            {TIKTOK_GUIDE.map((c) => (
              <section key={c.id} id={c.id} className="scroll-mt-24">
                <div className="font-mono text-sm font-semibold tracking-[0.25em] text-sky-400">
                  {c.num}
                </div>
                <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                  {c.title[locale]}
                </h2>
                <p className="mt-1.5 text-white/45">{c.lead[locale]}</p>
                <div className="guide-prose mt-4">{c.body[locale]}</div>
              </section>
            ))}
          </div>
        </article>

        {/* Sticky table of contents */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-8">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
              {t("dashboard.tiktokGuide.toc")}
            </div>
            <ul className="space-y-1">
              {TIKTOK_GUIDE.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => go(c.id)}
                    className={`flex w-full items-baseline gap-2 rounded-md border-l-2 px-3 py-1.5 text-left text-sm transition ${
                      active === c.id
                        ? "border-sky-400 bg-sky-400/10 text-white"
                        : "border-transparent text-white/50 hover:text-white/80"
                    }`}
                  >
                    <span className="font-mono text-xs text-sky-400/80">{c.num}</span>
                    <span>{c.title[locale]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}

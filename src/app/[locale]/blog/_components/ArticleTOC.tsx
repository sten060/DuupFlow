"use client";

import { useEffect, useState } from "react";

export type TocSection = { id: string; label: string };

/**
 * Sticky table of contents for an article.
 *
 * - Lists each H2 section with a leading number.
 * - Highlights the section currently in the viewport using
 *   IntersectionObserver — the active item gets an indigo left border
 *   and brighter text, matching the Gaating-style sidebar in the design
 *   reference.
 * - Click → smooth-scrolls to the corresponding heading.
 * - Hidden on screens narrower than `lg` to keep the article centered on
 *   mobile/tablet (no horizontal cram).
 */
export default function ArticleTOC({ sections }: { sections: TocSection[] }) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    if (sections.length === 0) return;

    // The rootMargin creates a narrow detection band ~10–30% from the top of
    // the viewport. A heading is "active" when it crosses that band on scroll.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );

    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    // We let CSS handle the scroll offset via `scroll-mt-*` on the headings.
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  }

  return (
    <nav aria-label="Sommaire de l'article" className="text-sm">
      <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-white/40 mb-4">
        Sommaire
      </p>
      <ol className="space-y-1">
        {sections.map((s, i) => {
          const isActive = s.id === activeId;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => handleClick(e, s.id)}
                className={[
                  "block relative pl-4 pr-2 py-2 transition leading-snug",
                  "border-l-2",
                  isActive
                    ? "border-indigo-400 text-white"
                    : "border-white/10 text-white/55 hover:text-white/85 hover:border-white/25",
                ].join(" ")}
              >
                <span className="text-white/40 mr-1.5">{i + 1}.</span>
                {s.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

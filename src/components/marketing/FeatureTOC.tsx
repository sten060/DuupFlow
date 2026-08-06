"use client";

import { useEffect, useState } from "react";

export type TocSection = { id: string; label: string };

/**
 * Sticky table of contents for a marketing feature page.
 *
 * Mirrors the blog's ArticleTOC (indigo active border, IntersectionObserver
 * scroll-spy, lg-only) but takes a localized heading label so an EN page shows
 * "Contents" instead of the blog's hardcoded French "Sommaire".
 */
export default function FeatureTOC({ sections, label }: { sections: TocSection[]; label: string }) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
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
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  }

  return (
    <nav aria-label={label} className="text-sm">
      <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#8a8a8a] mb-4">
        {label}
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
                  "block relative pl-4 pr-2 py-2 transition leading-snug border-l-2",
                  isActive
                    ? "border-[#4f7bff] text-[#1a1a1a]"
                    : "border-black/10 text-[#3f4453] hover:text-[#1a1a1a] hover:border-black/25",
                ].join(" ")}
              >
                <span className="text-[#8a8a8a] mr-1.5">{i + 1}.</span>
                {s.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

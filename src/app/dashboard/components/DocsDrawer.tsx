"use client";

// Reusable "Documentation" button + right-side slide-in drawer (35% of the
// screen). Replaces the scattered header "i" / TikTok icons: every help topic
// for a module lives here, one topic per collapsible entry so users scan the
// titles and open only what they need. Drop it into any module header:
//
//   <DocsDrawer docs={[{ title, body }, …]} />

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/lib/i18n/context";

export type DocEntry = { title: string; body: React.ReactNode };

export default function DocsDrawer({ docs }: { docs: DocEntry[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // First topic expanded by default so the panel is never empty on open.
  const [expanded, setExpanded] = useState<number | null>(0);

  useEffect(() => setMounted(true), []);

  // Close on Escape + lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-white/70 hover:bg-white/[0.09] hover:text-white transition"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        {t("dashboard.docs.button")}
      </button>

      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[120]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Drawer — 35% of the screen, slides in from the right */}
          <aside
            className="absolute right-0 top-0 h-full flex flex-col shadow-2xl animate-[duupDocsIn_.25s_ease-out]"
            style={{ width: "35%", minWidth: 360, maxWidth: 680, background: "#0b1024", borderLeft: "1px solid rgba(255,255,255,0.10)" }}
          >
            <style>{`@keyframes duupDocsIn{from{transform:translateX(24px);opacity:.4}to{transform:translateX(0);opacity:1}}`}</style>

            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-white/[0.08] shrink-0">
              <div className="flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-indigo-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                <h2 className="text-lg font-semibold text-white">{t("dashboard.docs.title")}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-white/40 hover:text-white/80 transition"
                aria-label={t("dashboard.docs.close")}
              >
                <svg viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            {/* Topic list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {docs.map((d, i) => {
                const isOpen = expanded === i;
                return (
                  <div
                    key={i}
                    className="rounded-xl overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : i)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition"
                    >
                      <span className="text-sm font-semibold text-white/90">{d.title}</span>
                      <svg
                        viewBox="0 0 24 24"
                        className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" strokeWidth="2"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-0.5 text-[13px] leading-relaxed text-white/60">
                        {d.body}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}

"use client";

// App-wide documentation hub. A "Documentation" button (used on the dashboard
// home) opens a large 3-pane window:
//   modules  →  topics of the selected module  →  topic content
// Plus a "Contact support" button pinned to the topics column.

import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Manrope } from "next/font/google";
import { useTranslation } from "@/lib/i18n/context";
import { buildAllDocs } from "./docs-content";

const docsFont = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const TELEGRAM_SUPPORT = "https://t.me/DuupFlow_Support";
// Separators between module groups — mirrors the classic sidebar grouping:
// [Images, Vidéos] · [Compresseur, Comparateur] · [Variation IA, Détection IA] · [API].
const GROUP_BREAKS = new Set([2, 4, 6]);

export default function GlobalDocsDrawer() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mod, setMod] = useState(0);
  const [topic, setTopic] = useState(0);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  const modules = buildAllDocs(t);
  const currentModule = modules[mod] ?? modules[0];
  const currentTopic = currentModule?.docs[topic] ?? currentModule?.docs[0];

  return (
    <>
      <button
        type="button"
        onClick={() => { setMod(0); setTopic(0); setOpen(true); }}
        className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        {t("dashboard.docs.button")}
      </button>

      {mounted && open && createPortal(
        <div className={`fixed inset-0 z-[120] flex items-center justify-center p-4 ${docsFont.className}`}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div
            className="relative flex w-full max-w-[1180px] h-[86vh] rounded-2xl overflow-hidden shadow-2xl animate-[duupDocsIn_.2s_ease-out]"
            style={{ background: "#0b1024", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            <style>{`@keyframes duupDocsIn{from{transform:scale(.98);opacity:.5}to{transform:scale(1);opacity:1}}`}</style>

            {/* Pane 1 — modules */}
            <aside className="w-[220px] shrink-0 flex flex-col border-r border-white/[0.08]">
              <div className="px-5 pt-5 pb-3">
                <h2 className="text-base font-bold text-white">{t("dashboard.docs.allTitle")}</h2>
              </div>
              <p className="px-5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">{t("dashboard.docs.modulesSection")}</p>
              <nav className="flex-1 overflow-y-auto px-2.5 pb-3 space-y-0.5">
                {modules.map((m, i) => {
                  const on = i === mod;
                  return (
                    <Fragment key={m.id}>
                      {GROUP_BREAKS.has(i) && <div className="my-2 mx-2 h-px bg-white/[0.07]" />}
                      <button
                        type="button"
                        onClick={() => { setMod(i); setTopic(0); }}
                        className={[
                          "w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[14px] transition",
                          on ? "text-white font-semibold" : "text-white/60 hover:text-white/85 hover:bg-white/[0.03]",
                        ].join(" ")}
                        style={on ? { background: "rgba(99,102,241,0.14)", boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.28)" } : undefined}
                      >
                        <span className={on ? "text-indigo-300 shrink-0" : "text-white/40 shrink-0"}>{m.icon}</span>
                        <span className="min-w-0 truncate">{m.label}</span>
                      </button>
                    </Fragment>
                  );
                })}
              </nav>
              {/* Contact support — pinned to the modules pane */}
              <div className="p-3 border-t border-white/[0.08]">
                <a
                  href={TELEGRAM_SUPPORT}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-90"
                  style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white">
                    <svg viewBox="0 0 24 24" className="h-3 w-3 -ml-px" fill="#229ED9">
                      <path d="M21.9 4.3 2.8 11.6c-1 .4-1 1.4-.2 1.6l4.9 1.5 1.9 5.7c.2.6.4.7 1 .4l2.7-2 5 3.7c.5.3 1 .1 1.1-.5l3-14.5c.2-.9-.4-1.3-1.3-1.2z" />
                    </svg>
                  </span>
                  {t("dashboard.docs.contactSupport")}
                </a>
              </div>
            </aside>

            {/* Pane 2 — topics of the module (subtle indigo tint) */}
            <aside className="w-[240px] shrink-0 flex flex-col border-r border-white/[0.08]" style={{ background: "rgba(99,102,241,0.05)" }}>
              <div className="px-5 pt-5 pb-3">
                <h3 className="text-sm font-semibold text-white/85 truncate">{currentModule?.label}</h3>
              </div>
              <nav className="flex-1 overflow-y-auto px-2.5 pb-2 space-y-0.5">
                {currentModule?.docs.map((d, i) => {
                  const on = i === topic;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTopic(i)}
                      className={[
                        "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition",
                        on ? "text-white font-semibold" : "text-white/60 hover:text-white/85 hover:bg-white/[0.04]",
                      ].join(" ")}
                      style={on ? { background: "rgba(99,102,241,0.20)", boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.34)" } : undefined}
                    >
                      <span className="min-w-0 truncate">{d.title}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Pane 3 — content */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/[0.08] shrink-0">
                <h3 className="text-lg font-semibold text-white truncate">{currentTopic?.title}</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-white/40 hover:text-white/80 transition shrink-0"
                  aria-label={t("dashboard.docs.close")}
                >
                  <svg viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 md:px-8 py-7 text-[14.5px] leading-[1.9] text-white/70">
                {currentTopic?.body}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

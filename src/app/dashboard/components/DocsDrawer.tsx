"use client";

// Reusable "Documentation" button + a large two-pane modal: topic list on the
// left (with a "Contact support" button pinned to the bottom), the selected
// topic's content on the right. Drop it into any module header:
//
//   <DocsDrawer docs={[{ title, body }, …]} />

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Manrope } from "next/font/google";
import { useTranslation } from "@/lib/i18n/context";

export type DocEntry = { title: string; body: React.ReactNode };

// Modern, self-hosted font for the docs surface (a touch more classic/neutral
// than the site's Inter, without the geometric feel of Sora).
const docsFont = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const TELEGRAM_SUPPORT = "https://t.me/DuupFlow_Support";

function DocIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

export default function DocsDrawer({ docs }: { docs: DocEntry[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  const current = docs[active] ?? docs[0];

  return (
    <>
      <button
        type="button"
        onClick={() => { setActive(0); setOpen(true); }}
        aria-label={t("dashboard.docs.button")}
        title={t("dashboard.docs.button")}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-2 sm:px-3.5 sm:py-2 text-sm font-medium text-[var(--app-text-muted)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)] transition"
      >
        <DocIcon className="h-4 w-4 shrink-0" />
        {/* Label hidden on mobile — icon-only to save space. */}
        <span className="hidden sm:inline">{t("dashboard.docs.button")}</span>
      </button>

      {mounted && open && createPortal(
        <div className={`fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-4 ${docsFont.className}`}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Window — full-screen on mobile, two-pane on desktop */}
          <div
            className="relative flex w-full h-full max-w-[1000px] sm:h-[84vh] rounded-none sm:rounded-2xl overflow-hidden shadow-2xl animate-[duupDocsIn_.2s_ease-out]"
            style={{ background: "var(--app-bg)", border: "1px solid var(--app-border)" }}
          >
            <style>{`@keyframes duupDocsIn{from{transform:scale(.98);opacity:.5}to{transform:scale(1);opacity:1}}`}</style>

            {/* Left — topic sidebar (hidden on mobile; replaced by a topic dropdown) */}
            <aside className="hidden sm:flex w-[230px] shrink-0 flex-col border-r border-[var(--app-border)]">
              <div className="px-5 pt-5 pb-3">
                <h2 className="text-base font-bold text-[var(--app-text)]">{t("dashboard.docs.title")}</h2>
              </div>

              <nav className="flex-1 overflow-y-auto px-2.5 pb-2 space-y-0.5">
                {docs.map((d, i) => {
                  const on = i === active;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActive(i)}
                      className={[
                        "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition",
                        on ? "text-[var(--app-text)] font-semibold" : "text-[var(--app-text-muted)] hover:text-[var(--app-text-muted)] hover:bg-[var(--app-surface)]",
                      ].join(" ")}
                      style={on ? { background: "rgba(99,102,241,0.14)", boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.28)" } : undefined}
                    >
                      <DocIcon className={`h-4 w-4 shrink-0 ${on ? "text-indigo-300" : "text-[var(--app-text-faint)]"}`} />
                      <span className="min-w-0 truncate">{d.title}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Contact support — pinned bottom */}
              <div className="p-3 border-t border-[var(--app-border)]">
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

            {/* Right — content */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[var(--app-border)] shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <DocIcon className="h-5 w-5 shrink-0 text-indigo-300" />
                  <h3 className="text-lg font-semibold text-[var(--app-text)] truncate">{current?.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[var(--app-text-faint)] hover:text-[var(--app-text-muted)] transition shrink-0"
                  aria-label={t("dashboard.docs.close")}
                >
                  <svg viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>

              {/* Mobile topic navigation — the left sidebar is hidden on phones,
                  so pick the topic here + a quick support shortcut. */}
              <div className="sm:hidden flex items-center gap-2 px-4 py-2.5 border-b border-[var(--app-border)] shrink-0">
                <select
                  value={active}
                  onChange={(e) => setActive(Number(e.target.value))}
                  className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                  style={{ background: "var(--app-surface-2)", border: "1px solid var(--app-border-strong)" }}
                >
                  {docs.map((d, i) => (
                    <option key={i} value={i} style={{ background: "var(--app-bg)" }}>{d.title}</option>
                  ))}
                </select>
                <a
                  href={TELEGRAM_SUPPORT}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("dashboard.docs.contactSupport")}
                  className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#fff"><path d="M21.9 4.3 2.8 11.6c-1 .4-1 1.4-.2 1.6l4.9 1.5 1.9 5.7c.2.6.4.7 1 .4l2.7-2 5 3.7c.5.3 1 .1 1.1-.5l3-14.5c.2-.9-.4-1.3-1.3-1.2z" /></svg>
                </a>
              </div>

              <div className="flex-1 overflow-y-auto px-5 sm:px-6 md:px-8 py-6 sm:py-7 text-[14.5px] leading-[1.9] text-[var(--app-text-muted)]">
                {current?.body}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

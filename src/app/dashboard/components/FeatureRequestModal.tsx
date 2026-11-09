"use client";

/**
 * Fenêtre « Amélioration » (sidebar) : le user écrit ce qu'il aimerait voir de
 * nouveau sur DuupFlow → POST /api/feature-requests (table + email à l'équipe).
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";

const MAX_CHARS = 3000;

/** Événement window qui ouvre cette fenêtre depuis n'importe où (ex. l'annonce). */
export const OPEN_IDEA_EVENT = "duup:open-feature-request";

export default function FeatureRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setState((s) => (s === "sent" ? "idle" : s));
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(id); window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  async function submit() {
    const message = text.trim();
    if (message.length < 3 || state === "sending") return;
    setState("sending");
    const r = await fetch("/api/feature-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, page: pathname }),
    }).catch(() => null);
    if (r?.ok) { setText(""); setState("sent"); } else setState("error");
  }

  const examples = ["ex1", "ex2", "ex3"] as const;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl">
        <button
          onClick={onClose}
          aria-label={t("dashboard.featureRequest.close")}
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-lg leading-none text-[var(--app-text-muted)] transition hover:bg-[var(--app-bg-2)] hover:text-[var(--app-text)]"
        >
          ✕
        </button>

        {state === "sent" ? (
          <div className="flex flex-col items-center px-6 py-14 text-center sm:px-12">
            <span className="text-5xl">🙌</span>
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-[var(--app-text)]">{t("dashboard.featureRequest.sentTitle")}</h2>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-[var(--app-text-muted)]">{t("dashboard.featureRequest.sentLead")}</p>
            <div className="mt-8 flex gap-3">
              <button onClick={() => setState("idle")} className="rounded-xl border border-[var(--app-border)] px-5 py-2.5 text-sm font-semibold text-[var(--app-text-muted)] transition hover:bg-[var(--app-bg-2)]">
                {t("dashboard.featureRequest.another")}
              </button>
              <button onClick={onClose} className="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">
                {t("dashboard.featureRequest.close")}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 pb-8 pt-10 sm:px-10">
            <span className="text-3xl">💡</span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[var(--app-text)] sm:text-[28px]">{t("dashboard.featureRequest.title")}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--app-text-muted)]">{t("dashboard.featureRequest.lead")}</p>

            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => { setText(e.target.value.slice(0, MAX_CHARS)); if (state === "error") setState("idle"); }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit(); }}
              rows={6}
              placeholder={t("dashboard.featureRequest.placeholder")}
              className="mt-6 w-full resize-y rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg-2)] px-4 py-3.5 text-[14.5px] leading-relaxed text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-text-faint)] focus:border-indigo-400"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {examples.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setText(t(`dashboard.featureRequest.${k}`)); inputRef.current?.focus(); }}
                  className="rounded-full border border-[var(--app-border)] px-3 py-1.5 text-[12.5px] text-[var(--app-text-muted)] transition hover:bg-[var(--app-bg-2)] hover:text-[var(--app-text)]"
                >
                  {t(`dashboard.featureRequest.${k}`)}
                </button>
              ))}
            </div>

            {state === "error" && (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-500">{t("dashboard.featureRequest.error")}</p>
            )}

            <div className="mt-7 flex items-center justify-between gap-4">
              <span className="text-[12px] text-[var(--app-text-faint)]">{t("dashboard.featureRequest.hint")}</span>
              <button
                onClick={() => void submit()}
                disabled={text.trim().length < 3 || state === "sending"}
                className="shrink-0 rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
              >
                {state === "sending" ? t("dashboard.featureRequest.sending") : t("dashboard.featureRequest.send")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

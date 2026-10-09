"use client";

// « Envoyer vers l'éditeur » — à poser à côté des résultats d'un module de
// duplication. Les copies choisies (ou toutes, sans sélection) deviennent de
// la matière du projet en cours de l'Éditeur IA de l'espace affiché : la
// version manuelle de ce que fait Claude (send_duplicates_to_editor).
// Invisible tant que l'Éditeur IA n'est pas ouvert à ce compte.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";

type Access = { available: boolean; max: number };
let accessPromise: Promise<Access> | null = null;
function loadAccess(): Promise<Access> {
  accessPromise ??= fetch("/api/ai-editor/from-duplicates", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { available: false, max: 20 }))
    .catch(() => { accessPromise = null; return { available: false, max: 20 }; });
  return accessPromise;
}

type Props = {
  /** Fichiers prêts (URL /api/out/… + nom affiché). */
  files: { url: string; name: string }[];
  /** true quand `files` est une sélection (sinon = tous les résultats). */
  isSelection: boolean;
  disabled?: boolean;
};

export default function SendToEditorButton({ files, isSelection, disabled }: Props) {
  const { t } = useTranslation();
  const [access, setAccess] = useState<Access | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err" | "warn"; text: string; open?: boolean } | null>(null);

  useEffect(() => { void loadAccess().then(setAccess); }, []);
  // Une nouvelle sélection efface le message précédent.
  useEffect(() => { setMsg(null); }, [files.length, isSelection]);

  if (!access?.available) return null;
  const tooMany = files.length > access.max;

  async function send() {
    if (busy || disabled || !files.length || !access) return;
    if (tooMany) {
      setMsg({
        tone: "warn",
        text: isSelection
          ? t("sendToEditor.tooManySelected", { max: String(access.max), count: String(files.length) })
          : t("sendToEditor.tooManyAll", { max: String(access.max), count: String(files.length) }),
      });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ai-editor/from-duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: files.map((f) => f.url) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ tone: "err", text: d.error || t("sendToEditor.failed") }); return; }
      const failed = (d.results ?? []).filter((r: { ok: boolean }) => !r.ok) as { name: string; error: string }[];
      if (d.added === 0) {
        setMsg({ tone: "err", text: failed[0] ? `${failed[0].name} — ${failed[0].error}` : t("sendToEditor.failed") });
      } else if (failed.length) {
        setMsg({ tone: "warn", open: true, text: t("sendToEditor.partial", { ok: String(d.added), failed: String(failed.length) }) + ` (${failed[0].name} — ${failed[0].error})` });
      } else {
        setMsg({ tone: "ok", open: true, text: t("sendToEditor.sent", { count: String(d.added) }) });
      }
    } catch {
      setMsg({ tone: "err", text: t("sendToEditor.failed") });
    } finally {
      setBusy(false);
    }
  }

  const toneClass = msg?.tone === "ok" ? "text-emerald-500" : msg?.tone === "err" ? "text-red-500" : "text-amber-500";

  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={send}
        disabled={busy || disabled || files.length === 0}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
        style={{ background: "linear-gradient(180deg,#8B5CF6,#7C3AED 60%,#6D28D9)", boxShadow: "0 6px 16px -8px rgba(124,58,237,0.85), inset 0 1px 0 rgba(255,255,255,0.3)" }}
      >
        <svg viewBox="0 0 24 24" className={busy ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {busy ? <path d="M21 12a9 9 0 1 1-6.2-8.56" /> : <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>}
        </svg>
        {busy
          ? t("sendToEditor.sending", { count: String(files.length) })
          : isSelection ? t("sendToEditor.sendSelection", { count: String(files.length) }) : t("sendToEditor.send")}
      </button>
      {msg && (
        <span className={`text-xs font-medium ${toneClass}`}>
          {msg.text}
          {msg.open && (
            <> · <Link href="/dashboard/ai-editor?from=duplicates" className="underline font-semibold text-[var(--app-text)]">{t("sendToEditor.open")}</Link></>
          )}
        </span>
      )}
    </div>
  );
}

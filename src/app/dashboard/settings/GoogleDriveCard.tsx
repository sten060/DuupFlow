"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";

/* Connexion Google Drive du compte — pour que Claude (MCP) exporte les variantes
   dans le dossier « DuupFlow variantes » du Drive du propriétaire, sans page
   ouverte. Un invité voit l'état mais ne peut ni connecter ni déconnecter. */

type Status = {
  configured: boolean;
  connected: boolean;
  isGuest: boolean;
  email: string | null;
  folderName: string;
  folderUrl: string | null;
};

const SURFACE = { background: "var(--app-surface)", border: "1px solid var(--app-border)" } as const;

export default function GoogleDriveCard() {
  const { t } = useTranslation();
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/google/drive", { cache: "no-store" }).then((r) => r.json()).then(setS).catch(() => setS(null));
    // Retour de la fenêtre Google : ?drive=connected|denied|error|…
    const q = new URLSearchParams(window.location.search).get("drive");
    if (q) {
      const ok = q === "connected";
      const key = ok ? "connected" : q === "denied" ? "denied" : q === "scope" ? "scope" : q === "guest" ? "guest" : q === "not_configured" ? "notConfigured" : "error";
      setNotice({ ok, text: t(`dashboard.drive.${key}`) });
      const url = new URL(window.location.href);
      url.searchParams.delete("drive");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  }, [t]);

  async function disconnect() {
    setBusy(true);
    await fetch("/api/google/drive", { method: "DELETE" }).catch(() => {});
    setS((x) => (x ? { ...x, connected: false, email: null, folderUrl: null } : x));
    setNotice({ ok: true, text: t("dashboard.drive.disconnected") });
    setBusy(false);
  }

  return (
    <div id="google-drive" className="scroll-mt-24">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--app-text-faint)] mb-3">{t("dashboard.drive.section")}</p>
      <div className="rounded-2xl p-5" style={SURFACE}>
        <div className="flex flex-wrap items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/app/icons8-google-drive-96.png" alt="" className="h-10 w-10 object-contain shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-[var(--app-text)]">
              {s?.connected ? t("dashboard.drive.titleConnected") : t("dashboard.drive.title")}
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--app-text-muted)] leading-relaxed">
              {s?.connected
                ? t("dashboard.drive.leadConnected", { email: s.email ?? "Google", folder: s.folderName })
                : t("dashboard.drive.lead", { folder: s?.folderName ?? "DuupFlow variantes" })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {s?.connected && s.folderUrl && (
              <a href={s.folderUrl} target="_blank" rel="noopener noreferrer"
                className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-surface-2)]"
                style={{ border: "1px solid var(--app-border-strong)" }}>
                {t("dashboard.drive.openFolder")} ↗
              </a>
            )}
            {s && !s.isGuest && (s.connected ? (
              <button type="button" onClick={disconnect} disabled={busy}
                className="rounded-xl px-3.5 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-500/10 disabled:opacity-50"
                style={{ border: "1px solid rgba(239,68,68,0.35)" }}>
                {t("dashboard.drive.disconnect")}
              </button>
            ) : (
              <a href="/api/google/drive/connect"
                className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 ${s.configured ? "" : "opacity-50 pointer-events-none"}`}
                style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}>
                {t("dashboard.drive.connect")}
              </a>
            ))}
          </div>
        </div>
        {s && !s.connected && s.isGuest && (
          <p className="mt-3 text-[13px] font-medium text-[var(--app-text-muted)]">{t("dashboard.drive.guestHint")}</p>
        )}
        {s && !s.configured && !s.isGuest && (
          <p className="mt-3 text-[13px] font-medium text-[var(--app-text-muted)]">{t("dashboard.drive.notConfigured")}</p>
        )}
        {notice && (
          <p className={`mt-3 text-sm font-semibold ${notice.ok ? "text-emerald-600" : "text-red-600"}`}>{notice.text}</p>
        )}
      </div>
    </div>
  );
}

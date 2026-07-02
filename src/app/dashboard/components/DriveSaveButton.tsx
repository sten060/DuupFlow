"use client";

// Reusable "Save to Google Drive" button — drop it into any module that lists
// ready-to-download files. Lets the user pick a destination Drive folder, then
// uploads the selected files there (same drive.file scope as the import — no
// extra Google config). Renders nothing when Drive isn't configured.

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { useDrivePicker } from "./useDrivePicker";

const DRIVE_ICON = "/app/icons8-google-drive-96.png";

type Props = {
  /** Ready files to upload — server URLs (same-origin, authed) + display names. */
  files: { url: string; name: string }[];
  disabled?: boolean;
  /** Compact icon-only button. */
  compact?: boolean;
  /** Override the (non-compact) button's size/style classes so it can match a
   *  host module's neighbouring buttons. The icon layout is always kept. */
  className?: string;
};

export default function DriveSaveButton({ files, disabled, compact, className }: Props) {
  const { t } = useTranslation();
  const { saveToDrive, loading, configured } = useDrivePicker();
  const [msg, setMsg] = useState<string | null>(null);
  const [tone, setTone] = useState<"info" | "ok" | "err">("info");

  if (!configured) return null;

  async function handle() {
    if (loading || disabled || files.length === 0) return;
    setTone("info");
    setMsg(null);
    try {
      const res = await saveToDrive(files, (done, total) =>
        setMsg(t("drive.savingProgress", { done: String(done), total: String(total) })),
      );
      if (!res.folderName && res.ok === 0 && res.failed === 0) {
        setMsg(null); // user cancelled folder selection
        return;
      }
      if (res.failed > 0) {
        setTone("err");
        setMsg(t("drive.savedPartial", { ok: String(res.ok), failed: String(res.failed), folder: res.folderName }));
      } else {
        setTone("ok");
        setMsg(t("drive.saved", { count: String(res.ok), folder: res.folderName }));
      }
    } catch (err: any) {
      setTone("err");
      setMsg(err?.message || t("drive.saveFailed"));
    }
  }

  const toneClass = tone === "ok" ? "text-emerald-300" : tone === "err" ? "text-red-300" : "text-white/50";

  if (compact) {
    return (
      <button
        type="button"
        onClick={handle}
        disabled={loading || disabled || files.length === 0}
        title={t("drive.save")}
        aria-label={t("drive.save")}
        className="inline-flex items-center justify-center h-8 w-8 rounded-md
                   bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={DRIVE_ICON} alt="" className={loading ? "h-3.5 w-3.5 animate-pulse" : "h-3.5 w-3.5"} />
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handle}
        disabled={loading || disabled || files.length === 0}
        className={
          className
            ? `inline-flex items-center gap-2 ${className}`
            : "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white/85 transition disabled:opacity-50"
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={DRIVE_ICON} alt="" className={loading ? "h-3.5 w-3.5 animate-pulse" : "h-3.5 w-3.5"} />
        {loading ? t("drive.saving") : t("drive.save")}
      </button>
      {msg && <span className={`text-xs ${toneClass}`}>{msg}</span>}
    </div>
  );
}

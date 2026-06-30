"use client";

// Reusable "Import from Google Drive" button — drop it into any module that
// ingests files. Wraps useDrivePicker (Picker + drive.file scope) and hands the
// downloaded File objects back via onFiles. Renders nothing when Drive isn't
// configured (missing env keys) so modules degrade gracefully.
//
// Surfaces import-step problems the same way classic upload does — files that
// failed to download (timeout on a big file, network) and files filtered out by
// type are reported, never dropped silently.

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { useDrivePicker } from "./useDrivePicker";

const DRIVE_ICON = "/app/icons8-google-drive-96.png";
const VIDEO_RE = /\.(mp4|mov|mkv|avi|webm)$/i;
const IMAGE_RE = /\.(png|jpe?g|webp|heic|heif)$/i;

type Props = {
  /** Called with the files the user picked + downloaded (and passed the type filter). */
  onFiles: (files: File[]) => void;
  /** Disable the button (e.g. while the module is processing). */
  disabled?: boolean;
  /** Surface a hard error message to the host module. */
  onError?: (msg: string) => void;
  /** Icon-only square button (for tight slots like the comparator). */
  compact?: boolean;
  /** Single-file mode — keep only the first picked file. */
  single?: boolean;
  /** Restrict accepted files to images or videos; others are reported as ignored. */
  accept?: "image" | "video";
  /** Reject videos longer than this many seconds (checked via Drive metadata, pre-download). */
  maxVideoSec?: number;
};

export default function DriveImportButton({ onFiles, disabled, onError, compact, single, accept, maxVideoSec }: Props) {
  const { t } = useTranslation();
  const { pickFromDrive, loading, configured } = useDrivePicker();
  const [msg, setMsg] = useState<string | null>(null);
  const [tone, setTone] = useState<"info" | "warn">("info");

  if (!configured) return null;

  async function handle() {
    if (loading || disabled) return;
    setMsg(null);
    setTone("info");
    try {
      const { files, failedNames, tooLongNames } = await pickFromDrive(
        (done, total) => {
          setTone("info");
          setMsg(t("drive.importingProgress", { done: String(done), total: String(total) }));
        },
        { maxVideoSec },
      );

      // Type filter — report wrong-type files instead of dropping them silently.
      let accepted = files;
      const wrongType: string[] = [];
      if (accept) {
        const re = accept === "video" ? VIDEO_RE : IMAGE_RE;
        accepted = [];
        for (const f of files) {
          if (f.type.startsWith(`${accept}/`) || re.test(f.name)) accepted.push(f);
          else wrongType.push(f.name);
        }
      }

      // Build a combined notice for anything that didn't make it in.
      const notices: string[] = [];
      if (tooLongNames.length) notices.push(t("drive.someTooLong", { count: String(tooLongNames.length), max: String(maxVideoSec ?? 59) }));
      if (failedNames.length) notices.push(t("drive.someFailed", { count: String(failedNames.length) }));
      if (wrongType.length) notices.push(t("drive.someWrongType", { count: String(wrongType.length) }));
      if (notices.length) { setTone("warn"); setMsg(notices.join(" · ")); }
      else setMsg(null);

      const out = single ? accepted.slice(0, 1) : accepted;
      if (out.length) onFiles(out);
    } catch (err: any) {
      setMsg(null);
      onError?.(err?.message || t("drive.failed"));
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handle}
        disabled={loading || disabled}
        title={t("drive.import")}
        aria-label={t("drive.import")}
        className="inline-flex items-center justify-center h-9 w-9 rounded-lg
                   bg-white/[0.04] border border-white/[0.10] hover:bg-white/[0.07]
                   hover:border-white/[0.18] transition disabled:opacity-50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={DRIVE_ICON} alt="" className={loading ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handle}
        disabled={loading || disabled}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold
                   bg-white/[0.04] border border-white/[0.10] text-white/85
                   hover:bg-white/[0.07] hover:border-white/[0.18] transition disabled:opacity-50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={DRIVE_ICON} alt="" className={loading ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
        {loading ? t("drive.importing") : t("drive.import")}
      </button>
      {msg && <span className={`text-xs ${tone === "warn" ? "text-amber-300" : "text-white/50"}`}>{msg}</span>}
    </div>
  );
}

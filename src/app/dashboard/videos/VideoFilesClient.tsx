"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearVideosSimpleAction, clearVideosAdvancedAction } from "./actions";
import { useTranslation } from "@/lib/i18n/context";
import DriveSaveButton from "../components/DriveSaveButton";

type Channel = "simple" | "advanced";

function fileNameFromUrl(u: string) {
  return decodeURIComponent(u.split("/").pop()!.split("?")[0]);
}

export default function VideoFilesClient({
  initialFiles,
  channel,
}: {
  initialFiles: string[];
  channel: Channel;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [files, setFiles] = useState<string[]>(initialFiles);
  const [clearing, setClearing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Sync displayed list when server component re-fetches (after duplication or clear)
  useEffect(() => {
    if (!clearing) setFiles(initialFiles);
  }, [initialFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClear() {
    if (clearing) return;
    setClearing(true);
    setFiles([]); // optimistic: hide list immediately
    setSelected(new Set());

    try {
      if (channel === "simple") {
        await clearVideosSimpleAction();
      } else {
        await clearVideosAdvancedAction();
      }
    } catch {}

    setClearing(false);
    router.refresh(); // sync server state (in case Supabase still had files)
  }

  const toggleOne = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const allSelected = files.length > 0 && selected.size === files.length;
  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === files.length ? new Set() : new Set(files),
    );
  };

  const selectedNames = files
    .filter((u) => selected.has(u))
    .map(fileNameFromUrl);

  const selectionHref =
    selectedNames.length > 0
      ? `/api/out/zip?scope=videos&channel=${channel}&files=${encodeURIComponent(
          selectedNames.join(","),
        )}`
      : null;

  return (
    <div className="space-y-4 lg:mr-28 xl:mr-32">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleClear}
          disabled={clearing}
          className="duup-btn rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--app-text-muted)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {clearing ? t("dashboard.videos.clearing") : t("dashboard.videos.clearVideos", { channel })}
        </button>
        {files.length > 0 && (
          <DriveSaveButton
            files={(selected.size > 0 ? files.filter((u) => selected.has(u)) : files).map((u) => ({ url: u, name: fileNameFromUrl(u) }))}
          />
        )}
        {selectionHref && (
          <a
            href={selectionHref}
            className="duup-btn rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--app-text)]"
          >
            {t("common.downloadSelection", { count: String(selected.size) })}
          </a>
        )}
        <a
          href={`/api/out/zip?scope=videos&channel=${channel}`}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition" style={{ background: "linear-gradient(180deg,#6366F1,#4F46E5 60%,#4338CA)", boxShadow: "0 6px 16px -8px rgba(79,70,229,0.85), inset 0 1px 0 rgba(255,255,255,0.32)" }}
        >
          {t("dashboard.videos.downloadAllZip")}
        </a>
      </div>

      <section className="duup-glass rounded-2xl p-4">
        <h2 className="font-semibold mb-2">{t("dashboard.videos.generatedVideos", { channel })}</h2>
        {files.length === 0 ? (
          <p className="text-[var(--app-text-muted)] text-sm">{t("dashboard.videos.noVideosYet")}</p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-xs text-[var(--app-text-muted)] mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-3.5 w-3.5 accent-indigo-400"
              />
              <span>{allSelected ? t("common.deselectAll") : t("common.selectAll")}</span>
            </label>
            <ul className="space-y-1">
              {files.map((u) => {
                const n = fileNameFromUrl(u);
                return (
                  <li key={u} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(u)}
                      onChange={() => toggleOne(u)}
                      className="h-3.5 w-3.5 accent-indigo-400 shrink-0"
                      aria-label={n}
                    />
                    <a className="underline text-sm truncate" href={u}>{n}</a>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

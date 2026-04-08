"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearVideosSimpleAction, clearVideosAdvancedAction } from "./actions";
import { useTranslation } from "@/lib/i18n/context";

type Channel = "simple" | "advanced";

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

  // Sync displayed list when server component re-fetches (after duplication or clear)
  useEffect(() => {
    if (!clearing) setFiles(initialFiles);
  }, [initialFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClear() {
    if (clearing) return;
    setClearing(true);
    setFiles([]); // optimistic: hide list immediately

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleClear}
          disabled={clearing}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {clearing ? t("dashboard.videos.clearing") : t("dashboard.videos.clearVideos", { channel })}
        </button>
        <a
          href={`/api/out/zip?scope=videos&channel=${channel}`}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
        >
          {t("dashboard.videos.downloadAllZip")}
        </a>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="font-semibold mb-2">{t("dashboard.videos.generatedVideos", { channel })}</h2>
        {files.length === 0 ? (
          <p className="text-white/60 text-sm">{t("dashboard.videos.noVideosYet")}</p>
        ) : (
          <ul className="list-disc pl-5 space-y-1">
            {files.map((u) => {
              const n = decodeURIComponent(u.split("/").pop()!.split("?")[0]);
              return (
                <li key={u}>
                  <a className="underline text-sm" href={u}>{n}</a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

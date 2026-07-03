"use client";

// Builds the per-module documentation topics fed to <DocsDrawer />. Keeps the
// content (and its i18n keys) in one place so the video + detection modules
// stay consistent. All strings come from the dashboard.docs / durationInfo /
// aiDetection / det namespaces (FR + EN).

import Link from "next/link";
import type { DocEntry } from "./DocsDrawer";

type T = (key: string, vars?: Record<string, string | number>) => string;

/** "Which filters to choose" body — shared by the simple + advanced video pages. */
function filtersBody(t: T) {
  const lines = [
    t("dashboard.docs.filtersMeta"),
    t("dashboard.docs.filtersMetaTech"),
    t("dashboard.docs.filtersPixel"),
    t("dashboard.docs.filtersMotion"),
    t("dashboard.docs.filtersVisuals"),
    t("dashboard.docs.filtersAudio"),
  ];
  return (
    <div className="space-y-3">
      <p>{t("dashboard.docs.filtersIntro")}</p>
      <ul className="space-y-2">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-indigo-400/70" />
            <span>{l}</span>
          </li>
        ))}
      </ul>
      <p
        className="rounded-lg px-3 py-2.5 text-white/75"
        style={{ background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.22)" }}
      >
        {t("dashboard.docs.filtersReco")}
      </p>
    </div>
  );
}

/** Docs for the video duplication pages. Pass `tiktok` on the advanced page. */
export function buildVideoDocs(t: T, opts?: { tiktok?: boolean }): DocEntry[] {
  const docs: DocEntry[] = [
    { title: t("dashboard.durationInfo.title"), body: <p>{t("dashboard.durationInfo.body")}</p> },
    { title: t("dashboard.docs.filtersTitle"), body: filtersBody(t) },
  ];
  if (opts?.tiktok) {
    docs.push({
      title: t("dashboard.docs.tiktokTitle"),
      body: (
        <div className="space-y-3">
          <p>{t("dashboard.docs.tiktokBody")}</p>
          <Link
            href="/dashboard/guides/tiktok"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            {t("dashboard.docs.tiktokCta")} →
          </Link>
        </div>
      ),
    });
  }
  return docs;
}

/** Docs for the AI-detection page (moved out of the former inline accordions). */
export function buildDetectionDocs(t: T): DocEntry[] {
  return [
    {
      title: t("dashboard.aiDetection.platformNotice"),
      body: (
        <p>
          {t("det.platformNoticeBody1")}{" "}
          <span className="text-white/75">{t("det.platformNoticeContentDetection")}</span>{" "}
          {t("det.platformNoticeBody2")}{" "}
          <strong className="text-white/80">{t("det.platformNoticeImageModule")}</strong>{" "}
          {t("det.platformNoticeBody3")}
        </p>
      ),
    },
    {
      title: t("dashboard.aiDetection.howItWorks"),
      body: (
        <div>
          <p>
            {t("det.howItWorksIntro1")} <strong className="text-white/70">{t("det.howItWorksSteps")}</strong> {t("det.howItWorksIntro2")}
          </p>
          <ol className="mt-2 space-y-1 list-decimal list-inside">
            <li><strong className="text-white/70">{t("det.step1Title")}</strong> — {t("det.step1Body")}</li>
            <li><strong className="text-white/70">{t("det.step2Title")}</strong> — {t("det.step2Body")}</li>
            <li><strong className="text-white/70">{t("det.step3Title")}</strong> — {t("det.step3Body")}</li>
          </ol>
        </div>
      ),
    },
  ];
}

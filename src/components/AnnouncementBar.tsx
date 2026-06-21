"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";
import { useLocalizedHref } from "@/lib/i18n/href";

/**
 * Thin sticky announcement bar — landing page only (rendered conditionally in
 * ClientLayout). Fixed at the very top, above the header (which is offset down
 * by the same height on the landing page). The whole bar links to /pricing.
 * Brand accent: indigo→sky gradient, matching the pricing TikTok badge.
 */
export default function AnnouncementBar() {
  const { t } = useTranslation();
  const lh = useLocalizedHref();

  return (
    <Link
      href={lh("/pricing")}
      aria-label={t("announce.text")}
      className="group fixed top-0 left-0 right-0 z-[60] flex h-9 items-center justify-center gap-2 overflow-hidden px-3 text-white"
      style={{ background: "linear-gradient(90deg,#6366F1,#38BDF8)" }}
    >
      {/* live dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>

      {/* full text — desktop */}
      <span className="hidden whitespace-nowrap text-[13px] font-medium sm:inline">
        {t("announce.text")}
      </span>
      {/* short text — mobile */}
      <span className="whitespace-nowrap text-[12px] font-medium sm:hidden">
        {t("announce.textShort")}
      </span>

      {/* CTA chip — desktop */}
      <span className="ml-1 hidden shrink-0 items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[12px] font-semibold transition group-hover:bg-white/30 sm:inline-flex">
        {t("announce.cta")} →
      </span>
      {/* arrow — mobile */}
      <span className="shrink-0 text-[13px] font-semibold sm:hidden">→</span>
    </Link>
  );
}

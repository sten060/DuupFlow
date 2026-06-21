"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";

/**
 * TikTok glyph next to the header "i" on the advanced page. Subtly highlighted
 * (sky ring + a slow, gentle glow pulse) to draw the eye without being loud.
 * Links to the paid-only TikTok guide.
 */
export default function TikTokGuideButton() {
  const { t } = useTranslation();

  return (
    <>
      <style>{`@keyframes duupGuideGlow{0%,100%{box-shadow:0 0 0 0 rgba(56,189,248,0)}50%{box-shadow:0 0 0 4px rgba(56,189,248,.14)}}.duup-guide-glow{animation:duupGuideGlow 2.8s ease-in-out infinite}`}</style>

      <Link
        href="/dashboard/guides/tiktok"
        aria-label={t("dashboard.tiktokGuide.aria")}
        title={t("dashboard.tiktokGuide.aria")}
        className="duup-guide-glow flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-400/40 bg-sky-400/10 text-white/80 transition hover:bg-sky-400/20 hover:text-white"
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
          <path d="M16.6 3c.27 2.07 1.43 3.3 3.4 3.43v2.32c-1.14.11-2.14-.26-3.3-.96v6.13c0 3.12-2.27 5.55-5.3 5.55-2.93 0-5.0-2.26-5.0-4.92 0-2.94 2.35-4.92 5.49-4.62v2.55c-.46-.1-.95-.16-1.43-.08-1.15.18-1.9.96-1.82 2.2.08 1.15.95 1.94 2.11 1.94.9 0 1.65-.58 1.87-1.45.06-.27.08-.62.08-.94V3h3.43z" />
        </svg>
      </Link>
    </>
  );
}

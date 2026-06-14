"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/context";

/**
 * Floating circled "i" that replaces the old back link in the video duplication
 * header. On click it explains why long / high-quality files take longer to
 * duplicate (normal — DuupFlow preserves the source quality).
 */
export default function DurationInfoButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <style>{`@keyframes duupFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}.duup-float{animation:duupFloat 2.6s ease-in-out infinite}`}</style>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("dashboard.durationInfo.aria")}
        title={t("dashboard.durationInfo.aria")}
        className="duup-float flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-sm font-semibold text-white/60 hover:bg-white/[0.1] hover:text-white transition"
      >
        i
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1024] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-white">{t("dashboard.durationInfo.title")}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-2 text-white/40 hover:text-white/80"
                aria-label={t("dashboard.videosCommon.close")}
              >
                ✕
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/70">{t("dashboard.durationInfo.body")}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 w-full rounded-lg bg-indigo-600/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              {t("dashboard.durationInfo.gotIt")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

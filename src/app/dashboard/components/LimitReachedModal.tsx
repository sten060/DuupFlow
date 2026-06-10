"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/lib/i18n/context";

/**
 * Friendly "limit reached" modal for IMAGE duplication.
 *   • Free  → propose Solo
 *   • Solo  → propose Pro
 * The primary CTA calls onUpgrade (opens the usual plan picker); "Quitter"
 * just closes and lets the user resume. Centred, light blurred backdrop.
 *
 * Rendered through a portal on document.body so the fixed backdrop covers the
 * whole viewport (otherwise a transformed/scrolled ancestor clips it).
 *
 * Copy is hardcoded FR to match its sibling UpgradePlanModal ("Choisis ton
 * plan"). When we tackle videos we'll generalise the resource label.
 */
export default function LimitReachedModal({
  open,
  plan,
  resource = "images",
  onClose,
  onUpgrade,
}: {
  open: boolean;
  plan: "free" | "solo";
  resource?: "images" | "videos";
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;

  const isFree = plan === "free";
  const isVideo = resource === "videos";
  const dup = isVideo ? t("dashboard.limitModal.dupVideos") : t("dashboard.limitModal.dupImages");
  const cta = isFree ? t("dashboard.limitModal.upgradeSolo") : t("dashboard.limitModal.upgradePro");
  const body = isFree
    ? t("dashboard.limitModal.bodyFree", { dup })
    : t("dashboard.limitModal.bodySolo", { dup });

  const content = (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(5,8,22,0.45)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl px-9 py-8 text-center"
        style={{
          background: "#0b0e1a",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon — duplication module (image or video) */}
        <div
          className="mx-auto mb-5 h-14 w-14 rounded-2xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(56,189,248,0.18))",
            border: "1px solid rgba(99,102,241,0.30)",
          }}
        >
          {isVideo ? (
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="#A5B4FC" strokeWidth="1.7">
              <rect x="2" y="5" width="14" height="14" rx="2" />
              <path d="M16 9l5-3v12l-5-3V9z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="#A5B4FC" strokeWidth="1.7">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          )}
        </div>

        <h2 className="text-2xl font-bold text-white">
          {t("dashboard.limitModal.title")}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/60 max-w-md mx-auto">
          {body}
        </p>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white/60 transition hover:text-white/85"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            {t("dashboard.limitModal.quit")}
          </button>
          <button
            type="button"
            onClick={onUpgrade}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)", boxShadow: "0 6px 24px rgba(99,102,241,0.35)" }}
          >
            {cta}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

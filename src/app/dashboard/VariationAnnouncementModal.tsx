"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";
import { acknowledgeVariationAnnouncement } from "./actions/onboarding";

/**
 * One-shot launch announcement for the AI Variation module.
 *
 * Triggered exactly once per legacy user (those whose
 * `profile.variation_ia_announced_at` is NULL). Two slides:
 *   • Slide 1 — marketing pitch + bonus tokens announcement
 *   • Slide 2 — how it works + tokens primer (without revealing 1 token = 0.40€)
 *
 * On dismissal, calls the `acknowledgeVariationAnnouncement` server action
 * which credits the bonus tokens (3 for Solo, 5 otherwise) and sets
 * `variation_ia_announced_at = NOW()` so the modal never re-opens.
 */
export default function VariationAnnouncementModal({
  plan,
  onDone,
}: {
  /** User's effective plan — drives the bonus token amount in the copy. */
  plan: "free" | "solo" | "pro" | null;
  /** Called after the server action resolves (modal can close). */
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [slide, setSlide] = useState<0 | 1>(0);
  const [busy, setBusy] = useState(false);

  const isSolo = plan === "solo";
  const giftLine = isSolo
    ? t("dashboard.home.variationAnnounceGiftSolo")
    : t("dashboard.home.variationAnnounceGiftDefault");

  async function finish() {
    if (busy) return;
    setBusy(true);
    try {
      await acknowledgeVariationAnnouncement();
    } finally {
      onDone();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(6,9,24,0.88)", backdropFilter: "blur(10px)" }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: "rgba(10,14,40,0.98)",
          border: "1px solid rgba(217,70,239,0.30)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(217,70,239,0.12)",
        }}
      >
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-5">
          {[0, 1].map((i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: slide === i ? 22 : 6,
                background: slide === i ? "#D946EF" : "rgba(255,255,255,0.18)",
              }}
            />
          ))}
        </div>

        {slide === 0 && (
          <div className="p-8">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(217,70,239,0.12)",
                  color: "#F0ABFC",
                  border: "1px solid rgba(217,70,239,0.30)",
                }}
              >
                ✨ {t("dashboard.home.variationAnnouncePill")}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mb-3 leading-tight">
              <span className="bg-gradient-to-r from-fuchsia-300 to-indigo-300 bg-clip-text text-transparent">
                {t("dashboard.home.variationAnnounceTitleP1")}
              </span>
            </h2>

            <p className="text-sm text-white/70 leading-relaxed mb-6">
              {t("dashboard.home.variationAnnounceLeadP1")}
            </p>

            <p className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-300/70 mb-3">
              {t("dashboard.home.variationAnnounceBulletsP1Heading")}
            </p>
            <ul className="space-y-2 mb-6">
              {[
                t("dashboard.home.variationAnnounceBulletP1a"),
                t("dashboard.home.variationAnnounceBulletP1b"),
                t("dashboard.home.variationAnnounceBulletP1c"),
                t("dashboard.home.variationAnnounceBulletP1d"),
              ].map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white/70">
                  <span className="text-fuchsia-300 mt-0.5">✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div
              className="rounded-xl px-4 py-3 mb-6 flex items-start gap-3"
              style={{
                background: "rgba(217,70,239,0.08)",
                border: "1px solid rgba(217,70,239,0.25)",
              }}
            >
              <div
                className="h-9 w-9 rounded-lg shrink-0 flex items-center justify-center text-lg"
                style={{
                  background: "rgba(217,70,239,0.18)",
                  border: "1px solid rgba(217,70,239,0.35)",
                }}
              >
                🎁
              </div>
              <p className="text-sm text-fuchsia-100 leading-relaxed">
                {giftLine}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSlide(1)}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#D946EF,#6366F1)" }}
            >
              {t("dashboard.home.variationAnnounceNext")}
            </button>
          </div>
        )}

        {slide === 1 && (
          <div className="p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-white mb-5 leading-tight">
              {t("dashboard.home.variationAnnounceTitleP2")}
            </h2>

            <ol className="space-y-3 mb-6">
              {[
                t("dashboard.home.variationAnnounceP2Step1"),
                t("dashboard.home.variationAnnounceP2Step2"),
                t("dashboard.home.variationAnnounceP2Step3"),
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{
                      background: "rgba(217,70,239,0.15)",
                      color: "#F0ABFC",
                      border: "1px solid rgba(217,70,239,0.30)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm text-white/75 leading-relaxed pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            <div
              className="rounded-xl p-4 mb-6"
              style={{
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.20)",
              }}
            >
              <h3 className="text-sm font-semibold text-white/90 mb-1.5 flex items-center gap-2">
                <span className="text-base">🪙</span>
                {t("dashboard.home.variationAnnounceTokensTitle")}
              </h3>
              <p className="text-[13px] text-white/60 leading-relaxed">
                {t("dashboard.home.variationAnnounceTokensBody")}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSlide(0)}
                disabled={busy}
                className="rounded-xl px-4 py-3 text-sm font-medium text-white/55 hover:text-white/85 hover:bg-white/[0.05] transition disabled:opacity-50"
              >
                {t("dashboard.home.variationAnnouncePrev")}
              </button>

              <Link
                href="/dashboard/generate"
                onClick={finish}
                className="flex-1 rounded-xl py-3 text-sm font-semibold text-white text-center transition hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#D946EF,#6366F1)" }}
              >
                {busy ? "…" : t("dashboard.home.variationAnnounceCta")}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

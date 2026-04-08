"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";

// STEPS moved inside component to use t()

export default function CommentCaMarche() {
  const { t } = useTranslation();

  const STEPS = [
    {
      num: t("howItWorks.step1Num"),
      title: t("howItWorks.step1Title"),
      desc: t("howItWorks.step1Desc"),
    },
    {
      num: t("howItWorks.step2Num"),
      title: t("howItWorks.step2Title"),
      desc: t("howItWorks.step2Desc"),
    },
    {
      num: t("howItWorks.step3Num"),
      title: t("howItWorks.step3Title"),
      desc: t("howItWorks.step3Desc"),
    },
  ];

  return (
    <div className="min-h-screen px-6 py-24">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3">
          {t("howItWorksPage.badge")}
        </p>
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-5 tracking-tight">
          {t("howItWorksPage.title")}{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent">
            {t("howItWorksPage.titleHighlight")}
          </span>
        </h1>
        <p className="text-white/45 text-lg mb-20 max-w-xl">
          {t("howItWorksPage.subtitle")}
        </p>

        {/* Steps */}
        <div className="relative">
          <div className="hidden md:block absolute top-[22px] left-[22px] right-[22px] h-px bg-white/[0.08]" />
          <div className="grid md:grid-cols-3 gap-12">
            {STEPS.map((s) => (
              <div key={s.num} className="relative">
                <div
                  className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold text-white mb-6 relative z-10"
                  style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
                >
                  {s.num}
                </div>
                <h3 className="font-semibold text-white text-lg mb-3">{s.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Detail cards */}
        <div className="mt-24 grid md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] p-6">
            <div className="text-2xl mb-4">🖼️</div>
            <h3 className="font-semibold text-white mb-2">{t("howItWorksPage.formatsTitle")}</h3>
            <p className="text-sm text-white/50 leading-relaxed whitespace-pre-line">
              {t("howItWorksPage.formatsDesc")}
            </p>
          </div>
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-6">
            <div className="text-2xl mb-4">⚡</div>
            <h3 className="font-semibold text-white mb-2">{t("howItWorksPage.speedTitle")}</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              {t("howItWorksPage.speedDesc")}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6">
            <div className="text-2xl mb-4">📦</div>
            <h3 className="font-semibold text-white mb-2">{t("howItWorksPage.exportTitle")}</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              {t("howItWorksPage.exportDesc")}
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl px-8 py-4 font-semibold text-white text-sm transition hover:opacity-90 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            {t("howItWorksPage.ctaPrimary")}
          </Link>
        </div>
      </div>
    </div>
  );
}

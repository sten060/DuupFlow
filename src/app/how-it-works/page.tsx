"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "@/lib/i18n/context";

/* STEPS keys resolved inside components via t() */

const SPEED = 5;

function CardShowcase() {
  const { t } = useTranslation();
  const STEPS = [
    { num: t("howItWorks.step1Num"), title: t("howItWorks.step1Title"), desc: t("howItWorks.step1Desc"), tag: t("howItWorks.step1Tag") },
    { num: t("howItWorks.step2Num"), title: t("howItWorks.step2Title"), desc: t("howItWorks.step2Desc"), tag: t("howItWorks.step2Tag") },
    { num: t("howItWorks.step3Num"), title: t("howItWorks.step3Title"), desc: t("howItWorks.step3Desc"), tag: t("howItWorks.step3Tag") },
  ];
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const activeRef = useRef(0);
  const progressRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const goToNext = useCallback(() => {
    const next = (activeRef.current + 1) % STEPS.length;
    activeRef.current = next;
    progressRef.current = 0;
    setActiveIndex(next);
    setProgress(0);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    const tick = 16;
    const increment = (100 / (SPEED * 1000)) * tick;

    intervalRef.current = setInterval(() => {
      progressRef.current += increment;
      if (progressRef.current >= 100) {
        goToNext();
      } else {
        setProgress(progressRef.current);
      }
    }, tick);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isMobile, goToNext]);

  const handleClick = (index: number) => {
    if (isMobile) return;
    activeRef.current = index;
    progressRef.current = 0;
    setActiveIndex(index);
    setProgress(0);
  };

  if (isMobile) {
    return (
      <div className="flex flex-col gap-5">
        {STEPS.map((card, i) => (
          <div
            key={i}
            className="border border-white/[0.08] p-5"
            style={{ background: "rgba(8,12,35,0.6)" }}
          >
            <div className="text-3xl font-bold text-indigo-400/40 mb-3 tracking-tight">{card.num}</div>
            <h3 className="text-lg font-semibold text-white mb-2">{card.title}</h3>
            <p className="text-sm text-white/50 leading-relaxed mb-3">{card.desc}</p>
            <span className="text-xs text-indigo-400 font-medium">{card.tag}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-0 w-full" style={{ height: "420px" }}>
      {STEPS.map((card, i) => {
        const isActive = i === activeIndex;
        return (
          <div
            key={i}
            onClick={() => handleClick(i)}
            className="relative cursor-pointer border border-white/[0.08] p-6 overflow-hidden"
            style={{
              background: "rgba(8,12,35,0.6)",
              flex: isActive ? 2.5 : 1,
              transition: "flex 0.5s ease-in-out",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              className="absolute bottom-0 left-0 w-[2px]"
              style={{ height: "100%", background: "rgba(255,255,255,0.06)" }}
            >
              {isActive && (
                <div
                  className="absolute bottom-0 left-0 w-full"
                  style={{
                    height: `${progress}%`,
                    background: "linear-gradient(to top, #6366F1, #818CF8)",
                    transition: "height 16ms linear",
                  }}
                />
              )}
            </div>

            <div
              className="text-4xl font-bold tracking-tight mb-3"
              style={{
                color: isActive ? "rgba(129,140,248,0.6)" : "rgba(129,140,248,0.25)",
                transition: "color 0.3s",
              }}
            >
              {card.num}
            </div>

            <h3
              className="text-lg font-semibold mb-3"
              style={{
                color: isActive ? "white" : "rgba(255,255,255,0.5)",
                transition: "color 0.3s",
              }}
            >
              {card.title}
            </h3>

            <div
              style={{
                opacity: isActive ? 1 : 0,
                maxHeight: isActive ? "300px" : "0px",
                overflow: "hidden",
                transition: "opacity 0.3s ease, max-height 0.4s ease",
                display: "flex",
                flexDirection: "column",
                flex: 1,
                justifyContent: "space-between",
              }}
            >
              <p className="text-sm text-white/60 leading-relaxed">{card.desc}</p>
              <span className="text-xs text-indigo-400 font-medium mt-4">{card.tag}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CommentCaMarche() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen px-6 py-24">
      <div className="max-w-5xl mx-auto">
        <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3">
          {t("howItWorksPage.badge")}
        </p>
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-5 tracking-tight">
          {t("howItWorksPage.title")}{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent">
            {t("howItWorksPage.titleHighlight")}
          </span>
        </h1>
        <p className="text-white/45 text-lg mb-16 max-w-xl">
          {t("howItWorksPage.subtitle")}
        </p>

        <CardShowcase />

        <div className="mt-24 grid md:grid-cols-3 gap-6">
          <div className="border border-indigo-500/20 bg-indigo-500/[0.04] p-6">
            <div className="text-2xl mb-4">🖼️</div>
            <h3 className="font-semibold text-white mb-2">{t("howItWorksPage.formatsTitle")}</h3>
            <p className="text-sm text-white/50 leading-relaxed whitespace-pre-line">
              {t("howItWorksPage.formatsDesc")}
            </p>
          </div>
          <div className="border border-sky-500/20 bg-sky-500/[0.04] p-6">
            <div className="text-2xl mb-4">⚡</div>
            <h3 className="font-semibold text-white mb-2">{t("howItWorksPage.speedTitle")}</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              {t("howItWorksPage.speedDesc")}
            </p>
          </div>
          <div className="border border-emerald-500/20 bg-emerald-500/[0.04] p-6">
            <div className="text-2xl mb-4">📦</div>
            <h3 className="font-semibold text-white mb-2">{t("howItWorksPage.exportTitle")}</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              {t("howItWorksPage.exportDesc")}
            </p>
          </div>
        </div>

        <div className="mt-20 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 font-semibold text-white text-sm transition hover:opacity-90 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            {t("howItWorksPage.ctaPrimary")}
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 px-8 py-4 font-semibold text-white/70 hover:text-white text-sm transition border border-white/15 hover:border-white/30 hover:bg-white/[0.04]"
          >
            {t("howItWorksPage.ctaSecondary")}
          </Link>
        </div>
      </div>
    </div>
  );
}

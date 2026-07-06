"use client";

import Image from "next/image";
import Link from "@/components/LocaleLink";
import { useTranslation } from "@/lib/i18n/context";
import SiteFooter from "@/components/SiteFooter";

const G = "bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent";

// FEATURES and STEPS are defined inside the component to use t()

export default function DemoPage() {
  const { t } = useTranslation();

  const FEATURES = [
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      ),
      color: "#C026D3",
      bg: "rgba(192,38,211,0.10)",
      border: "rgba(192,38,211,0.22)",
      title: t("demo.module1Title"),
      desc: t("demo.module1Desc"),
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="5" width="14" height="14" rx="2" />
          <path d="M16 9l5-3v12l-5-3V9z" />
        </svg>
      ),
      color: "#6366F1",
      bg: "rgba(99,102,241,0.10)",
      border: "rgba(99,102,241,0.22)",
      title: t("demo.module2Title"),
      desc: t("demo.module2Desc"),
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      ),
      color: "#10B981",
      bg: "rgba(16,185,129,0.10)",
      border: "rgba(16,185,129,0.22)",
      title: t("demo.module3Title"),
      desc: t("demo.module3Desc"),
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.10)",
      border: "rgba(245,158,11,0.22)",
      title: t("demo.module4Title"),
      desc: t("demo.module4Desc"),
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 14 10 14 10 20" />
          <polyline points="20 10 14 10 14 4" />
          <line x1="14" y1="10" x2="21" y2="3" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      ),
      color: "#14B8A6",
      bg: "rgba(20,184,166,0.10)",
      border: "rgba(20,184,166,0.22)",
      title: t("demo.module5Title"),
      desc: t("demo.module5Desc"),
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
        </svg>
      ),
      color: "#8B5CF6",
      bg: "rgba(139,92,246,0.10)",
      border: "rgba(139,92,246,0.22)",
      title: t("demo.module6Title"),
      desc: t("demo.module6Desc"),
    },
  ];

  const STEPS = [
    { num: t("demo.step1Num"), title: t("demo.step1Title"), desc: t("demo.step1Desc") },
    { num: t("demo.step2Num"), title: t("demo.step2Title"), desc: t("demo.step2Desc") },
    { num: t("demo.step3Num"), title: t("demo.step3Title"), desc: t("demo.step3Desc") },
    { num: t("demo.step4Num"), title: t("demo.step4Title"), desc: t("demo.step4Desc") },
  ];

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: "linear-gradient(135deg, #060918 0%, #0D0B2E 50%, #060C1F 100%)" }}
    >
      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">

        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4 leading-[1.08]">
            {t("demo.title")} <span className={G}>{t("demo.titleHighlight")}</span>
          </h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            {t("demo.subtitle")}
          </p>
        </div>

        {/* Demo Video — single panel (slightly wider than the surrounding text) */}
        <div className="mb-6 md:-mx-8 lg:-mx-16 rounded-3xl overflow-hidden" style={{ border: "1px solid rgba(99,102,241,0.20)", boxShadow: "0 0 60px rgba(99,102,241,0.08), 0 24px 60px rgba(0,0,0,0.4)", background: "rgba(8,12,35,0.85)" }}>
          <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
            {/* Image = aesthetic frame/backdrop, fills the block */}
            <Image
              src="/videos/069c168477871ddaf88252c114b5cfe9.jpg"
              alt=""
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
            />
            {/* Demo video — smaller and centered; the image forms its borders.
                The block + backdrop keep the same size. */}
            <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-10 lg:p-16">
              <video
                src="/videos/demo-duupflow.mp4"
                className="max-h-full max-w-full w-auto h-auto rounded-xl"
                style={{ boxShadow: "0 24px 70px rgba(0,0,0,0.55)" }}
                controls
                autoPlay
                muted
                playsInline
                preload="metadata"
              />
            </div>
          </div>
          <p className="text-center text-xs text-white/30 py-3 px-4 italic">
            {t("demo.videoDisclaimer")}
          </p>
        </div>

        {/* CTA right below the demo → pricing */}
        <div className="text-center mb-20">
          <Link
            href="/pricing#plans"
            className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 font-semibold text-white text-sm transition hover:opacity-90 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            {t("demo.ctaPrimary")}
          </Link>
        </div>

        {/* How it works */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3">{t("demo.howItWorksBadge")}</p>
            <h2 className="text-3xl font-semibold text-white tracking-tight">
              {t("demo.howItWorksTitle")} <span className={G}>{t("demo.howItWorksTitleHighlight")}</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s) => (
              <div
                key={s.num}
                className="rounded-2xl p-5"
                style={{
                  background: "rgba(10,14,40,0.60)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span
                  className="text-3xl font-bold block mb-3"
                  style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                >
                  {s.num}
                </span>
                <h3 className="text-sm font-semibold text-white mb-1.5">{s.title}</h3>
                <p className="text-xs text-white/45 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Modules */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3">{t("demo.modulesBadge")}</p>
            <h2 className="text-3xl font-semibold text-white tracking-tight">
              {t("demo.modulesTitle")} <span className={G}>{t("demo.modulesTitleHighlight")}</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl p-5 flex gap-4 items-start"
                style={{
                  background: "rgba(10,14,40,0.60)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: f.bg, border: `1px solid ${f.border}`, color: f.color }}
                >
                  {f.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">{f.title}</h3>
                  <p className="text-xs text-white/50 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div
          className="rounded-2xl p-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center mb-20"
          style={{ background: "rgba(10,14,40,0.60)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {[
            { val: t("demo.stat1Val"), label: t("demo.stat1Label") },
            { val: t("demo.stat2Val"), label: t("demo.stat2Label") },
            { val: t("demo.stat3Val"), label: t("demo.stat3Label") },
            { val: t("demo.stat4Val"), label: t("demo.stat4Label") },
          ].map((s) => (
            <div key={s.label}>
              <div className={`text-3xl font-bold mb-1 ${G}`}>{s.val}</div>
              <div className="text-xs text-white/40 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div
          className="relative rounded-3xl overflow-hidden p-12 text-center"
          style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(56,189,248,0.08) 100%)" }}
        >
          <div className="pointer-events-none absolute inset-0 border border-white/[0.10] rounded-3xl" />
          <div className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          <h2 className="text-3xl font-semibold text-white mb-3 tracking-tight relative">
            {t("demo.ctaTitle")}
          </h2>
          <p className="text-white/60 mb-8 max-w-sm mx-auto relative text-sm">
            {t("demo.ctaSubtitle")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 relative">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 font-semibold text-white text-sm transition hover:opacity-90 hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
            >
              {t("demo.ctaPrimary")}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-8 py-3.5 font-medium text-sm text-white/80 hover:bg-white/[0.08] transition"
            >
              {t("demo.ctaSecondary")}
            </Link>
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="relative z-10">
        <SiteFooter />
      </div>
    </div>
  );
}

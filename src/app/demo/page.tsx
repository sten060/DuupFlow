"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";

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

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/[0.07]">
        <Link href="/" className="text-xl font-extrabold tracking-tight">
          <span style={{ color: "#818CF8" }}>Duup</span>
          <span className="text-white/55">Flow</span>
        </Link>
        <Link
          href="/register"
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
        >
          {t("demo.commencerMaintenant")}
        </Link>
      </header>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">

        {/* Hero */}
        <div className="text-center mb-16">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-1.5 text-sm text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {t("demo.badge")}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4 leading-[1.08]">
            {t("demo.title")} <span className={G}>{t("demo.titleHighlight")}</span>
          </h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            {t("demo.subtitle")}
          </p>
        </div>

        {/* Demo Video — single panel */}
        <div className="mb-20 rounded-3xl overflow-hidden" style={{ border: "1px solid rgba(99,102,241,0.20)", boxShadow: "0 0 60px rgba(99,102,241,0.08), 0 24px 60px rgba(0,0,0,0.4)", background: "rgba(8,12,35,0.85)" }}>
          <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
            <iframe
              src="https://www.youtube.com/embed/OEj9wxKF_TA?autoplay=1&mute=1&loop=1&playlist=OEj9wxKF_TA&controls=1&rel=0"
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <p className="text-center text-xs text-white/30 py-3 px-4 italic">
            {t("demo.videoDisclaimer")}
          </p>
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
              href="/tarifs"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-8 py-3.5 font-medium text-sm text-white/80 hover:bg-white/[0.08] transition"
            >
              {t("demo.ctaSecondary")}
            </Link>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="relative z-10 px-8 py-8 border-t border-white/[0.06] text-center">
        <p className="text-xs text-white/25">{t("footer.copyright", { year: new Date().getFullYear().toString() })}</p>
      </footer>
    </div>
  );
}

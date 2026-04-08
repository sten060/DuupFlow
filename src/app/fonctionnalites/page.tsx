"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "@/lib/i18n/context";

const G = "bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent";

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <div style={{
        transform: visible ? "translateY(0)" : "translateY(72px)",
        opacity: visible ? 1 : 0,
        transition: `transform 0.85s cubic-bezier(0.16,1,0.3,1) ${delay}ms, opacity 0.75s ease-out ${delay}ms`,
        willChange: "transform, opacity",
      }}>{children}</div>
    </div>
  );
}

function AnimImageDup() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  useEffect(() => {
    function play() {
      setStep(0);
      const t1 = setTimeout(() => setStep(1), 400);
      const t2 = setTimeout(() => setStep(2), 750);
      const t3 = setTimeout(() => setStep(3), 1100);
      const t4 = setTimeout(() => setStep(4), 1450);
      return [t1, t2, t3, t4];
    }
    const timers = play();
    const loop = setInterval(() => { timers.forEach(clearTimeout); play(); }, 4000);
    return () => { timers.forEach(clearTimeout); clearInterval(loop); };
  }, []);
  const copies = [
    { name: "DuupFlow_dup1_47.jpg", color: "border-fuchsia-500/30 bg-fuchsia-500/[0.08]" },
    { name: "DuupFlow_dup2_83.jpg", color: "border-indigo-500/30 bg-indigo-500/[0.08]" },
    { name: "DuupFlow_dup3_12.jpg", color: "border-pink-500/30 bg-pink-500/[0.08]" },
    { name: "DuupFlow_dup4_55.jpg", color: "border-violet-500/30 bg-violet-500/[0.08]" },
  ];
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /><span className="text-xs text-white/50">{t("fonctionnalites.copiesGenerated").replace("{count}", String(step))}</span></div>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-medium">{t("fonctionnalites.unlimited")}</span>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-sky-500/20 flex items-center justify-center text-lg">🖼️</div>
        <div className="flex-1 min-w-0"><p className="text-sm text-white/80 font-medium truncate">photo_instagram.jpg</p><p className="text-xs text-white/35">{t("fonctionnalites.sourceFile")} · 2.4 MB</p></div>
        <span className="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/[0.04] text-white/40">{t("fonctionnalites.source")}</span>
      </div>
      <div className="flex justify-center py-0.5"><svg className="h-4 w-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 5v14M5 12l7 7 7-7" /></svg></div>
      {copies.map((f, i) => (
        <div key={f.name} className={`rounded-xl border p-3 flex items-center gap-3 transition-all duration-500 ${f.color}`} style={{ opacity: step > i ? 1 : 0, transform: step > i ? "translateY(0)" : "translateY(12px)" }}>
          <div className="h-9 w-9 rounded-lg bg-white/[0.06] flex items-center justify-center text-sm">📄</div>
          <div className="flex-1 min-w-0"><p className="text-xs text-white/65 font-mono truncate">{f.name}</p><p className="text-xs text-white/30">{t("fonctionnalites.metadataModified")}</p></div>
          <svg className="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
      ))}
    </div>
  );
}

function AnimInvisible() {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<0|1|2>(0);
  useEffect(() => {
    function play() { setPhase(0); const t1 = setTimeout(() => setPhase(1), 1200); const t2 = setTimeout(() => setPhase(2), 2400); return [t1, t2]; }
    const timers = play();
    const loop = setInterval(() => { timers.forEach(clearTimeout); play(); }, 5000);
    return () => { timers.forEach(clearTimeout); clearInterval(loop); };
  }, []);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2"><div className={`h-2 w-2 rounded-full transition-colors duration-500 ${phase === 2 ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"}`} /><span className="text-xs text-white/50">{phase === 0 ? t("fonctionnalites.originalHash") : phase === 1 ? t("fonctionnalites.pixelMagicInProgress") : t("fonctionnalites.hashModified")}</span></div>
      <div className={`rounded-xl border p-4 transition-all duration-500 ${phase === 0 ? "border-amber-500/25 bg-amber-500/[0.05]" : "border-white/10 bg-white/[0.04]"}`}><p className="text-xs text-white/40 font-mono mb-1">Original Hash</p><p className={`text-sm font-mono transition-all duration-500 ${phase === 0 ? "text-amber-300" : "text-white/30 line-through"}`}>a7f3e2d1c4b8...9f0a6e3d</p></div>
      <div className="flex justify-center"><div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-500 ${phase >= 1 ? "border-indigo-500/30 bg-indigo-500/[0.10] scale-105" : "border-white/10 bg-white/[0.04] scale-100"}`}><span className="text-sm">✨</span><span className={`text-xs font-semibold transition-colors duration-500 ${phase >= 1 ? "text-indigo-300" : "text-white/40"}`}>Pixel magique</span></div></div>
      <div className={`rounded-xl border p-4 transition-all duration-500 ${phase === 2 ? "border-emerald-500/25 bg-emerald-500/[0.05]" : "border-white/10 bg-white/[0.04]"}`}><p className="text-xs text-white/40 font-mono mb-1">Modified Hash</p><p className={`text-sm font-mono transition-all duration-500 ${phase === 2 ? "text-emerald-300" : "text-white/20"}`}>9b2e8f4a7c1d...3b5d2e8f</p></div>
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-center"><p className={`text-sm font-medium transition-colors duration-500 ${phase === 2 ? "text-emerald-300" : "text-white/50"}`}>{t("fonctionnalites.visuallyIdentical")}</p><p className="text-xs text-white/35">{t("fonctionnalites.visualContentUnchanged")}</p></div>
    </div>
  );
}

function AnimPriority() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  useEffect(() => {
    function play() { setStep(0); const t1 = setTimeout(() => setStep(1), 600); const t2 = setTimeout(() => setStep(2), 1200); const t3 = setTimeout(() => setStep(3), 1800); const t4 = setTimeout(() => setStep(4), 2400); return [t1, t2, t3, t4]; }
    const timers = play();
    const loop = setInterval(() => { timers.forEach(clearTimeout); play(); }, 5000);
    return () => { timers.forEach(clearTimeout); clearInterval(loop); };
  }, []);
  const fields = [{ key: "Make", value: "Apple" }, { key: "Model", value: "iPhone 16 Pro" }, { key: "Software", value: "18.3" }, { key: "Location", value: "Paris, France" }];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3"><div className="h-8 w-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center"><svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div><span className="text-xs text-white/50">{t("fonctionnalites.metadataInjected").replace("{count}", String(step))}</span></div>
      {fields.map((f, i) => (<div key={f.key} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 flex items-center justify-between transition-all duration-500" style={{ opacity: step > i ? 1 : 0.2, transform: step > i ? "translateX(0)" : "translateX(8px)" }}><span className="text-xs text-white/40 font-mono">{f.key}</span><span className={`text-xs font-mono transition-colors duration-500 ${step > i ? "text-emerald-300" : "text-white/20"}`}>{f.value}</span>{step > i && <svg className="h-3.5 w-3.5 text-emerald-400 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg>}</div>))}
      {step >= 4 && <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] p-3 text-center transition-all duration-500"><p className="text-xs text-indigo-300">{t("fonctionnalites.algorithmTreatsAsIphone")}</p></div>}
    </div>
  );
}

function AnimAIDet() {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<0|1|2>(0);
  useEffect(() => {
    function play() { setPhase(0); const t1 = setTimeout(() => setPhase(1), 1200); const t2 = setTimeout(() => setPhase(2), 2400); return [t1, t2]; }
    const timers = play();
    const loop = setInterval(() => { timers.forEach(clearTimeout); play(); }, 5000);
    return () => { timers.forEach(clearTimeout); clearInterval(loop); };
  }, []);
  const fields = [{ key: "Software", bad: "Midjourney v6.1", good: "Adobe Lightroom 7.2" }, { key: "Artist", bad: "Midjourney Bot", good: "Sophie Renaud" }, { key: "Make", bad: "midjourney.com", good: "Sony" }, { key: "Model", bad: "trainedAlgorithmic", good: "A7 IV" }];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4"><div className={`h-2 w-2 rounded-full transition-colors duration-500 ${phase === 2 ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"}`} /><span className="text-xs text-white/50">{phase === 0 ? t("fonctionnalites.analysisInProgress") : phase === 1 ? t("fonctionnalites.replacingMetadata") : t("fonctionnalites.aiSignatureErased")}</span></div>
      {fields.map((f) => (<div key={f.key} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 flex items-center justify-between gap-2"><span className="text-xs text-white/35 font-mono shrink-0">{f.key}</span><div className="flex items-center gap-2 flex-1 justify-end overflow-hidden">{phase === 0 && <span className="text-xs text-amber-300 font-mono truncate">{f.bad}</span>}{phase === 1 && <><span className="text-xs text-red-400/60 font-mono line-through truncate">{f.bad}</span><span className="text-white/20 text-xs">→</span><span className="text-xs text-white/40 font-mono truncate">{f.good}</span></>}{phase === 2 && <span className="text-xs text-emerald-400 font-mono truncate">{f.good}</span>}</div>{phase === 2 && <svg className="h-3.5 w-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg>}</div>))}
    </div>
  );
}

function FeatureRow({ badge, badgeColor, title, subtitle, bullets, mockup, reverse = false, first = false }: { badge: string; badgeColor: string; title: React.ReactNode; subtitle: string; bullets: string[]; mockup: React.ReactNode; reverse?: boolean; first?: boolean }) {
  return (
    <Reveal>
      <div className={`flex flex-col ${reverse ? "md:flex-row-reverse" : "md:flex-row"} gap-12 md:gap-20 items-center py-20 ${first ? "" : "border-t border-white/[0.05]"}`}>
        <div className="flex-1">
          <div className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold mb-5 ${badgeColor}`}>{badge}</div>
          <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-3 sm:mb-4 tracking-tight leading-[1.15]">{title}</h3>
          <p className="text-white/70 text-sm sm:text-base leading-relaxed mb-5 sm:mb-7">{subtitle}</p>
          <ul className="space-y-3.5">{bullets.map((b, i) => (<li key={i} className="flex items-start gap-3 text-sm text-white/75"><svg className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>{b}</li>))}</ul>
        </div>
        <div className="flex-1 w-full max-w-sm md:max-w-md">
          <div className="rounded-2xl border border-white/[0.12] p-4 sm:p-6 backdrop-blur-sm min-h-[220px] sm:min-h-[320px]" style={{ background: "rgba(8,12,35,0.75)" }}>{mockup}</div>
        </div>
      </div>
    </Reveal>
  );
}

export default function FonctionnalitesPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen px-6 pb-20">
      <div className="max-w-5xl mx-auto pt-20">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3 text-center">{t("fonctionnalites.badge")}</p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white mb-4 tracking-tight text-center">
            {t("fonctionnalites.title")} <span className={G}>{t("fonctionnalites.titleHighlight")}</span>
          </h2>
          <p className="text-white/65 text-sm sm:text-base max-w-lg mx-auto text-center">{t("fonctionnalites.subtitle")}</p>
        </Reveal>

        <FeatureRow first badge={"🖼️🎬 " + t("fonctionnalites.feature1Badge")} badgeColor="border border-fuchsia-500/25 bg-fuchsia-500/[0.08] text-fuchsia-300"
          title={<>{t("fonctionnalites.feature1Title")}{" "}<span className={G}>{t("fonctionnalites.feature1TitleHighlight")}</span></>}
          subtitle={t("fonctionnalites.feature1Subtitle")}
          bullets={[t("fonctionnalites.feature1Bullet1"), t("fonctionnalites.feature1Bullet2"), t("fonctionnalites.feature1Bullet3")]}
          mockup={<AnimImageDup />} />

        <FeatureRow badge={"✨ " + t("fonctionnalites.feature2Badge")} badgeColor="border border-indigo-500/25 bg-indigo-500/[0.08] text-indigo-300"
          title={<>{t("fonctionnalites.feature2Title")}{" "}<span className={G}>{t("fonctionnalites.feature2TitleHighlight")}</span></>}
          subtitle={t("fonctionnalites.feature2Subtitle")}
          bullets={[t("fonctionnalites.feature2Bullet1"), t("fonctionnalites.feature2Bullet2"), t("fonctionnalites.feature2Bullet3")]}
          mockup={<AnimInvisible />} reverse />

        <FeatureRow badge={"⚡ " + t("fonctionnalites.feature3Badge")} badgeColor="border border-amber-500/25 bg-amber-500/[0.08] text-amber-300"
          title={<>{t("fonctionnalites.feature3Title")}{" "}<span className={G}>{t("fonctionnalites.feature3TitleHighlight")}</span></>}
          subtitle={t("fonctionnalites.feature3Subtitle")}
          bullets={[t("fonctionnalites.feature3Bullet1"), t("fonctionnalites.feature3Bullet2"), t("fonctionnalites.feature3Bullet3")]}
          mockup={<AnimPriority />} />

        <FeatureRow badge={"🤖 " + t("fonctionnalites.feature4Badge")} badgeColor="border border-red-500/25 bg-red-500/[0.08] text-red-300"
          title={<>{t("fonctionnalites.feature4Title")}{" "}<span className={G}>{t("fonctionnalites.feature4TitleHighlight")}</span>{" "}{t("fonctionnalites.feature4TitleSuffix")}</>}
          subtitle={t("fonctionnalites.feature4Subtitle")}
          bullets={[t("fonctionnalites.feature4Bullet1"), t("fonctionnalites.feature4Bullet2"), t("fonctionnalites.feature4Bullet3")]}
          mockup={<AnimAIDet />} reverse />

        <Reveal>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-6 pb-8">
            <Link href="/register" className="btn-glow inline-flex items-center gap-2 rounded-xl px-7 py-3.5 font-semibold text-white text-sm">{t("fonctionnalites.ctaPrimary")}</Link>
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-7 py-3.5 font-medium text-sm text-white/80 hover:bg-white/[0.08] transition">{t("fonctionnalites.ctaSecondary")}</Link>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

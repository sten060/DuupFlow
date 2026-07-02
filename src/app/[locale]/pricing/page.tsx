"use client";

import Link from "@/components/LocaleLink";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n/context";

const G = "bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent";

/* ─── Testimonials (static data, text keys resolved in component) ─── */
const TESTIMONIAL_META = [
  { key: "tarifs.testimonial1", name: "S.M.", role: "Agence OFM", avatar: "/testimonials/_ (1).jpeg", color: "#6366F1" },
  { key: "tarifs.testimonial2", name: "J.R.", role: "Agence OFM", avatar: "/testimonials/_ (2).jpeg", color: "#8B5CF6" },
  { key: "tarifs.testimonial3", name: "A.K.", role: "Agence OFM", avatar: "/testimonials/_ (3).jpeg", color: "#38BDF8" },
  { key: "tarifs.testimonial4", name: "L.B.", role: "Agence OFM", avatar: "/testimonials/_ (4).jpeg", color: "#EC4899" },
  { key: "tarifs.testimonial5", name: "P.D.", role: "Agence OFM", avatar: "/testimonials/_ (5).jpeg", color: "#10B981" },
  { key: "tarifs.testimonial6", name: "T.M.", role: "Agence OFM", avatar: "/testimonials/_ (6).jpeg", color: "#F59E0B" },
  { key: "tarifs.testimonial7", name: "N.V.", role: "Agence OFM", avatar: "/testimonials/_ (7).jpeg", color: "#6366F1" },
  { key: "tarifs.testimonial8", name: "R.C.", role: "Mentor", avatar: "/testimonials/_ (8).jpeg", color: "#8B5CF6" },
  { key: "tarifs.testimonial9", name: "F.L.", role: "Agence OFM", avatar: "/testimonials/_.jpeg", color: "#38BDF8" },
  { key: "tarifs.testimonial10", name: "C.B.", role: "Agence OFM", avatar: "/testimonials/Ig sascha07__.jpeg", color: "#EC4899" },
  { key: "tarifs.testimonial11", name: "K.D.", role: "Agence OFM", avatar: "/testimonials/OFM = @melvin_ofm.jpeg", color: "#10B981" },
  { key: "tarifs.testimonial12", name: "O.M.", role: "Agence OFM", avatar: "/testimonials/hunter davenport _ the play _ briar u.jpeg", color: "#F59E0B" },
];

/* ─── Pricing FAQ keys ─── */
const PRICING_FAQ_KEYS = [
  { qKey: "tarifs.pricingFaq1Q", aKey: "tarifs.pricingFaq1A" },
  { qKey: "tarifs.pricingFaq2Q", aKey: "tarifs.pricingFaq2A" },
  { qKey: "tarifs.pricingFaq3Q", aKey: "tarifs.pricingFaq3A" },
  { qKey: "tarifs.pricingFaq4Q", aKey: "tarifs.pricingFaq4A" },
  { qKey: "tarifs.pricingFaq5Q", aKey: "tarifs.pricingFaq5A" },
  { qKey: "tarifs.pricingFaq8Q", aKey: "tarifs.pricingFaq8A" },
  { qKey: "tarifs.pricingFaq6Q", aKey: "tarifs.pricingFaq6A" },
  { qKey: "tarifs.pricingFaq7Q", aKey: "tarifs.pricingFaq7A" },
];

function TestimonialCard({ item }: { item: { text: string; name: string; role: string; avatar: string; color: string } }) {
  return (
    <div
      className="shrink-0 w-[200px] sm:w-[240px] rounded-xl sm:rounded-2xl border border-white/[0.10] px-3 sm:px-4 py-3 sm:py-3.5 flex flex-col justify-between"
      style={{ background: "rgba(8,12,35,0.75)" }}
    >
      <p className="text-[11px] sm:text-xs text-white/65 leading-relaxed mb-2.5 line-clamp-2">
        &ldquo;{item.text}&rdquo;
      </p>
      <div className="flex items-center gap-2">
        <img src={item.avatar} alt={item.name} className="h-6 w-6 sm:h-7 sm:w-7 rounded-full object-cover shrink-0" />
        <div>
          <p className="text-[11px] sm:text-xs font-semibold text-white leading-none mb-0.5">{item.name}</p>
          <p className="text-[9px] sm:text-[10px] text-white/40">{item.role}</p>
        </div>
      </div>
    </div>
  );
}

function TestimonialsCarousel() {
  const { t } = useTranslation();
  const testimonials = TESTIMONIAL_META.map((m) => ({
    text: t(m.key),
    name: m.name,
    role: m.role,
    avatar: m.avatar,
    color: m.color,
  }));
  return (
    <div className="relative overflow-hidden">
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track { animation: marquee 80s linear infinite; }
        .marquee-track:hover { animation-play-state: paused; }
      `}</style>

      {/* Fade edges */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-40 z-10"
        style={{ background: "linear-gradient(90deg, rgba(6,12,30,1) 0%, rgba(6,12,30,0.9) 60%, transparent 100%)" }} />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-40 z-10"
        style={{ background: "linear-gradient(270deg, rgba(6,12,30,1) 0%, rgba(6,12,30,0.9) 60%, transparent 100%)" }} />

      <div className="marquee-track flex gap-4" style={{ width: "max-content" }}>
        {/* Render twice for seamless loop */}
        {[...testimonials, ...testimonials].map((item, i) => (
          <TestimonialCard key={i} item={item} />
        ))}
      </div>
    </div>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <div
      className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
      style={{ background: `${color}20`, border: `1px solid ${color}40` }}
    >
      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="3">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </div>
  );
}

/* Features available on every plan — Google Drive import (with logo) + file compressor */
function UniversalFeatures({ color }: { color: string }) {
  const { t } = useTranslation();
  return (
    <>
      <li className="flex items-start gap-3 text-sm text-white/70">
        <img src="/app/icons8-google-drive-96.png" alt="Google Drive" className="h-5 w-5 object-contain shrink-0 mt-0.5" />
        {t("tarifs.featGoogleDrive")}
      </li>
      <li className="flex items-start gap-3 text-sm text-white/70">
        <CheckIcon color={color} />
        {t("tarifs.featCompressor")}
      </li>
    </>
  );
}

function PricingCards() {
  const { t } = useTranslation();
  const freeFeatures = [
    t("tarifs.freeFeature1"),
    t("tarifs.freeFeature2"),
    t("tarifs.freeFeature3"),
    t("tarifs.freeFeature4"),
    t("tarifs.freeFeature5"),
    t("tarifs.freeFeature6"),
    t("tarifs.freeFeature7"),
  ];

  const soloFeatures = [
    t("tarifs.soloFeature1"),
    t("tarifs.soloFeature2"),
    t("tarifs.soloFeature3"),
    t("tarifs.soloFeature4"),
    t("tarifs.soloFeature5"),
    t("tarifs.soloFeature6"),
    t("tarifs.soloFeature7"),
    t("tarifs.soloFeature8"),
  ];

  const proFeatures = [
    t("tarifs.proFeature1"),
    t("tarifs.proFeature2"),
    t("tarifs.proFeature3"),
    t("tarifs.proFeature4"),
    t("tarifs.proFeature5"),
    t("tarifs.proFeature6"),
    t("tarifs.proFeature7"),
    t("tarifs.proFeature8"),
    t("tarifs.proFeature9"),
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">

      {/* Plan Free */}
      <div
        className="relative rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: "rgba(10,14,40,0.35)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16,185,129,0.22) 0%, transparent 75%)",
          }}
        />
        <div className="relative z-10 p-5 sm:p-8 flex flex-col flex-1">
          <div className="mb-5 sm:mb-6">
            <span className="text-sm sm:text-base font-semibold text-white">{t("tarifs.planFree")}</span>
            <div className="flex items-baseline gap-1.5 mb-1 mt-3 sm:mt-4">
              <span className="text-4xl sm:text-5xl font-bold text-white">{t("tarifs.freePrice")}</span>
              <span className="text-white/45 text-sm">{t("tarifs.perMonth")}</span>
            </div>
            <p className="text-white/45 text-sm">{t("tarifs.freeDesc")}</p>
          </div>
          <div className="h-px bg-white/[0.08] mb-6" />
          <ul className="space-y-3.5 flex-1 mb-8">
            {freeFeatures.map((f, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/70">
                <CheckIcon color="#10B981" />
                {f}
              </li>
            ))}
            <UniversalFeatures color="#10B981" />
          </ul>
          <div className="flex flex-col gap-3">
            <Link
              href="/register"
              className="w-full flex items-center justify-center rounded-2xl py-3.5 text-sm font-semibold text-white/85 hover:text-white transition border border-white/20 hover:border-white/35 hover:bg-white/[0.04]"
            >
              {t("tarifs.commencer")}
            </Link>
            <Link
              href="/#videos"
              className="w-full flex items-center justify-center rounded-2xl py-3.5 text-sm font-semibold text-white/70 hover:text-white transition border border-white/15 hover:border-white/30 hover:bg-white/[0.04]"
            >
              {t("tarifs.voirDemo")}
            </Link>
          </div>
        </div>
      </div>

      {/* Plan Solo */}
      <div
        className="relative rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: "rgba(10,14,40,0.35)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(139,92,246,0.28) 0%, transparent 75%)",
          }}
        />
        <div className="relative z-10 p-5 sm:p-8 flex flex-col flex-1">
          <div className="mb-5 sm:mb-6">
            <span className="text-sm sm:text-base font-semibold text-white">{t("tarifs.planSolo")}</span>
            <div className="flex items-baseline gap-1.5 mb-1 mt-3 sm:mt-4">
              <span className="text-4xl sm:text-5xl font-bold text-white">39€</span>
              <span className="text-white/45 text-sm">{t("tarifs.perMonth")}</span>
            </div>
            <p className="text-white/45 text-sm">{t("tarifs.soloDesc")}</p>
          </div>
          <div className="h-px bg-white/[0.08] mb-6" />
          <ul className="space-y-3.5 flex-1 mb-8">
            {soloFeatures.map((f, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/70">
                <CheckIcon color="#A78BFA" />
                {f}
              </li>
            ))}
            <UniversalFeatures color="#A78BFA" />
          </ul>
          <div className="flex flex-col gap-3">
            <Link
              href="/register?plan=solo"
              className="w-full flex items-center justify-center rounded-2xl py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#7C3AED,#6366F1)" }}
            >
              {t("tarifs.commencer")}
            </Link>
            <Link
              href="/#videos"
              className="w-full flex items-center justify-center rounded-2xl py-3.5 text-sm font-semibold text-white/70 hover:text-white transition border border-white/15 hover:border-white/30 hover:bg-white/[0.04]"
            >
              {t("tarifs.voirDemo")}
            </Link>
          </div>
        </div>
      </div>

      {/* Plan Pro */}
      <div
        className="relative rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: "rgba(10,14,40,0.35)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          border: "1.5px solid rgba(99,102,241,0.40)",
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.40) 0%, transparent 75%)",
          }}
        />
        <div className="relative z-10 p-5 sm:p-8 flex flex-col flex-1">
          <div className="mb-5 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <span className="text-sm sm:text-base font-semibold text-white">{t("tarifs.planPro")}</span>
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 uppercase tracking-wide">
                {t("tarifs.mostPopular")}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-4xl sm:text-5xl font-bold text-white">99€</span>
              <span className="text-white/45 text-sm">{t("tarifs.perMonth")}</span>
            </div>
            <p className="text-white/45 text-sm">{t("tarifs.proDesc")}</p>
          </div>
          <div className="h-px bg-white/[0.08] mb-6" />
          <ul className="space-y-3.5 flex-1 mb-8">
            {proFeatures.map((f, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/70">
                <CheckIcon color="#818CF8" />
                {f}
              </li>
            ))}
            <UniversalFeatures color="#818CF8" />
          </ul>
          <div className="flex flex-col gap-3">
            <Link
              href="/register?plan=pro"
              className="w-full flex items-center justify-center rounded-2xl py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
            >
              {t("tarifs.commencer")}
            </Link>
            <Link
              href="/#videos"
              className="w-full flex items-center justify-center rounded-2xl py-3.5 text-sm font-semibold text-white/70 hover:text-white transition border border-white/15 hover:border-white/30 hover:bg-white/[0.04]"
            >
              {t("tarifs.voirDemo")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Plans comparison table (Gaating-style) ─── */
function CmpCheck() {
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full shrink-0"
      style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="3">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

function PlansComparison() {
  const { t } = useTranslation();
  const U = t("tarifs.cmpUnlimited");

  const groups: { label: string; rows: { label: string; values: (string | boolean)[]; logo?: string }[] }[] = [
    {
      label: t("tarifs.cmpGroupDuplication"),
      rows: [
        { label: t("tarifs.cmpRowDupImages"), values: ["20", "400", U] },
        { label: t("tarifs.cmpRowDupVideos"), values: ["10", "300", U] },
        { label: t("tarifs.cmpRowExportZip"), values: [true, true, true] },
      ],
    },
    {
      label: t("tarifs.cmpGroupUnicite"),
      rows: [
        { label: t("tarifs.cmpRowMetadata"), values: [false, true, true] },
        { label: t("tarifs.cmpRowSignatureIA"), values: [false, "200", U] },
        { label: t("tarifs.cmpRowVariationIA"), values: [t("tarifs.cmpVarFree"), t("tarifs.cmpVarSolo"), t("tarifs.cmpVarPro")] },
        { label: t("tarifs.cmpRowTokens"), values: [t("tarifs.cmpTokens1"), t("tarifs.cmpTokens3"), t("tarifs.cmpTokens3")] },
      ],
    },
    {
      label: t("tarifs.cmpGroupFormats"),
      rows: [
        { label: t("tarifs.cmpRowFormats"), values: [true, true, true] },
        { label: t("tarifs.cmpRowBatch"), values: [true, true, true] },
        { label: t("tarifs.cmpRowPresets"), values: [false, false, true] },
        { label: t("tarifs.featGoogleDrive"), logo: "/app/icons8-google-drive-96.png", values: [true, true, true] },
        { label: t("tarifs.featCompressor"), values: [true, true, true] },
        { label: t("tarifs.featApi"), values: [false, false, true] },
      ],
    },
    {
      label: t("tarifs.cmpGroupTeam"),
      rows: [{ label: t("tarifs.cmpRowMembers"), values: [false, false, t("tarifs.cmpMembers3")] }],
    },
    {
      label: t("tarifs.cmpGroupSupport"),
      rows: [
        { label: t("tarifs.cmpRowSupportEmail"), values: [true, true, true] },
        { label: t("tarifs.cmpRowSupportTelegram"), values: [false, true, true] },
        { label: t("tarifs.cmpRowSupportPriority"), values: [false, false, true] },
      ],
    },
  ];

  const plans = [t("tarifs.cmpColFree"), t("tarifs.cmpColSolo"), t("tarifs.cmpColPro")];
  const cols = "grid grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,1fr))]";

  const cell = (v: string | boolean) => {
    if (v === true) return <CmpCheck />;
    if (v === false) return <span className="text-white/20">—</span>;
    return <span className="text-xs sm:text-sm text-white/85 font-medium text-center">{v}</span>;
  };

  return (
    <section className="px-6 pt-10 pb-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14">
          <h2 className="text-3xl sm:text-5xl md:text-[3.5rem] font-light tracking-tight text-white leading-[1.05]">
            {t("tarifs.cmpTitle")}
          </h2>
          <p className="text-white/55 text-sm sm:text-lg mt-4 max-w-xl mx-auto leading-relaxed">
            {t("tarifs.cmpSubtitle")}
          </p>
        </div>

        {/* Sticky column header */}
        <div className={`${cols} sticky top-16 z-30 items-end backdrop-blur-md`} style={{ background: "rgba(8,12,30,0.85)" }}>
          <div className="py-4 text-sm font-semibold text-white/90">{t("tarifs.cmpFeature")}</div>
          {plans.map((p, i) => (
            <div key={i} className={`py-4 text-center text-sm sm:text-base font-semibold ${i === 2 ? "text-white" : "text-white/80"}`}>
              {p}
            </div>
          ))}
        </div>
        <div className="h-px" style={{ background: "rgba(255,255,255,0.14)" }} />

        {/* Groups */}
        {groups.map((g, gi) => (
          <div key={gi}>
            <div className="pt-7 pb-1 text-[11px] font-semibold tracking-[0.15em] uppercase text-white/35">{g.label}</div>
            {g.rows.map((row, ri) => (
              <div key={ri} className={`${cols} items-center border-t border-white/[0.06] hover:bg-white/[0.02] transition-colors`}>
                <div className="py-4 pr-3 text-xs sm:text-sm text-white/75 leading-snug flex items-center gap-2">
                  {row.logo && <img src={row.logo} alt="" className="h-4 w-4 object-contain shrink-0" />}
                  {row.label}
                </div>
                {row.values.map((v, vi) => (
                  <div key={vi} className="py-4 flex items-center justify-center">{cell(v)}</div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function PricingFAQ() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<number | null>(null);
  const pricingFaqs = PRICING_FAQ_KEYS.map((f) => ({ q: t(f.qKey), a: t(f.aKey) }));
  return (
    <section className="relative overflow-hidden">
      {/* Dark blue background */}
      <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(180deg, #040c28 0%, #06112f 50%, #040c28 100%)" }} />
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[400px] rounded-full pointer-events-none -z-10"
        style={{ background: "rgba(99,102,241,0.10)", filter: "blur(90px)" }} />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[350px] rounded-full pointer-events-none -z-10"
        style={{ background: "rgba(56,189,248,0.07)", filter: "blur(90px)" }} />

      <div className="px-6 pb-36">
        <div className="max-w-5xl mx-auto pt-20">
          <div className="grid md:grid-cols-[2fr_3fr] gap-16">
            <div className="md:sticky md:top-28 self-start">
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3">FAQ</p>
              <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight leading-[1.1]">{t("tarifs.faqTitle")}</h2>
              <p className="text-white/60 text-sm mt-4 leading-relaxed">
                {t("tarifs.faqSubtitle")}
              </p>
            </div>
            <div className="divide-y divide-white/[0.08]">
              {pricingFaqs.map((faq, i) => (
                <div key={i}>
                  <button
                    onClick={() => setOpen(open === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 py-5 text-left text-sm font-medium text-white/90 hover:text-white transition"
                  >
                    <span>{faq.q}</span>
                    <span
                      className="shrink-0 h-6 w-6 rounded-full border border-white/15 flex items-center justify-center text-white/50 transition-transform"
                      style={{ transform: open === i ? "rotate(45deg)" : "rotate(0deg)" }}
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </button>
                  {open === i && (
                    <div className="pb-5 text-sm text-white/70 leading-relaxed">{faq.a}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function TarifsPage() {
  const { t } = useTranslation();
  return (
    <div>
      {/* ── HERO ── */}
      <section className="flex flex-col items-center text-center px-6 pt-20 pb-16">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-1.5 text-sm text-white/70">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {t("tarifs.badge")}
        </div>
        <h1 className="text-3xl sm:text-5xl md:text-[3.5rem] font-bold tracking-tight text-white mb-4 leading-[1.08]">
          {t("tarifs.title")}
        </h1>
        <p className="text-white/65 text-sm sm:text-lg max-w-lg mb-3">
          {t("tarifs.subtitle")}
        </p>
        <p className="text-sm text-white/45 mb-2">
          {t("tarifs.forCreators")}{" "}
          <span className={G + " font-semibold"}>{t("tarifs.creators")}</span>
          {" "}{t("tarifs.and")}{" "}
          <span className={G + " font-semibold"}>{t("tarifs.agencies")}</span>
        </p>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="pb-16 overflow-hidden">
        <TestimonialsCarousel />
      </section>

      {/* ── PRICING CARDS ── */}
      <section className="px-6 pb-24">
        <PricingCards />

        {/* TikTok solution reassurance badge — accent matches the landing announcement bar */}
        <div className="mt-8 flex justify-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm">
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
              style={{ background: "linear-gradient(90deg,#6366F1,#38BDF8)" }}
            >
              {t("tarifs.tiktokBadgeNew")}
            </span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" className="shrink-0 text-white/80">
              <path d="M16.6 3c.27 2.07 1.43 3.3 3.4 3.43v2.32c-1.14.11-2.14-.26-3.3-.96v6.13c0 3.12-2.27 5.55-5.3 5.55-2.93 0-5.0-2.26-5.0-4.92 0-2.94 2.35-4.92 5.49-4.62v2.55c-.46-.1-.95-.16-1.43-.08-1.15.18-1.9.96-1.82 2.2.08 1.15.95 1.94 2.11 1.94.9 0 1.65-.58 1.87-1.45.06-.27.08-.62.08-.94V3h3.43z" />
            </svg>
            <span className="font-medium text-white/85">{t("tarifs.tiktokBadge")}</span>
          </div>
        </div>
      </section>

      {/* ── PLANS COMPARISON ── */}
      <PlansComparison />

      {/* ── FAQ ── */}
      <PricingFAQ />

      {/* ── FOOTER ── */}
      <footer className="px-6 pb-10 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto pt-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm font-bold tracking-tight">
            <span style={{ color: "#818CF8" }}>Duup</span>
            <span className="text-white/50">Flow</span>
          </div>
          <p className="text-xs text-white/25">{t("footer.copyright").replace("{year}", new Date().getFullYear().toString())}</p>
          <div className="flex gap-5 text-xs text-white/30">
            <Link href="/legal" className="hover:text-white/60 transition">{t("footer.mentionsLegales")}</Link>
            <Link href="/legal/terms" className="hover:text-white/60 transition">{t("footer.cgu")}</Link>
            <Link href="/legal/privacy" className="hover:text-white/60 transition">{t("footer.confidentialite")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

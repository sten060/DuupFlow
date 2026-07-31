"use client";

import Link from "@/components/LocaleLink";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { NavPill, Footer, SmoothScroll } from "@/components/landing/shell";

const G = "bg-gradient-to-r from-[#4f7bff] to-[#7c5cff] bg-clip-text text-transparent";

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
      className="shrink-0 w-[200px] sm:w-[240px] rounded-xl sm:rounded-2xl border border-black/10 px-3 sm:px-4 py-3 sm:py-3.5 flex flex-col justify-between"
      style={{ background: "#ffffff" }}
    >
      <p className="text-[11px] sm:text-xs text-[#605f5f] leading-relaxed mb-2.5 line-clamp-2">
        &ldquo;{item.text}&rdquo;
      </p>
      <div className="flex items-center gap-2">
        <img src={item.avatar} alt={item.name} className="h-6 w-6 sm:h-7 sm:w-7 rounded-full object-cover shrink-0" />
        <div>
          <p className="text-[11px] sm:text-xs font-semibold text-[#1a1a1a] leading-none mb-0.5">{item.name}</p>
          <p className="text-[9px] sm:text-[10px] text-[#8a8a8a]">{item.role}</p>
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
        style={{ background: "linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 60%, transparent 100%)" }} />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-40 z-10"
        style={{ background: "linear-gradient(270deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 60%, transparent 100%)" }} />

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
      <li className="flex items-start gap-3 text-sm text-[#605f5f]">
        <img src="/app/icons8-google-drive-96.png" alt="Google Drive" className="h-5 w-5 object-contain shrink-0 mt-0.5" />
        {t("tarifs.featGoogleDrive")}
      </li>
      <li className="flex items-start gap-3 text-sm text-[#605f5f]">
        <CheckIcon color={color} />
        {t("tarifs.featCompressor")}
      </li>
    </>
  );
}

/* Plan icons — sit in a rounded-square badge at the top of each card (screen-2 layout) */
function PlanIcon({ plan, color }: { plan: "solo" | "pro"; color: string }) {
  return (
    <div
      className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center shrink-0"
      style={{ background: `${color}1F`, border: `1px solid ${color}3D` }}
    >
      <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {plan === "solo" ? (
          /* Two interlocking rings — an original and its copy (DuupFlow duplication motif) */
          <>
            <circle cx="9" cy="12" r="5" />
            <circle cx="15" cy="12" r="5" />
          </>
        ) : (
          /* Three interconnected rings — duplication at scale for creators & agencies */
          <>
            <circle cx="12" cy="8" r="4.3" />
            <circle cx="8" cy="15" r="4.3" />
            <circle cx="16" cy="15" r="4.3" />
          </>
        )}
      </svg>
    </div>
  );
}

type Plan = {
  id: "solo" | "pro";
  name: string;
  desc: string;
  price: string;
  color: string;
  btnShadow: string;
  cardBorder: string;
  btnBg: string;
  cta: string;
  note?: string;
  href: string;
  demoHref: string;
  popular: boolean;
  features: string[];
};

function PricingCards() {
  const { t } = useTranslation();

  const soloFeatures = [
    t("tarifs.soloFeature1"),
    t("tarifs.soloFeature2"),
    t("tarifs.soloFeature3"),
    t("tarifs.soloFeature4"),
    t("tarifs.soloFeature5"),
    t("tarifs.soloFeature6"),
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

  const plans: Plan[] = [
    {
      id: "solo",
      name: t("tarifs.planSolo"),
      desc: t("tarifs.soloDesc"),
      price: "39€",
      color: "#A78BFA",
      btnShadow: "0 16px 30px -8px rgba(124,58,237,0.55), 0 6px 12px -4px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.28)",
      cardBorder: "1px solid rgba(255,255,255,0.09)",
      btnBg: "linear-gradient(135deg,#7C3AED,#6366F1)",
      cta: t("tarifs.commencer"),
      href: "/register?plan=solo",
      demoHref: "/demo-request?plan=solo",
      popular: false,
      features: soloFeatures,
    },
    {
      id: "pro",
      name: t("tarifs.planPro"),
      desc: t("tarifs.proDesc"),
      price: "99€",
      color: "#818CF8",
      btnShadow: "0 16px 30px -8px rgba(56,189,248,0.45), 0 6px 12px -4px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.28)",
      cardBorder: "1.5px solid rgba(99,102,241,0.35)",
      btnBg: "linear-gradient(135deg,#4f7bff,#7c5cff)",
      cta: t("tarifs.commencer"),
      href: "/register?plan=pro",
      demoHref: "/demo-request?plan=pro",
      popular: true,
      features: proFeatures,
    },
  ];

  return (
    <div id="plans" className="scroll-mt-24 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      {plans.map((p) => (
        <div
          key={p.id}
          className="relative rounded-3xl flex flex-col"
          style={{
            background: "#ffffff",
            border: p.cardBorder,
            boxShadow: "0 24px 50px -24px rgba(20,40,90,0.14)",
          }}
        >
          {/* Popular badge — large, tilted, overflowing the top-right edge (screen-2 style) */}
          {p.popular && (
            <div className="absolute -top-4 -right-3 sm:-right-4 z-20 rotate-[10deg]">
              <span
                className="inline-block rounded-2xl px-4 sm:px-5 py-2 text-sm sm:text-base font-bold text-white"
                style={{
                  background: "linear-gradient(135deg,#4f7bff,#7c5cff)",
                  boxShadow: "0 12px 24px -6px rgba(56,189,248,0.55), 0 4px 10px -2px rgba(0,0,0,0.5)",
                }}
              >
                {t("tarifs.mostPopular")}
              </span>
            </div>
          )}

          <div className="relative z-10 p-5 sm:p-8 flex flex-col flex-1">
            {/* Icon + title + subtitle + price */}
            <PlanIcon plan={p.id} color={p.color} />
            <h3 className="mt-5 text-lg sm:text-xl font-bold text-[#1a1a1a]">{p.name}</h3>
            <p className="text-[#8a8a8a] text-sm mt-1">{p.desc}</p>
            <div className="flex items-baseline gap-1.5 mt-4 mb-6">
              <span className="text-4xl sm:text-5xl font-bold text-[#1a1a1a]">{p.price}</span>
              <span className="text-[#8a8a8a] text-sm">{t("tarifs.perMonth")}</span>
            </div>

            {/* Primary CTA — raised/embossed relief, sits above the feature list */}
            <Link
              href={p.href}
              className="w-full flex items-center justify-center rounded-2xl py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-105"
              style={{ background: p.btnBg, boxShadow: p.btnShadow }}
            >
              {p.cta}
            </Link>
            {p.note && (
              <p className="mt-2.5 text-center text-xs text-[#8a8a8a]">{p.note}</p>
            )}

            {/* Features */}
            <ul className="space-y-3.5 flex-1 mt-7">
              {p.features.map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-[#605f5f]">
                  <CheckIcon color={p.color} />
                  {f}
                </li>
              ))}
              <UniversalFeatures color={p.color} />
            </ul>

            {/* Secondary — personalized demo */}
            <Link
              href={p.demoHref}
              className="mt-7 w-full flex items-center justify-center rounded-2xl py-3 text-sm font-medium text-[#605f5f] hover:text-[#1a1a1a] transition border border-black/10 hover:border-black/10 hover:bg-[#f6f7f9]"
            >
              {t("tarifs.demoPerso")}
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Plans comparison table (Gaating-style) ─── */
function CmpCheck() {
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full shrink-0"
      style={{ background: "linear-gradient(135deg,#4f7bff,#7c5cff)" }}
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
        { label: t("tarifs.cmpRowDupImages"), values: ["400", U] },
        { label: t("tarifs.cmpRowDupVideos"), values: ["300", U] },
        { label: t("tarifs.cmpRowExportZip"), values: [true, true] },
      ],
    },
    {
      label: t("tarifs.cmpGroupUnicite"),
      rows: [
        { label: t("tarifs.cmpRowMetadata"), values: [true, true] },
        { label: t("tarifs.cmpRowSignatureIA"), values: ["200", U] },
        { label: t("tarifs.cmpRowVariationIA"), values: [t("tarifs.cmpVarSolo"), t("tarifs.cmpVarPro")] },
        { label: t("tarifs.cmpRowTokens"), values: [t("tarifs.cmpTokens3"), t("tarifs.cmpTokens3")] },
      ],
    },
    {
      label: t("tarifs.cmpGroupFormats"),
      rows: [
        { label: t("tarifs.cmpRowFormats"), values: [true, true] },
        { label: t("tarifs.cmpRowBatch"), values: [true, true] },
        { label: t("tarifs.cmpRowPresets"), values: [false, true] },
        { label: t("tarifs.featGoogleDrive"), logo: "/app/icons8-google-drive-96.png", values: [true, true] },
        { label: t("tarifs.featCompressor"), values: [true, true] },
        { label: t("tarifs.featApi"), values: [false, true] },
      ],
    },
    {
      label: t("tarifs.cmpGroupTeam"),
      rows: [{ label: t("tarifs.cmpRowMembers"), values: [false, t("tarifs.cmpMembers3")] }],
    },
    {
      label: t("tarifs.cmpGroupSupport"),
      rows: [
        { label: t("tarifs.cmpRowSupportEmail"), values: [true, true] },
        { label: t("tarifs.cmpRowSupportTelegram"), values: [true, true] },
        { label: t("tarifs.cmpRowSupportPriority"), values: [false, true] },
      ],
    },
  ];

  const plans = [t("tarifs.cmpColSolo"), t("tarifs.cmpColPro")];
  const cols = "grid grid-cols-[minmax(0,1.7fr)_repeat(2,minmax(0,1fr))]";

  const cell = (v: string | boolean) => {
    if (v === true) return <CmpCheck />;
    if (v === false) return <span className="text-[#9aa2b2]">—</span>;
    return <span className="text-xs sm:text-sm text-[#1a1a1a] font-medium text-center">{v}</span>;
  };

  return (
    <section className="px-6 pt-10 pb-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14">
          <h2 className="text-3xl sm:text-5xl md:text-[3.5rem] font-light tracking-tight text-[#1a1a1a] leading-[1.05]">
            {t("tarifs.cmpTitle")}
          </h2>
          <p className="text-[#605f5f] text-sm sm:text-lg mt-4 max-w-xl mx-auto leading-relaxed">
            {t("tarifs.cmpSubtitle")}
          </p>
        </div>

        {/* Sticky column header */}
        <div className={`${cols} sticky top-16 z-30 items-end backdrop-blur-md`} style={{ background: "#ffffff" }}>
          <div className="py-4 text-sm font-semibold text-[#1a1a1a]">{t("tarifs.cmpFeature")}</div>
          {plans.map((p, i) => (
            <div key={i} className={`py-4 text-center text-sm sm:text-base font-semibold ${i === 1 ? "text-[#1a1a1a]" : "text-[#1a1a1a]"}`}>
              {p}
            </div>
          ))}
        </div>
        <div className="h-px" style={{ background: "rgba(255,255,255,0.14)" }} />

        {/* Groups */}
        {groups.map((g, gi) => (
          <div key={gi}>
            <div className="pt-7 pb-1 text-[11px] font-semibold tracking-[0.15em] uppercase text-[#8a8a8a]">{g.label}</div>
            {g.rows.map((row, ri) => (
              <div key={ri} className={`${cols} items-center border-t border-black/10 hover:bg-[#f6f7f9] transition-colors`}>
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
      <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(180deg,#f6f7f9 0%,#eef2fb 50%,#f6f7f9 100%)" }} />
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[400px] rounded-full pointer-events-none -z-10"
        style={{ background: "rgba(99,102,241,0.10)", filter: "blur(90px)" }} />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[350px] rounded-full pointer-events-none -z-10"
        style={{ background: "rgba(56,189,248,0.07)", filter: "blur(90px)" }} />

      <div className="px-6 pb-36">
        <div className="max-w-5xl mx-auto pt-20">
          <div className="grid md:grid-cols-[2fr_3fr] gap-16">
            <div className="md:sticky md:top-28 self-start">
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#4f7bff] mb-3">FAQ</p>
              <h2 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a] tracking-tight leading-[1.1]">{t("tarifs.faqTitle")}</h2>
              <p className="text-[#605f5f] text-sm mt-4 leading-relaxed">
                {t("tarifs.faqSubtitle")}
              </p>
            </div>
            <div className="divide-y divide-white/[0.08]">
              {pricingFaqs.map((faq, i) => (
                <div key={i}>
                  <button
                    onClick={() => setOpen(open === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 py-5 text-left text-sm font-medium text-[#1a1a1a] hover:text-[#1a1a1a] transition"
                  >
                    <span>{faq.q}</span>
                    <span
                      className="shrink-0 h-6 w-6 rounded-full border border-black/10 flex items-center justify-center text-[#605f5f] transition-transform"
                      style={{ transform: open === i ? "rotate(45deg)" : "rotate(0deg)" }}
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </button>
                  {open === i && (
                    <div className="pb-5 text-sm text-[#605f5f] leading-relaxed">{faq.a}</div>
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
    <div className="lunera min-h-screen bg-white text-[#1a1a1a]">
      <SmoothScroll />
      <NavPill />
      {/* ── HERO ── */}
      <section className="flex flex-col items-center text-center px-6 pt-36 pb-16 sm:pt-44">
        <h1 className="text-3xl sm:text-5xl md:text-[3.5rem] font-bold tracking-tight text-[#1a1a1a] mb-4 leading-[1.08]">
          {t("tarifs.title")}
        </h1>
        <p className="text-[#605f5f] text-sm sm:text-lg max-w-lg mb-3">
          {t("tarifs.subtitle")}
        </p>
        <p className="text-sm text-[#8a8a8a] mb-2">
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
          <div className="inline-flex items-center gap-2.5 rounded-full border border-black/10 bg-[#f6f7f9] px-4 py-2 text-sm">
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
              style={{ background: "linear-gradient(90deg,#4f7bff,#7c5cff)" }}
            >
              {t("tarifs.tiktokBadgeNew")}
            </span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" className="shrink-0 text-[#1a1a1a]">
              <path d="M16.6 3c.27 2.07 1.43 3.3 3.4 3.43v2.32c-1.14.11-2.14-.26-3.3-.96v6.13c0 3.12-2.27 5.55-5.3 5.55-2.93 0-5.0-2.26-5.0-4.92 0-2.94 2.35-4.92 5.49-4.62v2.55c-.46-.1-.95-.16-1.43-.08-1.15.18-1.9.96-1.82 2.2.08 1.15.95 1.94 2.11 1.94.9 0 1.65-.58 1.87-1.45.06-.27.08-.62.08-.94V3h3.43z" />
            </svg>
            <span className="font-medium text-[#1a1a1a]">{t("tarifs.tiktokBadge")}</span>
          </div>
        </div>
      </section>

      {/* ── PLANS COMPARISON ── */}
      <PlansComparison />

      {/* ── FAQ ── */}
      <PricingFAQ />

      {/* ── FOOTER ── */}
      <Footer />
    </div>
  );
}

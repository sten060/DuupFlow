"use client";

import Link from "@/components/LocaleLink";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { NavPill, Footer, SmoothScroll } from "@/components/landing/shell";

const G = "bg-gradient-to-r from-[#4f7bff] to-[#7c5cff] bg-clip-text text-transparent";

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

/* ─── Avis clients — bande façon Tella : phrase + avatar, marquee infini ─── */
const TESTIMONIAL_META = [
  { key: "tarifs.testimonial1", avatar: "/testimonials/_ (1).jpeg" },
  { key: "tarifs.testimonial2", avatar: "/testimonials/_ (2).jpeg" },
  { key: "tarifs.testimonial3", avatar: "/testimonials/_ (3).jpeg" },
  { key: "tarifs.testimonial4", avatar: "/testimonials/_ (4).jpeg" },
  { key: "tarifs.testimonial5", avatar: "/testimonials/_ (5).jpeg" },
  { key: "tarifs.testimonial6", avatar: "/testimonials/_ (6).jpeg" },
  { key: "tarifs.testimonial7", avatar: "/testimonials/_ (7).jpeg" },
  { key: "tarifs.testimonial8", avatar: "/testimonials/_ (8).jpeg" },
  { key: "tarifs.testimonial9", avatar: "/testimonials/_.jpeg" },
  { key: "tarifs.testimonial10", avatar: "/testimonials/Ig sascha07__.jpeg" },
  { key: "tarifs.testimonial11", avatar: "/testimonials/OFM = @melvin_ofm.jpeg" },
  { key: "tarifs.testimonial12", avatar: "/testimonials/hunter davenport _ the play _ briar u.jpeg" },
];

function TestimonialsMarquee() {
  const { t } = useTranslation();
  return (
    <div className="relative mt-16 -mx-6 overflow-hidden">
      <style>{`
        @keyframes testimonials-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .testimonials-track { animation: testimonials-marquee 90s linear infinite; }
        .testimonials-track:hover { animation-play-state: paused; }
      `}</style>

      {/* Voiles de fondu sur les bords */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 sm:w-40 z-10"
        style={{ background: "linear-gradient(90deg, #ffffff 0%, rgba(255,255,255,0) 100%)" }} />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 sm:w-40 z-10"
        style={{ background: "linear-gradient(270deg, #ffffff 0%, rgba(255,255,255,0) 100%)" }} />

      <div className="testimonials-track flex items-center gap-14 sm:gap-20" style={{ width: "max-content" }}>
        {/* Rendu deux fois pour une boucle sans couture */}
        {[...TESTIMONIAL_META, ...TESTIMONIAL_META].map((m, i) => (
          <div key={i} className="flex items-center gap-3.5 shrink-0">
            <img src={m.avatar} alt="" className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover shrink-0" />
            <p className="text-base sm:text-xl text-[#1a1a1a] whitespace-nowrap">
              {t(m.key)}
            </p>
          </div>
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

/* Accès à l'éditeur IA (propulsé par Claude) — logo Claude au lieu du check */
function AiEditorFeature() {
  const { t } = useTranslation();
  return (
    <li className="flex items-start gap-3 text-sm font-medium text-[#1a1a1a]">
      <img src="/claude-color.svg" alt="Claude" className="h-5 w-5 object-contain shrink-0 mt-0.5" />
      {t("tarifs.featAiEditor")}
    </li>
  );
}

/* Features available on every plan — Google Drive import (with logo) + file compressor + scraper */
function UniversalFeatures({ color }: { color: string }) {
  const { t } = useTranslation();
  return (
    <>
      <li className="flex items-start gap-3 text-sm text-[#1a1a1a]">
        <img src="/app/icons8-google-drive-96.png" alt="Google Drive" className="h-5 w-5 object-contain shrink-0 mt-0.5" />
        {t("tarifs.featGoogleDrive")}
      </li>
      <li className="flex items-start gap-3 text-sm text-[#1a1a1a]">
        <CheckIcon color={color} />
        {t("tarifs.featCompressor")}
      </li>
      <li className="flex items-start gap-3 text-sm text-[#1a1a1a]">
        <CheckIcon color={color} />
        {t("tarifs.featScraper")}
      </li>
    </>
  );
}

/* Plan icons — sit in a rounded-square badge at the top of each card (screen-2 layout) */
function PlanIcon({ plan, color }: { plan: "starter" | "solo" | "pro"; color: string }) {
  return (
    <div
      className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center shrink-0"
      style={{ background: `${color}1F`, border: `1px solid ${color}3D` }}
    >
      <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {plan === "starter" ? (
          /* Single ring — a single account, getting started */
          <circle cx="12" cy="12" r="6" />
        ) : plan === "solo" ? (
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
  id: "starter" | "solo" | "pro";
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

/* ─── Toggle Mensuel / Annuel ───
   L'"annuel" est purement visuel pour l'instant : Stripe n'a pas encore de
   prix annuels, le checkout facture toujours au mois. Le paramètre
   &billing=yearly est déjà posé sur les CTA pour le branchement à venir.
   Réduction affichée : −29% (Starter 13€ · Solo 28€ · Pro 70€ — prix ronds). */
const MONTHLY_NUM: Record<string, number> = { starter: 19, solo: 39, pro: 99 };
const YEARLY_NUM: Record<string, number> = { starter: 13, solo: 28, pro: 70 };

/* Compteur animé : quand la cible change (switch mensuel ↔ annuel), la valeur
   file vers la nouvelle en ~0,5s avec une décélération douce. */
function useCountUp(target: number, duration = 500) {
  const [value, setValue] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (from === target) return;
    let raf: number;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Onglet masqué : rAF est suspendu par le navigateur — on garantit quand
    // même l'atterrissage sur la valeur finale.
    const settle = setTimeout(() => setValue(target), duration + 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
    };
  }, [target, duration]);
  return value;
}

function AnimatedPrice({ amount, locale }: { amount: number; locale: string }) {
  const v = useCountUp(amount);
  // Une décimale seulement si le prix cible en a une (13,5€) — sinon entier.
  const str = Number.isInteger(amount)
    ? String(Math.round(v))
    : v.toFixed(1).replace(".", locale === "en" ? "." : ",");
  return <>{str}€</>;
}

function BillingToggle({ yearly, onChange }: { yearly: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const base = "rounded-full px-5 py-2 text-sm font-semibold transition";
  return (
    <div className="-mt-6 mb-9 flex justify-center">
      <div className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-[#f6f7f9] p-1">
        <button type="button" onClick={() => onChange(false)}
          className={`${base} ${yearly ? "text-[#605f5f] hover:text-[#1a1a1a]" : "bg-white text-[#1a1a1a] shadow-[0_2px_8px_rgba(20,40,90,0.10)]"}`}>
          {t("tarifs.billingMonthly")}
        </button>
        <button type="button" onClick={() => onChange(true)}
          className={`${base} inline-flex items-center gap-2 ${yearly ? "bg-white text-[#1a1a1a] shadow-[0_2px_8px_rgba(20,40,90,0.10)]" : "text-[#605f5f] hover:text-[#1a1a1a]"}`}>
          {t("tarifs.billingYearly")}
          <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
            style={{ background: "linear-gradient(90deg,#4f7bff,#7c5cff)" }}>
            {t("tarifs.yearlyBadge")}
          </span>
        </button>
      </div>
    </div>
  );
}

function PricingCards({ yearly }: { yearly: boolean }) {
  const { t, locale } = useTranslation();

  const starterFeatures = [
    t("tarifs.starterFeature1"),
    t("tarifs.starterFeature2"),
    t("tarifs.starterFeature3"),
    t("tarifs.soloFeature8"),
    t("tarifs.featExport1080"),
  ];

  const soloFeatures = [
    t("tarifs.soloFeature1"),
    t("tarifs.soloFeature2"),
    t("tarifs.soloFeature3"),
    t("tarifs.soloFeature4"),
    t("tarifs.soloFeature8"),
    t("tarifs.featExport4k"),
  ];

  const proFeatures = [
    t("tarifs.proFeature1"),
    t("tarifs.proFeature2"),
    t("tarifs.proFeature3"),
    t("tarifs.proFeature4"),
    t("tarifs.proFeature6"),
    t("tarifs.proFeature8"),
    t("tarifs.proFeature9"),
    t("tarifs.featExport4k"),
  ];

  const plans: Plan[] = [
    {
      id: "starter",
      name: t("tarifs.planStarter"),
      desc: t("tarifs.starterDesc"),
      price: "19€",
      color: "#C4B5FD",
      btnShadow: "0 16px 30px -8px rgba(139,92,246,0.45), 0 6px 12px -4px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.28)",
      cardBorder: "1px solid rgba(0,0,0,0.08)",
      btnBg: "linear-gradient(135deg,#9F7AEA,#7C3AED)",
      cta: t("tarifs.commencer"),
      href: "/register?plan=starter",
      demoHref: "/demo-request?plan=starter",
      popular: false,
      features: starterFeatures,
    },
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
      popular: true,
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
      popular: false,
      features: proFeatures,
    },
  ];

  return (
    <div id="plans" className="scroll-mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
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
            <div className="mt-4 mb-6">
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl sm:text-5xl font-bold text-[#1a1a1a]">
                  <AnimatedPrice amount={yearly ? YEARLY_NUM[p.id] : MONTHLY_NUM[p.id]} locale={locale} />
                </span>
                <span className="text-[#8a8a8a] text-sm">{t("tarifs.perMonth")}</span>
                {yearly && <span className="text-[#b0b0b0] text-lg line-through">{p.price}</span>}
              </div>
              {yearly && (
                <p className="mt-1.5 text-xs text-[#8a8a8a]">{t("tarifs.yearlyFreeMonth")}</p>
              )}
            </div>

            {/* Primary CTA — raised/embossed relief, sits above the feature list */}
            <Link
              href={yearly ? `${p.href}&billing=yearly` : p.href}
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
              <AiEditorFeature />
              {p.features.map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-[#1a1a1a]">
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

function PlansComparison({ yearly }: { yearly: boolean }) {
  const { t, locale } = useTranslation();
  const U = t("tarifs.cmpUnlimited");

  const groups: { label: string; rows: { label: string; values: (string | boolean)[]; logo?: string }[] }[] = [
    {
      label: t("tarifs.cmpGroupDuplication"),
      rows: [
        { label: t("tarifs.cmpRowDupImages"), values: ["150", "400", U] },
        { label: t("tarifs.cmpRowDupVideos"), values: ["100", "300", U] },
        { label: t("tarifs.cmpRowExportZip"), values: [true, true, true] },
      ],
    },
    {
      label: t("tarifs.cmpGroupUnicite"),
      rows: [
        { label: t("tarifs.cmpRowMetadata"), values: [true, true, true] },
        { label: t("tarifs.cmpRowSignatureIA"), values: ["80", "200", U] },
        { label: t("tarifs.cmpRowVariationIA"), values: [true, true, true] },
      ],
    },
    {
      label: t("tarifs.cmpGroupFormats"),
      rows: [
        { label: t("tarifs.featAiEditor"), logo: "/claude-color.svg", values: [true, true, true] },
        { label: t("tarifs.cmpRowExportRes"), values: ["1080p", "4K", "4K"] },
        { label: t("tarifs.cmpRowFormats"), values: [true, true, true] },
        { label: t("tarifs.cmpRowBatch"), values: [true, true, true] },
        { label: t("tarifs.cmpRowPresets"), values: [false, false, true] },
        { label: t("tarifs.featGoogleDrive"), logo: "/app/icons8-google-drive-96.png", values: [true, true, true] },
        { label: t("tarifs.featCompressor"), values: [true, true, true] },
        { label: t("tarifs.cmpRowScraper"), values: [t("tarifs.cmpScraperUsage"), t("tarifs.cmpScraperUsage"), t("tarifs.cmpScraperUsage")] },
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
        { label: t("tarifs.cmpRowSupportTelegram"), values: [true, true, true] },
        { label: t("tarifs.cmpRowSupportPriority"), values: [false, false, true] },
      ],
    },
  ];

  /* Prix et CTA identiques aux cartes pricing du haut de page */
  const plans = [
    { id: "starter", name: t("tarifs.cmpColStarter"), href: "/register?plan=starter", btnBg: "linear-gradient(135deg,#9F7AEA,#7C3AED)" },
    { id: "solo",    name: t("tarifs.cmpColSolo"),    href: "/register?plan=solo",    btnBg: "linear-gradient(135deg,#7C3AED,#6366F1)" },
    { id: "pro",     name: t("tarifs.cmpColPro"),     href: "/register?plan=pro",     btnBg: "linear-gradient(135deg,#4f7bff,#7c5cff)" },
  ].map((p) => (yearly ? { ...p, href: `${p.href}&billing=yearly` } : p));
  const cols = "grid grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,1fr))]";

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

        {/* Bloc sticky façon Tella : nom + prix + CTA par plan, qui suit le scroll.
            top-0 + grand padding haut : le fond blanc monte jusqu'en haut du
            viewport et masque les lignes du tableau qui passent derrière la
            nav flottante (sinon on les voit défiler autour de la pilule). */}
        <div className={`${cols} sticky top-0 z-30 items-end pt-24 sm:pt-28 pb-2`} style={{ background: "#ffffff" }}>
          <div className="py-4 text-sm font-semibold text-[#1a1a1a]">{t("tarifs.cmpFeature")}</div>
          {plans.map((p, i) => (
            <div key={i} className="py-4 flex flex-col items-center gap-2 text-center">
              <span className="text-base sm:text-xl font-bold text-[#1a1a1a]">{p.name}</span>
              <span className="text-xs sm:text-sm text-[#8a8a8a]">
                <span className="font-semibold text-[#1a1a1a]">
                  <AnimatedPrice amount={yearly ? YEARLY_NUM[p.id] : MONTHLY_NUM[p.id]} locale={locale} />
                </span>{" "}
                {t("tarifs.perMonth")}
              </span>
              <Link
                href={p.href}
                className="mt-1 hidden sm:inline-flex items-center justify-center rounded-xl px-5 py-2 text-xs sm:text-sm font-semibold text-white transition hover:brightness-105"
                style={{ background: p.btnBg }}
              >
                {t("tarifs.commencer")}
              </Link>
            </div>
          ))}
        </div>
        <div className="h-px" style={{ background: "rgba(0,0,0,0.10)" }} />

        {/* Groups */}
        {groups.map((g, gi) => (
          <div key={gi}>
            <div className="pt-7 pb-1 text-[11px] font-semibold tracking-[0.15em] uppercase text-[#8a8a8a]">{g.label}</div>
            {g.rows.map((row, ri) => (
              <div key={ri} className={`${cols} items-center border-t border-black/10 hover:bg-[#f6f7f9] transition-colors`}>
                <div className="py-4 pr-3 text-xs sm:text-sm text-[#605f5f] leading-snug flex items-center gap-2">
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
  // Annuel par défaut : c'est l'offre qu'on veut mettre en avant.
  const [yearly, setYearly] = useState(true);
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

      {/* ── PRICING CARDS ── */}
      <section className="px-6 pb-24">
        <BillingToggle yearly={yearly} onChange={setYearly} />
        <PricingCards yearly={yearly} />

        {/* Pastille YouTube — lien vers la vidéo de présentation, flotte doucement */}
        <div className="mt-8 flex justify-center">
          <style>{`
            @keyframes yt-badge-float {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-6px); }
            }
          `}</style>
          <a
            href="https://www.youtube.com/watch?v=FX29sadV_2g"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 rounded-full border border-black/10 bg-[#f6f7f9] px-4 py-2 text-sm transition hover:bg-[#eef0f4]"
            style={{ animation: "yt-badge-float 3.2s ease-in-out infinite" }}
          >
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
              style={{ background: "linear-gradient(90deg,#4f7bff,#7c5cff)" }}
            >
              {t("tarifs.ytBadgeNew")}
            </span>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="shrink-0" fill="#FF0000">
              <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000" />
              <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#ffffff" />
            </svg>
            <span className="font-medium text-[#1a1a1a]">{t("tarifs.ytBadge")}</span>
          </a>
        </div>

        {/* ── AVIS CLIENTS ── */}
        <TestimonialsMarquee />
      </section>

      {/* ── PLANS COMPARISON ── */}
      <PlansComparison yearly={yearly} />

      {/* ── FAQ ── */}
      <PricingFAQ />

      {/* ── FOOTER ── */}
      <Footer />
    </div>
  );
}

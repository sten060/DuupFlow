"use client";

// Page partenaire DuupFlow × Dropp — design clair "Lunera", même chrome que /partners.
// Le système en 3 étapes : trafic (DuupFlow) → audience (Telegram) → paiement (Dropp).

import Link from "@/components/LocaleLink";
import { useTranslation } from "@/lib/i18n/context";
import { NavPill, Footer, SmoothScroll, Label, Brand, CTA_GRAD } from "@/components/landing/shell";

/* ID de la vidéo YouTube de présentation (ex. "dQw4w9WgXcQ").
   Vide → le bloc vidéo n'est pas affiché. */
const DROPP_YOUTUBE_ID = "";

const DROPP_URL = "https://dropp.fans";

const STEPS = [
  {
    who: "DuupFlow",
    title: { en: "High-volume traffic", fr: "Du trafic en volume" },
    desc: {
      en: "1 video of your model → dozens of unique reels, one per Instagram account. Zero flags.",
      fr: "1 vidéo de ta modèle → des dizaines de reels uniques, un par compte Instagram. Zéro flag.",
    },
  },
  {
    who: "Telegram",
    title: { en: "An audience you own", fr: "Une audience à toi" },
    desc: {
      en: "Every reel points to your Telegram channel. If an account gets banned, you lose no one.",
      fr: "Chaque reel renvoie vers ton canal Telegram. Si un compte saute, tu ne perds personne.",
    },
  },
  {
    who: "Dropp",
    title: { en: "Get paid without friction", fr: "Encaisse sans friction" },
    desc: {
      en: "Fans pay directly inside Telegram. Fewer steps, more sales.",
      fr: "Le fan paie directement dans Telegram. Moins d'étapes, plus de ventes.",
    },
    featured: true,
  },
] as const;

export default function DroppPartnerPage() {
  const { locale } = useTranslation();
  const l = locale === "en" ? "en" : "fr";
  const en = l === "en";

  return (
    <div className="lunera min-h-screen bg-white text-[#1a1a1a]">
      <SmoothScroll />
      <NavPill />

      <section className="relative overflow-hidden px-6 pb-24 pt-36 sm:pt-44">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[520px]"
          style={{ background: "radial-gradient(60% 100% at 50% 0%, rgba(99,102,241,0.10), transparent 70%)" }} />

        <div className="relative mx-auto max-w-5xl">
          <Link href="/partners" className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-[#8a8a8a] transition hover:text-[#1a1a1a]">
            ← {en ? "Partners" : "Partenaires"}
          </Link>

          {/* Hero — logos côte à côte */}
          <div className="text-center">
            <Label>{en ? "Official partner" : "Partenaire officiel"}</Label>
            <div className="mt-8 flex items-center justify-center gap-4 sm:gap-6">
              <span className="flex items-center gap-2.5 text-[24px] font-semibold tracking-[-0.02em] sm:text-[28px]">
                <img src="/logo-mark.png" alt="" className="h-9 w-9 object-contain sm:h-10 sm:w-10" />
                <Brand />
              </span>
              <span aria-hidden className="text-[22px] font-light text-[#9aa2b2]">×</span>
              <img src="/partner-logos/dropp.svg" alt="Dropp" className="h-9 w-auto object-contain sm:h-10" />
            </div>
            <h1 className="mx-auto mt-8 max-w-3xl font-semibold tracking-[-0.03em] text-[#1a1a1a]"
              style={{ fontSize: "clamp(32px, 4.6vw, 54px)", lineHeight: 1.06 }}>
              {en
                ? "The complete system to monetize your model, from reel to payment."
                : "Le système complet pour monétiser ta modèle, du reel au paiement."}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-[#3a3f4b] sm:text-[18px]">
              {en
                ? "High-volume Instagram traffic, an audience you own on Telegram, sales without friction."
                : "Trafic Instagram en volume, audience sur Telegram, ventes encaissées sans friction."}
            </p>
          </div>

          {/* 3 étapes */}
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => {
              const featured = "featured" in s && s.featured;
              return (
                <div key={s.who}
                  className={`flex flex-col rounded-[28px] p-7 ${featured
                    ? "bg-[#1a1a1a] text-white shadow-[0_20px_50px_rgba(20,20,60,0.28)]"
                    : "bg-white ring-1 ring-black/[0.06] shadow-[0_14px_40px_rgba(20,40,90,0.06)]"}`}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white shadow-[0_6px_14px_rgba(90,90,240,0.30)]" style={{ background: CTA_GRAD }}>
                      {i + 1}
                    </span>
                    <span className={`text-[12.5px] font-semibold uppercase tracking-[0.1em] ${featured ? "text-white/60" : "text-[#8a8a8a]"}`}>{s.who}</span>
                  </div>
                  <h2 className={`mt-5 text-[20px] font-semibold tracking-[-0.01em] ${featured ? "text-white" : "text-[#1a1a1a]"}`}>{s.title[l]}</h2>
                  <p className={`mt-2 text-[15px] leading-relaxed ${featured ? "text-white/75" : "text-[#605f5f]"}`}>{s.desc[l]}</p>
                </div>
              );
            })}
          </div>

          {/* Vidéo de présentation — seulement si un ID est renseigné */}
          {DROPP_YOUTUBE_ID && (
            <div className="mt-14 overflow-hidden rounded-[28px] ring-1 ring-black/[0.06] shadow-[0_14px_40px_rgba(20,40,90,0.08)]">
              <div className="relative aspect-video w-full">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${DROPP_YOUTUBE_ID}`}
                  title="DuupFlow × Dropp"
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="mt-14 text-center">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className="rounded-full px-7 py-3 text-sm font-semibold text-white shadow-[0_12px_34px_rgba(90,90,240,0.38)] transition hover:opacity-90" style={{ background: CTA_GRAD }}>
                {en ? "Try DuupFlow →" : "Essayer DuupFlow →"}
              </Link>
              <a href={DROPP_URL} target="_blank" rel="noopener" className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-[#1a1a1a] ring-1 ring-black/10 transition hover:bg-[#f6f7f9]">
                {en ? "Discover Dropp →" : "Découvrir Dropp →"}
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// src/components/marketing/SubmagicAlternativePage.tsx
//
// Permanent SEO landing page: "Submagic Alternative". English only (no hreflang)
// — the /fr route redirects to /en (see the route wrapper). Lives at a top-level
// route (/en/submagic-alternative), NOT under /blog/. Chrome (NavPill + Footer +
// light "lunera" theme) comes from the sibling layout.tsx.
//
// Structured for machine extraction: single H1, strict H2/H3 hierarchy, a
// comparison table, an FAQ authored as real search queries whose answers stay in
// the HTML even when the <details> accordion is collapsed, and
// SoftwareApplication + FAQPage + BreadcrumbList JSON-LD.
//
// DuupFlow prices are the source of truth (Starter 19€ / Solo 39€ / Pro 99€,
// see src/lib/plans.ts + pricing/page.tsx). Competitor pricing is quoted in the
// currency they bill in and dated (UPDATED_AT) — re-check quarterly.

import Link from "@/components/LocaleLink";

export const SLUG = "submagic-alternative";
export const CANONICAL = `/en/${SLUG}`;

export const META = {
  title: "Submagic Alternative: Full AI Editing, Not Just Captions | DuupFlow",
  description:
    "Submagic captions and trims one video at a time, and every re-export costs a credit. DuupFlow edits your raw footage and multiplies it into ten versions.",
};

// Competitor pricing changes often — bump this when the comparison/FAQ prices are
// re-verified (shown as "last checked" under the comparison table).
const UPDATED_AT = "2026-08-10";

// Pricing source of truth: src/lib/plans.ts (quotas) + pricing/page.tsx (display).
const PRICE_STARTER = "19€";
const PRICE_SOLO = "39€";
const PRICE_PRO = "99€";

/* ─────────────────────────── Content ─────────────────────────── */

const HERO = {
  kicker: "Submagic alternative",
  h1: "The Submagic alternative for creators who need volume, not just captions",
  sub: "Submagic makes one video look better. DuupFlow builds the edit from your raw footage and turns it into ten publish-ready versions. Same effort, ten times the output.",
  cta: "Edit my first video",
  subCta: `From ${PRICE_STARTER}/month`,
};

const WHY = {
  h2: "Why creators look for a Submagic alternative",
  lead: "Submagic is a strong product. These are the four walls people hit.",
  reasons: [
    {
      h: "Every export burns a credit — including re-exports",
      p: "Plans are capped by video count, not minutes. Starter gives you 15 videos, Pro 40, Business 100. Re-export the same clip with a different caption style or a different aspect ratio and it counts again. If you iterate, you run out well before the end of the month.",
    },
    {
      h: "It's caption-first, not edit-first",
      p: "Submagic enhances footage you've already assembled: captions, emoji, silence removal, B-roll. It doesn't build the edit for you from a folder of raw clips.",
    },
    {
      h: "The B-roll is stock",
      p: "You get Storyblocks footage. That works for generic talking-head content. It doesn't work when you need your dashboard screenshot, your product shot, your interface capture to land on a specific word.",
    },
    {
      h: "The good stuff sits behind tiers and add-ons",
      p: "Eye contact correction is Pro-only. Magic Clips is a paid add-on on top of your plan, not part of any base tier. Several creators find out after subscribing.",
    },
  ],
};

const DIFFERENT = {
  h2: "What DuupFlow does differently",
  blocks: [
    {
      h: "It builds the edit, not just the layer on top",
      paras: [
        "You upload raw material — face cam, screen recordings, screenshots, product visuals, voiceover — and describe the edit you want. The AI assembles it: cuts, pacing, animated captions, zooms, split-screen, audio ducking.",
        "You're not polishing a finished timeline. You're skipping the timeline.",
      ],
    },
    {
      h: "Your visuals, on the exact word",
      paras: [
        "The single biggest gap. When you say \"dashboard\", your actual dashboard screenshot appears — not a stock clip of someone typing. For anyone selling a product, a course or a service, this is the difference between a video that demonstrates and a video that decorates.",
      ],
    },
    {
      h: "One edit, ten versions",
      paras: [
        "A creative that works should run more than once. In Submagic, each new version is another video against your cap. In DuupFlow, you keep the structure, swap the hook or the opening shot, and export ten technically distinct versions — ready to spread across accounts and platforms.",
        "DuupFlow is built end to end for this: volume, fast, without the output degrading.",
      ],
    },
  ],
};

const BETTER = {
  h2: "What Submagic does better than DuupFlow",
  lead: "Straight answer, otherwise this page is worthless.",
  items: [
    "Caption craft. Submagic's viral caption templates are excellent, and support for 48+ languages with accent detection is beyond what most tools ship.",
    "Eye contact correction. For pure talking-head content, it's a real differentiator and DuupFlow has no equivalent.",
    "A free tier. Three videos a month with a watermark, no card required. You can try it at zero cost.",
    "Maturity. Thousands of reviews, a large user base, a product that's been hardened over years.",
  ],
  kicker:
    "If your workflow is \"I already edit my videos and I just want better captions and B-roll on top\", Submagic is the right tool. If your workflow is \"I have raw footage and no time, and I need to publish a lot\", that's DuupFlow.",
};

const COMPARE = {
  h2: "Comparison",
  cols: ["", "Submagic", "DuupFlow"],
  rows: [
    { label: "Core job", submagic: "Captions, B-roll, trimming", duupflow: "Full edit from raw footage" },
    { label: "Builds the edit for you", submagic: "No", duupflow: "Yes" },
    {
      label: "Source material",
      submagic: "Your finished video",
      duupflow: "Your raw clips, screen recordings, visuals",
    },
    { label: "Inserts", submagic: "Stock B-roll", duupflow: "Your own visuals, on the word" },
    {
      label: "Variants of one video",
      submagic: "Each export counts against your cap",
      duupflow: "Automatic",
    },
    { label: "Free tier", submagic: "3 videos, watermark", duupflow: "No" },
    { label: "Price", submagic: "$19 – $69/month", duupflow: "19 – 99 €/month" },
  ],
};

const WHO = {
  h2: "Who it's for",
  paras: [
    "For people producing short-form content for social, who want output worthy of a professional editor, and who don't have the time to spend their days on a timeline.",
    "It's the trade-off nobody has offered you until now. Manual editors give you quality in exchange for your time. Fast tools give you time in exchange for quality. DuupFlow is built to hold both: the pace and the finish.",
  ],
};

const PRICING = {
  h2: "Pricing",
  plans: [
    { name: "Starter", price: `${PRICE_STARTER}/month`, for: "Testing it out, a few videos a month" },
    { name: "Solo", price: `${PRICE_SOLO}/month`, for: "Posting consistently", highlight: true },
    { name: "Pro", price: `${PRICE_PRO}/month`, for: "Volume and multiple accounts" },
  ],
  note: "No watermark on any plan. No add-on to unlock the core features.",
  cta: "See full pricing",
};

const FAQ = {
  h2: "FAQ",
  items: [
    {
      q: "How much does Submagic cost?",
      a: "Starter is $19/month ($12 billed annually) for 15 videos, Pro is $39/month ($23 annually) for 40 videos, Business + API is $69/month ($41 annually) for 100 videos. There's also a free plan limited to 3 watermarked videos per month.",
    },
    {
      q: "Is Submagic free?",
      a: "There's a free tier: 3 videos a month, with a watermark and a 90-second cap, no credit card required. Enough to evaluate it, not enough to publish with.",
    },
    {
      q: "Does Submagic edit the whole video for me?",
      a: "No. Submagic works on footage you've already put together — it adds captions, emoji, B-roll and removes silences. It doesn't assemble an edit from raw clips.",
    },
    {
      q: "What is Magic Clips and is it included?",
      a: "It's Submagic's clipping feature, sold as a paid add-on on top of your subscription. It isn't included in any base plan.",
    },
    {
      q: "Can Submagic create multiple versions of the same video?",
      a: "Not as a feature. You can re-export with different settings, but each export counts against your monthly video allowance. Producing variants at volume gets expensive quickly.",
    },
    {
      q: "What's the best Submagic alternative?",
      a: "It depends what's blocking you. For better captions at a lower price, look at Zubtitle or Veed. For clipping long videos, OpusClip. For building the edit from raw footage and producing volume, DuupFlow.",
    },
    {
      q: "Does DuupFlow do captions as well as Submagic?",
      a: "Captions are one part of what DuupFlow does — animated, word by word, fully styleable. If captions are the only thing you need, Submagic's library is deeper. If you need the whole edit, the comparison isn't on captions.",
    },
    {
      q: "Can I use my own screenshots and product visuals?",
      a: "Yes, and that's the point. You upload them and they're placed on the word you specify, rather than pulled from a stock library.",
    },
  ],
};

const FINAL = {
  h2: "One video isn't a strategy.",
  p: "Better captions on a single post won't move your numbers. Publishing consistently, at volume, with a finish that holds up — that will.",
  cta: "Edit my first video",
};

const SEE_ALSO = {
  label: "See also",
  links: [
    { href: "/capcut-alternative", text: "CapCut alternative" },
    { href: "/", text: "Repost across multiple accounts" },
    { href: "/pricing", text: "Pricing" },
  ],
};

/* ─────────────────────────── UI helpers ─────────────────────────── */

const CTA_GRAD = "linear-gradient(135deg,#4f7bff 0%,#7c5cff 100%)";

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-black/[0.04] px-3.5 py-1.5 text-[13px] font-medium text-[#1a1a1a] ring-1 ring-black/5">
      {children}
    </span>
  );
}

function PrimaryCta({ href, children, big }: { href: string; children: React.ReactNode; big?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full font-semibold text-white shadow-[0_14px_34px_rgba(90,90,240,0.35)] transition hover:opacity-90 ${
        big ? "px-8 py-4 text-base" : "px-6 py-3 text-[15px]"
      }`}
      style={{ background: CTA_GRAD }}
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}

function SectionHead({ title }: { title: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight text-[#1a1a1a]">{title}</h2>
    </div>
  );
}

/* ─────────────────────────── Page ─────────────────────────── */

export default function SubmagicAlternativePage() {
  const base = "https://www.duupflow.com";

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "DuupFlow",
    applicationCategory: "MultimediaApplication",
    applicationSubCategory: "AI video editor",
    operatingSystem: "Web",
    url: `${base}${CANONICAL}`,
    inLanguage: "en-US",
    description: META.description,
    featureList: [
      "Edit from raw footage",
      "Automatic cutting",
      "Word-by-word animated captions",
      "Word-synced inserts (your own visuals)",
      "Multiple variants of the same video",
    ],
    offers: [
      { "@type": "Offer", name: "Starter", price: "19", priceCurrency: "EUR" },
      { "@type": "Offer", name: "Solo", price: "39", priceCurrency: "EUR" },
      { "@type": "Offer", name: "Pro", price: "99", priceCurrency: "EUR" },
    ],
    publisher: {
      "@type": "Organization",
      name: "DuupFlow",
      logo: { "@type": "ImageObject", url: `${base}/logo-mark.png` },
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "DuupFlow", item: `${base}/en` },
      { "@type": "ListItem", position: 2, name: "Submagic alternative", item: `${base}${CANONICAL}` },
    ],
  };

  const checkedLabel = new Date(UPDATED_AT).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="text-[#1a1a1a]">
        {/* ── Hero ── */}
        <section className="px-6 pt-6 pb-16 md:pb-24">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 flex justify-center">
              <Kicker>{HERO.kicker}</Kicker>
            </div>
            <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              {HERO.h1}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#3f4453] md:text-xl">{HERO.sub}</p>
            <div className="mt-9 flex flex-col items-center gap-3">
              <PrimaryCta href="/register" big>
                {HERO.cta}
              </PrimaryCta>
              <span className="text-sm text-[#8a8a8a]">{HERO.subCta}</span>
            </div>
          </div>
        </section>

        {/* ── Why ── */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHead title={WHY.h2} />
            <p className="mb-10 max-w-3xl text-lg leading-relaxed text-[#3f4453]">{WHY.lead}</p>
            <div className="grid gap-5 md:grid-cols-2">
              {WHY.reasons.map((r, i) => (
                <div key={i} className="rounded-2xl bg-[#f5f6fb] p-6 ring-1 ring-black/[0.05]">
                  <h3 className="mb-2 text-lg font-bold text-[#1a1a1a]">{r.h}</h3>
                  <p className="text-[15px] leading-relaxed text-[#3f4453]">{r.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── What DuupFlow does differently ── */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHead title={DIFFERENT.h2} />
            <div className="space-y-6">
              {DIFFERENT.blocks.map((b, i) => (
                <div key={i} className="rounded-2xl border border-black/[0.06] p-6 md:p-8">
                  <h3 className="mb-3 text-xl font-bold text-[#1a1a1a] md:text-2xl">{b.h}</h3>
                  <div className="space-y-3 text-[15px] leading-relaxed text-[#3f4453] md:text-base">
                    {b.paras.map((p, j) => (
                      <p key={j}>{p}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── What Submagic does better ── */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHead title={BETTER.h2} />
            <p className="mb-8 max-w-3xl text-lg leading-relaxed text-[#3f4453]">{BETTER.lead}</p>
            <ul className="mb-8 space-y-3">
              {BETTER.items.map((it, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-[#3f4453]">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4f7bff]" />
                  {it}
                </li>
              ))}
            </ul>
            <p className="max-w-3xl rounded-2xl bg-[#f5f6fb] p-6 text-[15px] font-medium leading-relaxed text-[#1a1a1a] ring-1 ring-black/[0.05]">
              {BETTER.kicker}
            </p>
          </div>
        </section>

        {/* ── Comparison table ── */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHead title={COMPARE.h2} />
            <div className="overflow-x-auto rounded-2xl ring-1 ring-black/[0.08]">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[#f5f6fb]">
                    {COMPARE.cols.map((h, j) => (
                      <th
                        key={j}
                        className={`px-4 py-3 font-bold text-[#1a1a1a] ${j === 2 ? "text-[#4f7bff]" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.rows.map((row, ri) => (
                    <tr key={ri} className="border-t border-black/[0.06] align-top">
                      <td className="px-4 py-3 font-semibold text-[#1a1a1a]">{row.label}</td>
                      <td className="px-4 py-3 text-[#3f4453]">{row.submagic}</td>
                      <td className="bg-[#4f7bff]/[0.04] px-4 py-3 font-medium text-[#1a1a1a]">{row.duupflow}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-[#8a8a8a]">
              Competitor pricing shown in the currency they bill in. Last checked: {checkedLabel}.
            </p>
          </div>
        </section>

        {/* ── Who it's for ── */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-3xl">
            <SectionHead title={WHO.h2} />
            <div className="space-y-5 text-lg leading-relaxed text-[#3f4453]">
              {WHO.paras.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHead title={PRICING.h2} />
            <div className="grid gap-5 md:grid-cols-3">
              {PRICING.plans.map((p, i) => (
                <div
                  key={i}
                  className={`rounded-3xl p-7 ${
                    p.highlight
                      ? "bg-[#0e1120] text-white ring-1 ring-black/10 shadow-[0_20px_50px_rgba(20,40,90,0.15)]"
                      : "bg-white ring-1 ring-black/[0.08]"
                  }`}
                >
                  <h3 className={`text-sm font-semibold uppercase tracking-wider ${p.highlight ? "text-white/60" : "text-[#8a8a8a]"}`}>
                    {p.name}
                  </h3>
                  <p className="mt-3 text-3xl font-extrabold tracking-tight">{p.price}</p>
                  <p className={`mt-3 text-[15px] leading-relaxed ${p.highlight ? "text-white/80" : "text-[#3f4453]"}`}>
                    {p.for}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-[15px] leading-relaxed text-[#3f4453]">{PRICING.note}</p>
            <div className="mt-6">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 text-[15px] font-semibold text-[#4f7bff] transition hover:opacity-80"
              >
                {PRICING.cta}
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ── FAQ (accordion; answers stay in the HTML when collapsed) ── */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-3xl">
            <SectionHead title={FAQ.h2} />
            <div className="divide-y divide-black/[0.08] border-y border-black/[0.08]">
              {FAQ.items.map((item, i) => (
                <details key={i} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                    <span className="text-base font-semibold text-[#1a1a1a] md:text-lg">{item.q}</span>
                    <span
                      aria-hidden
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[#3f4453] transition group-open:rotate-45"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                      </svg>
                    </span>
                  </summary>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#3f4453]">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="px-6 py-16 md:py-24">
          <div className="mx-auto max-w-3xl rounded-3xl bg-[#f5f6fb] px-7 py-14 text-center ring-1 ring-black/[0.05] md:px-12">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#1a1a1a] md:text-4xl">{FINAL.h2}</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-[#3f4453]">{FINAL.p}</p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <PrimaryCta href="/register" big>
                {FINAL.cta}
              </PrimaryCta>
              <span className="text-sm text-[#8a8a8a]">{`From ${PRICE_STARTER}/month`}</span>
            </div>

            {/* Internal links */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-black/[0.07] pt-8 text-sm">
              <span className="text-[#8a8a8a]">{SEE_ALSO.label} :</span>
              {SEE_ALSO.links.map((l, i) => (
                <Link key={i} href={l.href} className="font-medium text-[#4f7bff] transition hover:opacity-80">
                  {l.text}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

// src/components/marketing/ReeepAlternativePage.tsx
//
// Permanent SEO landing page: "Reeep Alternative". Bilingual, one shared slug
// (/reeep-alternative, /fr/reeep-alternative), each locale self-canonical and
// linked via hreflang (route wrapper). Same page type and design as
// MetaghostAlternativePage (top-level route, chrome from the sibling layout).
//
// DuupFlow prices are the source of truth (Solo 39€ / Pro 99€ / Agency 249€,
// see src/lib/plans.ts + pricing/page.tsx). Reeep facts checked on reeep.it on
// 2026-11-24 (home page + FAQ): one "Créateur" plan at €23.99/month, no free
// trial, 300 variants per billing period, up to 10 variants per batch,
// publication as Instagram trial reels after confirmation (official API, up to
// 10 posts per 24 h), stats collected, downloadable files without watermark.
// Anything not stated there is shown as "Not listed" — re-check before editing.

import Link from "@/components/LocaleLink";
import CtaCallout from "@/components/marketing/CtaCallout";

export type Lang = "fr" | "en";

export const SLUG = "reeep-alternative";
export const CANONICAL: Record<Lang, string> = { en: `/${SLUG}`, fr: `/fr/${SLUG}` };

export const META: Record<Lang, { title: string; description: string }> = {
  en: {
    title: "Reeep Alternative: DuupFlow vs Reeep for Agencies (2026)",
    description:
      "Looking for a Reeep alternative? Compare DuupFlow and Reeep: trial reels on one Instagram account vs unique copies and AI variants for every account and platform, built for agencies.",
  },
  fr: {
    title: "Alternative à Reeep : DuupFlow vs Reeep pour les agences (2026)",
    description:
      "Tu cherches une alternative à Reeep ? Compare DuupFlow et Reeep : des reels d'essai sur un compte Instagram, ou des copies uniques et des variantes IA pour chaque compte et chaque plateforme, pensées pour les agences.",
  },
};

/* ─────────────────────────── Content ─────────────────────────── */

type Copy = {
  kicker: string;
  h1: string;
  shortAnswer: string; // HTML
  cta: { title: string; text: string; button: string }[];
  compare: { h2: string; cols: [string, string, string]; rows: [string, string, string][]; note: string };
  well: { h2: string; lead: string; items: string[]; kicker: string };
  why: { h2: string; lead: string; reasons: { h: string; p: string }[] };
  pricing: { h2: string; head: [string, string, string]; rows: [string, string, string][]; note: string; noteLink: string; noteEnd: string };
  choose: { h2: string; cols: { h: string; items: string[] }[] };
  faq: { h2: string; items: { q: string; a: string }[] };
  verified: string;
  seeAlso: { label: string; links: { href: string; text: string }[] };
  crumb: string;
};

const C: Record<Lang, Copy> = {
  en: {
    kicker: "Reeep alternative",
    h1: "Reeep Alternative: DuupFlow vs Reeep",
    shortAnswer:
      "<strong>Short answer:</strong> Reeep is built around Instagram trial reels: it creates variants of your videos, lets you approve the ones to post, publishes them and tracks their stats. DuupFlow solves the same problem, getting more reach out of the same content, but for <strong>every account and every platform</strong>: it turns one video into unique copies and AI variants you can post on Instagram, TikTok, YouTube Shorts and more, with one workspace per creator, VA roles and Google Drive export. If you manage one Instagram account and want automatic trial reels, Reeep fits. If you run an agency or post across many accounts and platforms, DuupFlow is built for that.",
    cta: [
      { title: "", text: "Posting on more than one account? Turn one video into unique copies and AI variants for every account.", button: "Try DuupFlow" },
      { title: "", text: "Get every account its own version of your best videos.", button: "Start with DuupFlow" },
      { title: "", text: "Switch your team to DuupFlow.", button: "Create your account" },
    ],
    compare: {
      h2: "DuupFlow vs Reeep at a glance",
      cols: ["", "DuupFlow", "Reeep"],
      rows: [
        ["Main job", "Unique copies + AI variants for many accounts and platforms", "Trial reel variants for Instagram"],
        ["Platforms", "Any (TikTok, Instagram, YouTube Shorts, X, Reddit, Threads)", "Publishes to Instagram (trial reels). Files can be downloaded to post elsewhere"],
        ["Unique files (metadata, re-encoding, fingerprint)", "Yes", "Not listed"],
        ["Variants of one video", "Yes, up to 50 per video, visibly different (caption, style, framing, subtitles, speed, colours)", "Yes, up to 10 per batch, 300 per month"],
        ["Captions and subtitles varied on every copy", "Yes", "Not listed"],
        ["Publishes for you", "No, you post the files with your usual tools", "Yes, as trial reels after you confirm (up to 10 posts per 24 h)"],
        ["Stats on published variants", "No", "Yes"],
        ["One workspace per creator + VA roles", "Yes (Pro and Agency)", "Not listed"],
        ["Google Drive import and export", "Yes", "Not listed"],
        ["Find an account's top-performing videos", "Yes (Instagram & TikTok scraper)", "Not listed"],
        ["AI editor from raw footage", "Yes, powered by Claude", "Not listed"],
        ["Starting price", "€39/month", "€23.99/month (one plan, no free trial)"],
      ],
      note: "Reeep information from reeep.it, checked in November 2026. Features and prices may change.",
    },
    well: {
      h2: "What Reeep does well",
      lead: "To be fair, Reeep is a good tool for what it is built for:",
      items: [
        "<strong>It publishes for you.</strong> You approve the variants, and Reeep posts them.",
        "<strong>It tracks results.</strong> You see how each published variant performs.",
        "<strong>It is focused.</strong> If your only goal is trial reels on one Instagram account, it is simple, with a single plan.",
      ],
      kicker: "If you run one Instagram account and want trial reels posted and measured for you, these are real advantages.",
    },
    why: {
      h2: "Why agencies choose DuupFlow instead",
      lead: "The difference shows up when you post on several accounts, several platforms, or with a team.",
      reasons: [
        { h: "Every platform, not only Instagram", p: "Your best videos can work on TikTok, YouTube Shorts and X too. DuupFlow files can be posted anywhere." },
        { h: "Many accounts, each with its own version", p: "Every copy is a new file for the platforms: new metadata, re-encoding, invisible micro-variations and a unique fingerprint. Each account gets its own version, never the same file." },
        { h: "Variants you control", p: "AI duplication in Variations mode creates up to 50 versions of one video that look different: rewritten caption, new style, framing, subtitles, speed and colours. You can guide it with your own instructions, and vary captions and subtitles on every copy." },
        { h: "Built for teams", p: "One workspace per creator, with her brief and her Drive folder. VAs only see the creators assigned to them." },
        { h: "The full pipeline", p: "Scrape an account's top-performing reels → duplicate them → create AI variants → export everything to each creator's Google Drive folder, ready to post." },
      ],
    },
    pricing: {
      h2: "DuupFlow pricing",
      head: ["Plan", "Monthly price", "Best for"],
      rows: [
        ["Solo", "€39", "One creator or a freelancer"],
        ["Pro", "€99", "Small agencies: unlimited duplications, 3 members, 2 creator spaces, VA roles, API"],
        ["Agency", "€249", "Agencies at scale: 10 members, 15 creator spaces, onboarding call"],
      ],
      note: "Yearly billing is discounted. See the ",
      noteLink: "pricing page",
      noteEnd: " for current details.",
    },
    choose: {
      h2: "Which one should you choose?",
      cols: [
        { h: "Choose Reeep if:", items: ["You manage one Instagram account.", "You want a tool that posts trial reels and tracks them for you."] },
        { h: "Choose DuupFlow if:", items: ["You post on several accounts or several platforms.", "You manage several creators or work with VAs.", "You want both invisible copies and visibly different AI variants, in one tool."] },
      ],
    },
    faq: {
      h2: "FAQ",
      items: [
        { q: "Is DuupFlow a Reeep alternative?", a: "Yes. Both help you get more reach from the same videos. Reeep focuses on Instagram trial reels; DuupFlow creates unique copies and AI variants for any account and any platform." },
        { q: "Does DuupFlow work for Instagram trial reels?", a: "Yes. You can create several different variants of a reel and post them as trial reels. DuupFlow creates the files; you post them yourself." },
        { q: "Does DuupFlow post videos for me?", a: "No. DuupFlow creates the copies and variants and can export them to Google Drive. You or your VAs post them with your usual tools." },
        { q: "Can DuupFlow handle several creators?", a: "Yes. Pro and Agency plans include separate creator workspaces, team members and VA roles." },
        { q: "Which platforms does DuupFlow work with?", a: "Any platform: TikTok, Instagram, YouTube Shorts, X, Reddit, Threads." },
      ],
    },
    verified: "Reeep information checked on reeep.it in November 2026.",
    seeAlso: {
      label: "See also",
      links: [
        { href: "/metaghost-alternative", text: "MetaGhost alternative" },
        { href: "/capcut-alternative", text: "CapCut alternative" },
        { href: "/submagic-alternative", text: "Submagic alternative" },
        { href: "/pricing", text: "Pricing" },
      ],
    },
    crumb: "Reeep alternative",
  },
  fr: {
    kicker: "Alternative à Reeep",
    h1: "Alternative à Reeep : DuupFlow vs Reeep",
    shortAnswer:
      "<strong>Réponse courte :</strong> Reeep est construit autour des reels d'essai Instagram : il crée des variantes de tes vidéos, te laisse valider celles à publier, les publie et suit leurs statistiques. DuupFlow règle le même problème, tirer plus de portée du même contenu, mais pour <strong>chaque compte et chaque plateforme</strong> : il transforme une vidéo en copies uniques et en variantes IA que tu peux publier sur Instagram, TikTok, YouTube Shorts et ailleurs, avec un espace de travail par créatrice, des rôles VA et l'export Google Drive. Si tu gères un seul compte Instagram et que tu veux des reels d'essai automatiques, Reeep convient. Si tu gères une agence ou que tu publies sur beaucoup de comptes et de plateformes, DuupFlow est fait pour ça.",
    cta: [
      { title: "", text: "Tu publies sur plus d'un compte ? Transforme une vidéo en copies uniques et en variantes IA pour chaque compte.", button: "Essayer DuupFlow" },
      { title: "", text: "Donne à chaque compte sa propre version de tes meilleures vidéos.", button: "Commencer avec DuupFlow" },
      { title: "", text: "Passe ton équipe sur DuupFlow.", button: "Créer mon compte" },
    ],
    compare: {
      h2: "DuupFlow vs Reeep en un coup d'œil",
      cols: ["", "DuupFlow", "Reeep"],
      rows: [
        ["Rôle principal", "Copies uniques + variantes IA pour beaucoup de comptes et de plateformes", "Variantes en reels d'essai pour Instagram"],
        ["Plateformes", "Toutes (TikTok, Instagram, YouTube Shorts, X, Reddit, Threads)", "Publie sur Instagram (reels d'essai). Les fichiers peuvent être téléchargés pour publier ailleurs"],
        ["Fichiers uniques (métadonnées, réencodage, empreinte)", "Oui", "Non mentionné"],
        ["Variantes d'une même vidéo", "Oui, jusqu'à 50 par vidéo, visuellement différentes (légende, style, cadrage, sous-titres, vitesse, couleurs)", "Oui, jusqu'à 10 par lot, 300 par mois"],
        ["Textes et sous-titres variés à chaque copie", "Oui", "Non mentionné"],
        ["Publie à ta place", "Non, tu publies les fichiers avec tes outils habituels", "Oui, en reels d'essai après ta confirmation (jusqu'à 10 publications par 24 h)"],
        ["Statistiques des variantes publiées", "Non", "Oui"],
        ["Un espace par créatrice + rôles VA", "Oui (Pro et Agence)", "Non mentionné"],
        ["Import et export Google Drive", "Oui", "Non mentionné"],
        ["Trouver les vidéos les plus performantes d'un compte", "Oui (scraper Instagram & TikTok)", "Non mentionné"],
        ["Éditeur IA à partir des rushes", "Oui, propulsé par Claude", "Non mentionné"],
        ["Prix de départ", "39 €/mois", "23,99 €/mois (un seul forfait, sans essai gratuit)"],
      ],
      note: "Informations sur Reeep issues de reeep.it, vérifiées en novembre 2026. Les fonctionnalités et les prix peuvent changer.",
    },
    well: {
      h2: "Ce que Reeep fait bien",
      lead: "Pour être honnête, Reeep est un bon outil pour ce qu'il sait faire :",
      items: [
        "<strong>Il publie à ta place.</strong> Tu valides les variantes, et Reeep les publie.",
        "<strong>Il suit les résultats.</strong> Tu vois comment chaque variante publiée performe.",
        "<strong>Il est ciblé.</strong> Si ton seul objectif, c'est des reels d'essai sur un compte Instagram, c'est simple, avec un seul forfait.",
      ],
      kicker: "Si tu gères un seul compte Instagram et que tu veux des reels d'essai publiés et mesurés pour toi, ce sont de vrais avantages.",
    },
    why: {
      h2: "Pourquoi les agences choisissent plutôt DuupFlow",
      lead: "La différence apparaît dès que tu publies sur plusieurs comptes, plusieurs plateformes, ou en équipe.",
      reasons: [
        { h: "Toutes les plateformes, pas seulement Instagram", p: "Tes meilleures vidéos peuvent aussi marcher sur TikTok, YouTube Shorts et X. Les fichiers DuupFlow se publient partout." },
        { h: "Beaucoup de comptes, chacun sa version", p: "Chaque copie est un fichier neuf pour les plateformes : nouvelles métadonnées, réencodage, micro-variations invisibles et empreinte unique. Chaque compte a sa propre version, jamais le même fichier." },
        { h: "Des variantes que tu contrôles", p: "La duplication IA en mode Variations crée jusqu'à 50 versions d'une même vidéo qui se voient différentes : légende réécrite, nouveau style, cadrage, sous-titres, vitesse et couleurs. Tu peux la guider avec tes propres consignes, et varier les textes et sous-titres à chaque copie." },
        { h: "Pensé pour les équipes", p: "Un espace de travail par créatrice, avec son brief et son dossier Drive. Les VA ne voient que les créatrices qui leur sont attribuées." },
        { h: "Toute la chaîne", p: "Récupère les reels les plus performants d'un compte → duplique-les → crée des variantes IA → exporte tout dans le dossier Google Drive de chaque créatrice, prêt à publier." },
      ],
    },
    pricing: {
      h2: "Les prix de DuupFlow",
      head: ["Plan", "Prix mensuel", "Idéal pour"],
      rows: [
        ["Solo", "39 €", "Une créatrice ou un freelance"],
        ["Pro", "99 €", "Petites agences : duplications illimitées, 3 membres, 2 espaces créatrices, rôles VA, API"],
        ["Agence", "249 €", "Agences à grande échelle : 10 membres, 15 espaces créatrices, appel d'onboarding"],
      ],
      note: "La facturation annuelle est moins chère. Consulte la ",
      noteLink: "page tarifs",
      noteEnd: " pour le détail à jour.",
    },
    choose: {
      h2: "Lequel choisir ?",
      cols: [
        { h: "Choisis Reeep si :", items: ["Tu gères un seul compte Instagram.", "Tu veux un outil qui publie tes reels d'essai et les suit pour toi."] },
        { h: "Choisis DuupFlow si :", items: ["Tu publies sur plusieurs comptes ou plusieurs plateformes.", "Tu gères plusieurs créatrices ou tu travailles avec des VA.", "Tu veux à la fois des copies invisibles et des variantes IA visuellement différentes, dans un seul outil."] },
      ],
    },
    faq: {
      h2: "Questions fréquentes",
      items: [
        { q: "DuupFlow est-il une alternative à Reeep ?", a: "Oui. Les deux t'aident à tirer plus de portée des mêmes vidéos. Reeep se concentre sur les reels d'essai Instagram ; DuupFlow crée des copies uniques et des variantes IA pour n'importe quel compte et n'importe quelle plateforme." },
        { q: "DuupFlow marche-t-il pour les reels d'essai Instagram ?", a: "Oui. Tu peux créer plusieurs variantes différentes d'un reel et les publier en reels d'essai. DuupFlow crée les fichiers ; c'est toi qui les publies." },
        { q: "DuupFlow publie-t-il les vidéos à ma place ?", a: "Non. DuupFlow crée les copies et les variantes et peut les exporter vers Google Drive. Toi ou tes VA les publiez avec vos outils habituels." },
        { q: "DuupFlow peut-il gérer plusieurs créatrices ?", a: "Oui. Les plans Pro et Agence incluent des espaces de travail séparés par créatrice, des membres d'équipe et des rôles VA." },
        { q: "Avec quelles plateformes DuupFlow fonctionne-t-il ?", a: "Toutes : TikTok, Instagram, YouTube Shorts, X, Reddit, Threads." },
      ],
    },
    verified: "Informations sur Reeep vérifiées sur reeep.it en novembre 2026.",
    seeAlso: {
      label: "Voir aussi",
      links: [
        { href: "/metaghost-alternative", text: "Alternative à MetaGhost" },
        { href: "/capcut-alternative", text: "Alternative à CapCut" },
        { href: "/submagic-alternative", text: "Alternative à Submagic" },
        { href: "/pricing", text: "Tarifs" },
      ],
    },
    crumb: "Alternative à Reeep",
  },
};

/* ─────────────────────────── UI helpers ─────────────────────────── */

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-black/[0.04] px-3.5 py-1.5 text-[13px] font-medium text-[#1a1a1a] ring-1 ring-black/5">
      {children}
    </span>
  );
}

function SectionHead({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight text-[#1a1a1a]">{title}</h2>
      {lead && <p className="mt-4 max-w-3xl text-lg leading-relaxed text-[#3f4453]">{lead}</p>}
    </div>
  );
}

function Html({ html, className }: { html: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ─────────────────────────── Page ─────────────────────────── */

export default function ReeepAlternativePage({ lang }: { lang: Lang }) {
  const c = C[lang];
  const base = "https://www.duupflow.com";
  const url = `${base}${CANONICAL[lang]}`;

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "DuupFlow",
    applicationCategory: "MultimediaApplication",
    applicationSubCategory: "Video duplication and AI variants",
    operatingSystem: "Web",
    url,
    inLanguage: lang === "fr" ? "fr-FR" : "en-US",
    description: META[lang].description,
    offers: [
      { "@type": "Offer", name: "Solo", price: "39", priceCurrency: "EUR" },
      { "@type": "Offer", name: "Pro", price: "99", priceCurrency: "EUR" },
      { "@type": "Offer", name: lang === "fr" ? "Agence" : "Agency", price: "249", priceCurrency: "EUR" },
    ],
    publisher: { "@type": "Organization", name: "DuupFlow", logo: { "@type": "ImageObject", url: `${base}/logo-mark.png` } },
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faq.items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "DuupFlow", item: lang === "fr" ? `${base}/fr` : base },
      { "@type": "ListItem", position: 2, name: c.crumb, item: url },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="text-[#1a1a1a] [&_strong]:font-semibold">
        {/* ── Hero + short answer ── */}
        <section className="px-6 pt-6 pb-12 md:pb-16">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 flex justify-center">
              <Kicker>{c.kicker}</Kicker>
            </div>
            <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">{c.h1}</h1>
          </div>
          <div className="mx-auto mt-10 max-w-3xl">
            <p className="text-lg leading-relaxed text-[#3f4453] md:text-xl">
              <Html html={c.shortAnswer} />
            </p>
            <CtaCallout className="mt-10" {...c.cta[0]} />
          </div>
        </section>

        {/* ── Comparison table ── */}
        <section className="px-6 py-14 md:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHead title={c.compare.h2} />
            <div className="overflow-x-auto rounded-2xl ring-1 ring-black/[0.08]">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[#f5f6fb]">
                    {c.compare.cols.map((h, j) => (
                      <th key={j} className={`px-4 py-3 font-bold ${j === 1 ? "text-[#4f7bff]" : "text-[#1a1a1a]"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.compare.rows.map(([label, dflw, mg], ri) => (
                    <tr key={ri} className="border-t border-black/[0.06] align-top">
                      <td className="px-4 py-3 font-semibold text-[#1a1a1a]">{label}</td>
                      <td className="bg-[#4f7bff]/[0.04] px-4 py-3 font-medium text-[#1a1a1a]">{dflw}</td>
                      <td className="px-4 py-3 text-[#3f4453]">{mg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs italic text-[#8a8a8a]">{c.compare.note}</p>
          </div>
        </section>

        {/* ── What Reeep does well ── */}
        <section className="px-6 py-14 md:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHead title={c.well.h2} lead={c.well.lead} />
            <ul className="mb-8 space-y-3">
              {c.well.items.map((it, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-[#3f4453] md:text-base">
                  <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4f7bff]" />
                  <Html html={it} />
                </li>
              ))}
            </ul>
            <p className="max-w-3xl rounded-2xl bg-[#f5f6fb] p-6 text-[15px] font-medium leading-relaxed text-[#1a1a1a] ring-1 ring-black/[0.05]">
              {c.well.kicker}
            </p>
          </div>
        </section>

        {/* ── Why agencies choose DuupFlow ── */}
        <section className="px-6 py-14 md:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHead title={c.why.h2} lead={c.why.lead} />
            <div className="grid gap-5 md:grid-cols-2">
              {c.why.reasons.map((r, i) => (
                <div key={i} className="rounded-2xl bg-[#f5f6fb] p-6 ring-1 ring-black/[0.05]">
                  <h3 className="mb-2 flex items-baseline gap-2.5 text-lg font-bold text-[#1a1a1a]">
                    <span className="text-[#4f7bff]">{i + 1}.</span>
                    {r.h}
                  </h3>
                  <p className="text-[15px] leading-relaxed text-[#3f4453]">
                    <Html html={r.p} />
                  </p>
                </div>
              ))}
            </div>
            <CtaCallout className="mt-12" {...c.cta[1]} />
          </div>
        </section>

        {/* ── DuupFlow pricing ── */}
        <section className="px-6 py-14 md:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHead title={c.pricing.h2} />
            <div className="overflow-x-auto rounded-2xl ring-1 ring-black/[0.08]">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[#f5f6fb]">
                    {c.pricing.head.map((h, j) => (
                      <th key={j} className="px-4 py-3 font-bold text-[#1a1a1a]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.pricing.rows.map(([plan, price, bestFor], ri) => (
                    <tr key={ri} className="border-t border-black/[0.06] align-top">
                      <td className="px-4 py-3 font-semibold text-[#1a1a1a]">{plan}</td>
                      <td className="px-4 py-3 text-base font-extrabold tracking-tight text-[#1a1a1a]">{price}</td>
                      <td className="px-4 py-3 text-[#3f4453]">{bestFor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-5 text-[15px] leading-relaxed text-[#3f4453]">
              {c.pricing.note}
              <Link href="/pricing" className="font-semibold text-[#4f7bff] underline underline-offset-2 hover:opacity-80">
                {c.pricing.noteLink}
              </Link>
              {c.pricing.noteEnd}
            </p>
          </div>
        </section>

        {/* ── Which one should you choose? ── */}
        <section className="px-6 py-14 md:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHead title={c.choose.h2} />
            <div className="grid gap-5 md:grid-cols-2">
              {c.choose.cols.map((col, i) => (
                <div
                  key={i}
                  className={`rounded-2xl p-6 md:p-7 ${i === 1 ? "bg-[#4f7bff]/[0.06] ring-1 ring-[#4f7bff]/25" : "bg-white ring-1 ring-black/[0.08]"}`}
                >
                  <h3 className={`mb-4 text-lg font-bold ${i === 1 ? "text-[#4f7bff]" : "text-[#1a1a1a]"}`}>{col.h}</h3>
                  <ul className="space-y-2.5">
                    {col.items.map((it, j) => (
                      <li key={j} className="flex gap-3 text-[15px] leading-relaxed text-[#3f4453]">
                        <span aria-hidden className={`mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full ${i === 1 ? "bg-[#4f7bff]" : "bg-[#8a8a8a]"}`} />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ (accordion; answers stay in the HTML when collapsed) ── */}
        <section className="px-6 py-14 md:py-20">
          <div className="mx-auto max-w-3xl">
            <SectionHead title={c.faq.h2} />
            <div className="divide-y divide-black/[0.08] border-y border-black/[0.08]">
              {c.faq.items.map((item, i) => (
                <details key={i} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                    <span className="text-base font-semibold text-[#1a1a1a] md:text-lg">{item.q}</span>
                    <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[#3f4453] transition group-open:rotate-45">
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

        {/* ── Final CTA + see also + verification date ── */}
        <section className="px-6 pt-6 pb-16 md:pb-24">
          <div className="mx-auto max-w-3xl">
            <CtaCallout {...c.cta[2]} />

            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
              <span className="text-[#8a8a8a]">{c.seeAlso.label}{lang === "fr" ? " :" : ":"}</span>
              {c.seeAlso.links.map((l, i) => (
                <Link key={i} href={l.href} className="font-medium text-[#4f7bff] transition hover:opacity-80">
                  {l.text}
                </Link>
              ))}
            </div>

            <p className="mt-10 text-center text-xs text-[#8a8a8a]">{c.verified}</p>
          </div>
        </section>
      </main>
    </>
  );
}

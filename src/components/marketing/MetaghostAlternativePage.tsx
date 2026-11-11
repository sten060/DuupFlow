// src/components/marketing/MetaghostAlternativePage.tsx
//
// Permanent SEO landing page: "MetaGhost Alternative". Bilingual, one shared
// slug (/metaghost-alternative, /fr/metaghost-alternative), each locale
// self-canonical and linked via hreflang (route wrapper). Lives at a top-level
// route, NOT under /blog/. Chrome (NavPill + Footer + light "lunera" theme)
// comes from the sibling layout.tsx — same page type as Submagic/CapCut.
//
// DuupFlow prices are the source of truth (Solo 39€ / Pro 99€ / Agency 249€,
// see src/lib/plans.ts + pricing/page.tsx). MetaGhost facts checked on
// metaghost.io (CHECKED_LABEL) — re-check before changing them.

import Link from "@/components/LocaleLink";
import CtaCallout from "@/components/marketing/CtaCallout";

export type Lang = "fr" | "en";

export const SLUG = "metaghost-alternative";
export const CANONICAL: Record<Lang, string> = { en: `/${SLUG}`, fr: `/fr/${SLUG}` };

export const META: Record<Lang, { title: string; description: string }> = {
  en: {
    title: "MetaGhost Alternative: DuupFlow vs MetaGhost for Agencies (2026)",
    description:
      "Looking for a MetaGhost alternative? An honest comparison of DuupFlow and MetaGhost: web app vs desktop, team workspaces, AI editing, pricing, and which one fits your workflow.",
  },
  fr: {
    title: "Alternative à MetaGhost : DuupFlow vs MetaGhost pour les agences (2026)",
    description:
      "Tu cherches une alternative à MetaGhost ? Une comparaison honnête de DuupFlow et MetaGhost : application web ou de bureau, espaces d'équipe, montage IA, prix, et lequel correspond à ton workflow.",
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
  switchTo: { h2: string; steps: string[] };
  faq: { h2: string; items: { q: string; a: string }[] };
  verified: string;
  seeAlso: { label: string; links: { href: string; text: string }[] };
  crumb: string;
};

const C: Record<Lang, Copy> = {
  en: {
    kicker: "MetaGhost alternative",
    h1: "MetaGhost Alternative: DuupFlow vs MetaGhost",
    shortAnswer:
      "<strong>Short answer:</strong> MetaGhost is a desktop app (Windows and macOS) that makes video and image files unique so they can be reposted. DuupFlow does the same job as a <strong>web app built for teams</strong>: one workspace per creator, manager and VA roles, Google Drive import and export, a scraper to find top-performing videos, and an AI editor powered by Claude to create new variants. If you work alone on one computer, MetaGhost is a solid choice. If you run an agency with several creators and VAs, DuupFlow is built for that workflow, and it starts at €39/month.",
    cta: [
      { title: "Running an agency?", text: "Try DuupFlow: unique copies, AI variants and one workspace per creator, from any browser.", button: "Try DuupFlow" },
      { title: "See the full workflow in one tool:", text: "scrape, duplicate, create variants, export to Drive.", button: "Start with DuupFlow" },
      { title: "Switch your team to DuupFlow.", text: "", button: "Create your account" },
    ],
    compare: {
      h2: "DuupFlow vs MetaGhost at a glance",
      cols: ["", "DuupFlow", "MetaGhost"],
      rows: [
        ["Type of app", "Web app (any browser)", "Desktop app (Windows, macOS)"],
        ["Videos and images", "Yes", "Yes"],
        ["Metadata rewriting", "Yes (device, date, encoder, location)", "Yes (40+ EXIF fields, iPhone profiles)"],
        ["Re-encoding + invisible visual variations", "Yes", "Yes (pixel, geometric, timing, audio)"],
        ["Uniqueness checker", "Yes (Comparator)", "Not listed"],
        ["AI editor to create new videos from footage", "Yes, powered by Claude", "Template-based Short Maker"],
        ["Hook / caption variants with AI", "Yes", "Template Cloner, AI subtitles"],
        ["Find top-performing videos of an account", "Yes (Instagram & TikTok scraper)", "Not listed"],
        ["One workspace per creator", "Yes (Pro and Agency)", "No"],
        ["Manager and VA roles", "Yes (Pro and Agency)", "Shared seats"],
        ["Google Drive import and export", "Yes", "Not listed"],
        ["API", "Yes (Pro and Agency)", "Yes (Business and Scale)"],
        ["Starting price", "€39/month (Solo)", "$99/month (Pro)"],
      ],
      note: "MetaGhost information from metaghost.io, checked in November 2026. Features and prices may change.",
    },
    well: {
      h2: "What MetaGhost does well",
      lead: "To be fair, MetaGhost is a strong tool in several areas:",
      items: [
        "<strong>Local processing.</strong> Basic spoofing runs on your own computer, so files don't have to be uploaded.",
        "<strong>Unlimited local batch processing</strong> on every plan.",
        "<strong>Deep metadata options</strong>, including iPhone device profiles.",
        "<strong>Extra AI tools</strong>, such as a remover for invisible AI watermarks and a template-based short maker.",
      ],
      kicker: "If you are a solo creator who wants everything on one machine, these are real advantages.",
    },
    why: {
      h2: "Why agencies choose DuupFlow instead",
      lead: "The difference shows up when more than one person works on the content.",
      reasons: [
        { h: "Built for teams, not one computer", p: "DuupFlow runs in the browser. Your managers and VAs log in from anywhere, on any device. Nobody has to install anything or pass files around." },
        { h: "One workspace per creator", p: "Each creator gets her own space: her content, her settings, her brief (tone, caption style, words to avoid) and her Drive folder. Content never gets mixed between creators." },
        { h: "VAs only see what they handle", p: "Manager and VA roles let you give each VA access only to the creators assigned to them, with an admin view across all creators for you." },
        { h: "From footage to new videos, not just copies", p: "Duplication lets you repost what you already have. DuupFlow's <strong>AI editor, powered by Claude</strong>, goes further: upload raw footage, give a reference video or a prompt, and it assembles new edits and as many variants as you need. That's how you get more content out of every video a creator sends." },
        { h: "A full pipeline, end to end", p: "Scrape an account's top-performing reels → duplicate them into unique copies → create AI variants → export everything to each creator's Google Drive folder, ready for VAs to post. One tool instead of four." },
        { h: "Lower starting price", p: "DuupFlow starts at €39/month. Team features (workspaces, VA roles, API) are on the Pro and Agency plans." },
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
        { h: "Choose MetaGhost if:", items: ["You work alone, on one computer.", "You prefer processing files locally.", "You mainly need spoofing and a few extra AI tools."] },
        { h: "Choose DuupFlow if:", items: ["You manage several creators, or work with VAs.", "You want everyone working from the same place, in the browser.", "You want to create new variants from footage with AI, not only duplicate.", "You use Google Drive to hand content to your team."] },
      ],
    },
    switchTo: {
      h2: "How to switch from MetaGhost to DuupFlow",
      steps: [
        "Create your DuupFlow account.",
        "Create one workspace per creator and invite your VAs.",
        "Connect Google Drive and import your source content.",
        "Run your first duplication, then check uniqueness with the Comparator.",
        "Export finished copies to each creator's Drive folder.",
      ],
    },
    faq: {
      h2: "FAQ",
      items: [
        { q: "Is DuupFlow a MetaGhost alternative?", a: "Yes. Both make video and image files unique so they can be reposted. DuupFlow is a web app with team features and AI editing; MetaGhost is a desktop app." },
        { q: "Does DuupFlow work on Mac and Windows?", a: "Yes. It runs in the browser, so it works on any computer, with nothing to install." },
        { q: "Can DuupFlow handle several creators?", a: "Yes. Pro and Agency plans include separate creator workspaces, invited members and VA roles." },
        { q: "Does DuupFlow handle images too?", a: "Yes, both images and videos." },
        { q: "Which platforms does it work with?", a: "The files work on any platform: TikTok, Instagram, YouTube, X, Reddit, Threads. You post them yourself or through your usual tools." },
      ],
    },
    verified: "MetaGhost information verified on metaghost.io in November 2026.",
    seeAlso: {
      label: "See also",
      links: [
        { href: "/blog/agence-onlyfans-reels-instagram-plusieurs-comptes", text: "How OFM agencies scale Instagram reels" },
        { href: "/capcut-alternative", text: "CapCut alternative" },
        { href: "/submagic-alternative", text: "Submagic alternative" },
        { href: "/pricing", text: "Pricing" },
      ],
    },
    crumb: "MetaGhost alternative",
  },
  fr: {
    kicker: "Alternative à MetaGhost",
    h1: "Alternative à MetaGhost : DuupFlow vs MetaGhost",
    shortAnswer:
      "<strong>Réponse courte :</strong> MetaGhost est une application de bureau (Windows et macOS) qui rend les fichiers vidéo et image uniques pour pouvoir les reposter. DuupFlow fait le même travail sous la forme d'une <strong>application web pensée pour les équipes</strong> : un espace de travail par créatrice, des rôles manager et VA, l'import et l'export Google Drive, un scraper pour trouver les vidéos les plus performantes, et un éditeur IA propulsé par Claude pour créer de nouvelles variantes. Si tu travailles seul sur un ordinateur, MetaGhost est un bon choix. Si tu gères une agence avec plusieurs créatrices et des VA, DuupFlow est conçu pour ce workflow, à partir de 39 €/mois.",
    cta: [
      { title: "Tu gères une agence ?", text: "Essaie DuupFlow : copies uniques, variantes IA et un espace de travail par créatrice, depuis n'importe quel navigateur.", button: "Essayer DuupFlow" },
      { title: "Tout le workflow dans un seul outil :", text: "scraper, dupliquer, créer des variantes, exporter vers Drive.", button: "Commencer avec DuupFlow" },
      { title: "Passe ton équipe sur DuupFlow.", text: "", button: "Créer mon compte" },
    ],
    compare: {
      h2: "DuupFlow vs MetaGhost en un coup d'œil",
      cols: ["", "DuupFlow", "MetaGhost"],
      rows: [
        ["Type d'application", "Application web (n'importe quel navigateur)", "Application de bureau (Windows, macOS)"],
        ["Vidéos et images", "Oui", "Oui"],
        ["Réécriture des métadonnées", "Oui (appareil, date, encodeur, localisation)", "Oui (plus de 40 champs EXIF, profils iPhone)"],
        ["Réencodage + variations visuelles invisibles", "Oui", "Oui (pixel, géométrie, timing, audio)"],
        ["Vérificateur d'unicité", "Oui (Comparateur)", "Non mentionné"],
        ["Éditeur IA pour créer de nouvelles vidéos à partir des rushes", "Oui, propulsé par Claude", "Short Maker à base de modèles"],
        ["Variantes de hooks / légendes avec l'IA", "Oui", "Template Cloner, sous-titres IA"],
        ["Trouver les vidéos les plus performantes d'un compte", "Oui (scraper Instagram & TikTok)", "Non mentionné"],
        ["Un espace de travail par créatrice", "Oui (Pro et Agence)", "Non"],
        ["Rôles manager et VA", "Oui (Pro et Agence)", "Sièges partagés"],
        ["Import et export Google Drive", "Oui", "Non mentionné"],
        ["API", "Oui (Pro et Agence)", "Oui (Business et Scale)"],
        ["Prix de départ", "39 €/mois (Solo)", "99 $/mois (Pro)"],
      ],
      note: "Informations sur MetaGhost issues de metaghost.io, vérifiées en novembre 2026. Les fonctionnalités et les prix peuvent changer.",
    },
    well: {
      h2: "Ce que MetaGhost fait bien",
      lead: "Pour être honnête, MetaGhost est un outil solide sur plusieurs points :",
      items: [
        "<strong>Traitement local.</strong> Le spoofing de base tourne sur ton propre ordinateur, donc pas besoin d'envoyer les fichiers.",
        "<strong>Traitement local par lots illimité</strong> dans tous les plans.",
        "<strong>Des options de métadonnées poussées</strong>, dont des profils d'appareils iPhone.",
        "<strong>Des outils IA en plus</strong>, comme un outil qui retire les filigranes IA invisibles et un créateur de shorts à base de modèles.",
      ],
      kicker: "Si tu es un créateur solo qui veut tout sur une seule machine, ce sont de vrais avantages.",
    },
    why: {
      h2: "Pourquoi les agences choisissent plutôt DuupFlow",
      lead: "La différence apparaît dès que plus d'une personne travaille sur le contenu.",
      reasons: [
        { h: "Pensé pour les équipes, pas pour un seul ordinateur", p: "DuupFlow tourne dans le navigateur. Tes managers et tes VA se connectent de n'importe où, sur n'importe quel appareil. Personne n'a rien à installer ni à se faire passer des fichiers." },
        { h: "Un espace de travail par créatrice", p: "Chaque créatrice a son propre espace : son contenu, ses réglages, son brief (ton, style de légende, mots à éviter) et son dossier Drive. Les contenus ne se mélangent jamais entre créatrices." },
        { h: "Les VA ne voient que ce qu'ils gèrent", p: "Les rôles manager et VA te permettent de donner à chaque VA l'accès aux seules créatrices qui lui sont attribuées, avec une vue admin sur toutes les créatrices pour toi." },
        { h: "Des rushes à de nouvelles vidéos, pas seulement des copies", p: "La duplication te permet de reposter ce que tu as déjà. L'<strong>éditeur IA de DuupFlow, propulsé par Claude</strong>, va plus loin : envoie tes rushes, donne une vidéo de référence ou un prompt, et il assemble de nouveaux montages et autant de variantes qu'il t'en faut. C'est comme ça que tu tires plus de contenu de chaque vidéo qu'envoie une créatrice." },
        { h: "Toute la chaîne, de bout en bout", p: "Récupère les reels les plus performants d'un compte → duplique-les en copies uniques → crée des variantes IA → exporte tout dans le dossier Google Drive de chaque créatrice, prêt à être publié par les VA. Un seul outil au lieu de quatre." },
        { h: "Un prix de départ plus bas", p: "DuupFlow commence à 39 €/mois. Les fonctions d'équipe (espaces de travail, rôles VA, API) sont dans les plans Pro et Agence." },
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
        { h: "Choisis MetaGhost si :", items: ["Tu travailles seul, sur un seul ordinateur.", "Tu préfères traiter tes fichiers en local.", "Tu as surtout besoin de spoofing et de quelques outils IA en plus."] },
        { h: "Choisis DuupFlow si :", items: ["Tu gères plusieurs créatrices, ou tu travailles avec des VA.", "Tu veux que tout le monde travaille au même endroit, dans le navigateur.", "Tu veux créer de nouvelles variantes à partir de tes rushes avec l'IA, pas seulement dupliquer.", "Tu utilises Google Drive pour transmettre le contenu à ton équipe."] },
      ],
    },
    switchTo: {
      h2: "Passer de MetaGhost à DuupFlow",
      steps: [
        "Crée ton compte DuupFlow.",
        "Crée un espace de travail par créatrice et invite tes VA.",
        "Connecte Google Drive et importe ton contenu source.",
        "Lance ta première duplication, puis vérifie l'unicité avec le Comparateur.",
        "Exporte les copies terminées dans le dossier Drive de chaque créatrice.",
      ],
    },
    faq: {
      h2: "Questions fréquentes",
      items: [
        { q: "DuupFlow est-il une alternative à MetaGhost ?", a: "Oui. Les deux rendent les fichiers vidéo et image uniques pour pouvoir les reposter. DuupFlow est une application web avec des fonctions d'équipe et du montage IA ; MetaGhost est une application de bureau." },
        { q: "DuupFlow fonctionne-t-il sur Mac et Windows ?", a: "Oui. Il tourne dans le navigateur, donc il marche sur n'importe quel ordinateur, sans rien à installer." },
        { q: "DuupFlow peut-il gérer plusieurs créatrices ?", a: "Oui. Les plans Pro et Agence incluent des espaces de travail séparés par créatrice, des membres invités et des rôles VA." },
        { q: "DuupFlow gère-t-il aussi les images ?", a: "Oui, les images comme les vidéos." },
        { q: "Avec quelles plateformes ça fonctionne ?", a: "Les fichiers fonctionnent sur n'importe quelle plateforme : TikTok, Instagram, YouTube, X, Reddit, Threads. Tu les publies toi-même ou avec tes outils habituels." },
      ],
    },
    verified: "Informations sur MetaGhost vérifiées sur metaghost.io en novembre 2026.",
    seeAlso: {
      label: "Voir aussi",
      links: [
        { href: "/blog/agence-onlyfans-reels-instagram-plusieurs-comptes", text: "Comment les agences OFM font grandir leurs reels" },
        { href: "/capcut-alternative", text: "Alternative à CapCut" },
        { href: "/submagic-alternative", text: "Alternative à Submagic (en anglais)" },
        { href: "/pricing", text: "Tarifs" },
      ],
    },
    crumb: "Alternative à MetaGhost",
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

export default function MetaghostAlternativePage({ lang }: { lang: Lang }) {
  const c = C[lang];
  const base = "https://www.duupflow.com";
  const url = `${base}${CANONICAL[lang]}`;

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "DuupFlow",
    applicationCategory: "MultimediaApplication",
    applicationSubCategory: "Video and image duplication",
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

        {/* ── What MetaGhost does well ── */}
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

        {/* ── How to switch ── */}
        <section className="px-6 py-14 md:py-20">
          <div className="mx-auto max-w-3xl">
            <SectionHead title={c.switchTo.h2} />
            <ol className="space-y-4">
              {c.switchTo.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-4 text-[15px] leading-relaxed text-[#3f4453] md:text-base">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#4f7bff 0%,#7c5cff 100%)" }}>
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
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

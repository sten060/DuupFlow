// src/app/[locale]/blog/duupflow-pas-qu-un-simple-spoofer/page.tsx
//
// Fully bilingual SEO article (FR + EN both indexed, one shared slug). Each
// locale is self-canonical and cross-linked via hreflang. Same layout as the
// other blog articles (blocks + FAQ + sticky TOC).

import type { Metadata } from "next";
import { publicPath } from "@/lib/i18n/routes";
import Link from "@/components/LocaleLink";
import ArticleTOC, { type TocSection } from "../_components/ArticleTOC";

const SLUG = "duupflow-pas-qu-un-simple-spoofer";
const PUBLISHED_AT = "2026-11-02";
const AUTHOR = "@Sten";
// Adresse EN traduite (routes.ts) : /blog/<slug-en> ; FR : /fr/blog/<slug-fr>.
const CANONICAL_FR = publicPath("fr", `/blog/${SLUG}`);
const CANONICAL_EN = publicPath("en", `/blog/${SLUG}`);
const READING = { fr: 7, en: 7 } as const;

const SECTIONS = {
  fr: [
    { id: "pourquoi", label: "Pourquoi un simple spoofer ne suffit plus" },
    { id: "duplicateur", label: "Le duplicateur" },
    { id: "editeur", label: "L'éditeur IA" },
    { id: "agences", label: "Pensé pour les agences" },
    { id: "prix", label: "Plans et prix" },
    { id: "limites", label: "Ce que DuupFlow ne fait pas" },
    { id: "faq", label: "Questions fréquentes" },
  ],
  en: [
    { id: "pourquoi", label: "Why a plain spoofer isn't enough anymore" },
    { id: "duplicateur", label: "The duplicator" },
    { id: "editeur", label: "The AI editor" },
    { id: "agences", label: "Built for agencies" },
    { id: "prix", label: "Plans and pricing" },
    { id: "limites", label: "What DuupFlow doesn't do" },
    { id: "faq", label: "FAQ" },
  ],
} satisfies Record<"fr" | "en", TocSection[]>;

const META = {
  fr: {
    title: "DuupFlow : pas qu'un simple spoofer vidéo et photo",
    description:
      "DuupFlow est un spoofer vidéo et photo couplé à un éditeur vidéo IA, pensé pour les agences multi-créatrices : il monte tes vidéos avec Claude puis les duplique en copies uniques.",
    h1: "DuupFlow : pas qu'un simple spoofer",
  },
  en: {
    title: "DuupFlow: more than just a video and photo spoofer",
    description:
      "DuupFlow is a video and photo spoofer paired with an AI video editor, built for multi-creator agencies: it edits your videos with Claude, then duplicates them into unique copies.",
    h1: "DuupFlow: more than just a spoofer",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isFr = locale === "fr";
  const m = isFr ? META.fr : META.en;
  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: isFr ? CANONICAL_FR : CANONICAL_EN,
      languages: { "en-US": CANONICAL_EN, "fr-FR": CANONICAL_FR, "x-default": CANONICAL_EN },
    },
    openGraph: {
      title: m.title,
      description: m.description,
      url: `https://www.duupflow.com${isFr ? CANONICAL_FR : CANONICAL_EN}`,
      type: "article",
      locale: isFr ? "fr_FR" : "en_US",
      publishedTime: PUBLISHED_AT,
    },
  };
}

const FAQ = {
  fr: [
    { q: "DuupFlow est-il un spoofer ?", a: "Oui, son duplicateur fait le travail d'un spoofer vidéo et photo. Mais DuupFlow ajoute un éditeur IA qui crée le contenu, et des outils d'équipe pour les agences." },
    { q: "Quelle différence avec un spoofer classique ?", a: "Un spoofer rend une vidéo existante unique. DuupFlow la monte d'abord avec l'IA, la décline en variantes, la duplique, puis l'envoie dans le dossier Drive de chaque créatrice." },
    { q: "Pour qui est fait DuupFlow ?", a: "Pour les agences qui gèrent plusieurs créatrices et plusieurs comptes (OFM, UGC, multi-comptes), et pour les créateurs qui repostent sur plusieurs comptes." },
    { q: "Sur quelles plateformes fonctionnent les copies ?", a: "TikTok, Instagram, YouTube Shorts, X, Reddit et Threads. DuupFlow prépare les fichiers, la publication se fait ailleurs." },
    { q: "La qualité baisse-t-elle ?", a: "Non. Résolution et bitrate sont conservés, jusqu'en 4K." },
    { q: "L'éditeur IA est-il inclus ?", a: "Oui, dans tous les plans." },
    { q: "Faut-il installer un logiciel ?", a: "Non, DuupFlow est une application web." },
    { q: "Peut-on l'automatiser ?", a: "Oui, via l'API (Make, n8n, Claude Code) à partir du plan Pro, ou en pilotant DuupFlow depuis Claude avec le connecteur MCP." },
    { q: "Combien coûte DuupFlow ?", a: "De 39 € à 249 € par mois selon le plan, ou de 28 € à 176 € par mois en annuel." },
  ],
  en: [
    { q: "Is DuupFlow a spoofer?", a: "Yes, its duplicator does the job of a video and photo spoofer. But DuupFlow adds an AI editor that creates the content, plus team tools for agencies." },
    { q: "How is it different from a classic spoofer?", a: "A spoofer makes an existing video unique. DuupFlow first edits it with AI, turns it into variants, duplicates it, then sends it to each creator's Drive folder." },
    { q: "Who is DuupFlow for?", a: "For agencies managing several creators and several accounts (OFM, UGC, multi-account), and for creators who repost across several accounts." },
    { q: "Which platforms do the copies work on?", a: "TikTok, Instagram, YouTube Shorts, X, Reddit and Threads. DuupFlow prepares the files; publishing happens elsewhere." },
    { q: "Does quality drop?", a: "No. Resolution and bitrate are kept, up to 4K." },
    { q: "Is the AI editor included?", a: "Yes, in every plan." },
    { q: "Do I need to install anything?", a: "No, DuupFlow is a web app." },
    { q: "Can it be automated?", a: "Yes, through the API (Make, n8n, Claude Code) from the Pro plan, or by driving DuupFlow from Claude with the MCP connector." },
    { q: "How much does DuupFlow cost?", a: "From €39 to €249 per month depending on the plan, or €28 to €176 per month billed yearly." },
  ],
};

type Block =
  | { t: "lead"; html: string }
  | { t: "p"; html: string }
  | { t: "h2"; id: string; html: string }
  | { t: "h3"; html: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "cta"; href: string; html: string };

const LINK = 'class="text-[#4f7bff] hover:text-[#4f7bff] underline underline-offset-2"';

const BODY: Record<"fr" | "en", Block[]> = {
  fr: [
    { t: "lead", html: "DuupFlow est un <strong>spoofer vidéo et photo couplé à un éditeur vidéo IA</strong>, pensé pour les agences qui gèrent plusieurs créatrices et plusieurs comptes. Il fait deux choses : il monte tes vidéos automatiquement avec Claude, puis il les duplique en copies uniques prêtes à reposter sur TikTok, Instagram, YouTube, X, Reddit et Threads." },
    { t: "p", html: "C'est une application web, sans installation." },

    { t: "h2", id: "pourquoi", html: "Pourquoi un simple spoofer ne suffit plus" },
    { t: "p", html: "Un spoofer classique règle un seul problème : il rend une vidéo unique pour que la plateforme ne la détecte pas comme un doublon. Mais pour une agence, le vrai goulot n'est pas là." },
    { t: "ul", items: [
      "<strong>Il faut d'abord produire le contenu.</strong> Un spoofer ne monte rien : il faut toujours un monteur ou des heures sur CapCut avant de dupliquer.",
      "<strong>Reposter la même vidéo en boucle s'use vite.</strong> Les comptes ont besoin de variantes visuellement différentes (hook, sous-titres, rythme) pour tester ce qui performe.",
      "<strong>Le contenu doit arriver au bon endroit.</strong> Dans une agence, chaque créatrice a ses VA et ses dossiers ; un spoofer desktop laisse tout à trier à la main.",
    ] },
    { t: "p", html: "DuupFlow couvre les trois étapes : <strong>créer le contenu, le rendre unique, et l'envoyer à la bonne personne.</strong>" },

    { t: "h2", id: "duplicateur", html: "Le duplicateur : une vidéo, des dizaines de copies uniques" },
    { t: "p", html: "Le duplicateur transforme une vidéo ou une image déjà montée en autant de copies uniques que nécessaire, en un seul lot. Chaque copie est vue comme un fichier neuf par les plateformes, sans différence visible à l'œil." },
    { t: "table",
      head: ["Ce qui change sur chaque copie", "Ce qui ne change pas"],
      rows: [
        ["Métadonnées : appareil, date, encodeur, géolocalisation (EXIF/XMP)", "Le montage"],
        ["Micro-variations visuelles sous le seuil de perception : luminosité, teinte, cadrage", "L'audio"],
        ["Empreinte binaire du fichier", "La résolution et le bitrate (1080p reste 1080p, 4K reste 4K)"],
        ["Réencodage complet du fichier", "Le poids : jamais plus lourd que l'original"],
      ],
    },
    { t: "ul", items: [
      "<strong>Formats :</strong> JPG, PNG, WEBP pour les images ; MP4, MOV, MKV pour les vidéos.",
      "<strong>Volume :</strong> traitement par lot, export ZIP en un clic, import et export Google Drive.",
      "<strong>Contrôle :</strong> le module Comparateur mesure la différence entre l'original et chaque copie.",
    ] },

    { t: "h2", id: "editeur", html: "L'éditeur IA : des rushes bruts à la vidéo montée" },
    { t: "p", html: "L'éditeur IA est un agent de montage piloté par conversation, propulsé par Claude. Tu décris le montage voulu, Claude assemble la vidéo à ta place." },
    { t: "ol", items: [
      "<strong>Tu donnes un style :</strong> une vidéo de référence ou une consigne écrite. L'IA en déduit le rythme, les coupes et les sous-titres.",
      "<strong>Tu ajoutes tes fichiers :</strong> rushes bruts, images, logo, dans n'importe quel format.",
      "<strong>Claude monte la vidéo :</strong> il assemble les plans, cale les coupes sur les beats, ajoute captions et sous-titres.",
      "<strong>Tu déclines en variantes :</strong> la même vidéo en plusieurs versions visuellement différentes (hook, style de caption, sous-titres) pour tester ce qui performe.",
    ] },
    { t: "p", html: "L'éditeur est aussi accessible depuis ton propre Claude via un connecteur MCP. Les vidéos peuvent ensuite passer directement dans le duplicateur." },
    { t: "p", html: "C'est la différence avec un spoofer classique : <strong>DuupFlow ne se contente pas de rendre ton contenu unique, il le crée.</strong>" },

    { t: "h2", id: "agences", html: "Pensé pour les agences" },
    { t: "p", html: "DuupFlow est conçu pour les agences qui gèrent des créatrices (OFM, UGC, multi-comptes), leurs managers et leurs équipes de VA." },
    { t: "ul", items: [
      "<strong>Espaces créatrices :</strong> un espace par créatrice, avec son brief, ses réglages et son dossier Google Drive.",
      "<strong>Rôles Manager et VA :</strong> chaque VA n'accède qu'aux créatrices qui lui sont assignées ; le manager voit toute l'agence.",
      "<strong>Google Drive :</strong> import du contenu brut et export des copies directement dans Drive.",
      "<strong>Automatisation :</strong> clés API compatibles Make, n8n et Claude Code, et pilotage par Claude via MCP, pour faire tourner la production chaque semaine sans intervention.",
    ] },
    { t: "h3", html: "Modules inclus" },
    { t: "ul", items: [
      "<strong>Scraper Instagram et TikTok :</strong> classe tes publications par performance et remonte tes meilleurs contenus à dupliquer.",
      "<strong>Comparateur :</strong> mesure la similarité visuelle entre deux fichiers.",
      "<strong>Compresseur :</strong> réduit le poids des fichiers sans perte visible.",
      "<strong>Variation IA :</strong> génère de nouvelles images à partir des tiennes (même visage, même décor).",
      "<strong>Détection IA :</strong> retire les marqueurs techniques laissés par les outils de génération (C2PA, EXIF).",
    ] },

    { t: "h2", id: "prix", html: "Plans et prix" },
    { t: "p", html: "DuupFlow propose trois plans. L'éditeur IA est inclus dans tous. La facturation annuelle donne <strong>-29 %</strong>." },
    { t: "table",
      head: ["Plan", "Prix mensuel", "Prix annuel (par mois)", "Pour qui", "Contenu"],
      rows: [
        ["Solo", "39 €", "28 €", "Créateur indépendant", "300 duplications vidéo et 400 duplications image par mois, éditeur IA, export 4K, Google Drive"],
        ["Pro", "99 €", "70 €", "Créateurs et petites agences", "Duplications illimitées, 3 membres, 2 espaces créatrices, rôles VA, API"],
        ["Agence", "249 €", "176 €", "Agences multi-créatrices", "Tout le plan Pro, 10 membres, 15 espaces créatrices, appel d'onboarding"],
      ],
    },
    { t: "p", html: `Le détail complet est sur la <a href="/fr/pricing" ${LINK}>page tarifs</a>.` },

    { t: "h2", id: "limites", html: "Ce que DuupFlow ne fait pas" },
    { t: "ul", items: [
      "<strong>Pas de publication ni de planification :</strong> DuupFlow prépare les fichiers, tu les postes toi-même ou via tes outils.",
      "<strong>Pas de génération d'avatar ou de vidéo synthétique :</strong> l'éditeur monte tes vrais rushes, il n'invente pas de personnage.",
      "<strong>Pas de gestion de comptes sociaux :</strong> pas de connexion à tes comptes Instagram ou TikTok, pas de téléphones cloud.",
      "<strong>Pas de garantie absolue :</strong> aucun outil ne peut garantir qu'une plateforme ne limitera jamais un compte. DuupFlow réduit fortement la détection de doublons ; les bonnes pratiques de publication restent nécessaires.",
      "<strong>Pas d'application à installer :</strong> tout se passe dans le navigateur.",
    ] },
    { t: "cta", href: "/pricing", html: "Voir les plans DuupFlow" },
  ],
  en: [
    { t: "lead", html: "DuupFlow is a <strong>video and photo spoofer paired with an AI video editor</strong>, built for agencies managing several creators and several accounts. It does two things: it edits your videos automatically with Claude, then duplicates them into unique copies ready to repost on TikTok, Instagram, YouTube, X, Reddit and Threads." },
    { t: "p", html: "It's a web app, nothing to install." },

    { t: "h2", id: "pourquoi", html: "Why a plain spoofer isn't enough anymore" },
    { t: "p", html: "A classic spoofer solves one problem: it makes a video unique so the platform doesn't flag it as a duplicate. But for an agency, that's not where the real bottleneck is." },
    { t: "ul", items: [
      "<strong>You have to produce the content first.</strong> A spoofer doesn't edit anything: you still need an editor or hours in CapCut before you can duplicate.",
      "<strong>Reposting the same video on a loop wears out fast.</strong> Accounts need visually different variants (hook, captions, pacing) to test what performs.",
      "<strong>The content has to land in the right place.</strong> In an agency, each creator has her own VAs and folders; a desktop spoofer leaves all the sorting to you.",
    ] },
    { t: "p", html: "DuupFlow covers all three steps: <strong>create the content, make it unique, and send it to the right person.</strong>" },

    { t: "h2", id: "duplicateur", html: "The duplicator: one video, dozens of unique copies" },
    { t: "p", html: "The duplicator turns an already-edited video or image into as many unique copies as you need, in a single batch. Platforms see each copy as a brand-new file, with no visible difference." },
    { t: "table",
      head: ["What changes on each copy", "What doesn't change"],
      rows: [
        ["Metadata: device, date, encoder, geolocation (EXIF/XMP)", "The edit"],
        ["Visual micro-variations below the perception threshold: brightness, hue, framing", "The audio"],
        ["The file's binary fingerprint", "Resolution and bitrate (1080p stays 1080p, 4K stays 4K)"],
        ["A full re-encode of the file", "File size: never heavier than the original"],
      ],
    },
    { t: "ul", items: [
      "<strong>Formats:</strong> JPG, PNG, WEBP for images; MP4, MOV, MKV for videos.",
      "<strong>Volume:</strong> batch processing, one-click ZIP export, Google Drive import and export.",
      "<strong>Control:</strong> the Comparator module measures the difference between the original and each copy.",
    ] },

    { t: "h2", id: "editeur", html: "The AI editor: from raw footage to a finished video" },
    { t: "p", html: "The AI editor is a conversation-driven editing agent, powered by Claude. You describe the edit you want, Claude assembles the video for you." },
    { t: "ol", items: [
      "<strong>You set a style:</strong> a reference video or a written brief. The AI infers the pacing, the cuts and the captions.",
      "<strong>You add your files:</strong> raw footage, images, logo, in any format.",
      "<strong>Claude edits the video:</strong> it assembles the shots, locks the cuts to the beats, adds captions and subtitles.",
      "<strong>You spin it into variants:</strong> the same video in several visually different versions (hook, caption style, subtitles) to test what performs.",
    ] },
    { t: "p", html: "The editor can also be used from your own Claude through an MCP connector. The videos can then go straight into the duplicator." },
    { t: "p", html: "That's the difference with a classic spoofer: <strong>DuupFlow doesn't just make your content unique, it creates it.</strong>" },

    { t: "h2", id: "agences", html: "Built for agencies" },
    { t: "p", html: "DuupFlow is designed for agencies managing creators (OFM, UGC, multi-account), their managers and their VA teams." },
    { t: "ul", items: [
      "<strong>Creator workspaces:</strong> one workspace per creator, with her brief, her settings and her Google Drive folder.",
      "<strong>Manager and VA roles:</strong> each VA only accesses the creators assigned to them; the manager sees the whole agency.",
      "<strong>Google Drive:</strong> import raw content and export copies straight into Drive.",
      "<strong>Automation:</strong> API keys that work with Make, n8n and Claude Code, plus driving DuupFlow from Claude via MCP, to run production every week without lifting a finger.",
    ] },
    { t: "h3", html: "Included modules" },
    { t: "ul", items: [
      "<strong>Instagram and TikTok scraper:</strong> ranks your posts by performance and surfaces your best content to duplicate.",
      "<strong>Comparator:</strong> measures the visual similarity between two files.",
      "<strong>Compressor:</strong> cuts file size with no visible loss.",
      "<strong>AI Variation:</strong> generates new images from yours (same face, same setting).",
      "<strong>AI Detection:</strong> removes the technical markers left by generation tools (C2PA, EXIF).",
    ] },

    { t: "h2", id: "prix", html: "Plans and pricing" },
    { t: "p", html: "DuupFlow offers three plans. The AI editor is included in all of them. Yearly billing saves <strong>29%</strong>." },
    { t: "table",
      head: ["Plan", "Monthly price", "Yearly price (per month)", "For", "What's included"],
      rows: [
        ["Solo", "€39", "€28", "Independent creator", "300 video and 400 image duplications per month, AI editor, 4K export, Google Drive"],
        ["Pro", "€99", "€70", "Creators and small agencies", "Unlimited duplications, 3 members, 2 creator workspaces, VA roles, API"],
        ["Agency", "€249", "€176", "Multi-creator agencies", "Everything in Pro, 10 members, 15 creator workspaces, onboarding call"],
      ],
    },
    { t: "p", html: `Full details are on the <a href="/pricing" ${LINK}>pricing page</a>.` },

    { t: "h2", id: "limites", html: "What DuupFlow doesn't do" },
    { t: "ul", items: [
      "<strong>No publishing or scheduling:</strong> DuupFlow prepares the files, you post them yourself or with your own tools.",
      "<strong>No avatar or synthetic video generation:</strong> the editor cuts your real footage, it doesn't invent a character.",
      "<strong>No social account management:</strong> no connection to your Instagram or TikTok accounts, no cloud phones.",
      "<strong>No absolute guarantee:</strong> no tool can guarantee a platform will never limit an account. DuupFlow sharply reduces duplicate detection; good posting practices are still needed.",
      "<strong>No app to install:</strong> everything runs in the browser.",
    ] },
    { t: "cta", href: "/pricing", html: "See DuupFlow plans" },
  ],
};

function renderBlock(b: Block, i: number) {
  switch (b.t) {
    case "lead":
      return <p key={i} className="text-lg md:text-xl text-[#1a1a1a] leading-relaxed" dangerouslySetInnerHTML={{ __html: b.html }} />;
    case "p":
      return <p key={i} dangerouslySetInnerHTML={{ __html: b.html }} />;
    case "h2":
      return <h2 key={i} id={b.id} className="pt-6 text-2xl md:text-3xl font-bold tracking-tight text-[#1a1a1a]" dangerouslySetInnerHTML={{ __html: b.html }} />;
    case "h3":
      return <h3 key={i} className="pt-4 text-xl md:text-2xl font-semibold tracking-tight text-[#1a1a1a]" dangerouslySetInnerHTML={{ __html: b.html }} />;
    case "ul":
      return <ul key={i} className="list-disc list-outside space-y-2 pl-6 marker:text-[#4f7bff]/70">{b.items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: it }} />)}</ul>;
    case "ol":
      return <ol key={i} className="list-decimal list-outside space-y-2 pl-6 marker:text-[#4f7bff]/70 marker:font-semibold">{b.items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: it }} />)}</ol>;
    case "table":
      // Tables textuelles : tout aligné à gauche (cellules longues).
      return (
        <div key={i} className="my-2 overflow-x-auto rounded-2xl ring-1 ring-black/[0.08]">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#f5f6fb]">
                {b.head.map((h, j) => (
                  <th key={j} className="px-4 py-3 font-semibold text-[#1a1a1a]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, ri) => (
                <tr key={ri} className="border-t border-black/[0.06] align-top">
                  {row.map((cell, ci) => (
                    <td key={ci} className={`px-4 py-3 ${ci === 0 ? "font-medium text-[#1a1a1a]" : "text-[#3f4453]"}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "cta":
      return (
        <div key={i} className="pt-6">
          <Link href={b.href} className="btn-glow inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-[#1a1a1a]">
            <span dangerouslySetInnerHTML={{ __html: b.html }} /><span aria-hidden>→</span>
          </Link>
        </div>
      );
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isFr = locale === "fr";
  const lang: "fr" | "en" = isFr ? "fr" : "en";

  const faqJsonLd = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: FAQ[lang].map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const articleJsonLd = {
    "@context": "https://schema.org", "@type": "Article",
    headline: META[lang].h1, datePublished: PUBLISHED_AT, dateModified: PUBLISHED_AT,
    inLanguage: isFr ? "fr-FR" : "en-US",
    author: { "@type": "Person", name: "Sten" },
    publisher: { "@type": "Organization", name: "DuupFlow", logo: { "@type": "ImageObject", url: "https://www.duupflow.com/logo-mark.png" } },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://www.duupflow.com${isFr ? CANONICAL_FR : CANONICAL_EN}` },
  };

  const dateLabel = new Date(PUBLISHED_AT).toLocaleDateString(isFr ? "fr-FR" : "en-US", { day: "numeric", month: "short", year: "numeric" });
  const crumb = isFr ? "Pas qu'un simple spoofer" : "More than a spoofer";
  const tag = isFr ? "Produit" : "Product";
  const read = isFr ? "min de lecture" : "min read";
  const faqTitle = isFr ? "Questions fréquentes" : "Frequently asked questions";
  const back = isFr ? "← Retour au blog" : "← Back to blog";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <main className="px-6 py-12 md:py-16">
        <div className="max-w-6xl mx-auto grid grid-cols-12 gap-10 lg:gap-14">
          <article className="col-span-12 lg:col-span-8 [&_h2]:scroll-mt-28 [&_h3]:scroll-mt-28">
            <nav className="text-xs text-[#8a8a8a] mb-6" aria-label="Breadcrumb">
              <Link href="/blog" className="hover:text-[#3f4453] transition">Blog</Link>
              <span className="mx-2 text-[#8a8a8a]">/</span>
              <span className="text-[#3f4453]">{crumb}</span>
            </nav>

            <header className="mb-10">
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">{META[lang].h1}</h1>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs uppercase tracking-wider text-[#8a8a8a]">
                <time dateTime={PUBLISHED_AT}>{dateLabel}</time>
                <span className="text-[#8a8a8a]">•</span>
                <span className="normal-case tracking-normal">{AUTHOR}</span>
                <span className="text-[#8a8a8a]">•</span>
                <span>{READING[lang]} {read}</span>
                <span className="text-[#8a8a8a]">•</span>
                <span>{tag}</span>
              </div>
            </header>

            <div className="space-y-6 text-[15px] md:text-base leading-relaxed text-[#1a1a1a]">
              {BODY[lang].map(renderBlock)}
            </div>

            <section className="mt-16 pt-10 border-t border-black/10">
              <h2 id="faq" className="scroll-mt-28 text-2xl md:text-3xl font-bold tracking-tight text-[#1a1a1a] mb-6">{faqTitle}</h2>
              <div className="space-y-6">
                {FAQ[lang].map((item, i) => (
                  <div key={i}>
                    <h3 className="text-base md:text-lg font-semibold text-[#1a1a1a] mb-2">{item.q}</h3>
                    <p className="text-sm md:text-[15px] text-[#3f4453] leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-12 pt-6 border-t border-black/10">
              <Link href="/blog" className="text-sm text-[#3f4453] hover:text-[#1a1a1a] transition">{back}</Link>
            </div>
          </article>

          <aside className="hidden lg:block lg:col-span-4">
            <div className="sticky top-28">
              <ArticleTOC sections={SECTIONS[lang]} />
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

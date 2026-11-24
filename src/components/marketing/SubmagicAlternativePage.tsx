// src/components/marketing/SubmagicAlternativePage.tsx
//
// Permanent SEO landing page: "Submagic Alternative". Bilingual since November
// 2026: one shared slug (/submagic-alternative, /fr/submagic-alternative), each
// locale self-canonical and linked via hreflang (route wrapper). Lives at a
// top-level route, NOT under /blog/. Chrome (NavPill + Footer + light "lunera"
// theme) comes from the sibling layout.tsx.
//
// Structured for machine extraction: single H1, strict H2/H3 hierarchy, a
// comparison table, an FAQ authored as real search queries whose answers stay in
// the HTML even when the <details> accordion is collapsed, and
// SoftwareApplication + WebPage + FAQPage + BreadcrumbList JSON-LD.
//
// DuupFlow prices are the source of truth (Solo 39€ / Pro 99€ / Agency 249€,
// see src/lib/plans.ts + pricing/page.tsx).
//
// Submagic facts: ONLY what submagic.co/pricing states (checked 2026-11-24).
// Starter 12/month yearly (19 monthly) · Pro 23 (39) · Business 41 (69) + Custom.
// Captioned videos / month 15 · 40 · 100. Iris AI editor 2 · 6 · 15 videos / month.
// Magic Clips in every plan (5 · 15 · 37 long videos / month). API 10 · 10 · 100
// min / month. The site shows the currency of the visitor's country: USD on the
// English page, EUR on the French one (same figures). Re-check before editing;
// anything not on their site gets removed, not guessed.

import Link from "@/components/LocaleLink";
import CtaCallout from "@/components/marketing/CtaCallout";

export type Lang = "fr" | "en";

export const SLUG = "submagic-alternative";
export const CANONICAL: Record<Lang, string> = { en: `/${SLUG}`, fr: `/fr/${SLUG}` };

/** Dernière mise à jour du contenu (affichée + données structurées + sitemap). */
export const UPDATED_AT = "2026-11-24";

export const META: Record<Lang, { title: string; description: string }> = {
  en: {
    title: "Submagic Alternative for Creators Who Need Volume (2026) | DuupFlow",
    description:
      "Submagic captions and polishes one video at a time, with an AI editor limited to a few videos a month. DuupFlow edits from your raw footage and turns every video into dozens of versions.",
  },
  fr: {
    title: "Alternative à Submagic pour les créateurs qui ont besoin de volume (2026) | DuupFlow",
    description:
      "Submagic sous-titre et peaufine une vidéo à la fois, avec un éditeur IA limité à quelques vidéos par mois. DuupFlow monte à partir de tes rushes et transforme chaque vidéo en dizaines de versions.",
  },
};

// Pricing source of truth: src/lib/plans.ts (quotas) + pricing/page.tsx (display).
const PRICE: Record<Lang, { solo: string; pro: string; agency: string; from: string }> = {
  en: { solo: "€39", pro: "€99", agency: "€249", from: "From €39/month" },
  fr: { solo: "39 €", pro: "99 €", agency: "249 €", from: "À partir de 39 €/mois" },
};

/* ─────────────────────────── Content ─────────────────────────── */

type Copy = {
  hero: { kicker: string; h1: string; updated: string; shortAnswer: string; cta: string };
  why: { h2: string; lead: string; reasons: { h: string; p: string }[] };
  whyCta: { text: string; button: string };
  different: { h2: string; blocks: { h: string; paras: string[] }[] };
  better: { h2: string; lead: string; items: string[]; kicker: string };
  compare: { h2: string; cols: [string, string, string]; rows: { label: string; submagic: string; duupflow: string }[]; note: string };
  who: { h2: string; paras: string[] };
  pricing: { h2: string; plans: { name: string; price: string; for: string; highlight?: boolean }[]; note: string; cta: string };
  faq: { h2: string; items: { q: string; a: string }[] };
  final: { h2: string; p: string; cta: string };
  seeAlso: { label: string; links: { href: string; text: string }[] };
  crumb: string;
};

const C: Record<Lang, Copy> = {
  en: {
    hero: {
      kicker: "Submagic alternative",
      h1: "The Submagic alternative for creators who need volume, not just captions",
      updated: "Last updated: November 2026",
      shortAnswer:
        "<strong>Short answer:</strong> Submagic is great for adding captions and polishing one video at a time, and its AI editor is limited to a few videos per month. DuupFlow is built for volume: it edits videos from your raw footage with your own visuals, then turns each one into dozens of unique versions for all your accounts and platforms. If you post one video per channel, Submagic is enough. If you need many videos and many versions, DuupFlow is built for that.",
      cta: "Edit my first video",
    },
    why: {
      h2: "Why creators look for a Submagic alternative",
      lead: "Submagic is a strong product. These are the walls people hit when they need volume.",
      reasons: [
        {
          h: "Every plan is capped by video count",
          p: "Submagic Starter includes 15 captioned videos per month, Submagic Pro 40, Submagic Business 100. If you publish every day on several accounts, you reach the limit fast.",
        },
        {
          h: "The AI editor is limited to a few videos",
          p: "Submagic now has an AI editor, Iris, in every plan. But it edits 2 videos per month on Starter, 6 on Pro and 15 on Business. That works for a few highlight videos, not for daily volume.",
        },
        {
          h: "It works one video at a time",
          p: "Submagic is built to caption and improve a video. It doesn't turn one video into many different versions for your other accounts and platforms.",
        },
        {
          h: "The B-roll is a stock library",
          p: "Submagic gives you a library of B-roll (Storyblocks on Pro and Business). That works for generic content. It doesn't work when you need your dashboard, your product shot or your interface on a specific word.",
        },
      ],
    },
    whyCta: { text: "Need volume, not just captions? Edit from your raw footage and get dozens of versions of every video.", button: "Try DuupFlow" },
    different: {
      h2: "What DuupFlow does differently",
      blocks: [
        {
          h: "It builds the edit from your raw footage",
          paras: [
            "You upload raw material (face cam, screen recordings, screenshots, product visuals, voiceover) and describe the edit you want. The AI assembles it: cuts, pacing, animated captions, zooms, split-screen, audio ducking.",
            "The AI editor is included in every paid plan and is built for volume, not for a handful of videos per month.",
          ],
        },
        {
          h: "Your visuals, on the exact word",
          paras: [
            "When you say \"dashboard\", your actual dashboard screenshot appears, not a stock clip of someone typing. For anyone selling a product, a course or a service, this is the difference between a video that demonstrates and a video that decorates.",
          ],
        },
        {
          h: "One video, dozens of versions",
          paras: [
            "A video that works should run more than once. <strong>Duplication</strong> turns it into new files for the platforms (new metadata, re-encoding, unique fingerprint), in the original quality.",
            "<strong>AI duplication in Variations mode</strong> goes further: up to 50 visibly different versions of one video, with a rewritten caption, a new style, framing, subtitles, speed and colours, guided by your own instructions. Captions and subtitles can also change on every copy (fonts, colours, subtitle styles).",
            "The result: one edit becomes dozens of versions, ready to spread across all your accounts and platforms.",
          ],
        },
      ],
    },
    better: {
      h2: "What Submagic does better than DuupFlow",
      lead: "Straight answer, otherwise this page is worthless.",
      items: [
        "Caption craft. Submagic is built around captions: a deep library of caption templates, and custom templates on the higher plans.",
        "Clipping long videos. Magic Clips, included in every plan, turns long videos into short clips. DuupFlow doesn't do that.",
        "Audio clean-up and bad-take removal with AI, on the Pro plan.",
        "Publishing and analytics for social accounts, on the Pro and Business plans.",
      ],
      kicker:
        "If your workflow is \"I already edit my videos and I just want better captions and B-roll on top\", Submagic is the right tool. If your workflow is \"I have raw footage and no time, and I need to publish a lot\", that's DuupFlow.",
    },
    compare: {
      h2: "Comparison",
      cols: ["", "Submagic", "DuupFlow"],
      rows: [
        { label: "Core job", submagic: "Captions and polishing, one video at a time", duupflow: "Full edit from raw footage, then many versions" },
        { label: "AI editor", submagic: "Yes (Iris): 2, 6 or 15 videos per month", duupflow: "Yes, in every paid plan, built for volume" },
        { label: "Turn one video into many unique versions", submagic: "No", duupflow: "Yes, up to 50 per video" },
        { label: "Captions and subtitles that change on every copy", submagic: "Not listed", duupflow: "Yes" },
        { label: "Inserts", submagic: "B-roll library", duupflow: "Your own visuals, on the word" },
        { label: "Videos per month", submagic: "15, 40 or 100 captioned videos", duupflow: "300 on Solo, unlimited duplications on Pro and Agency" },
        { label: "Clips from long videos", submagic: "Yes (Magic Clips, every plan)", duupflow: "No" },
        { label: "API", submagic: "Every plan (10 min/month on Starter and Pro, 100 on Business)", duupflow: "Pro and Agency" },
        { label: "Price", submagic: "$12 – $41/month billed yearly ($19 – $69 monthly), plus a Custom plan", duupflow: "€39 – €249/month" },
      ],
      note: "Submagic information checked on submagic.co in November 2026.",
    },
    who: {
      h2: "Who it's for",
      paras: [
        "For people producing short-form content for social, who want output worthy of a professional editor, and who don't have the time to spend their days on a timeline.",
        "It's the trade-off nobody has offered you until now. Manual editors give you quality in exchange for your time. Fast tools give you time in exchange for quality. DuupFlow is built to hold both: the pace and the finish.",
      ],
    },
    pricing: {
      h2: "Pricing",
      plans: [
        { name: "Solo", price: "€39/month", for: "Posting consistently", highlight: true },
        { name: "Pro", price: "€99/month", for: "Volume and multiple accounts" },
        { name: "Agency", price: "€249/month", for: "Agencies managing several creators" },
      ],
      note: "No watermark on any plan. No add-on to unlock the core features.",
      cta: "See full pricing",
    },
    faq: {
      h2: "FAQ",
      items: [
        {
          q: "How much does Submagic cost?",
          a: "Submagic's own plans, billed yearly: Starter $12/month ($19 billed monthly) for 15 captioned videos per month, Pro $23/month ($39 monthly) for 40, Business $41/month ($69 monthly) for 100, plus a Custom plan. These are Submagic's prices, not DuupFlow's: DuupFlow plans are Solo €39/month, Pro €99/month and Agency €249/month.",
        },
        {
          q: "Does Submagic have an AI editor?",
          a: "Yes, Submagic’s AI editor (Iris) is included in all plans, but limited to a few videos per month (2 on Starter, 6 on Pro, 15 on Business). DuupFlow’s AI editor is included in all paid plans and is built for volume.",
        },
        {
          q: "What is Magic Clips and is it included?",
          a: "Magic Clips is Submagic's feature that turns long videos into short clips. It's included in every plan, with limits: 5 long videos per month on Starter, 15 on Pro and 37 on Business.",
        },
        {
          q: "Can Submagic create multiple versions of the same video?",
          a: "Submagic doesn't list a feature for this. Each video you caption counts against your monthly limit (15, 40 or 100). DuupFlow is built for it: duplication creates new files for the platforms, and AI duplication in Variations mode creates up to 50 visibly different versions.",
        },
        {
          q: "Can DuupFlow create many versions of the same video?",
          a: "Yes. AI duplication in Variations mode creates up to 50 visibly different versions of one video, and captions and subtitles can change on every copy.",
        },
        {
          q: "What's the best Submagic alternative?",
          a: "It depends what's blocking you. For clipping long videos, use a dedicated clipping tool. For building the edit from raw footage and producing volume, DuupFlow.",
        },
        {
          q: "Does DuupFlow do captions as well as Submagic?",
          a: "Captions are one part of what DuupFlow does: animated, word by word, fully styleable, and they can change on every copy. If captions are the only thing you need, Submagic's template library is deeper. If you need the whole edit and many versions, the comparison isn't on captions.",
        },
        {
          q: "Can I use my own screenshots and product visuals?",
          a: "Yes, and that's the point. You upload them and they're placed on the word you specify, rather than pulled from a stock library.",
        },
      ],
    },
    final: {
      h2: "One video isn't a strategy.",
      p: "Better captions on a single post won't move your numbers. Publishing consistently, at volume, with a finish that holds up, will.",
      cta: "Edit my first video",
    },
    seeAlso: {
      label: "See also",
      links: [
        { href: "/capcut-alternative", text: "CapCut alternative" },
        { href: "/metaghost-alternative", text: "MetaGhost alternative" },
        { href: "/reeep-alternative", text: "Reeep alternative" },
        { href: "/pricing", text: "Pricing" },
      ],
    },
    crumb: "Submagic alternative",
  },

  fr: {
    hero: {
      kicker: "Alternative à Submagic",
      h1: "L'alternative à Submagic pour les créateurs qui ont besoin de volume, pas seulement de sous-titres",
      updated: "Mis à jour : novembre 2026",
      shortAnswer:
        "<strong>Réponse courte :</strong> Submagic est très bien pour ajouter des sous-titres et peaufiner une vidéo à la fois, et son éditeur IA est limité à quelques vidéos par mois. DuupFlow est fait pour le volume : il monte tes vidéos à partir de tes rushes avec tes propres visuels, puis transforme chacune en dizaines de versions uniques pour tous tes comptes et toutes tes plateformes. Si tu publies une vidéo par chaîne, Submagic suffit. Si tu as besoin de beaucoup de vidéos et de beaucoup de versions, DuupFlow est fait pour ça.",
      cta: "Monter ma première vidéo",
    },
    why: {
      h2: "Pourquoi les créateurs cherchent une alternative à Submagic",
      lead: "Submagic est un bon produit. Voici les limites sur lesquelles on bute quand on a besoin de volume.",
      reasons: [
        {
          h: "Chaque plan est plafonné en nombre de vidéos",
          p: "Submagic Starter inclut 15 vidéos sous-titrées par mois, Submagic Pro 40, Submagic Business 100. Si tu publies tous les jours sur plusieurs comptes, tu atteins vite la limite.",
        },
        {
          h: "L'éditeur IA est limité à quelques vidéos",
          p: "Submagic a maintenant un éditeur IA, Iris, dans tous les plans. Mais il monte 2 vidéos par mois en Starter, 6 en Pro et 15 en Business. Ça suffit pour quelques vidéos phares, pas pour du volume au quotidien.",
        },
        {
          h: "Il travaille une vidéo à la fois",
          p: "Submagic est fait pour sous-titrer et améliorer une vidéo. Il ne transforme pas une vidéo en plusieurs versions différentes pour tes autres comptes et plateformes.",
        },
        {
          h: "Le B-roll vient d'une banque d'images",
          p: "Submagic te donne une banque de B-roll (Storyblocks en Pro et Business). Ça marche pour du contenu générique. Pas quand il te faut ton tableau de bord, ta photo produit ou ton interface sur un mot précis.",
        },
      ],
    },
    whyCta: { text: "Tu as besoin de volume, pas seulement de sous-titres ? Monte à partir de tes rushes et obtiens des dizaines de versions de chaque vidéo.", button: "Essayer DuupFlow" },
    different: {
      h2: "Ce que DuupFlow fait différemment",
      blocks: [
        {
          h: "Il construit le montage à partir de tes rushes",
          paras: [
            "Tu envoies ta matière brute (face cam, enregistrements d'écran, captures, visuels produit, voix off) et tu décris le montage que tu veux. L'IA l'assemble : coupes, rythme, sous-titres animés, zooms, écran partagé, baisse automatique de la musique sous la voix.",
            "L'éditeur IA est inclus dans tous les plans payants et il est fait pour le volume, pas pour une poignée de vidéos par mois.",
          ],
        },
        {
          h: "Tes visuels, sur le mot exact",
          paras: [
            "Quand tu dis « tableau de bord », c'est ta vraie capture de tableau de bord qui apparaît, pas une vidéo de banque d'images de quelqu'un qui tape au clavier. Si tu vends un produit, une formation ou un service, c'est la différence entre une vidéo qui démontre et une vidéo qui décore.",
          ],
        },
        {
          h: "Une vidéo, des dizaines de versions",
          paras: [
            "Une vidéo qui marche doit tourner plus d'une fois. La <strong>duplication</strong> la transforme en fichiers neufs pour les plateformes (nouvelles métadonnées, réencodage, empreinte unique), en qualité d'origine.",
            "La <strong>duplication IA en mode Variations</strong> va plus loin : jusqu'à 50 versions visuellement différentes d'une même vidéo, avec une légende réécrite, un nouveau style, un autre cadrage, d'autres sous-titres, une autre vitesse et d'autres couleurs, guidées par tes propres consignes. Les textes et les sous-titres peuvent aussi changer à chaque copie (polices, couleurs, styles de sous-titres).",
            "Résultat : un montage devient des dizaines de versions, prêtes à partir sur tous tes comptes et toutes tes plateformes.",
          ],
        },
      ],
    },
    better: {
      h2: "Ce que Submagic fait mieux que DuupFlow",
      lead: "Réponse franche, sinon cette page ne sert à rien.",
      items: [
        "Le travail des sous-titres. Submagic est construit autour des sous-titres : une grande bibliothèque de modèles, et des modèles personnalisés sur les plans supérieurs.",
        "Le découpage des vidéos longues. Magic Clips, inclus dans tous les plans, transforme une vidéo longue en clips courts. DuupFlow ne fait pas ça.",
        "Le nettoyage audio et la suppression des prises ratées par l'IA, sur le plan Pro.",
        "La publication et les statistiques sur les réseaux, sur les plans Pro et Business.",
      ],
      kicker:
        "Si ton workflow, c'est « je monte déjà mes vidéos et je veux juste de meilleurs sous-titres et du B-roll par-dessus », Submagic est le bon outil. Si c'est « j'ai des rushes, pas de temps, et je dois publier beaucoup », c'est DuupFlow.",
    },
    compare: {
      h2: "Comparatif",
      cols: ["", "Submagic", "DuupFlow"],
      rows: [
        { label: "Rôle principal", submagic: "Sous-titres et finitions, une vidéo à la fois", duupflow: "Montage complet à partir des rushes, puis beaucoup de versions" },
        { label: "Éditeur IA", submagic: "Oui (Iris) : 2, 6 ou 15 vidéos par mois", duupflow: "Oui, dans tous les plans payants, fait pour le volume" },
        { label: "Transformer une vidéo en beaucoup de versions uniques", submagic: "Non", duupflow: "Oui, jusqu'à 50 par vidéo" },
        { label: "Textes et sous-titres qui changent à chaque copie", submagic: "Non mentionné", duupflow: "Oui" },
        { label: "Inserts", submagic: "Banque de B-roll", duupflow: "Tes propres visuels, sur le mot" },
        { label: "Vidéos par mois", submagic: "15, 40 ou 100 vidéos sous-titrées", duupflow: "300 en Solo, duplications illimitées en Pro et Agence" },
        { label: "Clips à partir de vidéos longues", submagic: "Oui (Magic Clips, tous les plans)", duupflow: "Non" },
        { label: "API", submagic: "Tous les plans (10 min/mois en Starter et Pro, 100 en Business)", duupflow: "Pro et Agence" },
        { label: "Prix", submagic: "12 à 41 €/mois en annuel (19 à 69 € en mensuel), plus un plan Custom", duupflow: "39 à 249 €/mois" },
      ],
      note: "Informations sur Submagic vérifiées sur submagic.co en novembre 2026.",
    },
    who: {
      h2: "Pour qui",
      paras: [
        "Pour celles et ceux qui produisent des vidéos courtes pour les réseaux, qui veulent un rendu digne d'un monteur professionnel, et qui n'ont pas le temps de passer leurs journées sur une timeline.",
        "C'est le compromis que personne ne t'a proposé jusqu'ici. Les logiciels de montage te donnent la qualité contre ton temps. Les outils rapides te donnent du temps contre la qualité. DuupFlow est fait pour tenir les deux : le rythme et la finition.",
      ],
    },
    pricing: {
      h2: "Tarifs",
      plans: [
        { name: "Solo", price: "39 €/mois", for: "Publier régulièrement", highlight: true },
        { name: "Pro", price: "99 €/mois", for: "Volume et plusieurs comptes" },
        { name: "Agence", price: "249 €/mois", for: "Agences qui gèrent plusieurs créateurs" },
      ],
      note: "Aucun filigrane, quel que soit le plan. Aucune option payante pour débloquer les fonctions principales.",
      cta: "Voir tous les tarifs",
    },
    faq: {
      h2: "Questions fréquentes",
      items: [
        {
          q: "Combien coûte Submagic ?",
          a: "Les plans de Submagic, en facturation annuelle : Starter à 12 €/mois (19 € en mensuel) pour 15 vidéos sous-titrées par mois, Pro à 23 €/mois (39 € en mensuel) pour 40, Business à 41 €/mois (69 € en mensuel) pour 100, plus un plan Custom. Ce sont les prix de Submagic, pas ceux de DuupFlow : les plans DuupFlow sont Solo à 39 €/mois, Pro à 99 €/mois et Agence à 249 €/mois.",
        },
        {
          q: "Submagic a-t-il un éditeur IA ?",
          a: "Oui, l'éditeur IA de Submagic (Iris) est inclus dans tous les plans, mais limité à quelques vidéos par mois (2 en Starter, 6 en Pro, 15 en Business). L'éditeur IA de DuupFlow est inclus dans tous les plans payants et il est fait pour le volume.",
        },
        {
          q: "C'est quoi Magic Clips, et est-ce inclus ?",
          a: "Magic Clips est la fonction de Submagic qui transforme une vidéo longue en clips courts. Elle est incluse dans tous les plans, avec des limites : 5 vidéos longues par mois en Starter, 15 en Pro et 37 en Business.",
        },
        {
          q: "Submagic peut-il créer plusieurs versions d'une même vidéo ?",
          a: "Submagic n'annonce pas de fonction pour ça. Chaque vidéo que tu sous-titres compte dans ta limite mensuelle (15, 40 ou 100). DuupFlow est fait pour ça : la duplication crée des fichiers neufs pour les plateformes, et la duplication IA en mode Variations crée jusqu'à 50 versions visuellement différentes.",
        },
        {
          q: "DuupFlow peut-il créer beaucoup de versions d'une même vidéo ?",
          a: "Oui. La duplication IA en mode Variations crée jusqu'à 50 versions visuellement différentes d'une même vidéo, et les textes et sous-titres peuvent changer à chaque copie.",
        },
        {
          q: "Quelle est la meilleure alternative à Submagic ?",
          a: "Ça dépend de ce qui te bloque. Pour découper des vidéos longues, prends un outil spécialisé dans les clips. Pour construire le montage à partir de tes rushes et produire du volume, DuupFlow.",
        },
        {
          q: "DuupFlow fait-il les sous-titres aussi bien que Submagic ?",
          a: "Les sous-titres sont une partie de ce que fait DuupFlow : animés, mot par mot, entièrement personnalisables, et ils peuvent changer à chaque copie. Si tu n'as besoin que de sous-titres, la bibliothèque de modèles de Submagic est plus fournie. Si tu as besoin du montage complet et de beaucoup de versions, la comparaison ne se joue pas sur les sous-titres.",
        },
        {
          q: "Je peux utiliser mes propres captures et visuels produit ?",
          a: "Oui, c'est tout l'intérêt. Tu les envoies et ils sont placés sur le mot que tu choisis, au lieu de venir d'une banque d'images.",
        },
      ],
    },
    final: {
      h2: "Une vidéo, ce n'est pas une stratégie.",
      p: "De meilleurs sous-titres sur un seul post ne changeront pas tes chiffres. Publier régulièrement, en volume, avec une finition qui tient la route, oui.",
      cta: "Monter ma première vidéo",
    },
    seeAlso: {
      label: "Voir aussi",
      links: [
        { href: "/capcut-alternative", text: "Alternative à CapCut" },
        { href: "/metaghost-alternative", text: "Alternative à MetaGhost" },
        { href: "/reeep-alternative", text: "Alternative à Reeep" },
        { href: "/pricing", text: "Tarifs" },
      ],
    },
    crumb: "Alternative à Submagic",
  },
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

function Html({ html }: { html: string }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ─────────────────────────── Page ─────────────────────────── */

export default function SubmagicAlternativePage({ lang }: { lang: Lang }) {
  const c = C[lang];
  const price = PRICE[lang];
  const base = "https://www.duupflow.com";
  const url = `${base}${CANONICAL[lang]}`;
  const inLanguage = lang === "fr" ? "fr-FR" : "en-US";

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "DuupFlow",
    applicationCategory: "MultimediaApplication",
    applicationSubCategory: "AI video editor",
    operatingSystem: "Web",
    url,
    inLanguage,
    description: META[lang].description,
    featureList: [
      "Edit from raw footage",
      "Automatic cutting",
      "Word-by-word animated captions",
      "Word-synced inserts (your own visuals)",
      "Up to 50 visibly different versions of one video (AI duplication, Variations mode)",
      "Captions and subtitles that change on every copy",
    ],
    offers: [
      { "@type": "Offer", name: "Solo", price: "39", priceCurrency: "EUR" },
      { "@type": "Offer", name: "Pro", price: "99", priceCurrency: "EUR" },
      { "@type": "Offer", name: lang === "fr" ? "Agence" : "Agency", price: "249", priceCurrency: "EUR" },
    ],
    publisher: {
      "@type": "Organization",
      name: "DuupFlow",
      logo: { "@type": "ImageObject", url: `${base}/logo-mark.png` },
    },
  };

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: META[lang].title,
    description: META[lang].description,
    url,
    inLanguage,
    dateModified: UPDATED_AT,
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faq.items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="text-[#1a1a1a] [&_strong]:font-semibold">
        {/* ── Hero + short answer ── */}
        <section className="px-6 pt-6 pb-16 md:pb-24">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 flex justify-center">
              <Kicker>{c.hero.kicker}</Kicker>
            </div>
            <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              {c.hero.h1}
            </h1>
            <p className="mt-5 text-sm font-medium text-[#8a8a8a]">
              <time dateTime={UPDATED_AT}>{c.hero.updated}</time>
            </p>
          </div>
          <div className="mx-auto mt-8 max-w-3xl">
            <p className="text-lg leading-relaxed text-[#3f4453] md:text-xl">
              <Html html={c.hero.shortAnswer} />
            </p>
            <div className="mt-9 flex flex-col items-center gap-3">
              <PrimaryCta href="/register" big>
                {c.hero.cta}
              </PrimaryCta>
              <span className="text-sm text-[#8a8a8a]">{price.from}</span>
            </div>
          </div>
        </section>

        {/* ── Why ── */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHead title={c.why.h2} />
            <p className="mb-10 max-w-3xl text-lg leading-relaxed text-[#3f4453]">{c.why.lead}</p>
            <div className="grid gap-5 md:grid-cols-2">
              {c.why.reasons.map((r, i) => (
                <div key={i} className="rounded-2xl bg-[#f5f6fb] p-6 ring-1 ring-black/[0.05]">
                  <h3 className="mb-2 text-lg font-bold text-[#1a1a1a]">{r.h}</h3>
                  <p className="text-[15px] leading-relaxed text-[#3f4453]">{r.p}</p>
                </div>
              ))}
            </div>
            <CtaCallout className="mt-12" text={c.whyCta.text} button={c.whyCta.button} />
          </div>
        </section>

        {/* ── What DuupFlow does differently ── */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHead title={c.different.h2} />
            <div className="space-y-6">
              {c.different.blocks.map((b, i) => (
                <div key={i} className="rounded-2xl border border-black/[0.06] p-6 md:p-8">
                  <h3 className="mb-3 text-xl font-bold text-[#1a1a1a] md:text-2xl">{b.h}</h3>
                  <div className="space-y-3 text-[15px] leading-relaxed text-[#3f4453] md:text-base">
                    {b.paras.map((p, j) => (
                      <p key={j}><Html html={p} /></p>
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
            <SectionHead title={c.better.h2} />
            <p className="mb-8 max-w-3xl text-lg leading-relaxed text-[#3f4453]">{c.better.lead}</p>
            <ul className="mb-8 space-y-3">
              {c.better.items.map((it, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-[#3f4453]">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4f7bff]" />
                  {it}
                </li>
              ))}
            </ul>
            <p className="max-w-3xl rounded-2xl bg-[#f5f6fb] p-6 text-[15px] font-medium leading-relaxed text-[#1a1a1a] ring-1 ring-black/[0.05]">
              {c.better.kicker}
            </p>
          </div>
        </section>

        {/* ── Comparison table ── */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHead title={c.compare.h2} />
            <div className="overflow-x-auto rounded-2xl ring-1 ring-black/[0.08]">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[#f5f6fb]">
                    {c.compare.cols.map((h, j) => (
                      <th key={j} className={`px-4 py-3 font-bold text-[#1a1a1a] ${j === 2 ? "text-[#4f7bff]" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.compare.rows.map((row, ri) => (
                    <tr key={ri} className="border-t border-black/[0.06] align-top">
                      <td className="px-4 py-3 font-semibold text-[#1a1a1a]">{row.label}</td>
                      <td className="px-4 py-3 text-[#3f4453]">{row.submagic}</td>
                      <td className="bg-[#4f7bff]/[0.04] px-4 py-3 font-medium text-[#1a1a1a]">{row.duupflow}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-[#8a8a8a]">{c.compare.note}</p>
          </div>
        </section>

        {/* ── Who it's for ── */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-3xl">
            <SectionHead title={c.who.h2} />
            <div className="space-y-5 text-lg leading-relaxed text-[#3f4453]">
              {c.who.paras.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHead title={c.pricing.h2} />
            <div className="grid gap-5 md:grid-cols-3">
              {c.pricing.plans.map((p, i) => (
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
            <p className="mt-8 text-[15px] leading-relaxed text-[#3f4453]">{c.pricing.note}</p>
            <div className="mt-6">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 text-[15px] font-semibold text-[#4f7bff] transition hover:opacity-80"
              >
                {c.pricing.cta}
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ── FAQ (accordion; answers stay in the HTML when collapsed) ── */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-3xl">
            <SectionHead title={c.faq.h2} />
            <div className="divide-y divide-black/[0.08] border-y border-black/[0.08]">
              {c.faq.items.map((item, i) => (
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
            <h2 className="text-3xl font-extrabold tracking-tight text-[#1a1a1a] md:text-4xl">{c.final.h2}</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-[#3f4453]">{c.final.p}</p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <PrimaryCta href="/register" big>
                {c.final.cta}
              </PrimaryCta>
              <span className="text-sm text-[#8a8a8a]">{price.from}</span>
            </div>

            {/* Internal links */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-black/[0.07] pt-8 text-sm">
              <span className="text-[#8a8a8a]">{c.seeAlso.label}{lang === "fr" ? " :" : ":"}</span>
              {c.seeAlso.links.map((l, i) => (
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

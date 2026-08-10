// src/components/marketing/CapcutAlternativePage.tsx
//
// Permanent, fully bilingual SEO landing page: "CapCut Alternative".
// Lives at a top-level route (/fr/capcut-alternative, /en/capcut-alternative),
// NOT under /blog/. Both locales share ONE slug and are self-canonical, linked
// via hreflang (see CANONICAL). The surrounding chrome (NavPill + Footer + the
// light "lunera" theme) comes from the sibling layout.tsx — this component
// renders the page body only.
//
// Structured for machine extraction: single H1, strict H2/H3 hierarchy, a
// comparison table, an FAQ authored as real search queries whose answers stay
// in the HTML even when the <details> accordion is collapsed, and
// SoftwareApplication + FAQPage + BreadcrumbList JSON-LD.
//
// Prices are the pricing source of truth (Starter 19€ / Solo 39€ / Pro 99€,
// see src/lib/plans.ts + pricing/page.tsx) and shown in € across all locales.

import Link from "@/components/LocaleLink";

export type Lang = "fr" | "en";

export const SLUG = "capcut-alternative";

export const CANONICAL: Record<Lang, string> = {
  fr: `/fr/${SLUG}`,
  en: `/en/${SLUG}`,
};

export const META: Record<Lang, { title: string; description: string }> = {
  fr: {
    title: "Alternative à CapCut : laisse l'IA monter tes vidéos short-form | DuupFlow",
    description:
      "CapCut est gratuit, mais il te coûte deux heures par vidéo. DuupFlow monte tes rushes automatiquement — coupes, sous-titres, zooms, incrustations. Tu décris, l'IA monte.",
  },
  en: {
    title: "CapCut Alternative: Let AI Edit Your Short-Form Videos | DuupFlow",
    description:
      "CapCut is free, but it costs you two hours per video. DuupFlow edits your raw footage automatically — cuts, captions, zooms, inserts. You describe it, the AI edits it.",
  },
};

// Pricing source of truth: src/lib/plans.ts (quotas) + pricing/page.tsx (display).
const PRICE_STARTER = "19€";
const PRICE_SOLO = "39€";
const PRICE_PRO = "99€";

/* ─────────────────────────── Content ─────────────────────────── */

type Content = {
  crumb: string;
  hero: {
    kicker: string;
    h1: string;
    sub: string;
    cta: string;
    subCta: string;
  };
  why: {
    h2: string;
    lead: string;
    reasons: { h: string; p: string }[];
  };
  removes: {
    h2: string;
    lead: string;
    stepsTitle: string;
    steps: { h: string; p: string }[];
  };
  can: {
    h2: string;
    items: { h: string; p: string }[];
  };
  volume: {
    h2: string;
    paras: string[];
  };
  better: {
    h2: string;
    lead: string;
    items: string[];
    kicker: string;
  };
  compare: {
    h2: string;
    cols: string[]; // ["", "CapCut", "DuupFlow"]
    rows: { label: string; capcut: string; duupflow: string }[];
  };
  who: {
    h2: string;
    paras: string[];
  };
  pricing: {
    h2: string;
    plans: { name: string; price: string; for: string; highlight?: boolean }[];
    note: string;
    cta: string;
  };
  faq: {
    h2: string;
    items: { q: string; a: string }[];
  };
  final: {
    h2: string;
    p: string;
    cta: string;
  };
  seeAlso: {
    label: string;
    links: { href: string; text: string }[];
  };
};

const C: Record<Lang, Content> = {
  en: {
    crumb: "CapCut alternative",
    hero: {
      kicker: "CapCut alternative",
      h1: "The CapCut alternative for people who don't have time to edit",
      sub: "CapCut doesn't cost you money. It costs you your evenings. DuupFlow takes your raw footage — face cam, screen recordings, screenshots — and returns the finished video. You describe the edit, the AI builds it.",
      cta: "Edit my first video",
      subCta: `From ${PRICE_STARTER}/month`,
    },
    why: {
      h2: "Why you're looking for a CapCut alternative",
      lead: "You're not here because CapCut is bad. It's very good. You're here for one of four reasons.",
      reasons: [
        {
          h: "Time",
          p: "A clean short-form video — tight cuts, synced captions, zooms, screenshots dropped in at the right moment — takes one to two hours on the timeline. Multiply that by five videos a week. That's a part-time job.",
        },
        {
          h: "A paywall that keeps moving",
          p: "Features that used to be free have shifted behind a subscription: auto-captions, certain effects, watermark-free export, the advanced AI tools. The classic scenario is finishing your project, hitting export, and discovering the effect you used now requires an upgrade.",
        },
        {
          h: "Pricing you can't read",
          p: "Standard sits at 11,99 €/month (109,99 €/year). Pro changes depending on your region and on whether you subscribe through the App Store or the website — the store version costs noticeably more, because the app stores take their cut.",
        },
        {
          h: "Repetition",
          p: "You rebuild the exact same edit every single time. Same structure, same caption style, same zooms. The work is 90 % identical and you redo it by hand on every video.",
        },
      ],
    },
    removes: {
      h2: "DuupFlow doesn't replace CapCut. It removes the step.",
      lead: "CapCut is a manual editor: you place every cut, every text layer, every effect. Every other CapCut alternative is also a manual editor. You change the interface, not the workload. DuupFlow works differently. You upload your footage and describe what you want. The AI does the edit.",
      stepsTitle: "How it works",
      steps: [
        {
          h: "Drop in your footage",
          p: "Face cam, screen recordings, screenshots, product visuals, voiceover. Raw material, not an edit.",
        },
        {
          h: "Describe the edit",
          p: "The way you'd brief an editor. \"Cut all the dead air, word-by-word captions in white with a thick black outline, drop in the dashboard screenshot when I say 'dashboard', zoom on my face at the punchline.\"",
        },
        {
          h: "Get the finished video",
          p: "Cuts, pacing, animated captions, synced inserts, zooms, split-screen, audio ducking. Ready to post.",
        },
        {
          h: "Adjust in one sentence",
          p: "\"Zoom's too slow, move the captions lower.\" No going back into a timeline.",
        },
      ],
    },
    can: {
      h2: "What the AI editor can do",
      items: [
        { h: "Automatic cutting", p: "dead air removed, pacing tightened" },
        { h: "Word-by-word animated captions", p: "style, position, color, outline" },
        {
          h: "Word-synced inserts",
          p: "a screenshot, a product shot, an interface capture appears on the exact word you say it",
        },
        { h: "Animated zoom and reframing", p: "scale and position inside the frame" },
        { h: "Speed control", p: "slow motion, speed ramps, freeze frames" },
        { h: "Split-screen and picture-in-picture", p: "two media on screen at once" },
        { h: "Effects", p: "selective blur, flash, glitch, beat-synced shake" },
        { h: "Audio ducking", p: "music drops automatically under your voice" },
      ],
    },
    volume: {
      h2: "The thing CapCut can't give you: volume",
      paras: [
        "When an edit works, you want to run it again. In CapCut, duplicating a project and swapping the hook means rebuilding the edit by hand every time.",
        "In DuupFlow, a winning creative gets multiplied. You keep the structure, swap the hook, the opening line, the first shot — and export ten versions of the same video. Each one technically unique, ready to go out across multiple accounts or platforms.",
        "That's where the real gap sits. Plenty of tools can edit fast. Almost none can edit fast and multiply.",
        "DuupFlow is built end to end for exactly that: shipping volume, quickly, without the output degrading. A creative edited in the morning can be live in ten versions by the afternoon.",
      ],
    },
    better: {
      h2: "What CapCut does better than DuupFlow",
      lead: "Worth being straight about, otherwise this page is worthless.",
      items: [
        "CapCut is free at the base tier, and it's one of the strongest free editors on the market.",
        "CapCut gives you frame-level control. If you need a transition to land on three specific frames, do it in CapCut.",
        "CapCut has a massive library of templates, sounds, effects and fonts.",
        "CapCut runs on mobile. You can edit on the train.",
      ],
      kicker:
        "If your problem is making one perfect video, stay on CapCut. If your problem is making ten solid videos a week without losing your evenings, that's where DuupFlow comes in.",
    },
    compare: {
      h2: "Comparison",
      cols: ["", "CapCut", "DuupFlow"],
      rows: [
        { label: "Type", capcut: "Manual editor", duupflow: "Full AI editor" },
        { label: "Time per video", capcut: "1–2 hrs", duupflow: "Minutes" },
        { label: "You place the cuts", capcut: "Yes, all of them", duupflow: "No" },
        {
          label: "Word-synced inserts",
          capcut: "Manual",
          duupflow: "Your own visuals, on the word",
        },
        {
          label: "Variants of the same video",
          capcut: "Manual duplication",
          duupflow: "Automatic",
        },
        { label: "Learning curve", capcut: "Real", duupflow: "You just describe it" },
        { label: "Mobile", capcut: "Yes", duupflow: "No" },
        {
          label: "Price",
          capcut: "Free / 11,99 € / Pro varies",
          duupflow: "19–99 €/month",
        },
      ],
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
        { name: "Starter", price: `${PRICE_STARTER}/month`, for: "Testing it out, a few videos a month" },
        { name: "Solo", price: `${PRICE_SOLO}/month`, for: "Posting consistently", highlight: true },
        { name: "Pro", price: `${PRICE_PRO}/month`, for: "Volume and multiple accounts" },
      ],
      note: "A freelance editor charges between 40 € and 150 € per short-form video. Starter costs less than a single one.",
      cta: "See full pricing",
    },
    faq: {
      h2: "FAQ",
      items: [
        {
          q: "Is CapCut actually free?",
          a: "The base version is. But several features — auto-captions, some effects, watermark-free export, the advanced AI tools — have moved behind the Standard or Pro tiers over successive updates. You usually find out at export.",
        },
        {
          q: "How much does CapCut Pro cost?",
          a: "It depends where you buy it. The same subscription costs noticeably more through the App Store than directly on CapCut's website, because the app stores take a commission. Pricing also varies by region.",
        },
        {
          q: "What's the best CapCut alternative on desktop?",
          a: "For manual editing: DaVinci Resolve (free, powerful, demanding) or Clipchamp. For not editing at all: DuupFlow, which runs in the browser.",
        },
        {
          q: "How do I remove the CapCut watermark?",
          a: "You need a paid plan, or you avoid the templates and effects marked Pro. DuupFlow adds no watermark, including on the 19 € plan.",
        },
        {
          q: "Can I keep my own editing style?",
          a: "Yes. You describe your style once — font, colors, pacing, zoom behavior — and reuse it. That's the point: the style stays consistent across videos without you rebuilding it each time.",
        },
        {
          q: "Does it generate AI video?",
          a: "No, and that distinction matters. DuupFlow doesn't produce synthetic footage. It edits your material: your face, your voice, your screen recordings.",
        },
        {
          q: "Which formats does it handle?",
          a: "Vertical short-form: TikTok, Reels, Shorts. Face cam, faceless, screen recording, or all three combined.",
        },
        {
          q: "Can I go back to CapCut if I don't like it?",
          a: "Yes. You export the video and take it wherever you want. Nothing is locked in.",
        },
      ],
    },
    final: {
      h2: "Editing isn't your job.",
      p: "Every hour on a timeline is an hour you're not selling.",
      cta: "Edit my first video",
    },
    seeAlso: {
      label: "See also",
      links: [
        { href: "/submagic-alternative", text: "Submagic alternative" },
        { href: "/", text: "Repost across multiple accounts" },
        { href: "/pricing", text: "Pricing" },
      ],
    },
  },

  fr: {
    crumb: "Alternative à CapCut",
    hero: {
      kicker: "Alternative à CapCut",
      h1: "L'alternative à CapCut pour ceux qui n'ont pas le temps de monter",
      sub: "CapCut ne te coûte pas d'argent. Il te coûte tes soirées. DuupFlow prend tes rushes — face cam, captures d'écran, screenshots — et te rend la vidéo finie. Tu décris le montage, l'IA le construit.",
      cta: "Monter ma première vidéo",
      subCta: `À partir de ${PRICE_STARTER}/mois`,
    },
    why: {
      h2: "Pourquoi tu cherches une alternative à CapCut",
      lead: "Tu n'es pas là parce que CapCut est mauvais. Il est très bon. Tu es là pour l'une de ces quatre raisons.",
      reasons: [
        {
          h: "Le temps",
          p: "Une vidéo short-form propre — coupes serrées, sous-titres synchronisés, zooms, screenshots posés au bon moment — prend une à deux heures sur la timeline. Multiplie par cinq vidéos par semaine. C'est un mi-temps.",
        },
        {
          h: "Un paywall qui n'arrête pas de bouger",
          p: "Des fonctions autrefois gratuites sont passées derrière un abonnement : sous-titres auto, certains effets, export sans watermark, les outils IA avancés. Le scénario classique : tu finis ton projet, tu cliques sur export, et tu découvres que l'effet que tu as utilisé demande maintenant une mise à niveau.",
        },
        {
          h: "Des tarifs illisibles",
          p: "Le Standard est à 11,99 €/mois (109,99 €/an). Le Pro change selon ta région et selon que tu t'abonnes via l'App Store ou le site — la version store coûte nettement plus cher, parce que les stores prennent leur commission.",
        },
        {
          h: "La répétition",
          p: "Tu refais exactement le même montage à chaque fois. Même structure, même style de sous-titres, mêmes zooms. Le travail est identique à 90 % et tu le refais à la main sur chaque vidéo.",
        },
      ],
    },
    removes: {
      h2: "DuupFlow ne remplace pas CapCut. Il supprime l'étape.",
      lead: "CapCut est un éditeur manuel : tu places chaque coupe, chaque calque de texte, chaque effet. Toutes les autres alternatives à CapCut sont aussi des éditeurs manuels. Tu changes d'interface, pas de charge de travail. DuupFlow fonctionne autrement. Tu uploades tes rushes et tu décris ce que tu veux. L'IA fait le montage.",
      stepsTitle: "Comment ça marche",
      steps: [
        {
          h: "Dépose tes rushes",
          p: "Face cam, captures d'écran, screenshots, visuels produit, voix off. De la matière brute, pas un montage.",
        },
        {
          h: "Décris le montage",
          p: "Comme tu briefferais un monteur. « Coupe tous les blancs, sous-titres mot à mot en blanc avec un gros contour noir, incruste le screenshot du dashboard quand je dis \"dashboard\", zoom sur mon visage à la punchline. »",
        },
        {
          h: "Récupère la vidéo finie",
          p: "Coupes, rythme, sous-titres animés, incrustations synchronisées, zooms, split-screen, ducking audio. Prête à publier.",
        },
        {
          h: "Ajuste en une phrase",
          p: "« Le zoom est trop lent, descends les sous-titres. » Sans jamais rouvrir une timeline.",
        },
      ],
    },
    can: {
      h2: "Ce que l'éditeur IA sait faire",
      items: [
        { h: "Découpage automatique", p: "blancs supprimés, rythme resserré" },
        { h: "Sous-titres animés mot à mot", p: "style, position, couleur, contour" },
        {
          h: "Incrustations synchronisées au mot",
          p: "un screenshot, un plan produit, une capture d'interface apparaît sur le mot exact où tu le prononces",
        },
        { h: "Zoom animé et recadrage", p: "échelle et position dans l'image" },
        { h: "Contrôle de la vitesse", p: "ralenti, accélérés, freeze frames" },
        { h: "Split-screen et incrustation", p: "deux médias à l'écran en même temps" },
        { h: "Effets", p: "flou de zone, flash, glitch, shake calé sur les beats" },
        { h: "Ducking audio", p: "la musique baisse automatiquement sous ta voix" },
      ],
    },
    volume: {
      h2: "Ce que CapCut ne peut pas te donner : le volume",
      paras: [
        "Quand un montage marche, tu veux le relancer. Dans CapCut, dupliquer un projet et changer le hook, ça veut dire refaire le montage à la main à chaque fois.",
        "Dans DuupFlow, une créa qui marche se multiplie. Tu gardes la structure, tu changes le hook, la première phrase, le premier plan — et tu exportes dix versions de la même vidéo. Chacune techniquement unique, prête à sortir sur plusieurs comptes ou plusieurs plateformes.",
        "C'est là qu'est le vrai écart. Plein d'outils savent monter vite. Presque aucun ne sait monter vite et multiplier.",
        "DuupFlow est pensé de bout en bout pour exactement ça : sortir du volume, vite, sans que le rendu se dégrade. Une créa montée le matin peut être en ligne en dix versions l'après-midi.",
      ],
    },
    better: {
      h2: "Ce que CapCut fait mieux que DuupFlow",
      lead: "Autant être honnête, sinon cette page ne vaut rien.",
      items: [
        "CapCut est gratuit sur son offre de base, et c'est l'un des éditeurs gratuits les plus solides du marché.",
        "CapCut te donne un contrôle à la frame près. Si tu as besoin qu'une transition tombe sur trois frames précises, fais-le dans CapCut.",
        "CapCut a une bibliothèque immense de templates, sons, effets et polices.",
        "CapCut tourne sur mobile. Tu peux monter dans le train.",
      ],
      kicker:
        "Si ton problème c'est de faire une vidéo parfaite, reste sur CapCut. Si ton problème c'est de faire dix vidéos solides par semaine sans y laisser tes soirées, c'est là que DuupFlow entre en jeu.",
    },
    compare: {
      h2: "Comparatif",
      cols: ["", "CapCut", "DuupFlow"],
      rows: [
        { label: "Type", capcut: "Éditeur manuel", duupflow: "Éditeur IA complet" },
        { label: "Temps par vidéo", capcut: "1–2 h", duupflow: "Quelques minutes" },
        { label: "Tu places les coupes", capcut: "Oui, toutes", duupflow: "Non" },
        {
          label: "Incrustations synchro au mot",
          capcut: "À la main",
          duupflow: "Tes propres visuels, sur le mot",
        },
        {
          label: "Variantes d'une même vidéo",
          capcut: "Duplication manuelle",
          duupflow: "Automatique",
        },
        { label: "Courbe d'apprentissage", capcut: "Réelle", duupflow: "Tu décris, c'est tout" },
        { label: "Mobile", capcut: "Oui", duupflow: "Non" },
        {
          label: "Prix",
          capcut: "Gratuit / 11,99 € / Pro variable",
          duupflow: "19–99 €/mois",
        },
      ],
    },
    who: {
      h2: "Pour qui",
      paras: [
        "Pour les gens qui produisent du contenu short-form pour les réseaux, qui veulent un rendu digne d'un monteur pro, et qui n'ont pas le temps de passer leurs journées sur une timeline.",
        "C'est l'arbitrage que personne ne t'a proposé jusqu'ici. Les éditeurs manuels te donnent la qualité en échange de ton temps. Les outils rapides te donnent le temps en échange de la qualité. DuupFlow est fait pour tenir les deux : le rythme et le rendu.",
      ],
    },
    pricing: {
      h2: "Tarifs",
      plans: [
        { name: "Starter", price: `${PRICE_STARTER}/mois`, for: "Pour tester, quelques vidéos par mois" },
        { name: "Solo", price: `${PRICE_SOLO}/mois`, for: "Pour publier régulièrement", highlight: true },
        { name: "Pro", price: `${PRICE_PRO}/mois`, for: "Volume et comptes multiples" },
      ],
      note: "Un monteur freelance facture entre 40 € et 150 € la vidéo short-form. Le Starter coûte moins qu'une seule.",
      cta: "Voir tous les tarifs",
    },
    faq: {
      h2: "FAQ",
      items: [
        {
          q: "CapCut est-il vraiment gratuit ?",
          a: "La version de base l'est. Mais plusieurs fonctions — sous-titres auto, certains effets, export sans watermark, les outils IA avancés — sont passées derrière les offres Standard ou Pro au fil des mises à jour. En général, tu t'en rends compte au moment de l'export.",
        },
        {
          q: "Combien coûte CapCut Pro ?",
          a: "Ça dépend d'où tu l'achètes. Le même abonnement coûte nettement plus cher via l'App Store que directement sur le site de CapCut, parce que les stores prennent une commission. Le prix varie aussi selon la région.",
        },
        {
          q: "Quelle est la meilleure alternative à CapCut sur ordinateur ?",
          a: "Pour du montage manuel : DaVinci Resolve (gratuit, puissant, exigeant) ou Clipchamp. Pour ne pas monter du tout : DuupFlow, qui tourne dans le navigateur.",
        },
        {
          q: "Comment enlever le watermark de CapCut ?",
          a: "Il te faut un plan payant, ou tu évites les templates et effets marqués Pro. DuupFlow n'ajoute aucun watermark, y compris sur le plan à 19 €.",
        },
        {
          q: "Puis-je garder mon propre style de montage ?",
          a: "Oui. Tu décris ton style une fois — police, couleurs, rythme, comportement des zooms — et tu le réutilises. C'est tout l'intérêt : le style reste cohérent d'une vidéo à l'autre sans que tu aies à le refaire à chaque fois.",
        },
        {
          q: "Est-ce que ça génère de la vidéo IA ?",
          a: "Non, et la distinction compte. DuupFlow ne produit pas d'images synthétiques. Il monte ta matière : ton visage, ta voix, tes captures d'écran.",
        },
        {
          q: "Quels formats gère-t-il ?",
          a: "Le short-form vertical : TikTok, Reels, Shorts. Face cam, faceless, capture d'écran, ou les trois combinés.",
        },
        {
          q: "Puis-je revenir à CapCut si ça ne me plaît pas ?",
          a: "Oui. Tu exportes la vidéo et tu l'emmènes où tu veux. Rien n'est verrouillé.",
        },
      ],
    },
    final: {
      h2: "Monter, ce n'est pas ton métier.",
      p: "Chaque heure sur une timeline est une heure où tu ne vends pas.",
      cta: "Monter ma première vidéo",
    },
    seeAlso: {
      label: "À voir aussi",
      links: [
        { href: "/submagic-alternative", text: "Alternative à Submagic" },
        { href: "/", text: "Republier sur plusieurs comptes" },
        { href: "/pricing", text: "Tarifs" },
      ],
    },
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

function SectionHead({ kicker, title }: { kicker?: string; title: string }) {
  return (
    <div className="mb-8">
      {kicker && (
        <div className="mb-4">
          <Kicker>{kicker}</Kicker>
        </div>
      )}
      <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight text-[#1a1a1a]">{title}</h2>
    </div>
  );
}

/* ─────────────────────────── Page ─────────────────────────── */

export default function CapcutAlternativePage({ lang }: { lang: Lang }) {
  const isFr = lang === "fr";
  const c = C[lang];
  const m = META[lang];
  const base = "https://www.duupflow.com";

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "DuupFlow",
    applicationCategory: "MultimediaApplication",
    applicationSubCategory: isFr ? "Éditeur vidéo IA" : "AI video editor",
    operatingSystem: "Web",
    url: `${base}${CANONICAL[lang]}`,
    inLanguage: isFr ? "fr-FR" : "en-US",
    description: m.description,
    featureList: isFr
      ? [
          "Montage depuis rushes bruts",
          "Découpage automatique",
          "Sous-titres animés mot à mot",
          "Incrustations synchronisées au mot",
          "Zoom et recadrage animés",
          "Variantes multiples d'une même vidéo",
        ]
      : [
          "Edit from raw footage",
          "Automatic cutting",
          "Word-by-word animated captions",
          "Word-synced inserts",
          "Animated zoom and reframing",
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
      { "@type": "ListItem", position: 1, name: "DuupFlow", item: `${base}/${lang}` },
      { "@type": "ListItem", position: 2, name: c.crumb, item: `${base}${CANONICAL[lang]}` },
    ],
  };

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
              <Kicker>{c.hero.kicker}</Kicker>
            </div>
            <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              {c.hero.h1}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#3f4453] md:text-xl">
              {c.hero.sub}
            </p>
            <div className="mt-9 flex flex-col items-center gap-3">
              <PrimaryCta href="/register" big>
                {c.hero.cta}
              </PrimaryCta>
              <span className="text-sm text-[#8a8a8a]">{c.hero.subCta}</span>
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
          </div>
        </section>

        {/* ── Removes the step + How it works ── */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHead title={c.removes.h2} />
            <p className="mb-12 max-w-3xl text-lg leading-relaxed text-[#3f4453]">{c.removes.lead}</p>

            <h3 className="mb-6 text-xl font-bold text-[#1a1a1a]">{c.removes.stepsTitle}</h3>
            <ol className="grid gap-5 md:grid-cols-2">
              {c.removes.steps.map((s, i) => (
                <li key={i} className="flex gap-4 rounded-2xl border border-black/[0.06] p-6">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ background: CTA_GRAD }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h4 className="mb-1.5 font-bold text-[#1a1a1a]">{s.h}</h4>
                    <p className="text-[15px] leading-relaxed text-[#3f4453]">{s.p}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── What the AI editor can do ── */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHead title={c.can.h2} />
            <div className="grid gap-4 sm:grid-cols-2">
              {c.can.items.map((it, i) => (
                <div key={i} className="flex gap-3 rounded-xl bg-[#f5f6fb] p-5 ring-1 ring-black/[0.04]">
                  <span
                    aria-hidden
                    className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: CTA_GRAD }}
                  >
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M4 10l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <p className="text-[15px] leading-relaxed text-[#3f4453]">
                    <strong className="text-[#1a1a1a]">{it.h}</strong> — {it.p}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Volume ── */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <div className="rounded-3xl px-7 py-12 text-white md:px-12" style={{ background: CTA_GRAD }}>
              <h2 className="max-w-3xl text-2xl font-extrabold tracking-tight md:text-4xl">{c.volume.h2}</h2>
              <div className="mt-6 max-w-3xl space-y-4 text-[15px] leading-relaxed text-white/90 md:text-base">
                {c.volume.paras.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── What CapCut does better ── */}
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
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[#f5f6fb]">
                    {c.compare.cols.map((h, j) => (
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
                  {c.compare.rows.map((row, ri) => (
                    <tr key={ri} className="border-t border-black/[0.06] align-top">
                      <td className="px-4 py-3 font-semibold text-[#1a1a1a]">{row.label}</td>
                      <td className="px-4 py-3 text-[#3f4453]">{row.capcut}</td>
                      <td className="bg-[#4f7bff]/[0.04] px-4 py-3 font-medium text-[#1a1a1a]">{row.duupflow}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              <span className="text-sm text-[#8a8a8a]">{isFr ? `À partir de ${PRICE_STARTER}/mois` : `From ${PRICE_STARTER}/month`}</span>
            </div>

            {/* Internal links */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-black/[0.07] pt-8 text-sm">
              <span className="text-[#8a8a8a]">{c.seeAlso.label} :</span>
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

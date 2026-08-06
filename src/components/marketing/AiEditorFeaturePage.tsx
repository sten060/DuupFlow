// src/components/marketing/AiEditorFeaturePage.tsx
//
// Permanent, fully bilingual BLOG article for the DuupFlow AI Editor.
// It lives in the blog (/fr/blog/editeur-video-ia, /en/blog/ai-video-editor),
// so the surrounding chrome (nav + footer + light "lunera" theme) comes from
// blog/layout.tsx — this component renders the article body only.
//
// NOT a dated changelog — no date in the title / URL / body. The only date is
// the "last updated" line at the bottom (UPDATED_AT); the only "new" signal is
// an isolated, one-flag badge (SHOW_NEW_BADGE).
//
// Editorial angle: the AI editor is powered by Claude. Roles are split like a
// kitchen — DuupFlow gives the tools, you bring the ingredients (your footage),
// and Claude is the chef who cooks the edit. Speak of "Claude" directly, not a
// generic "AI".
//
// Two thin route folders import this and pass `lang`. Each locale is
// self-canonical and cross-linked via hreflang (see CANONICAL). Structured for
// machine extraction: single H1, a self-contained definition as the first body
// sentence, a comparison table, an FAQ authored as real search queries, and
// SoftwareApplication + FAQPage JSON-LD. Prices come from the pricing source of
// truth (Solo 39€ / Pro 99€).

import Link from "@/components/LocaleLink";
import FeatureTOC, { type TocSection } from "./FeatureTOC";

export type Lang = "fr" | "en";

export const SLUG_FR = "editeur-video-ia";
export const SLUG_EN = "ai-video-editor";
export const UPDATED_AT = "2026-08-06";

// Flip to false to remove the "Nouveau" / "New" pill. Nothing else depends on it.
const SHOW_NEW_BADGE = true;

// Pricing source of truth: src/lib/plans.ts (quotas) + pricing/page.tsx (display).
const PRICE_SOLO = "39€";
const PRICE_PRO = "99€";

export const CANONICAL: Record<Lang, string> = {
  fr: `/fr/blog/${SLUG_FR}`,
  en: `/en/blog/${SLUG_EN}`,
};

export const META: Record<Lang, { title: string; description: string; h1: string }> = {
  fr: {
    title: "Éditeur vidéo IA propulsé par Claude : monter des vidéos depuis tes rushes | DuupFlow",
    description:
      "L'éditeur IA de DuupFlow confie le montage à Claude : tu fournis tes rushes, DuupFlow lui donne les outils, Claude assemble la vidéo et en génère autant de variantes que tu veux. Inclus dans les plans Solo (39€) et Pro (99€).",
    h1: "L'éditeur vidéo IA de DuupFlow, propulsé par Claude",
  },
  en: {
    title: "AI Video Editor powered by Claude: edit videos from raw footage | DuupFlow",
    description:
      "DuupFlow's AI editor hands the editing to Claude: you bring your footage, DuupFlow gives Claude the tools, and Claude assembles the video and generates as many variations as you want. Included in the Solo (39€) and Pro (99€) plans.",
    h1: "The DuupFlow AI Video Editor, powered by Claude",
  },
};

const UI = {
  fr: {
    badge: "Nouveau",
    tag: "Éditeur IA",
    crumb: "Éditeur IA propulsé par Claude",
    toc: "Sommaire",
    ctaTop: "Créer un compte",
    ctaBottom: "Essayer l'éditeur IA",
    faqTitle: "Questions fréquentes",
    updated: "Dernière mise à jour",
    back: "← Retour au blog",
    read: "min de lecture",
  },
  en: {
    badge: "New",
    tag: "AI Editor",
    crumb: "AI Editor powered by Claude",
    toc: "Contents",
    ctaTop: "Create an account",
    ctaBottom: "Try the AI editor",
    faqTitle: "Frequently asked questions",
    updated: "Last updated",
    back: "← Back to blog",
    read: "min read",
  },
} satisfies Record<Lang, Record<string, string>>;

const READING = { fr: 6, en: 6 } as const;

const SECTIONS: Record<Lang, TocSection[]> = {
  fr: [
    { id: "roles", label: "Qui fait quoi : DuupFlow, toi, Claude" },
    { id: "probleme", label: "Le problème" },
    { id: "fonctionnement", label: "Comment ça marche" },
    { id: "capacites", label: "Ce que Claude sait faire" },
    { id: "comparaison", label: "Découpage IA classique vs Claude × DuupFlow" },
    { id: "variantes", label: "Les variantes infinies" },
    { id: "limites", label: "Ce que ça ne fait pas" },
    { id: "tarifs", label: "Tarifs" },
    { id: "faq", label: "Questions fréquentes" },
  ],
  en: [
    { id: "roles", label: "Who does what: DuupFlow, you, Claude" },
    { id: "probleme", label: "The problem" },
    { id: "fonctionnement", label: "How it works" },
    { id: "capacites", label: "What Claude can do" },
    { id: "comparaison", label: "Classic AI clipping vs Claude × DuupFlow" },
    { id: "variantes", label: "Infinite variations" },
    { id: "limites", label: "What it doesn't do" },
    { id: "tarifs", label: "Pricing" },
    { id: "faq", label: "Frequently asked questions" },
  ],
};

const FAQ: Record<Lang, { q: string; a: string }[]> = {
  fr: [
    {
      q: "Peut-on monter une vidéo automatiquement à partir de rushes bruts ?",
      a: "Oui. Claude, via l'éditeur IA de DuupFlow, travaille directement sur des rushes non montés, contrairement aux outils de repurposing qui exigent une vidéo longue déjà finalisée. Tu uploades ta matière brute, DuupFlow la décrit, et Claude construit le montage.",
    },
    {
      q: "Quel modèle d'IA monte les vidéos dans DuupFlow ?",
      a: "C'est Claude, le modèle d'Anthropic. DuupFlow lui fournit les outils de montage et ta matière analysée ; Claude prend les décisions créatives — sélection des plans, rythme, sous-titres, effets — et assemble la vidéo.",
    },
    {
      q: "Comment générer plusieurs versions différentes d'une même vidéo ?",
      a: "Tu relances la génération sur la même matière. Claude repart de zéro sur la sélection des plans, le rythme et les effets, et donne un montage réellement distinct. Tu peux en sortir 10, 30 ou 50 sans repasser dans un logiciel de montage.",
    },
    {
      q: "Faut-il savoir monter pour utiliser l'éditeur IA ?",
      a: "Non. Tu décris le résultat voulu en langage naturel et Claude fait le montage. Tu restes le cerveau créatif, Claude est le monteur.",
    },
    {
      q: "Quels formats de sortie sont supportés ?",
      a: "Claude exporte en MP4 (vidéo H.264, audio AAC), prêt à publier sur TikTok, Instagram et YouTube. Trois ratios sont disponibles : vertical 9:16 (1080×1920, par défaut), carré 1:1 (1080×1080) et paysage 16:9 (1920×1080).",
    },
    {
      q: "L'éditeur IA est-il inclus dans tous les plans ?",
      a: `Non. L'éditeur IA propulsé par Claude est inclus dans les plans Solo (${PRICE_SOLO}/mois) et Pro (${PRICE_PRO}/mois), pas dans le plan gratuit. Les rendus sont décomptés de ton quota vidéos : 300 par mois en Solo, illimité en Pro.`,
    },
  ],
  en: [
    {
      q: "Can you automatically edit a video from raw footage?",
      a: "Yes. Claude, through DuupFlow's AI editor, works directly on unedited footage, unlike repurposing tools that require a finished long-form video. You upload your raw material, DuupFlow describes it, and Claude builds the edit.",
    },
    {
      q: "Which AI model edits the videos in DuupFlow?",
      a: "It's Claude, Anthropic's model. DuupFlow gives it the editing tools and your analyzed material; Claude makes the creative decisions — shot selection, pacing, captions, effects — and assembles the video.",
    },
    {
      q: "How do you generate multiple different versions of the same video?",
      a: "You re-run the generation on the same footage. Claude starts over on shot selection, pacing and effects, producing a genuinely distinct edit. You can output 10, 30 or 50 versions without ever opening an editing app.",
    },
    {
      q: "Do you need editing skills to use the AI editor?",
      a: "No. You describe the result you want in plain language and Claude does the editing. You stay the creative brain; Claude is the editor.",
    },
    {
      q: "What output formats are supported?",
      a: "Claude exports MP4 (H.264 video, AAC audio), ready to publish on TikTok, Instagram and YouTube. Three ratios are available: vertical 9:16 (1080×1920, default), square 1:1 (1080×1080) and landscape 16:9 (1920×1080).",
    },
    {
      q: "Is the AI editor included in every plan?",
      a: `No. The Claude-powered AI editor is included in the Solo (${PRICE_SOLO}/mo) and Pro (${PRICE_PRO}/mo) plans, not in the free plan. Renders count against your video quota: 300 per month on Solo, unlimited on Pro.`,
    },
  ],
};

type Block =
  | { t: "lead"; html: string }
  | { t: "p"; html: string }
  | { t: "h2"; id: string; html: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "table"; head: string[]; rows: string[][] };

const BODY: Record<Lang, Block[]> = {
  fr: [
    {
      t: "lead",
      html: "L'éditeur IA de DuupFlow est un agent de montage vidéo propulsé par Claude : tu fournis tes rushes, DuupFlow donne à Claude les outils de montage, et Claude assemble la vidéo à ta place, puis en génère autant de variantes différentes que tu demandes.",
    },

    { t: "h2", id: "roles", html: "Qui fait quoi : DuupFlow, toi, Claude" },
    {
      t: "p",
      html: "Le partage des rôles est simple, comme dans une cuisine :",
    },
    {
      t: "ul",
      items: [
        "<strong>DuupFlow, c'est la cuisine et les ustensiles.</strong> Il analyse ta matière, extrait le style de ta référence et met à disposition les outils de montage (coupes, sous-titres, effets, recadrage, audio) et le moteur de rendu.",
        "<strong>Toi, tu apportes les ingrédients.</strong> Tes rushes, une vidéo de référence, et une consigne en langage naturel.",
        "<strong>Claude, c'est le chef.</strong> Il prend les décisions de montage et cuisine la vidéo avec les outils de DuupFlow.",
      ],
    },

    { t: "h2", id: "probleme", html: "Le problème" },
    {
      t: "p",
      html: "Les outils de montage IA existants prennent une vidéo longue et la découpent en clips. Ils ne montent pas. Tu récupères des extraits bruts avec des sous-titres par-dessus, toujours le même rendu, et tu dois repasser derrière dans CapCut.",
    },
    {
      t: "p",
      html: "L'éditeur IA de DuupFlow fait l'inverse : il part de ta matière brute et Claude construit le montage.",
    },

    { t: "h2", id: "fonctionnement", html: "Comment ça marche" },
    {
      t: "ol",
      items: [
        "<strong>Tu uploades ta matière.</strong> Rushes vidéo, images, audio. DuupFlow les analyse et les décrit automatiquement pour que Claude sache ce qu'il y a dans chaque plan.",
        "<strong>Tu donnes une vidéo de référence.</strong> DuupFlow en extrait le style et le transmet à Claude : rythme de coupe, position et animation des sous-titres, effets, colorimétrie, calage sur les beats.",
        "<strong>Tu discutes avec Claude.</strong> Tu lui dis ce que tu veux, il assemble et rend la vidéo avec les outils de DuupFlow.",
      ],
    },

    { t: "h2", id: "capacites", html: "Ce que Claude sait faire avec les outils de DuupFlow" },
    {
      t: "ul",
      items: [
        "<strong>Coupes et rythme :</strong> calage des transitions sur les beats de l'audio.",
        "<strong>Sous-titres animés</strong> mot à mot, avec contrôle du style, de la position et des emojis.",
        "<strong>Vitesse :</strong> ralenti, accéléré, freeze frame.",
        "<strong>Recadrage dans l'image :</strong> zoom et déplacement pour recentrer l'action.",
        "<strong>Composition multi-média :</strong> split-screen, incrustation, superposition de plusieurs sources.",
        "<strong>Effets :</strong> zoom animé, flash blanc, shake sur beat, flou de zone, glitch / RGB split.",
        "<strong>Audio :</strong> ducking automatique de la musique sous la voix.",
      ],
    },

    { t: "h2", id: "comparaison", html: "Découpage IA classique vs éditeur Claude × DuupFlow" },
    {
      t: "p",
      html: "La différence tient en une phrase : les outils classiques découpent une vidéo déjà montée, tandis que Claude, dans DuupFlow, monte à partir de rushes bruts.",
    },
    {
      t: "table",
      head: ["", "Input", "Contrôle du montage", "Nombre de versions", "Retouche possible"],
      rows: [
        [
          "Outils de découpage IA classiques",
          "Une vidéo longue déjà montée",
          "Aucun : découpe automatique, rendu figé",
          "Des extraits d'une même vidéo, tous similaires",
          "Non : tu repasses dans CapCut",
        ],
        [
          "Éditeur IA DuupFlow (piloté par Claude)",
          "Tes rushes bruts (vidéo, images, audio)",
          "Total : tu diriges Claude en langage naturel",
          "Autant de variantes réellement distinctes que tu veux",
          "Oui : tu demandes le changement, Claude l'applique",
        ],
      ],
    },

    { t: "h2", id: "variantes", html: "Les variantes infinies" },
    {
      t: "p",
      html: "Une fois une vidéo montée, tu relances. Claude repart de la même matière et produit un montage différent : autres plans sélectionnés, autre rythme, autres accroches, autres effets.",
    },
    {
      t: "p",
      html: "Tu peux sortir 10, 30 ou 50 versions d'un même contenu, toutes réellement distinctes, sans repasser une seule fois dans un logiciel de montage. Tu testes des hooks en volume, tu alimentes plusieurs comptes, tu couvres plusieurs plateformes.",
    },
    {
      t: "p",
      html: "Et tu peux modifier une variante existante sans tout refaire : tu demandes le changement, Claude applique la modification.",
    },

    { t: "h2", id: "limites", html: "Ce que ça ne fait pas" },
    {
      t: "ul",
      items: [
        "<strong>Ça ne génère pas de vidéo synthétique.</strong> Tout part de tes propres rushes.",
        "<strong>Ça ne remplace pas ton écriture.</strong> Tu restes le cerveau, Claude est le monteur.",
      ],
    },

    { t: "h2", id: "tarifs", html: "Tarifs" },
    {
      t: "p",
      html: `L'éditeur IA propulsé par Claude est inclus dans les deux plans payants de DuupFlow. Le plan <strong>Solo</strong> est à <strong>${PRICE_SOLO}/mois</strong> (300 rendus vidéo par mois) et le plan <strong>Pro</strong> à <strong>${PRICE_PRO}/mois</strong> (rendus illimités, presets avancés, 3 membres, clés API). Le plan gratuit ne comprend pas l'éditeur IA.`,
    },
  ],
  en: [
    {
      t: "lead",
      html: "The DuupFlow AI editor is a video-editing agent powered by Claude: you bring your footage, DuupFlow gives Claude the editing tools, and Claude assembles the video for you — then generates as many distinct variations as you ask for.",
    },

    { t: "h2", id: "roles", html: "Who does what: DuupFlow, you, Claude" },
    {
      t: "p",
      html: "The split of roles is simple, like a kitchen:",
    },
    {
      t: "ul",
      items: [
        "<strong>DuupFlow is the kitchen and the utensils.</strong> It analyzes your material, extracts the style from your reference and provides the editing tools (cuts, captions, effects, reframing, audio) and the render engine.",
        "<strong>You bring the ingredients.</strong> Your footage, a reference video, and a prompt in plain language.",
        "<strong>Claude is the chef.</strong> It makes the editing decisions and cooks the video with DuupFlow's tools.",
      ],
    },

    { t: "h2", id: "probleme", html: "The problem" },
    {
      t: "p",
      html: "Existing AI editing tools take a long video and slice it into clips. They don't edit. You get raw excerpts with captions slapped on top, always the same look, and you have to finish the job in CapCut.",
    },
    {
      t: "p",
      html: "The DuupFlow AI editor does the opposite: it starts from your raw footage and Claude builds the edit.",
    },

    { t: "h2", id: "fonctionnement", html: "How it works" },
    {
      t: "ol",
      items: [
        "<strong>You upload your material.</strong> Video footage, images, audio. DuupFlow analyzes and describes it automatically so Claude knows what's in every shot.",
        "<strong>You hand it a reference video.</strong> DuupFlow extracts its style and passes it to Claude: cut pace, caption position and animation, effects, color grade, beat syncing.",
        "<strong>You chat with Claude.</strong> You tell it what you want, it assembles and renders the video with DuupFlow's tools.",
      ],
    },

    { t: "h2", id: "capacites", html: "What Claude can do with DuupFlow's tools" },
    {
      t: "ul",
      items: [
        "<strong>Cuts and pacing:</strong> transitions synced to the beats of the audio.",
        "<strong>Animated captions,</strong> word by word, with control over style, position and emojis.",
        "<strong>Speed:</strong> slow motion, speed ramps, freeze frames.",
        "<strong>In-frame reframing:</strong> zoom and pan to re-center the action.",
        "<strong>Multi-source composition:</strong> split-screen, picture-in-picture, layering several sources.",
        "<strong>Effects:</strong> animated zoom, white flash, beat shake, area blur, glitch / RGB split.",
        "<strong>Audio:</strong> automatic music ducking under the voice.",
      ],
    },

    { t: "h2", id: "comparaison", html: "Classic AI clipping vs the Claude × DuupFlow editor" },
    {
      t: "p",
      html: "The difference is one sentence: classic tools chop up an already-edited video, while Claude, inside DuupFlow, edits from raw footage.",
    },
    {
      t: "table",
      head: ["", "Input", "Edit control", "Number of versions", "Editable afterward"],
      rows: [
        [
          "Classic AI clipping tools",
          "One long, already-edited video",
          "None: automatic slicing, fixed look",
          "Excerpts of the same video, all alike",
          "No: you finish it in CapCut",
        ],
        [
          "DuupFlow AI editor (driven by Claude)",
          "Your raw footage (video, images, audio)",
          "Full: you direct Claude in plain language",
          "As many genuinely distinct variations as you want",
          "Yes: you ask for the change, Claude applies it",
        ],
      ],
    },

    { t: "h2", id: "variantes", html: "Infinite variations" },
    {
      t: "p",
      html: "Once a video is edited, you re-run it. Claude starts over from the same footage and produces a different edit: other shots selected, different pacing, different hooks, different effects.",
    },
    {
      t: "p",
      html: "You can output 10, 30 or 50 versions of the same content, all genuinely distinct, without ever touching an editing app. You test hooks at volume, feed multiple accounts, cover multiple platforms.",
    },
    {
      t: "p",
      html: "And you can tweak an existing variation without redoing everything: you ask for the change, Claude applies it.",
    },

    { t: "h2", id: "limites", html: "What it doesn't do" },
    {
      t: "ul",
      items: [
        "<strong>It doesn't generate synthetic video.</strong> Everything starts from your own footage.",
        "<strong>It doesn't replace your writing.</strong> You stay the brain, Claude is the editor.",
      ],
    },

    { t: "h2", id: "tarifs", html: "Pricing" },
    {
      t: "p",
      html: `The Claude-powered AI editor is included in both of DuupFlow's paid plans. The <strong>Solo</strong> plan is <strong>${PRICE_SOLO}/mo</strong> (300 video renders per month) and the <strong>Pro</strong> plan is <strong>${PRICE_PRO}/mo</strong> (unlimited renders, advanced presets, 3 members, API keys). The free plan does not include the AI editor.`,
    },
  ],
};

function renderBlock(b: Block, i: number) {
  switch (b.t) {
    case "lead":
      return (
        <p key={i} className="text-lg md:text-xl text-[#1a1a1a] leading-relaxed" dangerouslySetInnerHTML={{ __html: b.html }} />
      );
    case "p":
      return <p key={i} dangerouslySetInnerHTML={{ __html: b.html }} />;
    case "h2":
      return (
        <h2 key={i} id={b.id} className="scroll-mt-28 pt-6 text-2xl md:text-3xl font-bold tracking-tight text-[#1a1a1a]" dangerouslySetInnerHTML={{ __html: b.html }} />
      );
    case "ul":
      return (
        <ul key={i} className="list-disc list-outside space-y-2 pl-6 marker:text-[#4f7bff]/70">
          {b.items.map((it, j) => (
            <li key={j} dangerouslySetInnerHTML={{ __html: it }} />
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={i} className="list-decimal list-outside space-y-2 pl-6 marker:text-[#4f7bff]/70 marker:font-semibold">
          {b.items.map((it, j) => (
            <li key={j} dangerouslySetInnerHTML={{ __html: it }} />
          ))}
        </ol>
      );
    case "table":
      return (
        <div key={i} className="my-2 overflow-x-auto rounded-2xl ring-1 ring-black/[0.08]">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#f5f6fb]">
                {b.head.map((h, j) => (
                  <th key={j} className="px-4 py-3 font-semibold text-[#1a1a1a]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, ri) => (
                <tr key={ri} className="border-t border-black/[0.06] align-top">
                  {row.map((cell, ci) => (
                    <td key={ci} className={`px-4 py-3 ${ci === 0 ? "font-semibold text-[#1a1a1a]" : "text-[#3f4453]"}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export default function AiEditorFeaturePage({ lang }: { lang: Lang }) {
  const isFr = lang === "fr";
  const m = META[lang];
  const ui = UI[lang];

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: isFr ? "DuupFlow — Éditeur IA (propulsé par Claude)" : "DuupFlow AI Video Editor (powered by Claude)",
    applicationCategory: "MultimediaApplication",
    applicationSubCategory: isFr ? "Éditeur vidéo IA" : "AI video editor",
    operatingSystem: "Web",
    url: `https://www.duupflow.com${CANONICAL[lang]}`,
    inLanguage: isFr ? "fr-FR" : "en-US",
    description: m.description,
    featureList: isFr
      ? ["Montage depuis rushes bruts", "Piloté par Claude", "Variantes multiples", "Sous-titres animés", "Export 9:16 / 1:1 / 16:9"]
      : ["Edit from raw footage", "Powered by Claude", "Multiple variations", "Animated captions", "9:16 / 1:1 / 16:9 export"],
    offers: [
      { "@type": "Offer", name: "Solo", price: "39", priceCurrency: "EUR" },
      { "@type": "Offer", name: "Pro", price: "99", priceCurrency: "EUR" },
    ],
    publisher: {
      "@type": "Organization",
      name: "DuupFlow",
      logo: { "@type": "ImageObject", url: "https://www.duupflow.com/logo-mark.png" },
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ[lang].map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const updatedLabel = new Date(UPDATED_AT).toLocaleDateString(isFr ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <main className="px-6 py-12 md:py-16">
        <div className="max-w-6xl mx-auto grid grid-cols-12 gap-10 lg:gap-14">
          <article className="col-span-12 lg:col-span-8 [&_h2]:scroll-mt-28 [&_h3]:scroll-mt-28">
            <nav className="text-xs text-[#8a8a8a] mb-6" aria-label="Breadcrumb">
              <Link href="/blog" className="hover:text-[#3f4453] transition">Blog</Link>
              <span className="mx-2 text-[#8a8a8a]">/</span>
              <span className="text-[#3f4453]">{ui.crumb}</span>
            </nav>

            <header className="mb-10">
              {/* Lockup co-brandé DuupFlow × Claude */}
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2.5 rounded-full bg-white px-4 py-2 ring-1 ring-black/[0.08] shadow-[0_8px_24px_rgba(20,40,90,0.06)]">
                  <img src="/logo-mark.png" alt="" className="h-5 w-5 object-contain" />
                  <span className="text-[13px] font-semibold text-[#1a1a1a]">DuupFlow</span>
                  <span className="text-[15px] leading-none text-[#c0c4cc]">×</span>
                  <img src="/claude-color.svg" alt="Claude" className="h-5 w-5" />
                  <span className="text-[13px] font-semibold text-[#1a1a1a]">Claude</span>
                </span>
                {SHOW_NEW_BADGE && (
                  <span className="rounded-full bg-[#4f7bff]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#4f7bff]">
                    {ui.badge}
                  </span>
                )}
              </div>

              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">{m.h1}</h1>

              <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-wider text-[#8a8a8a]">
                <span>{ui.tag}</span>
                <span className="text-[#8a8a8a]">•</span>
                <span>{READING[lang]} {ui.read}</span>
              </div>

              <div className="mt-6">
                <Link
                  href="/register"
                  className="btn-glow inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-[#1a1a1a]"
                >
                  {ui.ctaTop}
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </header>

            <div className="space-y-6 text-[15px] md:text-base leading-relaxed text-[#1a1a1a]">
              {BODY[lang].map(renderBlock)}
            </div>

            <section className="mt-16 pt-10 border-t border-black/10">
              <h2 id="faq" className="scroll-mt-28 text-2xl md:text-3xl font-bold tracking-tight text-[#1a1a1a] mb-6">
                {ui.faqTitle}
              </h2>
              <div className="space-y-6">
                {FAQ[lang].map((item, i) => (
                  <div key={i}>
                    <h3 className="text-base md:text-lg font-semibold text-[#1a1a1a] mb-2">{item.q}</h3>
                    <p className="text-sm md:text-[15px] text-[#3f4453] leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-14 rounded-2xl bg-[#f5f6fb] ring-1 ring-black/[0.06] px-6 py-8 text-center">
              <div className="mb-4 flex items-center justify-center gap-2">
                <img src="/logo-mark.png" alt="" className="h-6 w-6 object-contain" />
                <span className="text-[15px] leading-none text-[#c0c4cc]">×</span>
                <img src="/claude-color.svg" alt="Claude" className="h-6 w-6" />
              </div>
              <Link
                href="/register"
                className="btn-glow inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold text-[#1a1a1a]"
              >
                {ui.ctaBottom}
                <span aria-hidden>→</span>
              </Link>
            </div>

            <div className="mt-10 pt-6 border-t border-black/10 flex flex-wrap items-center justify-between gap-3">
              <Link href="/blog" className="text-sm text-[#3f4453] hover:text-[#1a1a1a] transition">
                {ui.back}
              </Link>
              <p className="text-xs text-[#8a8a8a]">
                {ui.updated} : <time dateTime={UPDATED_AT}>{updatedLabel}</time>
              </p>
            </div>
          </article>

          <aside className="hidden lg:block lg:col-span-4">
            <div className="sticky top-28">
              <FeatureTOC sections={SECTIONS[lang]} label={ui.toc} />
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

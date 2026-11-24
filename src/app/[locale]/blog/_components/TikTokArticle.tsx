// Shared bilingual renderer for the TikTok "ineligible for recommendation"
// article. Two thin route folders (one per language slug) import this and pass
// `lang`. Same layout as the other articles (12-col grid, sticky ArticleTOC,
// FAQ, JSON-LD).
//
// Réécrit en novembre 2026 (texte EN fourni par Sten, FR traduit à partir de
// cette version). Les adresses ne changent pas. Le corps est décrit en blocs
// (BODY) : un seul rendu pour les deux langues, et la table des matières est
// déduite des H2.

import Link from "@/components/LocaleLink";
import CtaCallout from "@/components/marketing/CtaCallout";
import ArticleTOC, { type TocSection } from "./ArticleTOC";
import YouTubeLazy from "./YouTubeLazy";

export type Lang = "fr" | "en";

export const SLUG_FR = "tiktok-ineligible-recommandations";
export const SLUG_EN = "tiktok-ineligible-for-recommendation";
export const PUBLISHED_AT = "2026-06-21";
/** Date de la dernière mise à jour du contenu (données structurées + sitemap). */
export const UPDATED_AT = "2026-11-24";
export const READING_MIN = 7;

export const CANONICAL: Record<Lang, string> = {
  fr: `/fr/blog/${SLUG_FR}`,
  en: `/blog/${SLUG_EN}`,
};

export const META: Record<Lang, { title: string; description: string }> = {
  en: {
    title: "TikTok “Ineligible for Recommendation”: What It Means and How to Fix It (2026)",
    description:
      "What “ineligible for recommendation” means on TikTok, the 3 reasons it happens, how long it lasts, and a step-by-step fix — including how to repost content without getting flagged again.",
  },
  fr: {
    title: "TikTok « inéligible aux recommandations » : ce que ça veut dire et comment régler le problème (2026)",
    description:
      "Ce que veut dire « inéligible aux recommandations » sur TikTok, les 3 raisons, combien de temps ça dure, et la solution étape par étape — y compris pour reposter ton contenu sans te refaire flag.",
  },
};

const IMG_SRC = "/SEO-page/tiktok-ineligibility-notice.png";
const VIDEO_ID = "HMGMmpnEUSk";
const CTA_HREF = "/register?utm_source=blog&utm_medium=organic&utm_campaign=tiktok_ineligible";

/* ─────────────────────────── Content ─────────────────────────── */

type Block =
  | { t: "p"; html: string }
  | { t: "h2"; id: string; text: string }
  | { t: "h3"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "cta"; text: string; button: string }
  | { t: "video" }
  | { t: "img" }
  | { t: "links"; items: { href: string; text: string }[] };

type FaqItem = { q: string; a: string };

type Copy = {
  breadcrumb: string;
  h1: string;
  updated: string;
  metaTag: string;
  readLabel: string;
  videoIntro: string;
  videoTitle: string;
  videoDesc: string;
  videoAlt: string;
  imgAlt: string;
  imgCaption: string;
  body: Block[];
  faqTitle: string;
  faq: FaqItem[];
  finalCta: { text: string; button: string };
  back: string;
};

const C: Record<Lang, Copy> = {
  en: {
    breadcrumb: "TikTok: ineligible for recommendation",
    h1: "TikTok “Ineligible for Recommendation”: What It Means and How to Fix It",
    updated: "Last updated: November 2026",
    metaTag: "TikTok algorithm",
    readLabel: "min read",
    videoIntro: "Prefer the video version? We break it all down here 👇",
    videoTitle: "Why your TikTok is “ineligible for recommendation” — and how to fix it",
    videoDesc:
      "Video explainer: what TikTok's “ineligible for recommendation” means, why it happens, and how to get your content back in the For You feed.",
    videoAlt: "Video thumbnail: why your TikTok is “ineligible for recommendation” and how to fix it",
    imgAlt: "TikTok ineligible-for-recommendation notice stating unoriginal, low-quality, and QR code content",
    imgCaption: "TikTok's own notice: “Unoriginal, low-quality, and QR code content”.",
    body: [
      {
        t: "p",
        html: "<strong>Short answer:</strong> “Ineligible for recommendation” means TikTok has removed your video from the For You feed. The video is not deleted and your followers can still see it, but TikTok stops pushing it to new viewers, which is why views drop to almost nothing. It usually happens for one of three reasons: the content is seen as <strong>unoriginal</strong> (reposted or already published elsewhere), it is <strong>low quality</strong>, or it contains a <strong>watermark or QR code</strong>. The fix depends on the cause, and for reposted content, it means making each version genuinely different, not just a new file.",
      },
      { t: "video" },

      { t: "h2", id: "meaning", text: "What “ineligible for recommendation” actually means" },
      { t: "p", html: "When a video is marked ineligible, TikTok shows a notice on that video. Three things are true at the same time:" },
      {
        t: "ul",
        items: [
          "<strong>The video stays on your profile.</strong> Nothing is deleted, and it is not a ban.",
          "<strong>Your followers can still see it.</strong> They can find it on your profile and sometimes in their Following feed.",
          "<strong>It no longer goes to the For You feed.</strong> This is where almost all views come from, so reach collapses.",
        ],
      },
      { t: "p", html: "In practice, it is a reach limit on that one video. But if it keeps happening, the whole account can slow down." },
      { t: "img" },

      { t: "h2", id: "reasons", text: "Why your TikTok says “ineligible for recommendation”: the 3 reasons" },
      { t: "h3", text: "1. Unoriginal content" },
      {
        t: "p",
        html: "This is the most common reason, especially for creators and agencies that post on several accounts. TikTok flags content it recognizes as already published, on your account or anywhere else: reposts, the same clip on several accounts, or videos taken from other creators without real changes.",
      },
      {
        t: "cta",
        text: "Posting the same videos on several accounts? DuupFlow turns one video into many versions that are different for the platforms, in a few minutes.",
        button: "Try DuupFlow",
      },
      { t: "h3", text: "2. Low quality" },
      {
        t: "p",
        html: "Blurry, pixelated or heavily compressed videos, very short clips with no substance, or content that is mostly a static image can be judged too low quality to recommend.",
      },
      { t: "h3", text: "3. Watermarks and QR codes" },
      {
        t: "p",
        html: "A visible logo from another app (another editing tool or another platform) or a QR code on screen is a classic trigger. TikTok reads it as content made for, or taken from, somewhere else.",
      },

      { t: "h2", id: "metadata", text: "Why changing the metadata alone isn’t enough anymore" },
      {
        t: "p",
        html: "For a long time, reposting worked by changing the file: new metadata (device, date), a new encoding, a tiny crop or a bit of grain. Each upload looked like a new file.",
      },
      {
        t: "p",
        html: "That still matters, and every copy should be a new file. But <strong>on its own, it is no longer enough on TikTok</strong>. The platform also looks at what is on screen: the images, the text, the subtitles, the sound. Two files that are technically different but show exactly the same thing can still be matched as the same video.",
      },
      { t: "p", html: "So the reliable approach today combines two layers:" },
      {
        t: "ol",
        items: [
          "<strong>A new file</strong>: new metadata, re-encoding, a unique fingerprint.",
          "<strong>Visible differences</strong>: a different caption, a different text style, different subtitles, a slightly different framing or speed.",
        ],
      },

      { t: "h2", id: "appeal", text: "Why appealing rarely solves the problem" },
      {
        t: "p",
        html: "You can appeal an ineligible video, and sometimes it gets restored. But an appeal fixes one video, not the cause. If you keep reposting the same content the same way, the next video gets flagged too. Appeal when you are sure the video is original. Otherwise, fix the content.",
      },

      { t: "h2", id: "fix", text: "How to fix “ineligible for recommendation”, step by step" },
      {
        t: "ol",
        items: [
          "<strong>Identify the reason.</strong> Open the notice on the affected video and check which of the three causes applies.",
          "<strong>Remove watermarks and QR codes.</strong> Re-export the video from the original file, without logos from other apps.",
          "<strong>Fix quality issues.</strong> Upload the best version you have, at full resolution, without compressing it again.",
          "<strong>For unoriginal content: don’t repost the same video.</strong> Create a version that is really different: new caption or hook, different text style and subtitles, slightly different framing. Ideally, start from your raw footage.",
          "<strong>Delete or archive the flagged video</strong>, then post the new version. Don’t post the same version again.",
          "<strong>Let the account breathe.</strong> Post content you know is original for a few days, and avoid publishing several near-identical videos in a row.",
          "<strong>If you post on several accounts, give each account its own version.</strong> Never the same file, and ideally not the same visuals either.",
        ],
      },

      { t: "h2", id: "repost", text: "How to repost your content without getting flagged again" },
      {
        t: "p",
        html: "If you run several accounts, or if your best videos deserve a second life, you need a repeatable process, not one-off edits. This is exactly what <strong>DuupFlow</strong> is built for:",
      },
      {
        t: "ul",
        items: [
          "<strong>Duplication</strong>: each copy is a brand-new file, with new metadata, re-encoding, invisible micro-variations and a unique fingerprint, while keeping the original quality (1080p stays 1080p, 4K stays 4K).",
          "<strong>AI duplication, Variations mode</strong>: the AI creates up to 50 versions of one video that look different: it rewrites the on-screen caption, changes its style, the framing, the subtitles, the speed and the colours. You can guide it with your own instructions.",
          "<strong>Captions and subtitles that change on every copy</strong>: add your text and automatic subtitles, and let each copy get a different combination of fonts, colours and subtitle styles.",
          "<strong>Comparator</strong>: check that your copies are really unique before posting.",
          "<strong>Scraper</strong>: find the best-performing videos of any TikTok or Instagram account, and send them straight to duplication.",
        ],
      },
      {
        t: "p",
        html: "No method is “undetectable forever”: platforms keep evolving. But combining a new file with visible variations is the most reliable way to repost today.",
      },
      {
        t: "cta",
        text: "Give every account its own version of your best videos. DuupFlow creates new files and visible variations in one click.",
        button: "Create your account",
      },

      { t: "h2", id: "related", text: "Related guides" },
      {
        t: "links",
        items: [
          { href: "/blog/instagram-contenus-non-originaux", text: "Instagram’s unoriginal content rule: what changes in 2026" },
          { href: "/blog/reposter-meme-video-plusieurs-comptes-tiktok-instagram", text: "How to repost the same video across multiple TikTok and Instagram accounts" },
          { href: "/blog/agence-onlyfans-reels-instagram-plusieurs-comptes", text: "How OnlyFans agencies scale reels across multiple accounts" },
        ],
      },
    ],
    faqTitle: "FAQ",
    faq: [
      {
        q: "What does “ineligible for recommendation” mean on TikTok?",
        a: "It means the video has been removed from the For You feed. It stays on your profile and your followers can still see it, but TikTok no longer shows it to new viewers.",
      },
      {
        q: "Why does my TikTok say “ineligible for recommendation”?",
        a: "Usually because the video is seen as unoriginal (already published or reposted), low quality, or because it contains a watermark or a QR code.",
      },
      {
        q: "How do I know if my video is ineligible?",
        a: "TikTok shows a notice on the affected video. A sudden drop to almost no views on one video is also a strong sign.",
      },
      {
        q: "How long does “ineligible for recommendation” last?",
        a: "It applies to that specific video. In most cases, the video stays limited unless an appeal succeeds. The best move is to fix the cause and post a new, different version.",
      },
      {
        q: "Does “ineligible for recommendation” go away?",
        a: "Sometimes, if you appeal and TikTok agrees. But it won’t stop new flags if the same type of content keeps being posted.",
      },
      {
        q: "Why did my TikTok views suddenly drop to almost zero?",
        a: "If one video is affected, it has probably been marked ineligible for the For You feed. If all your videos drop, the account itself may be limited, often after several flagged videos in a row.",
      },
      {
        q: "Does reposting content get flagged on TikTok?",
        a: "Reposting the exact same video often does. Each repost needs to be a new file and, ideally, visibly different (caption, text style, subtitles, framing).",
      },
    ],
    finalCta: { text: "Stop losing reach on your best videos.", button: "Try DuupFlow" },
    back: "← Back to the blog",
  },

  fr: {
    breadcrumb: "TikTok : inéligible aux recommandations",
    h1: "TikTok « inéligible aux recommandations » : ce que ça veut dire et comment régler le problème",
    updated: "Mis à jour : novembre 2026",
    metaTag: "Algorithme TikTok",
    readLabel: "min de lecture",
    videoIntro: "Tu préfères la version vidéo ? On t'explique tout ici 👇",
    videoTitle: "Pourquoi ton TikTok est « inéligible aux recommandations » — et comment régler le problème",
    videoDesc:
      "Explication vidéo : ce que veut dire l'inéligibilité aux recommandations TikTok, pourquoi elle arrive, et comment remettre ton contenu dans le For You.",
    videoAlt: "Miniature de la vidéo : pourquoi ton TikTok est « inéligible aux recommandations » et comment régler le problème",
    imgAlt: "Notice TikTok d'inéligibilité aux recommandations indiquant un contenu non original, de mauvaise qualité ou avec QR code",
    imgCaption: "La notice affichée par TikTok : « Unoriginal, low-quality, and QR code content » (contenu non original, de mauvaise qualité ou avec QR code).",
    body: [
      {
        t: "p",
        html: "<strong>Réponse courte :</strong> « Inéligible aux recommandations » veut dire que TikTok a retiré ta vidéo du fil For You. La vidéo n'est pas supprimée et tes abonnés peuvent encore la voir, mais TikTok arrête de la montrer à de nouvelles personnes : c'est pour ça que les vues tombent presque à zéro. Ça arrive en général pour l'une de ces trois raisons : le contenu est vu comme <strong>non original</strong> (reposté ou déjà publié ailleurs), il est de <strong>mauvaise qualité</strong>, ou il contient un <strong>filigrane ou un QR code</strong>. La solution dépend de la cause. Pour du contenu reposté, il faut rendre chaque version vraiment différente, pas seulement en faire un nouveau fichier.",
      },
      { t: "video" },

      { t: "h2", id: "meaning", text: "Ce que veut vraiment dire « inéligible aux recommandations »" },
      { t: "p", html: "Quand une vidéo est marquée inéligible, TikTok affiche une notice sur cette vidéo. Trois choses sont vraies en même temps :" },
      {
        t: "ul",
        items: [
          "<strong>La vidéo reste sur ton profil.</strong> Rien n'est supprimé, et ce n'est pas un ban.",
          "<strong>Tes abonnés peuvent encore la voir.</strong> Ils la trouvent sur ton profil, et parfois dans leur fil Abonnements.",
          "<strong>Elle ne part plus dans le For You.</strong> C'est de là que viennent presque toutes les vues, donc la portée s'effondre.",
        ],
      },
      { t: "p", html: "En pratique, c'est une limite de portée sur cette seule vidéo. Mais si ça se répète, c'est tout le compte qui peut ralentir." },
      { t: "img" },

      { t: "h2", id: "reasons", text: "Pourquoi ton TikTok est « inéligible aux recommandations » : les 3 raisons" },
      { t: "h3", text: "1. Contenu non original" },
      {
        t: "p",
        html: "C'est la raison la plus fréquente, surtout pour les créateurs et les agences qui publient sur plusieurs comptes. TikTok signale le contenu qu'il reconnaît comme déjà publié, sur ton compte ou ailleurs : des reposts, le même clip sur plusieurs comptes, ou des vidéos reprises d'autres créateurs sans vraie modification.",
      },
      {
        t: "cta",
        text: "Tu publies les mêmes vidéos sur plusieurs comptes ? DuupFlow transforme une vidéo en plusieurs versions différentes pour les plateformes, en quelques minutes.",
        button: "Essayer DuupFlow",
      },
      { t: "h3", text: "2. Mauvaise qualité" },
      {
        t: "p",
        html: "Une vidéo floue, pixelisée ou très compressée, un clip très court sans contenu, ou une vidéo qui n'est presque qu'une image fixe peuvent être jugés de trop mauvaise qualité pour être recommandés.",
      },
      { t: "h3", text: "3. Filigranes et QR codes" },
      {
        t: "p",
        html: "Un logo visible d'une autre app (un autre outil de montage ou une autre plateforme) ou un QR code à l'écran est un déclencheur classique. TikTok le lit comme un contenu fait pour ailleurs, ou récupéré ailleurs.",
      },

      { t: "h2", id: "metadata", text: "Pourquoi changer les métadonnées ne suffit plus" },
      {
        t: "p",
        html: "Pendant longtemps, reposter marchait en changeant le fichier : de nouvelles métadonnées (appareil, date), un nouvel encodage, un léger recadrage ou un peu de grain. Chaque upload ressemblait à un nouveau fichier.",
      },
      {
        t: "p",
        html: "Ça compte toujours, et chaque copie doit être un nouveau fichier. Mais <strong>tout seul, ça ne suffit plus sur TikTok</strong>. La plateforme regarde aussi ce qu'il y a à l'écran : les images, le texte, les sous-titres, le son. Deux fichiers techniquement différents qui montrent exactement la même chose peuvent quand même être reconnus comme la même vidéo.",
      },
      { t: "p", html: "La méthode fiable aujourd'hui combine donc deux couches :" },
      {
        t: "ol",
        items: [
          "<strong>Un nouveau fichier</strong> : nouvelles métadonnées, réencodage, empreinte unique.",
          "<strong>Des différences visibles</strong> : une autre légende, un autre style de texte, d'autres sous-titres, un cadrage ou une vitesse légèrement différents.",
        ],
      },

      { t: "h2", id: "appeal", text: "Pourquoi faire appel règle rarement le problème" },
      {
        t: "p",
        html: "Tu peux faire appel pour une vidéo inéligible, et parfois elle est rétablie. Mais un appel règle une vidéo, pas la cause. Si tu continues à reposter le même contenu de la même façon, la vidéo suivante sera signalée aussi. Fais appel quand tu es sûr que la vidéo est originale. Sinon, corrige le contenu.",
      },

      { t: "h2", id: "fix", text: "Régler « inéligible aux recommandations », étape par étape" },
      {
        t: "ol",
        items: [
          "<strong>Identifie la raison.</strong> Ouvre la notice sur la vidéo concernée et regarde laquelle des trois causes s'applique.",
          "<strong>Retire les filigranes et les QR codes.</strong> Réexporte la vidéo depuis le fichier d'origine, sans logo d'une autre app.",
          "<strong>Corrige les problèmes de qualité.</strong> Mets en ligne la meilleure version que tu as, en pleine résolution, sans la recompresser.",
          "<strong>Pour le contenu non original : ne reposte pas la même vidéo.</strong> Crée une version vraiment différente : nouvelle légende ou nouveau hook, autre style de texte et autres sous-titres, cadrage un peu différent. L'idéal : repartir de tes rushes.",
          "<strong>Supprime ou archive la vidéo signalée</strong>, puis publie la nouvelle version. Ne republie pas la même version.",
          "<strong>Laisse respirer le compte.</strong> Publie pendant quelques jours du contenu que tu sais original, et évite d'enchaîner plusieurs vidéos presque identiques.",
          "<strong>Si tu publies sur plusieurs comptes, donne à chaque compte sa propre version.</strong> Jamais le même fichier, et idéalement pas les mêmes visuels non plus.",
        ],
      },

      { t: "h2", id: "repost", text: "Reposter ton contenu sans te refaire flag" },
      {
        t: "p",
        html: "Si tu gères plusieurs comptes, ou si tes meilleures vidéos méritent une deuxième vie, il te faut une méthode répétable, pas des retouches au cas par cas. C'est exactement ce pour quoi <strong>DuupFlow</strong> est fait :",
      },
      {
        t: "ul",
        items: [
          "<strong>Duplication</strong> : chaque copie est un fichier neuf, avec de nouvelles métadonnées, un réencodage, des micro-variations invisibles et une empreinte unique, tout en gardant la qualité d'origine (une 1080p reste en 1080p, une 4K reste en 4K).",
          "<strong>Duplication IA, mode Variations</strong> : l'IA crée jusqu'à 50 versions d'une même vidéo qui se voient différentes : elle réécrit la légende à l'écran, change son style, le cadrage, les sous-titres, la vitesse et les couleurs. Tu peux la guider avec tes propres consignes.",
          "<strong>Des textes et sous-titres qui changent à chaque copie</strong> : ajoute ton texte et des sous-titres automatiques, et laisse chaque copie prendre une combinaison différente de polices, de couleurs et de styles de sous-titres.",
          "<strong>Comparateur</strong> : vérifie que tes copies sont vraiment uniques avant de publier.",
          "<strong>Scraper</strong> : trouve les vidéos les plus performantes de n'importe quel compte TikTok ou Instagram, et envoie-les directement en duplication.",
        ],
      },
      {
        t: "p",
        html: "Aucune méthode n'est « indétectable pour toujours » : les plateformes évoluent sans arrêt. Mais combiner un nouveau fichier et des variations visibles, c'est aujourd'hui la façon la plus fiable de reposter.",
      },
      {
        t: "cta",
        text: "Donne à chaque compte sa propre version de tes meilleures vidéos. DuupFlow crée de nouveaux fichiers et des variations visibles en un clic.",
        button: "Créer mon compte",
      },

      { t: "h2", id: "related", text: "Guides liés" },
      {
        t: "links",
        items: [
          { href: "/blog/instagram-contenus-non-originaux", text: "La règle d'Instagram sur les contenus non originaux : ce qui change en 2026" },
          { href: "/blog/reposter-meme-video-plusieurs-comptes-tiktok-instagram", text: "Reposter la même vidéo sur plusieurs comptes TikTok et Instagram" },
          { href: "/blog/agence-onlyfans-reels-instagram-plusieurs-comptes", text: "Comment les agences OnlyFans font tourner leurs reels sur plusieurs comptes" },
        ],
      },
    ],
    faqTitle: "Questions fréquentes",
    faq: [
      {
        q: "Que veut dire « inéligible aux recommandations » sur TikTok ?",
        a: "Ça veut dire que la vidéo a été retirée du fil For You. Elle reste sur ton profil et tes abonnés peuvent encore la voir, mais TikTok ne la montre plus à de nouvelles personnes.",
      },
      {
        q: "Pourquoi mon TikTok est « inéligible aux recommandations » ?",
        a: "En général parce que la vidéo est vue comme non originale (déjà publiée ou repostée), de mauvaise qualité, ou parce qu'elle contient un filigrane ou un QR code.",
      },
      {
        q: "Comment savoir si ma vidéo est inéligible ?",
        a: "TikTok affiche une notice sur la vidéo concernée. Une chute brutale à presque zéro vue sur une vidéo est aussi un signe fort.",
      },
      {
        q: "Combien de temps dure « inéligible aux recommandations » ?",
        a: "Ça concerne cette vidéo précise. Dans la plupart des cas, elle reste limitée sauf si un appel aboutit. Le mieux est de corriger la cause et de publier une nouvelle version, différente.",
      },
      {
        q: "Est-ce que « inéligible aux recommandations » disparaît ?",
        a: "Parfois, si tu fais appel et que TikTok te donne raison. Mais ça n'empêchera pas de nouveaux signalements si tu continues à publier le même type de contenu.",
      },
      {
        q: "Pourquoi mes vues TikTok sont tombées presque à zéro d'un coup ?",
        a: "Si une seule vidéo est touchée, elle a probablement été marquée inéligible au For You. Si toutes tes vidéos chutent, c'est peut-être le compte lui-même qui est limité, souvent après plusieurs vidéos signalées d'affilée.",
      },
      {
        q: "Est-ce que reposter du contenu se fait flag sur TikTok ?",
        a: "Reposter exactement la même vidéo, souvent oui. Chaque repost doit être un nouveau fichier et, idéalement, se voir différent (légende, style de texte, sous-titres, cadrage).",
      },
    ],
    finalCta: { text: "Arrête de perdre de la portée sur tes meilleures vidéos.", button: "Essayer DuupFlow" },
    back: "← Retour au blog",
  },
};

/* ─────────────────────────── JSON-LD ─────────────────────────── */

function jsonLd(lang: Lang) {
  const c = C[lang];
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: c.h1,
    description: META[lang].description,
    datePublished: PUBLISHED_AT,
    dateModified: UPDATED_AT,
    inLanguage: lang === "fr" ? "fr-FR" : "en-US",
    image: `https://www.duupflow.com${IMG_SRC}`,
    author: { "@type": "Organization", name: "DuupFlow" },
    publisher: {
      "@type": "Organization",
      name: "DuupFlow",
      logo: { "@type": "ImageObject", url: "https://www.duupflow.com/logo-mark.png" },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://www.duupflow.com${CANONICAL[lang]}` },
  };
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  const video = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: c.videoTitle,
    description: c.videoDesc,
    thumbnailUrl: [`https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`],
    uploadDate: PUBLISHED_AT,
    contentUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
    publisher: {
      "@type": "Organization",
      name: "DuupFlow",
      logo: { "@type": "ImageObject", url: "https://www.duupflow.com/logo-mark.png" },
    },
  };
  return [article, faq, video];
}

/* ─────────────────────────── Page ─────────────────────────── */

const H2 = "pt-6 text-2xl md:text-3xl font-bold tracking-tight text-[#1a1a1a]";

function Html({ html }: { html: string }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function TikTokArticle({ lang }: { lang: Lang }) {
  const c = C[lang];
  const toc: TocSection[] = [
    ...c.body.filter((b): b is Extract<Block, { t: "h2" }> => b.t === "h2").map((b) => ({ id: b.id, label: b.text })),
    { id: "faq", label: c.faqTitle },
  ];
  const [articleLd, faqLd, videoLd] = jsonLd(lang);

  const renderBlock = (b: Block, i: number) => {
    switch (b.t) {
      case "p":
        return <p key={i}><Html html={b.html} /></p>;
      case "h2":
        return <h2 key={i} id={b.id} className={H2}>{b.text}</h2>;
      case "h3":
        return <h3 key={i} className="pt-2 text-xl font-bold tracking-tight text-[#1a1a1a]">{b.text}</h3>;
      case "ul":
        return (
          <ul key={i} className="list-disc list-outside space-y-2 pl-6 marker:text-[#4f7bff]/70">
            {b.items.map((li, j) => <li key={j}><Html html={li} /></li>)}
          </ul>
        );
      case "ol":
        return (
          <ol key={i} className="list-decimal list-outside space-y-2 pl-6 marker:font-semibold marker:text-[#4f7bff]">
            {b.items.map((li, j) => <li key={j}><Html html={li} /></li>)}
          </ol>
        );
      case "cta":
        return <CtaCallout key={i} className="my-8" text={b.text} button={b.button} href={CTA_HREF} />;
      case "video":
        return (
          <div key={i} className="my-8">
            <p className="mb-3 text-sm font-medium text-[#3f4453]">{c.videoIntro}</p>
            <YouTubeLazy videoId={VIDEO_ID} title={c.videoTitle} alt={c.videoAlt} />
          </div>
        );
      case "img":
        return (
          <figure key={i} className="my-8">
            <img
              src={IMG_SRC}
              alt={c.imgAlt}
              width={804}
              height={546}
              loading="lazy"
              className="w-full h-auto rounded-xl border border-black/10"
            />
            <figcaption className="mt-2 text-xs text-[#8a8a8a] text-center">{c.imgCaption}</figcaption>
          </figure>
        );
      case "links":
        return (
          <ul key={i} className="space-y-2.5">
            {b.items.map((l, j) => (
              <li key={j} className="flex gap-2">
                <span aria-hidden className="text-[#4f7bff]">→</span>
                <Link href={l.href} className="font-medium text-[#4f7bff] underline-offset-2 hover:underline">{l.text}</Link>
              </li>
            ))}
          </ul>
        );
    }
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoLd) }} />

      <main className="px-6 py-12 md:py-16">
        <div className="max-w-6xl mx-auto grid grid-cols-12 gap-10 lg:gap-14">
          <article className="col-span-12 lg:col-span-8 [&_h2]:scroll-mt-28 [&_h3]:scroll-mt-28 [&_strong]:font-semibold">
            {/* Breadcrumb */}
            <nav className="text-xs text-[#8a8a8a] mb-6" aria-label={lang === "fr" ? "Fil d'Ariane" : "Breadcrumb"}>
              <Link href="/blog" className="hover:text-[#3f4453] transition">Blog</Link>
              <span className="mx-2 text-[#8a8a8a]">/</span>
              <span className="text-[#3f4453]">{c.breadcrumb}</span>
            </nav>

            {/* Header */}
            <header className="mb-10">
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">{c.h1}</h1>
              <p className="mt-5 text-sm font-medium text-[#3f4453]">
                <time dateTime={UPDATED_AT}>{c.updated}</time>
              </p>
              <div className="mt-2 flex items-center gap-3 text-xs uppercase tracking-wider text-[#8a8a8a]">
                <span>{READING_MIN} {c.readLabel}</span>
                <span>•</span>
                <span>{c.metaTag}</span>
              </div>
            </header>

            <div className="space-y-6 text-[15px] md:text-base leading-relaxed text-[#1a1a1a] [&>p:first-child]:text-lg [&>p:first-child]:md:text-xl">
              {c.body.map(renderBlock)}
            </div>

            {/* FAQ */}
            <section className="mt-16 pt-10 border-t border-black/10">
              <h2 id="faq" className="scroll-mt-28 text-2xl md:text-3xl font-bold tracking-tight text-[#1a1a1a] mb-6">
                {c.faqTitle}
              </h2>
              <div className="space-y-6">
                {c.faq.map((item, i) => (
                  <div key={i}>
                    <h3 className="text-base md:text-lg font-semibold text-[#1a1a1a] mb-2">{item.q}</h3>
                    <p className="text-sm md:text-[15px] text-[#3f4453] leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
              <CtaCallout className="mt-12" text={c.finalCta.text} button={c.finalCta.button} href={CTA_HREF} />
            </section>

            {/* Back to index */}
            <div className="mt-12 pt-6 border-t border-black/10">
              <Link href="/blog" className="text-sm text-[#3f4453] hover:text-[#1a1a1a] transition">{c.back}</Link>
            </div>
          </article>

          {/* Sticky TOC */}
          <aside className="hidden lg:block lg:col-span-4">
            <div className="sticky top-28">
              <ArticleTOC sections={toc} />
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

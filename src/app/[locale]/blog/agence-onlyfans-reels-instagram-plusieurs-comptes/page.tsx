// src/app/[locale]/blog/agence-onlyfans-reels-instagram-plusieurs-comptes/page.tsx
//
// Fully bilingual SEO article (FR + EN both indexed). The folder holds the FR
// slug; the English address is translated in routes.ts
// (/blog/onlyfans-agency-instagram-reels-multiple-accounts). Same layout as the
// other blog articles (blocks + FAQ + sticky TOC), plus three CTA callouts.

import type { Metadata } from "next";
import { ogImageFor } from "@/lib/i18n/seo";
import { publicPath } from "@/lib/i18n/routes";
import Link from "@/components/LocaleLink";
import CtaCallout from "@/components/marketing/CtaCallout";
import ArticleTOC, { type TocSection } from "../_components/ArticleTOC";

const SLUG = "agence-onlyfans-reels-instagram-plusieurs-comptes";
const PUBLISHED_AT = "2026-11-11";
const AUTHOR = "@Sten";
// Adresse EN traduite (routes.ts) : /blog/<slug-en> ; FR : /fr/blog/<slug-fr>.
const CANONICAL_FR = publicPath("fr", `/blog/${SLUG}`);
const CANONICAL_EN = publicPath("en", `/blog/${SLUG}`);
const READING = { fr: 7, en: 6 } as const;

const SECTIONS = {
  fr: [
    { id: "probleme", label: "Le vrai problème" },
    { id: "reposter", label: "Pourquoi reposter le même reel tue ta portée" },
    { id: "etape-1", label: "Étape 1 : repérer les reels qui marchent" },
    { id: "etape-2", label: "Étape 2 : des copies uniques" },
    { id: "etape-3", label: "Étape 3 : des variantes à tester" },
    { id: "etape-4", label: "Étape 4 : un rythme fixe" },
    { id: "etape-5", label: "Étape 5 : un cycle hebdomadaire" },
    { id: "organiser", label: "Organiser modèles et VA" },
    { id: "outils", label: "Les outils" },
    { id: "erreurs", label: "Les erreurs courantes" },
    { id: "faq", label: "Questions fréquentes" },
  ],
  en: [
    { id: "probleme", label: "The real problem" },
    { id: "reposter", label: "Why reposting the same reel kills your reach" },
    { id: "etape-1", label: "Step 1: Find the reels that already work" },
    { id: "etape-2", label: "Step 2: Unique copies" },
    { id: "etape-3", label: "Step 3: Visual variants to test" },
    { id: "etape-4", label: "Step 4: A fixed rhythm" },
    { id: "etape-5", label: "Step 5: A weekly cycle" },
    { id: "organiser", label: "Organizing models and VAs" },
    { id: "outils", label: "The tools" },
    { id: "erreurs", label: "Common mistakes" },
    { id: "faq", label: "FAQ" },
  ],
} satisfies Record<"fr" | "en", TocSection[]>;

const META = {
  fr: {
    title: "Comment les agences OnlyFans font grandir leurs reels Instagram sur plusieurs comptes (2026)",
    description:
      "Le système de contenu des agences OFM pour publier des reels sur de nombreux comptes Instagram : recyclage des reels gagnants, copies uniques, variantes de hooks et un workflow hebdo qui prend moins d'une heure.",
    h1: "Comment les agences OnlyFans font grandir leurs reels Instagram sur plusieurs comptes",
  },
  en: {
    title: "How OnlyFans Agencies Scale Instagram Reels Across Multiple Accounts (2026)",
    description:
      "The content system OFM agencies use to post reels on many Instagram accounts: winning-reel recycling, unique copies, hook variants and a weekly workflow that takes under an hour.",
    h1: "How OnlyFans Agencies Scale Instagram Reels Across Multiple Accounts",
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
      images: [ogImageFor(isFr ? "fr" : "en")],
      locale: isFr ? "fr_FR" : "en_US",
      publishedTime: PUBLISHED_AT,
    },
  };
}

const FAQ = {
  fr: [
    { q: "Puis-je publier le même reel sur plusieurs comptes Instagram ?", a: "Oui, mais pas le même fichier. Un fichier identique est reconnu comme un doublon et n'obtient en général que très peu de portée. Chaque compte a besoin d'une copie techniquement unique." },
    { q: "Changer la légende ou ajouter un filtre rend-il un reel unique ?", a: "Pas de façon fiable. Instagram analyse le fichier et la vidéo elle-même, pas seulement la légende. De légères retouches laissent souvent l'empreinte assez proche pour être reconnue." },
    { q: "Combien de reels par jour une agence OFM doit-elle publier par compte ?", a: "Ça dépend de l'âge et de la santé du compte. Commence autour d'un par jour sur les nouveaux comptes, et monte jusqu'à 5 à 10 par jour sur les comptes en bonne santé qui ont déjà de la portée." },
    { q: "Combien de contenu une modèle doit-elle envoyer ?", a: "Moins que tu ne le penses. Avec le recyclage des reels gagnants et les variantes, 5 à 10 vidéos fortes par semaine peuvent alimenter un large réseau de comptes." },
    { q: "Quelle différence entre un doublon et une variante ?", a: "Un doublon paraît identique pour le spectateur, mais c'est un nouveau fichier pour la plateforme. Une variante est volontairement différente (hook, légendes) pour tester ce qui performe." },
  ],
  en: [
    { q: "Can I post the same reel on multiple Instagram accounts?", a: "Yes, but not the same file. An identical file is recognized as a duplicate and usually gets very little reach. Each account needs a technically unique copy." },
    { q: "Does changing the caption or adding a filter make a reel unique?", a: "Not reliably. Instagram analyzes the file and the video itself, not only the caption. Light edits often leave the fingerprint close enough to be matched." },
    { q: "How many reels a day should an OFM agency post per account?", a: "It depends on the account's age and health. Start around 1 a day on new accounts, and go up to 5 to 10 a day on healthy accounts that already have reach." },
    { q: "How much content does a model need to send?", a: "Less than you think. With winning-reel recycling and variants, 5 to 10 strong videos a week can feed a large network of accounts." },
    { q: "What's the difference between a duplicate and a variant?", a: "A duplicate looks identical to a viewer but is a new file for the platform. A variant looks different on purpose (hook, captions) so you can test what performs." },
  ],
};

const CTA = {
  fr: [
    { title: "Tu gères les reels de plusieurs modèles ?", text: "DuupFlow transforme une vidéo en dizaines de copies uniques et de variantes, rangées par modèle, en quelques minutes.", button: "Essayer DuupFlow" },
    { title: "C'est exactement le workflow pour lequel DuupFlow a été conçu.", text: "Récupère les meilleurs reels d'une modèle, duplique-les en copies uniques, génère des variantes de hooks et de légendes avec l'IA, et exporte tout dans le dossier Google Drive de chaque modèle.", button: "Voir comment ça marche" },
    { title: "Tire plus de reels de chaque vidéo que t'envoient tes modèles.", text: "Commence avec DuupFlow.", button: "Créer mon compte" },
  ],
  en: [
    { title: "Running reels for several models?", text: "DuupFlow turns one video into dozens of unique copies and variants, organized per model, in minutes.", button: "Try DuupFlow" },
    { title: "This is exactly the workflow DuupFlow was built for.", text: "Scrape a model's top reels, duplicate them into unique copies, generate hook and caption variants with AI, and export everything to each model's Google Drive folder.", button: "See how it works" },
    { title: "Get more reels out of every video your models send.", text: "Start with DuupFlow", button: "Create your account" },
  ],
};

type Block =
  | { t: "lead"; html: string }
  | { t: "p"; html: string }
  | { t: "h2"; id: string; html: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "callout"; n: 0 | 1 | 2 };

const LINK = 'class="text-[#4f7bff] hover:text-[#4f7bff] underline underline-offset-2"';
const IG_ARTICLE = {
  fr: publicPath("fr", "/blog/instagram-contenus-non-originaux"),
  en: publicPath("en", "/blog/instagram-contenus-non-originaux"),
};

const BODY: Record<"fr" | "en", Block[]> = {
  fr: [
    { t: "lead", html: "<strong>Réponse courte :</strong> les agences OFM ne font pas grandir Instagram en demandant plus de contenu à leurs modèles. Elles prennent les quelques reels qui performent déjà, transforment chacun en de nombreuses copies uniques et variantes visuelles, et les répartissent sur un réseau de comptes selon un cycle hebdomadaire fixe. Le goulot d'étranglement n'est jamais le montage. C'est la quantité de contenu exploitable que t'envoie une modèle, et la vitesse à laquelle tu peux la multiplier sans qu'Instagram la repère comme un doublon." },
    { t: "p", html: "Ce guide détaille le système, étape par étape." },
    { t: "callout", n: 0 },

    { t: "h2", id: "probleme", html: "Le vrai problème : pas assez de contenu, pas trop peu de montage" },
    { t: "p", html: "La plupart des agences pensent que leur problème de croissance, c'est le montage. Ce n'est pas le cas. Les VA savent monter. La vraie contrainte est en amont :" },
    { t: "ul", items: [
      "Une modèle envoie 5 à 15 vidéos par semaine, parfois moins.",
      "Chaque compte Instagram a besoin d'un à plusieurs reels par jour pour grandir.",
      "Multiplie ça par 10, 20 ou 50 comptes, et il te faut des centaines de reels par semaine.",
    ] },
    { t: "p", html: "Aucune modèle ne peut tripler sa production. Les agences qui grandissent sont donc celles qui tirent <strong>plus de reels du même contenu</strong>." },

    { t: "h2", id: "reposter", html: "Pourquoi reposter le même reel tue ta portée" },
    { t: "p", html: "La solution évidente, c'est de publier la même vidéo sur tous les comptes. Ça ne marche pas." },
    { t: "p", html: `Instagram détecte le contenu déjà publié, sur le même compte ou ailleurs. Depuis le durcissement de ses <a href="${IG_ARTICLE.fr}" ${LINK}>règles sur le contenu non original</a>, un reel reconnu comme une copie peut être déclassé ou montré à presque personne. Beaucoup d'agences voient leurs reposts bloqués autour de 0 vue alors que l'original en avait fait des milliers.` },
    { t: "p", html: "Instagram ne regarde pas seulement ce que montre la vidéo. Il regarde le fichier lui-même : les métadonnées (appareil, date, encodeur), l'encodage et une empreinte visuelle des images. Deux fichiers identiques à ce niveau sont traités comme le même contenu, quel que soit le compte qui les publie." },
    { t: "p", html: "Faire grandir ton réseau se joue donc en deux temps :" },
    { t: "ol", items: [
      "<strong>Rendre chaque fichier techniquement unique</strong>, pour que chaque publication soit traitée comme nouvelle.",
      "<strong>Rendre certaines versions visuellement différentes</strong>, pour tester ce qui performe.",
    ] },

    { t: "h2", id: "etape-1", html: "Étape 1 : repère les reels qui marchent déjà" },
    { t: "p", html: "Ne multiplie jamais du contenu au hasard. Pars de ce qui a fait ses preuves." },
    { t: "ul", items: [
      "Récupère les reels les plus performants de chaque modèle, sur tes comptes ou sur ceux de concurrents dans la même niche.",
      "Classe-les par vues et selon ce qui compte vraiment pour toi (visites de profil, clics sur le lien, abonnés).",
      "Garde les 5 à 10 meilleurs par modèle. Ce sont tes « reels sources » de la semaine.",
    ] },
    { t: "p", html: "Un reel qui a déjà performé a bien plus de chances de performer à nouveau qu'un reel tout neuf. C'est la même logique que les reels d'essai d'Instagram : tester, garder ce qui marche, le reposter." },

    { t: "h2", id: "etape-2", html: "Étape 2 : transforme chaque reel gagnant en copies uniques" },
    { t: "p", html: "Chaque reel source est dupliqué en autant de copies que tu as de comptes où le publier. Pour que chaque copie compte comme nouvelle, il lui faut :" },
    { t: "ul", items: [
      "<strong>De nouvelles métadonnées</strong> : appareil, date, encodeur et localisation réécrits.",
      "<strong>Un nouvel encodage</strong> : le fichier est réencodé, donc sa signature binaire change.",
      "<strong>Des variations visuelles invisibles</strong> : d'infimes changements de luminosité, de teinte ou de cadrage, imperceptibles pour le spectateur mais suffisants pour changer l'empreinte.",
    ] },
    { t: "p", html: "La qualité compte ici. Une copie qui paraît compressée ou floue fait baisser la rétention, et donc la portée. La résolution et le débit doivent rester ceux de l'original." },

    { t: "h2", id: "etape-3", html: "Étape 3 : crée des variantes visuelles à tester" },
    { t: "p", html: "Les copies uniques te permettent de reposter. Les variantes te permettent d'apprendre." },
    { t: "p", html: "À partir des mêmes rushes, crée des versions volontairement différentes :" },
    { t: "ul", items: [
      "Un autre <strong>hook</strong> (la première ligne de texte à l'écran).",
      "Un autre <strong>style de légende</strong> : couleur, position, taille.",
      "D'autres <strong>sous-titres</strong> ou une autre première seconde.",
    ] },
    { t: "p", html: "Publie ces variantes sur différents comptes et compare. Au bout de deux ou trois semaines, tu sais quels hooks et quels formats marchent pour chaque modèle, et tu arrêtes de deviner." },

    { t: "h2", id: "etape-4", html: "Étape 4 : publie à un rythme fixe, adapté à la santé de chaque compte" },
    { t: "p", html: "Le volume ne marche que si les comptes restent en bonne santé." },
    { t: "ul", items: [
      "Comptes nouveaux ou fragiles : commence doucement, autour d'un reel par jour.",
      "Comptes établis et en bonne santé : les agences tournent couramment à 5 à 10 reposts de reels gagnants par jour, mélangés à du contenu neuf.",
      "Surveille la portée de chaque compte. Si les vues d'un compte s'effondrent, ralentis avant de pousser à nouveau.",
    ] },
    { t: "p", html: "La règle : ne pousse jamais tous les comptes au maximum en même temps. Répartis le risque." },

    { t: "h2", id: "etape-5", html: "Étape 5 : fais-en un cycle hebdomadaire" },
    { t: "p", html: "Les agences qui grandissent traitent ça comme une chaîne de production, pas comme un exercice créatif :" },
    { t: "ol", items: [
      "<strong>Lundi</strong> : récupère les meilleurs reels de la semaine passée pour chaque modèle.",
      "<strong>Duplique-les</strong> en copies uniques, une par compte.",
      "<strong>Génère des variantes</strong> des meilleurs (nouveaux hooks, nouvelles légendes).",
      "<strong>Envoie tout</strong> dans le dossier de chaque VA, trié par modèle et par compte.",
      "<strong>Les VA programment et publient</strong> pendant la semaine.",
      "<strong>Lundi suivant</strong> : regarde ce qui a performé, et recommence.",
    ] },
    { t: "p", html: "Avec les bons outils, les étapes 1 à 4 prennent moins d'une heure par semaine, toutes modèles confondues." },
    { t: "callout", n: 1 },

    { t: "h2", id: "organiser", html: "Comment organiser le travail entre modèles et VA" },
    { t: "p", html: "Avec plusieurs modèles, le chaos vient du mélange des contenus. Reste strict :" },
    { t: "ul", items: [
      "<strong>Un espace de travail par modèle</strong> : son contenu, son brief (ton, style de légende, mots à éviter), ses dossiers.",
      "<strong>Les VA ne voient que les modèles qu'ils gèrent.</strong> Moins d'erreurs, aucun contenu publié sur le mauvais compte.",
      "<strong>Un dossier Drive par modèle et par VA</strong> : les reels terminés arrivent là où ils seront publiés.",
      "<strong>Un brief écrit par modèle</strong>, pour que chaque variante respecte son style sans que personne ait à le répéter.",
    ] },

    { t: "h2", id: "outils", html: "Les outils utilisés par les agences OFM" },
    { t: "p", html: "Une stack classique a trois briques :" },
    { t: "ul", items: [
      "<strong>Un outil de duplication</strong> pour rendre chaque fichier unique. Les « spoofers » de bureau traitent les fichiers en local sur un seul ordinateur. Les outils web permettent à toute une équipe de travailler au même endroit.",
      "<strong>Une couche de montage</strong> pour créer les variantes. Certaines agences le font à la main dans CapCut, ce qui ne tient pas au-delà de quelques reels par jour. D'autres utilisent le montage par IA pour générer les variantes automatiquement.",
      "<strong>Un circuit de fichiers</strong> (en général Google Drive) pour transmettre les reels aux VA.",
    ] },
    { t: "p", html: "<strong>DuupFlow</strong> réunit les trois dans une seule application web pensée pour les agences : la duplication (métadonnées, réencodage, variations invisibles), un éditeur IA propulsé par Claude qui crée des variantes à partir de tes rushes, un scraper pour trouver les meilleurs reels de chaque modèle, un espace de travail par modèle avec des rôles manager et VA, et l'import et l'export Google Drive. Les plans commencent à 39 €/mois, avec les fonctions d'équipe dans les plans Pro et Agence." },

    { t: "h2", id: "erreurs", html: "Les erreurs courantes" },
    { t: "ul", items: [
      "<strong>Reposter exactement le même fichier</strong> sur plusieurs comptes. C'est le moyen le plus rapide de faire 0 vue.",
      "<strong>Multiplier du contenu faible.</strong> Dix copies d'un reel qui n'a pas performé ne performeront pas non plus.",
      "<strong>Trop retravailler les vidéos</strong> jusqu'à ce qu'elles paraissent dégradées. La rétention baisse, la portée suit.",
      "<strong>Pousser tous les comptes à plein volume</strong> dès le premier jour.",
      "<strong>Ne rien tester.</strong> Sans variantes, tu n'apprends jamais quel hook marche pour quelle modèle.",
    ] },
  ],
  en: [
    { t: "lead", html: "<strong>Short answer:</strong> OFM agencies don't scale Instagram by asking their models for more content. They scale by taking the few reels that already perform, turning each one into many unique copies and visual variants, and spreading those across a network of accounts on a fixed weekly cycle. The bottleneck is never editing. It's the amount of usable content a model sends you, and how fast you can multiply it without Instagram flagging it as a duplicate." },
    { t: "p", html: "This guide breaks down the system, step by step." },
    { t: "callout", n: 0 },

    { t: "h2", id: "probleme", html: "The real problem: not enough content, not too little editing" },
    { t: "p", html: "Most agencies think their growth problem is editing. It isn't. VAs can edit. The real constraint is upstream:" },
    { t: "ul", items: [
      "A model sends 5 to 15 videos a week, sometimes less.",
      "Each Instagram account needs 1 to several reels a day to grow.",
      "Multiply that by 10, 20 or 50 accounts, and you need hundreds of reels a week.",
    ] },
    { t: "p", html: "No model can triple her output. So the agencies that grow are the ones that get <strong>more reels out of the same content</strong>." },

    { t: "h2", id: "reposter", html: "Why reposting the same reel kills your reach" },
    { t: "p", html: "The obvious fix is to post the same video on every account. It doesn't work." },
    { t: "p", html: `Instagram detects content that has already been published, on the same account or elsewhere. Since its <a href="${IG_ARTICLE.en}" ${LINK}>unoriginal content rules</a> tightened, a reel recognized as a copy can be pushed down or shown to almost no one. Many agencies see reposts stuck near 0 views while the original did thousands.` },
    { t: "p", html: "Instagram doesn't only look at what the video shows. It looks at the file itself: metadata (device, date, encoder), the encoding, and a visual fingerprint of the frames. Two files that are identical at that level are treated as the same content, whatever account posts them." },
    { t: "p", html: "So scaling has two parts:" },
    { t: "ol", items: [
      "<strong>Make every file technically unique</strong>, so each upload is treated as new.",
      "<strong>Make some versions visually different</strong>, so you can test what performs.",
    ] },

    { t: "h2", id: "etape-1", html: "Step 1: Find the reels that already work" },
    { t: "p", html: "Never multiply content at random. Start from proof." },
    { t: "ul", items: [
      "Pull the top-performing reels of each model, on your accounts or on competitors' accounts in the same niche.",
      "Rank them by views and by what you actually care about (profile visits, link clicks, subs).",
      "Keep the top 5 to 10 per model. These are your \"source reels\" for the week.",
    ] },
    { t: "p", html: "A reel that already performed has a far higher chance of performing again than a brand-new one. This is the same logic as Instagram's own trial reels: test, keep what works, repost it." },

    { t: "h2", id: "etape-2", html: "Step 2: Turn each winning reel into unique copies" },
    { t: "p", html: "Each source reel gets duplicated into as many copies as you have accounts to post it on. For each copy to count as new, it needs:" },
    { t: "ul", items: [
      "<strong>New metadata</strong>: device, date, encoder and location rewritten.",
      "<strong>A new encoding</strong>: the file is re-encoded, so its binary signature changes.",
      "<strong>Invisible visual variations</strong>: tiny changes in brightness, hue or framing, imperceptible to a viewer but enough to change the fingerprint.",
    ] },
    { t: "p", html: "Quality matters here. A copy that looks compressed or blurry hurts retention, which hurts reach. Resolution and bitrate should stay the same as the original." },

    { t: "h2", id: "etape-3", html: "Step 3: Create visual variants to test" },
    { t: "p", html: "Unique copies let you repost. Variants let you learn." },
    { t: "p", html: "From the same source footage, create versions that look different on purpose:" },
    { t: "ul", items: [
      "A different <strong>hook</strong> (the first line of text on screen).",
      "A different <strong>caption style</strong>: color, position, size.",
      "Different <strong>subtitles</strong> or a different first second.",
    ] },
    { t: "p", html: "Post these variants on different accounts and compare. After two or three weeks, you know which hooks and formats work for each model, and you stop guessing." },

    { t: "h2", id: "etape-4", html: "Step 4: Post on a fixed rhythm, adapted to each account's health" },
    { t: "p", html: "Volume only works if accounts stay healthy." },
    { t: "ul", items: [
      "New or fragile accounts: start low, around 1 reel a day.",
      "Healthy, established accounts: agencies commonly run 5 to 10 reposts of winning reels a day, mixed with fresh content.",
      "Watch reach per account. If an account's views collapse, slow it down before pushing again.",
    ] },
    { t: "p", html: "The rule: never push every account to the maximum at the same time. Spread the risk." },

    { t: "h2", id: "etape-5", html: "Step 5: Run it as a weekly cycle" },
    { t: "p", html: "The agencies that scale treat this as a production line, not a creative exercise:" },
    { t: "ol", items: [
      "<strong>Monday</strong>: pull last week's top reels for each model.",
      "<strong>Duplicate</strong> them into unique copies, one per account.",
      "<strong>Generate variants</strong> of the best ones (new hooks, new captions).",
      "<strong>Send everything</strong> to each VA's folder, sorted by model and account.",
      "<strong>VAs schedule and post</strong> through the week.",
      "<strong>Next Monday</strong>: check what performed, repeat.",
    ] },
    { t: "p", html: "Done with the right tools, steps 1 to 4 take under an hour a week, for all models combined." },
    { t: "callout", n: 1 },

    { t: "h2", id: "organiser", html: "How to organize the work across models and VAs" },
    { t: "p", html: "With several models, the chaos comes from mixing content. Keep it strict:" },
    { t: "ul", items: [
      "<strong>One workspace per model</strong>: her content, her brief (tone, caption style, words to avoid), her folders.",
      "<strong>VAs only see the models they handle.</strong> Fewer mistakes, no content posted on the wrong account.",
      "<strong>One Drive folder per model and per VA</strong>: finished reels land where they will be posted.",
      "<strong>A written brief per model</strong>, so every variant respects her style without anyone repeating it.",
    ] },

    { t: "h2", id: "outils", html: "The tools OFM agencies use for this" },
    { t: "p", html: "A typical stack has three parts:" },
    { t: "ul", items: [
      "<strong>A duplication tool</strong> to make each file unique. Desktop \"spoofers\" process files locally on one computer. Web tools let a whole team work from the same place.",
      "<strong>An editing layer</strong> to create variants. Some agencies do it by hand in CapCut, which doesn't scale beyond a few reels a day. Others use AI editing to generate variants automatically.",
      "<strong>A file pipeline</strong> (usually Google Drive) to hand reels to VAs.",
    ] },
    { t: "p", html: "<strong>DuupFlow</strong> combines the three in one web app built for agencies: duplication (metadata, re-encoding, invisible variations), an AI editor powered by Claude that creates variants from your footage, a scraper to find each model's top reels, one workspace per model with manager and VA roles, and Google Drive import and export. Plans start at €39/month, with team features on the Pro and Agency plans." },

    { t: "h2", id: "erreurs", html: "Common mistakes" },
    { t: "ul", items: [
      "<strong>Reposting the exact same file</strong> on several accounts. It's the fastest way to get 0 views.",
      "<strong>Multiplying weak content.</strong> Ten copies of a reel that didn't perform won't perform either.",
      "<strong>Over-processing videos</strong> until they look degraded. Retention drops, reach follows.",
      "<strong>Pushing every account at full volume</strong> from day one.",
      "<strong>No testing.</strong> Without variants, you never learn which hook works for which model.",
    ] },
  ],
};

function renderBlock(b: Block, i: number, lang: "fr" | "en") {
  switch (b.t) {
    case "lead":
      return <p key={i} className="text-lg md:text-xl text-[#1a1a1a] leading-relaxed" dangerouslySetInnerHTML={{ __html: b.html }} />;
    case "p":
      return <p key={i} dangerouslySetInnerHTML={{ __html: b.html }} />;
    case "h2":
      return <h2 key={i} id={b.id} className="pt-6 text-2xl md:text-3xl font-bold tracking-tight text-[#1a1a1a]" dangerouslySetInnerHTML={{ __html: b.html }} />;
    case "ul":
      return <ul key={i} className="list-disc list-outside space-y-2 pl-6 marker:text-[#4f7bff]/70">{b.items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: it }} />)}</ul>;
    case "ol":
      return <ol key={i} className="list-decimal list-outside space-y-2 pl-6 marker:text-[#4f7bff]/70 marker:font-semibold">{b.items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: it }} />)}</ol>;
    case "callout": {
      const c = CTA[lang][b.n];
      return <CtaCallout key={i} className="my-4" title={c.title} text={c.text} button={c.button} />;
    }
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
  const crumb = isFr ? "Agences OFM et reels Instagram" : "OFM agencies and Instagram reels";
  const tag = "Guide";
  const read = isFr ? "min de lecture" : "min read";
  const faqTitle = isFr ? "Questions fréquentes" : "FAQ";
  const back = isFr ? "← Retour au blog" : "← Back to blog";
  const end = CTA[lang][2];

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

            <div className="space-y-6 text-[15px] md:text-base leading-relaxed text-[#1a1a1a] [&_strong]:font-semibold">
              {BODY[lang].map((b, i) => renderBlock(b, i, lang))}
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

            <CtaCallout className="mt-12" title={end.title} text={end.text} button={end.button} />

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

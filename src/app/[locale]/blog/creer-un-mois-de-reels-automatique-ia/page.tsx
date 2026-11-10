// src/app/[locale]/blog/creer-un-mois-de-reels-automatique-ia/page.tsx
//
// Fully bilingual SEO guide (FR + EN both indexed, one shared slug). Same
// layout as the other blog articles (blocks + FAQ + sticky TOC), plus a
// "code" block for the Drive tree and the Claude prompt.

import type { Metadata } from "next";
import { ogImageFor } from "@/lib/i18n/seo";
import { publicPath } from "@/lib/i18n/routes";
import Link from "@/components/LocaleLink";
import ArticleTOC, { type TocSection } from "../_components/ArticleTOC";

const SLUG = "creer-un-mois-de-reels-automatique-ia";
const PUBLISHED_AT = "2026-11-02";
const AUTHOR = "@Sten";
// Adresse EN traduite (routes.ts) : /blog/<slug-en> ; FR : /fr/blog/<slug-fr>.
const CANONICAL_FR = publicPath("fr", `/blog/${SLUG}`);
const CANONICAL_EN = publicPath("en", `/blog/${SLUG}`);
const READING = { fr: 9, en: 9 } as const;

const SECTIONS = {
  fr: [
    { id: "probleme", label: "Le vrai problème" },
    { id: "prerequis", label: "Ce qu'il faut avant de commencer" },
    { id: "etape-1", label: "1. Trouver ce qui marche déjà" },
    { id: "etape-2", label: "2. Calculer le volume du mois" },
    { id: "etape-3", label: "3. Monter avec l'éditeur IA" },
    { id: "etape-4", label: "4. Décliner en variantes" },
    { id: "etape-5", label: "5. Dupliquer pour chaque compte" },
    { id: "etape-6", label: "6. Répartir aux VA via Drive" },
    { id: "etape-7", label: "7. Automatiser avec Claude" },
    { id: "erreurs", label: "Les erreurs à éviter" },
    { id: "faq", label: "Questions fréquentes" },
  ],
  en: [
    { id: "probleme", label: "The real problem" },
    { id: "prerequis", label: "What you need before you start" },
    { id: "etape-1", label: "1. Find what already works" },
    { id: "etape-2", label: "2. Work out the month's volume" },
    { id: "etape-3", label: "3. Edit with the AI editor" },
    { id: "etape-4", label: "4. Spin off variants" },
    { id: "etape-5", label: "5. Duplicate for each account" },
    { id: "etape-6", label: "6. Hand off to VAs via Drive" },
    { id: "etape-7", label: "7. Automate with Claude" },
    { id: "erreurs", label: "Mistakes to avoid" },
    { id: "faq", label: "FAQ" },
  ],
} satisfies Record<"fr" | "en", TocSection[]>;

const META = {
  fr: {
    title: "Créer un mois de reels en automatique avec l'IA : le workflow complet",
    description:
      "Produire des centaines de reels par mois sans monteur : un éditeur IA monte les vidéos à partir des rushes, un duplicateur en fait des copies uniques pour chaque compte.",
    h1: "Créer un mois de reels en automatique avec l'IA : le workflow complet",
  },
  en: {
    title: "Create a month of reels automatically with AI: the complete workflow",
    description:
      "Produce hundreds of reels a month without an editor: an AI editor cuts the videos from raw footage, a duplicator turns them into unique copies for every account.",
    h1: "Create a month of reels automatically with AI: the complete workflow",
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
    { q: "Peut-on vraiment créer des reels automatiquement avec l'IA ?", a: "Oui, pour les formats simples et répétables (face cam, texte à l'écran, sous-titres). L'éditeur IA de DuupFlow monte la vidéo à partir de rushes réels ; il ne génère pas de personnage synthétique." },
    { q: "Combien de temps faut-il pour préparer un mois de reels ?", a: "Une fois le workflow en place, environ une session par semaine : ajouter les rushes, lancer la consigne, vérifier le résultat." },
    { q: "Faut-il savoir monter ?", a: "Non. Tu décris le montage en français, Claude l'exécute." },
    { q: "Pourquoi dupliquer si on a déjà des variantes ?", a: "Les variantes changent ce que voit le spectateur. La duplication change ce que voit l'algorithme : sans elle, deux comptes qui publient la même variante risquent d'être limités pour contenu dupliqué." },
    { q: "Est-ce que ça marche sur TikTok et Instagram ?", a: "Oui, ainsi que YouTube Shorts, X, Reddit et Threads. DuupFlow prépare les fichiers, la publication se fait ensuite." },
    { q: "Quel plan DuupFlow choisir pour ce workflow ?", a: "Solo pour un créateur seul. Pro pour l'API et les rôles VA. Agence pour gérer jusqu'à 15 créatrices et 10 membres. Détails sur la page tarifs." },
  ],
  en: [
    { q: "Can you really create reels automatically with AI?", a: "Yes, for simple, repeatable formats (face cam, on-screen text, captions). The DuupFlow AI editor cuts the video from real footage; it doesn't generate a synthetic character." },
    { q: "How long does it take to prepare a month of reels?", a: "Once the workflow is in place, about one session a week: add the footage, run the brief, check the output." },
    { q: "Do I need to know how to edit?", a: "No. You describe the edit in plain language, Claude carries it out." },
    { q: "Why duplicate if I already have variants?", a: "Variants change what the viewer sees. Duplication changes what the algorithm sees: without it, two accounts posting the same variant risk being limited for duplicate content." },
    { q: "Does it work on TikTok and Instagram?", a: "Yes, as well as YouTube Shorts, X, Reddit and Threads. DuupFlow prepares the files; publishing happens afterwards." },
    { q: "Which DuupFlow plan fits this workflow?", a: "Solo for a single creator. Pro for the API and VA roles. Agency to manage up to 15 creators and 10 members. Details on the pricing page." },
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
  | { t: "code"; code: string }
  | { t: "cta"; href: string; html: string };

const LINK = 'class="text-[#4f7bff] hover:text-[#4f7bff] underline underline-offset-2"';

const TREE_FR = `Drive /
  Emma — brut /         ← rushes de la créatrice
  Emma — DuupFlow /     ← copies exportées par DuupFlow
    VA Lucas /          ← copies pour ses comptes
    VA Sarah /
  Lina — brut /
  Lina — DuupFlow /
    VA Yanis /`;
const TREE_EN = `Drive /
  Emma — raw /          ← the creator's footage
  Emma — DuupFlow /     ← copies exported by DuupFlow
    VA Lucas /          ← copies for his accounts
    VA Sarah /
  Lina — raw /
  Lina — DuupFlow /
    VA Yanis /`;
const PROMPT_FR = `Pour Emma : prends les nouveaux rushes de son dossier Drive "brut",
monte 3 vidéos dans le style de la référence "face cam hook",
fais 3 variantes de chacune, puis duplique chaque variante en 6 copies.`;
const PROMPT_EN = `For Emma: take the new footage from her "raw" Drive folder,
edit 3 videos in the style of the "face cam hook" reference,
make 3 variants of each, then duplicate each variant into 6 copies.`;

const BODY: Record<"fr" | "en", Block[]> = {
  fr: [
    { t: "lead", html: "Un mois de reels pour plusieurs créatrices, c'est plusieurs centaines de publications. Ce guide montre comment les produire <strong>sans monteur</strong>, en enchaînant deux outils : un éditeur IA qui monte les vidéos à partir des rushes bruts, et un duplicateur qui transforme chaque vidéo en copies uniques pour chaque compte." },
    { t: "p", html: "Tout le workflow se fait dans DuupFlow, branché à Google Drive et pilotable par Claude, en environ <strong>une session de travail par semaine</strong>." },

    { t: "h2", id: "probleme", html: "Le vrai problème : produire du volume sans monteur" },
    { t: "p", html: "Une agence qui gère plusieurs créatrices doit alimenter des dizaines de comptes chaque semaine. Deux méthodes classiques bloquent vite :" },
    { t: "ul", items: [
      "<strong>Monter chaque vidéo à la main.</strong> Un monteur freelance coûte cher et ne suit pas le volume.",
      "<strong>Reposter le même fichier sur tous les comptes.</strong> TikTok et Instagram détectent les doublons et coupent la portée, parfois jusqu'à zéro vue.",
    ] },
    { t: "p", html: "La solution est de séparer le travail : <strong>produire peu de vidéos de base, les décliner en variantes, puis rendre chaque fichier unique</strong> avant de le poster." },

    { t: "h2", id: "prerequis", html: "Ce qu'il faut avant de commencer" },
    { t: "ul", items: [
      "<strong>Un dossier Google Drive par créatrice</strong>, avec ses rushes bruts : vidéos face cam, plans de vie quotidienne, photos.",
      "<strong>Les comptes à alimenter</strong> et leur rythme de publication, par créatrice.",
      "<strong>Deux ou trois vidéos de référence</strong> dont tu veux reprendre le style de montage : rythme, sous-titres, captions.",
      "<strong>Un dossier Drive par VA</strong>, s'ils publient pour toi.",
      "<strong>Un compte DuupFlow connecté à ton Drive</strong>, avec un espace par créatrice.",
    ] },

    { t: "h2", id: "etape-1", html: "Étape 1 : trouver ce qui marche déjà" },
    { t: "p", html: "Avant de produire, repère les formats qui performent. C'est ce qui évite de monter 100 vidéos que personne ne regarde." },
    { t: "ul", items: [
      "<strong>Sur tes propres comptes :</strong> le Scraper DuupFlow analyse un compte Instagram ou TikTok, classe les publications par vues et remonte les meilleures. Ce sont tes premières candidates à la duplication.",
      "<strong>Dans ta niche :</strong> repère les vidéos qui explosent chez des comptes similaires et garde-les comme références de style pour l'éditeur IA.",
    ] },
    { t: "p", html: "<strong>Résultat attendu :</strong> une liste de 5 à 10 vidéos gagnantes à reposter, et 2 ou 3 styles de montage à reproduire." },

    { t: "h2", id: "etape-2", html: "Étape 2 : calculer le volume du mois" },
    { t: "p", html: "Le volume se calcule à l'envers : du nombre de publications vers le nombre de vidéos à monter. Exemple pour une agence de 3 créatrices, avec 3 comptes chacune et 2 posts par jour et par compte :" },
    { t: "table",
      head: ["Étape", "Calcul", "Résultat"],
      rows: [
        ["Publications du mois", "3 créatrices × 3 comptes × 2 posts × 30 jours", "540 posts"],
        ["Par créatrice", "3 comptes × 2 posts × 30 jours", "180 posts"],
        ["Vidéos de base à monter", "par créatrice", "10 vidéos"],
        ["Variantes visuelles", "10 vidéos × 3 variantes", "30 variantes"],
        ["Copies uniques", "30 variantes × 6 copies", "180 fichiers"],
      ],
    },
    { t: "p", html: "Au lieu de monter 180 vidéos par créatrice, <strong>tu en montes 10</strong>. L'éditeur IA et le duplicateur font le reste. Adapte les chiffres à ton nombre de comptes et à leur rythme." },

    { t: "h2", id: "etape-3", html: "Étape 3 : monter les vidéos de base avec l'éditeur IA" },
    { t: "p", html: "L'éditeur IA de DuupFlow monte une vidéo à partir de rushes bruts, en conversation avec Claude." },
    { t: "ol", items: [
      "<strong>Donne le style :</strong> importe une vidéo de référence ou décris le montage voulu. L'IA en déduit le rythme, les coupes et le style des sous-titres.",
      "<strong>Ajoute la matière :</strong> les rushes de la créatrice depuis son dossier Drive, plus un logo ou des images si besoin.",
      "<strong>Décris ce que tu veux :</strong> par exemple « Monte une vidéo de 15 secondes avec ces rushes, un hook en texte blanc sur les 2 premières secondes, des sous-titres mot à mot et des coupes sur le beat. »",
      "<strong>Ajuste :</strong> demande une correction en une phrase (« hook plus court », « sous-titres plus bas ») au lieu de tout refaire.",
    ] },
    { t: "p", html: "Le montage IA est le plus efficace sur les <strong>formats simples et répétables</strong> : face cam, plans de vie quotidienne, texte à l'écran, sous-titres. Pour un montage très travaillé, monte la vidéo de base à la main et utilise DuupFlow à partir de l'étape 4." },

    { t: "h2", id: "etape-4", html: "Étape 4 : décliner en variantes" },
    { t: "p", html: "Une variante est une version visuellement différente de la même vidéo. Elle sert à tester ce qui performe et à éviter que les mêmes comptes voient exactement le même contenu." },
    { t: "p", html: "Dans l'éditeur IA, demande par exemple « Fais 3 variantes de cette vidéo » en changeant :" },
    { t: "ul", items: [
      "<strong>le hook :</strong> une autre phrase d'accroche ;",
      "<strong>le style des captions :</strong> police, couleur, position ;",
      "<strong>les sous-titres :</strong> formulation et placement ;",
      "<strong>l'ordre ou le rythme</strong> des plans.",
    ] },
    { t: "p", html: "Ne confonds pas variante et copie : <strong>la variante change ce que le spectateur voit, la copie (étape 5) change ce que l'algorithme voit.</strong>" },

    { t: "h2", id: "etape-5", html: "Étape 5 : dupliquer pour chaque compte" },
    { t: "p", html: "Chaque variante passe ensuite dans le duplicateur, qui en sort autant de copies uniques que de comptes à alimenter. Pour les plateformes, chaque copie est un fichier neuf :" },
    { t: "ul", items: [
      "métadonnées nouvelles (appareil, date, encodeur, géolocalisation) ;",
      "micro-variations visuelles invisibles à l'œil (luminosité, teinte, cadrage) ;",
      "empreinte de fichier unique et réencodage complet.",
    ] },
    { t: "p", html: "Le montage, l'audio et la qualité restent identiques, jusqu'en 4K. Lance la duplication par lot sur toutes les variantes de la semaine d'un coup, puis vérifie une copie avec le Comparateur si tu veux contrôler l'écart avec l'original." },
    { t: "p", html: "<strong>Règle simple :</strong> un fichier ne doit jamais être publié deux fois, même sur deux comptes différents." },

    { t: "h2", id: "etape-6", html: "Étape 6 : répartir aux VA via Google Drive" },
    { t: "p", html: "Les copies doivent arriver chez la bonne personne, prêtes à poster. Exporte-les en un clic depuis DuupFlow vers Google Drive : elles arrivent dans le dossier de la créatrice (« Emma — DuupFlow »), que tu répartis ensuite en un sous-dossier par VA ou par compte :" },
    { t: "code", code: TREE_FR },
    { t: "p", html: "Avec les rôles Manager et VA, chaque VA n'accède qu'aux créatrices qui lui sont assignées. Il ouvre son dossier, prend les fichiers du jour et publie." },

    { t: "h2", id: "etape-7", html: "Étape 7 : automatiser chaque semaine avec Claude" },
    { t: "p", html: "Une fois le workflow rodé, tu peux le confier à Claude. DuupFlow se connecte à Claude via un connecteur MCP : Claude peut alors récupérer les rushes d'un dossier Drive partagé, monter, décliner et dupliquer à ta place. Exemple de consigne hebdomadaire :" },
    { t: "code", code: PROMPT_FR },
    { t: "p", html: "Les copies t'attendent ensuite dans DuupFlow, d'où tu les envoies vers Drive en un clic. Pour aller plus loin, <strong>l'API DuupFlow</strong> (à partir du plan Pro) s'intègre à Make, n8n ou Claude Code pour déclencher ce pipeline automatiquement, sans même ouvrir la conversation." },
    { t: "p", html: "Un mois de reels se résume alors à <strong>quatre sessions</strong> : tu ajoutes les rushes, tu lances la consigne, tu vérifies quelques vidéos." },

    { t: "h2", id: "erreurs", html: "Les erreurs à éviter" },
    { t: "ul", items: [
      "<strong>Publier le même fichier sur plusieurs comptes.</strong> Même avec des variantes, chaque fichier publié doit être une copie unique.",
      "<strong>Dupliquer un contenu qui ne marche pas.</strong> Dupliquer multiplie la diffusion, pas la qualité : commence toujours par l'étape 1.",
      "<strong>Tout miser sur une seule vidéo de base.</strong> Garde au moins 5 à 10 vidéos de base par créatrice et par mois pour éviter la lassitude de l'audience.",
      "<strong>Laisser l'IA monter des formats trop complexes.</strong> Le montage automatique excelle sur les formats simples ; pour le reste, monte à la main et automatise la suite.",
      "<strong>Ignorer les signaux des plateformes.</strong> Si un compte perd sa portée, ralentis le rythme de publication sur ce compte avant de continuer.",
    ] },
    { t: "p", html: `Pour choisir ton plan, tout est sur la <a href="/fr/pricing" ${LINK}>page tarifs</a>.` },
    { t: "cta", href: "/pricing", html: "Voir les plans DuupFlow" },
  ],
  en: [
    { t: "lead", html: "A month of reels for several creators means several hundred posts. This guide shows how to produce them <strong>without a video editor</strong>, by chaining two tools: an AI editor that cuts the videos from raw footage, and a duplicator that turns each video into unique copies for every account." },
    { t: "p", html: "The whole workflow runs in DuupFlow, plugged into Google Drive and drivable by Claude, in about <strong>one work session a week</strong>." },

    { t: "h2", id: "probleme", html: "The real problem: producing volume without an editor" },
    { t: "p", html: "An agency managing several creators has to feed dozens of accounts every week. Two classic methods hit a wall fast:" },
    { t: "ul", items: [
      "<strong>Editing every video by hand.</strong> A freelance editor is expensive and can't keep up with the volume.",
      "<strong>Reposting the same file on every account.</strong> TikTok and Instagram spot duplicates and cut reach, sometimes down to zero views.",
    ] },
    { t: "p", html: "The fix is to split the work: <strong>produce a few base videos, spin them into variants, then make every file unique</strong> before posting it." },

    { t: "h2", id: "prerequis", html: "What you need before you start" },
    { t: "ul", items: [
      "<strong>One Google Drive folder per creator</strong>, with her raw footage: face-cam videos, everyday-life shots, photos.",
      "<strong>The accounts to feed</strong> and their posting rhythm, per creator.",
      "<strong>Two or three reference videos</strong> whose editing style you want to reuse: pacing, subtitles, captions.",
      "<strong>One Drive folder per VA</strong>, if they post for you.",
      "<strong>A DuupFlow account connected to your Drive</strong>, with one workspace per creator.",
    ] },

    { t: "h2", id: "etape-1", html: "Step 1: find what already works" },
    { t: "p", html: "Before producing anything, spot the formats that perform. That's what stops you from editing 100 videos nobody watches." },
    { t: "ul", items: [
      "<strong>On your own accounts:</strong> the DuupFlow Scraper analyses an Instagram or TikTok account, ranks posts by views and surfaces the best ones. Those are your first candidates for duplication.",
      "<strong>In your niche:</strong> spot the videos blowing up on similar accounts and keep them as style references for the AI editor.",
    ] },
    { t: "p", html: "<strong>Expected result:</strong> a list of 5 to 10 winning videos to repost, and 2 or 3 editing styles to reproduce." },

    { t: "h2", id: "etape-2", html: "Step 2: work out the month's volume" },
    { t: "p", html: "Volume is worked out backwards: from the number of posts to the number of videos to edit. Example for an agency with 3 creators, 3 accounts each and 2 posts per day per account:" },
    { t: "table",
      head: ["Step", "Calculation", "Result"],
      rows: [
        ["Posts for the month", "3 creators × 3 accounts × 2 posts × 30 days", "540 posts"],
        ["Per creator", "3 accounts × 2 posts × 30 days", "180 posts"],
        ["Base videos to edit", "per creator", "10 videos"],
        ["Visual variants", "10 videos × 3 variants", "30 variants"],
        ["Unique copies", "30 variants × 6 copies", "180 files"],
      ],
    },
    { t: "p", html: "Instead of editing 180 videos per creator, <strong>you edit 10</strong>. The AI editor and the duplicator do the rest. Adjust the numbers to your account count and posting rhythm." },

    { t: "h2", id: "etape-3", html: "Step 3: edit the base videos with the AI editor" },
    { t: "p", html: "The DuupFlow AI editor cuts a video from raw footage, in a conversation with Claude." },
    { t: "ol", items: [
      "<strong>Set the style:</strong> import a reference video or describe the edit you want. The AI infers the pacing, the cuts and the subtitle style.",
      "<strong>Add the material:</strong> the creator's footage from her Drive folder, plus a logo or images if needed.",
      "<strong>Describe what you want:</strong> for example “Edit a 15-second video with this footage, a white text hook over the first 2 seconds, word-by-word subtitles and cuts on the beat.”",
      "<strong>Adjust:</strong> ask for a fix in one sentence (“shorter hook”, “subtitles lower”) instead of redoing everything.",
    ] },
    { t: "p", html: "AI editing works best on <strong>simple, repeatable formats</strong>: face cam, everyday-life shots, on-screen text, subtitles. For a heavily crafted edit, cut the base video by hand and use DuupFlow from step 4." },

    { t: "h2", id: "etape-4", html: "Step 4: spin off variants" },
    { t: "p", html: "A variant is a visually different version of the same video. It lets you test what performs and keeps the same accounts from seeing exactly the same content." },
    { t: "p", html: "In the AI editor, ask for example “Make 3 variants of this video”, changing:" },
    { t: "ul", items: [
      "<strong>the hook:</strong> a different opening line;",
      "<strong>the caption style:</strong> font, colour, position;",
      "<strong>the subtitles:</strong> wording and placement;",
      "<strong>the order or pacing</strong> of the shots.",
    ] },
    { t: "p", html: "Don't confuse a variant with a copy: <strong>a variant changes what the viewer sees, a copy (step 5) changes what the algorithm sees.</strong>" },

    { t: "h2", id: "etape-5", html: "Step 5: duplicate for each account" },
    { t: "p", html: "Each variant then goes through the duplicator, which outputs as many unique copies as you have accounts to feed. To the platforms, every copy is a brand-new file:" },
    { t: "ul", items: [
      "new metadata (device, date, encoder, geolocation);",
      "visual micro-variations invisible to the eye (brightness, hue, framing);",
      "a unique file fingerprint and a full re-encode.",
    ] },
    { t: "p", html: "The edit, the audio and the quality stay identical, up to 4K. Run the duplication in one batch on all of the week's variants, then check a copy with the Comparator if you want to verify the gap with the original." },
    { t: "p", html: "<strong>Simple rule:</strong> a file should never be posted twice, even on two different accounts." },

    { t: "h2", id: "etape-6", html: "Step 6: hand off to VAs via Google Drive" },
    { t: "p", html: "The copies have to reach the right person, ready to post. Export them in one click from DuupFlow to Google Drive: they land in the creator's folder (“Emma — DuupFlow”), which you then split into one subfolder per VA or per account:" },
    { t: "code", code: TREE_EN },
    { t: "p", html: "With Manager and VA roles, each VA only accesses the creators assigned to them. They open their folder, grab the day's files and post." },

    { t: "h2", id: "etape-7", html: "Step 7: automate every week with Claude" },
    { t: "p", html: "Once the workflow runs smoothly, you can hand it to Claude. DuupFlow connects to Claude through an MCP connector: Claude can then pull footage from a shared Drive folder, edit, spin off variants and duplicate for you. Example weekly brief:" },
    { t: "code", code: PROMPT_EN },
    { t: "p", html: "The copies are then waiting for you in DuupFlow, ready to send to Drive in one click. To go further, <strong>the DuupFlow API</strong> (from the Pro plan) plugs into Make, n8n or Claude Code to trigger this pipeline automatically, without even opening the conversation." },
    { t: "p", html: "A month of reels then comes down to <strong>four sessions</strong>: add the footage, run the brief, check a few videos." },

    { t: "h2", id: "erreurs", html: "Mistakes to avoid" },
    { t: "ul", items: [
      "<strong>Posting the same file on several accounts.</strong> Even with variants, every posted file must be a unique copy.",
      "<strong>Duplicating content that doesn't work.</strong> Duplicating multiplies reach, not quality: always start with step 1.",
      "<strong>Betting everything on a single base video.</strong> Keep at least 5 to 10 base videos per creator per month to avoid audience fatigue.",
      "<strong>Letting the AI edit overly complex formats.</strong> Automatic editing shines on simple formats; for the rest, edit by hand and automate what comes after.",
      "<strong>Ignoring platform signals.</strong> If an account loses reach, slow down its posting rhythm before carrying on.",
    ] },
    { t: "p", html: `To pick your plan, everything is on the <a href="/pricing" ${LINK}>pricing page</a>.` },
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
    case "code":
      return (
        <pre key={i} className="overflow-x-auto rounded-2xl bg-[#0f1325] px-5 py-4 text-[13px] leading-relaxed text-[#dfe6ff] ring-1 ring-black/10">
          <code className="font-mono">{b.code}</code>
        </pre>
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
  const crumb = isFr ? "Un mois de reels avec l'IA" : "A month of reels with AI";
  const tag = isFr ? "Guide" : "Guide";
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

// src/app/[locale]/blog/reposter-meme-video-plusieurs-comptes-tiktok-instagram/page.tsx
//
// Fully bilingual SEO article (FR + EN both indexed). Each locale is
// self-canonical and cross-linked via hreflang. The body is authored as
// localized "blocks" so the rich content (links, lists, bold, tables) stays
// in one place per language.

import type { Metadata } from "next";
import Link from "@/components/LocaleLink";
import ArticleTOC, { type TocSection } from "../_components/ArticleTOC";

const SLUG = "reposter-meme-video-plusieurs-comptes-tiktok-instagram";
const PUBLISHED_AT = "2026-08-01";
const CANONICAL_FR = `/fr/blog/${SLUG}`;
const CANONICAL_EN = `/en/blog/${SLUG}`;
const READING = { fr: 8, en: 8 } as const;

const SECTIONS = {
  fr: [
    { id: "probleme",  label: "Le vrai problème : la détection de contenu non-original" },
    { id: "solution",  label: "La solution : une copie unique par compte" },
    { id: "volume",    label: "Pourquoi le volume change tout" },
    { id: "approches", label: "Les trois approches possibles" },
    { id: "methode",   label: "La méthode en 5 étapes" },
    { id: "erreurs",   label: "Les erreurs qui coûtent le plus cher" },
    { id: "conclusion", label: "En résumé" },
    { id: "faq",       label: "Questions fréquentes" },
  ],
  en: [
    { id: "probleme",  label: "The real problem: unoriginal-content detection" },
    { id: "solution",  label: "The fix: one unique copy per account" },
    { id: "volume",    label: "Why volume changes everything" },
    { id: "approches", label: "The three possible approaches" },
    { id: "methode",   label: "The method in 5 steps" },
    { id: "erreurs",   label: "The mistakes that cost the most" },
    { id: "conclusion", label: "In short" },
    { id: "faq",       label: "FAQ" },
  ],
} satisfies Record<"fr" | "en", TocSection[]>;

const META = {
  fr: {
    title: "Reposter la même vidéo sur plusieurs comptes TikTok et Instagram (2026)",
    description:
      "Reposter le même fichier sur plusieurs comptes ne marche pas : les plateformes reconnaissent le doublon et coupent la portée. La solution est de générer des copies uniques.",
    h1: "Reposter la même vidéo sur plusieurs comptes TikTok et Instagram : la méthode qui fonctionne en 2026",
  },
  en: {
    title: "Repost the same video across multiple TikTok and Instagram accounts (2026)",
    description:
      "Reposting the same file across multiple accounts doesn't work: platforms recognize the duplicate and cut reach. The fix is to generate unique copies.",
    h1: "Reposting the same video across multiple TikTok and Instagram accounts: the method that works in 2026",
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
      languages: { "fr-FR": CANONICAL_FR, "en": CANONICAL_EN, "x-default": CANONICAL_EN },
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
    { q: "Pourquoi ma vidéo repostée ne fait aucune vue ?", a: "Dans la grande majorité des cas, parce qu'il s'agit du même fichier qu'une publication déjà présente sur la plateforme. La vidéo n'est pas supprimée, elle n'est simplement pas recommandée." },
    { q: "Est-ce que changer le nom du fichier suffit ?", a: "Non. Le nom du fichier n'a aucune importance. Ce qui est analysé, ce sont les métadonnées internes et l'empreinte du contenu. Il faut agir sur les deux." },
    { q: "Faut-il remonter la vidéo pour chaque compte ?", a: "Non, et c'est justement ce qui rendait la stratégie inexploitable. DuupFlow travaille sur votre vidéo déjà montée et en sort des copies uniques sans que vous ayez à rouvrir votre projet." },
    { q: "Combien de comptes faut-il gérer ?", a: "Commencez à 3 à 5 comptes, le temps de prendre le rythme. La contrainte n'est plus la production des copies, elle est la gestion des comptes." },
    { q: "Un scheduler suffit-il ?", a: "Pour publier sur plusieurs plateformes depuis un seul compte, oui. Pour publier sur plusieurs comptes, non : il enverra le même fichier partout, avec le résultat décrit plus haut." },
  ],
  en: [
    { q: "Why does my reposted video get no views?", a: "In the vast majority of cases, because it's the same file as a post already present on the platform. The video isn't removed, it's simply not recommended." },
    { q: "Is renaming the file enough?", a: "No. The file name doesn't matter at all. What's analyzed is the internal metadata and the content fingerprint. You have to act on both." },
    { q: "Do I have to re-edit the video for each account?", a: "No, and that's exactly what made the strategy unworkable. DuupFlow works from your already-edited video and outputs unique copies without you having to reopen your project." },
    { q: "How many accounts should I run?", a: "Start with 3 to 5 accounts while you get into the rhythm. The constraint is no longer producing the copies, it's managing the accounts." },
    { q: "Is a scheduler enough?", a: "To publish across several platforms from a single account, yes. To publish across several accounts, no: it will send the same file everywhere, with the result described above." },
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

const BODY: Record<"fr" | "en", Block[]> = {
  fr: [
    { t: "lead", html: "<strong>Réponse courte :</strong> publier la même vidéo sur plusieurs comptes est la stratégie de volume la plus efficace en organique — mais elle échoue si vous envoyez le même fichier partout. TikTok et Instagram reconnaissent un fichier déjà vu et coupent la distribution des copies, sans notification." },
    { t: "p", html: "La solution est de générer, à partir de votre vidéo, autant de copies techniquement uniques que vous avez de comptes. C'est exactement ce que fait <a href=\"/\" class=\"text-[#4f7bff] hover:text-[#4f7bff] underline underline-offset-2\">DuupFlow</a> : un fichier en entrée, N fichiers uniques en sortie, en quelques secondes." },

    { t: "h2", id: "probleme", html: "Le vrai problème : la détection de contenu non-original" },
    { t: "p", html: "La plupart des créateurs pensent que le risque du repost multi-comptes est le bannissement. Ce n'est pas ça. Le risque réel est bien plus discret : votre vidéo est publiée, elle reste en ligne, et elle ne sort jamais." },
    { t: "p", html: "Les plateformes ne regardent pas seulement l'image. Chaque fichier uploadé transporte une signature : des <strong>métadonnées</strong> (appareil, date, GPS, logiciel d'export) et une <strong>empreinte numérique</strong> du contenu lui-même, calculée à l'upload. Quand cette empreinte correspond à un fichier déjà présent sur la plateforme, la copie est identifiée comme non-originale." },
    { t: "p", html: "Ce n'est pas une théorie de créateurs, les plateformes l'écrivent :" },
    { t: "ul", items: [
      "<strong>TikTok.</strong> Les règles d'éligibilité au fil Pour Toi listent explicitement, parmi les contenus rendus inéligibles à la recommandation, le contenu reproduit ou non-original importé ou uploadé sans nouvelle édition. Inéligible ne veut pas dire supprimé : la vidéo reste en ligne, elle n'est simplement plus poussée.",
      "<strong>Instagram.</strong> Depuis 2024, quand le système identifie un Reel en double, il remplace la copie par la version d'origine dans les recommandations. La copie existe, elle n'est pas montrée.",
    ] },
    { t: "p", html: "Résultat, pour vous :" },
    { t: "ul", items: [
      "<strong>Aucune notification.</strong> Pas d'avertissement, pas de message d'erreur, pas de suppression. La vidéo existe et fait 200 vues.",
      "<strong>L'écart est invisible.</strong> Vous en concluez que « ça ne marche pas », alors que le contenu n'a jamais été distribué.",
      "<strong>La sanction porte sur la découverte.</strong> Vos abonnés voient toujours vos publications ; les non-abonnés, non. C'est-à-dire la croissance.",
    ] },
    { t: "p", html: "C'est là que la quasi-totalité des stratégies multi-comptes meurent : pas sur le contenu, sur le <strong>fichier</strong>." },

    { t: "h2", id: "solution", html: "La solution : une copie unique par compte" },
    { t: "p", html: "Si le problème est la reconnaissance du doublon, la réponse est mécanique : chaque compte doit recevoir un fichier différent." },
    { t: "p", html: "Pas une vidéo différente — la même vidéo, dans un fichier qui n'a plus la même signature. C'est précisément le travail que fait DuupFlow, sur <strong>trois niveaux</strong> :" },
    { t: "ol", items: [
      "<strong>Les métadonnées.</strong> Appareil, date, GPS, données d'export : tout ce qui identifie un fichier avant même que son contenu soit analysé est régénéré pour chaque copie.",
      "<strong>Le réencodage.</strong> Codec, bitrate, structure du conteneur. Une copie réencodée ne présente plus la même empreinte technique que le fichier source.",
      "<strong>Le pixel magique.</strong> Une couche de bruit invisible appliquée à l'image. Invisible pour un spectateur, suffisante pour que l'empreinte visuelle calculée par la plateforme ne soit plus la même.",
    ] },
    { t: "p", html: "Résultat : dix copies de la même vidéo, indiscernables à l'œil, et dix fichiers distincts au moment de l'upload. Vous obtenez dix vraies chances de percer au lieu d'une." },
    { t: "p", html: "DuupFlow fait ça automatiquement. Vous importez votre vidéo, vous choisissez le nombre de copies, vous récupérez vos fichiers en quelques secondes. Les trois réglages sont en mode Auto par défaut : vous n'avez rien à paramétrer." },

    { t: "h2", id: "volume", html: "Pourquoi le volume change tout" },
    { t: "p", html: "Sur TikTok et Reels, la portée ne dépend pas de la taille du compte mais de la performance des premières impressions. Chaque publication est un tirage indépendant." },
    { t: "ul", items: [
      "<strong>Le contenu est le coût fixe.</strong> Le montage prend du temps ; la diffusion, non.",
      "<strong>La performance n'est pas prévisible.</strong> Une vidéo à 800 vues sur un compte peut en faire 340 000 sur un autre, avec une autre audience.",
      "<strong>Le volume révèle les formats gagnants.</strong> Plus vous avez de tirages, plus vite vous savez ce qui fonctionne.",
    ] },
    { t: "p", html: "Un créateur qui poste une vidéo par jour sur un compte fait 30 tirages par mois. Le même créateur qui décline cette vidéo sur 10 comptes en fait 300, pour le même travail de montage." },

    { t: "h2", id: "approches", html: "Les trois approches possibles" },
    { t: "h3", html: "1. Le remontage manuel" },
    { t: "p", html: "Vous rouvrez le projet et produisez une version différente pour chaque compte. Méthode la plus propre, et de loin la plus lente : 15 à 30 minutes par variante. À 10 comptes, la stratégie de volume s'effondre sous son propre poids." },
    { t: "h3", html: "2. Les outils de planification (schedulers)" },
    { t: "p", html: "Buffer, Metricool, SocialPilot et équivalents programment une publication vers plusieurs comptes en une opération. Excellents outils de calendrier, mais ils ne résolvent pas le problème : ils envoient le même fichier partout. Ils font gagner du temps sur la publication, pas sur l'originalité du fichier." },
    { t: "h3", html: "3. Les outils de duplication" },
    { t: "p", html: "Ils partent de votre vidéo déjà montée et en produisent N fichiers uniques. C'est la seule approche qui tienne la charge à 10, 30 ou 100 publications par semaine." },
    { t: "table",
      head: ["", "Remontage manuel", "Scheduler", "DuupFlow"],
      rows: [
        ["Temps pour 10 copies", "3 à 5 heures", "~10 min", "quelques secondes"],
        ["Fichiers distincts", "Oui", "Non", "Oui"],
        ["Métadonnées régénérées", "Non", "Non", "Oui"],
        ["Réencodage", "Manuel", "Non", "Oui"],
        ["Bruit invisible", "Non", "Non", "Oui"],
        ["Adapté à 10+ comptes", "Non", "Partiellement", "Oui"],
      ],
    },

    { t: "h2", id: "methode", html: "La méthode en 5 étapes" },
    { t: "ol", items: [
      "<strong>Partir d'une vidéo qui a déjà prouvé quelque chose.</strong> Repérez vos vidéos qui ont sur-performé et servez-vous-en comme base. Ne dupliquez pas au hasard.",
      "<strong>Générer les copies.</strong> Une par compte, chacune avec son propre fichier. C'est l'étape que DuupFlow automatise.",
      "<strong>Étaler la publication.</strong> Ne publiez pas les 10 copies dans la même heure. Répartissez sur plusieurs jours, en respectant les fuseaux horaires de vos audiences.",
      "<strong>Varier ce qui est gratuit.</strong> Caption et hashtags changent d'un compte à l'autre. C'est un test gratuit, ne le gâchez pas en copiant-collant.",
      "<strong>Mesurer par copie.</strong> L'objectif du volume n'est pas d'accumuler des vues, c'est d'identifier ce qui marche pour le refaire.",
    ] },

    { t: "h2", id: "erreurs", html: "Les erreurs qui coûtent le plus cher" },
    { t: "ul", items: [
      "<strong>Uploader le fichier d'origine sur tous les comptes.</strong> L'erreur numéro un, et la cause directe du problème décrit plus haut.",
      "<strong>Télécharger sa propre vidéo depuis TikTok pour la reposter.</strong> Vous récupérez un fichier watermarké, explicitement cité comme signal de contenu non-original.",
      "<strong>Copier-coller la même caption partout.</strong>",
      "<strong>Publier en rafale.</strong> Dix publications simultanées sur dix comptes ne ressemblent à rien de naturel.",
      "<strong>Ne pas mesurer.</strong> Sans suivi par copie, vous produisez du volume sans jamais apprendre.",
    ] },

    { t: "h2", id: "conclusion", html: "En résumé" },
    { t: "p", html: "Le repost multi-comptes ne meurt pas sur le bannissement, il meurt sur la détection du doublon. Chaque compte doit donc recevoir un fichier réellement distinct. Le remontage manuel y arrive mais ne passe pas à l'échelle ; les schedulers gèrent le calendrier, pas le fichier." },
    { t: "p", html: "<a href=\"/\" class=\"text-[#4f7bff] hover:text-[#4f7bff] underline underline-offset-2\">DuupFlow</a> prend votre vidéo déjà montée et en sort autant de copies uniques que vous avez de comptes — métadonnées, réencodage et pixel magique compris, en quelques secondes." },
    { t: "cta", href: "/pricing", html: "Tester DuupFlow" },
  ],
  en: [
    { t: "lead", html: "<strong>Short answer:</strong> posting the same video across several accounts is the most effective organic volume strategy — but it fails if you send the same file everywhere. TikTok and Instagram recognize an already-seen file and cut the distribution of copies, with no notification." },
    { t: "p", html: "The fix is to generate, from your video, as many technically unique copies as you have accounts. That's exactly what <a href=\"/\" class=\"text-[#4f7bff] hover:text-[#4f7bff] underline underline-offset-2\">DuupFlow</a> does: one file in, N unique files out, in a few seconds." },

    { t: "h2", id: "probleme", html: "The real problem: unoriginal-content detection" },
    { t: "p", html: "Most creators think the risk of multi-account reposting is a ban. It isn't. The real risk is far quieter: your video is published, it stays online, and it never takes off." },
    { t: "p", html: "Platforms don't only look at the image. Every uploaded file carries a signature: <strong>metadata</strong> (device, date, GPS, export software) and a <strong>digital fingerprint</strong> of the content itself, computed at upload. When that fingerprint matches a file already present on the platform, the copy is flagged as unoriginal." },
    { t: "p", html: "This isn't creator folklore, the platforms write it down:" },
    { t: "ul", items: [
      "<strong>TikTok.</strong> The For You feed eligibility rules explicitly list, among content made ineligible for recommendation, reproduced or unoriginal content imported or uploaded without new editing. Ineligible doesn't mean removed: the video stays online, it's simply no longer pushed.",
      "<strong>Instagram.</strong> Since 2024, when the system identifies a duplicate Reel, it replaces the copy with the original version in recommendations. The copy exists, it isn't shown.",
    ] },
    { t: "p", html: "The result, for you:" },
    { t: "ul", items: [
      "<strong>No notification.</strong> No warning, no error message, no removal. The video exists and gets 200 views.",
      "<strong>The gap is invisible.</strong> You conclude “it doesn't work,” when the content was never distributed.",
      "<strong>The penalty hits discovery.</strong> Your followers still see your posts; non-followers don't. That's exactly where growth comes from.",
    ] },
    { t: "p", html: "This is where nearly all multi-account strategies die: not on content, on the <strong>file</strong>." },

    { t: "h2", id: "solution", html: "The fix: one unique copy per account" },
    { t: "p", html: "If the problem is duplicate recognition, the answer is mechanical: each account must receive a different file." },
    { t: "p", html: "Not a different video — the same video, in a file that no longer has the same signature. That's precisely the work DuupFlow does, on <strong>three levels</strong>:" },
    { t: "ol", items: [
      "<strong>The metadata.</strong> Device, date, GPS, export data: everything that identifies a file before its content is even analyzed is regenerated for each copy.",
      "<strong>The re-encoding.</strong> Codec, bitrate, container structure. A re-encoded copy no longer has the same technical fingerprint as the source file.",
      "<strong>The magic pixel.</strong> A layer of invisible noise applied to the image. Invisible to a viewer, enough that the visual fingerprint computed by the platform is no longer the same.",
    ] },
    { t: "p", html: "The result: ten copies of the same video, indistinguishable to the eye, and ten distinct files at upload time. You get ten real chances to break through instead of one." },
    { t: "p", html: "DuupFlow does this automatically. You import your video, you choose the number of copies, you get your files back in a few seconds. The three settings are on Auto by default: you have nothing to configure." },

    { t: "h2", id: "volume", html: "Why volume changes everything" },
    { t: "p", html: "On TikTok and Reels, reach doesn't depend on account size but on the performance of the first impressions. Every post is an independent shot." },
    { t: "ul", items: [
      "<strong>Content is the fixed cost.</strong> Editing takes time; distribution doesn't.",
      "<strong>Performance isn't predictable.</strong> A video that gets 800 views on one account can get 340,000 on another, with a different audience.",
      "<strong>Volume reveals the winning formats.</strong> The more shots you take, the faster you learn what works.",
    ] },
    { t: "p", html: "A creator who posts one video a day on one account takes 30 shots a month. The same creator who spins that video across 10 accounts takes 300 — for the same editing work." },

    { t: "h2", id: "approches", html: "The three possible approaches" },
    { t: "h3", html: "1. Manual re-editing" },
    { t: "p", html: "You reopen the project and produce a different version for each account. The cleanest method, and by far the slowest: 15 to 30 minutes per variant. At 10 accounts, the volume strategy collapses under its own weight." },
    { t: "h3", html: "2. Scheduling tools (schedulers)" },
    { t: "p", html: "Buffer, Metricool, SocialPilot and equivalents schedule a post to several accounts in one operation. Excellent calendar tools, but they don't solve the problem: they send the same file everywhere. They save time on publishing, not on the file's originality." },
    { t: "h3", html: "3. Duplication tools" },
    { t: "p", html: "They start from your already-edited video and produce N unique files. It's the only approach that holds up at 10, 30 or 100 posts per week." },
    { t: "table",
      head: ["", "Manual re-editing", "Scheduler", "DuupFlow"],
      rows: [
        ["Time for 10 copies", "3 to 5 hours", "~10 min", "a few seconds"],
        ["Distinct files", "Yes", "No", "Yes"],
        ["Regenerated metadata", "No", "No", "Yes"],
        ["Re-encoding", "Manual", "No", "Yes"],
        ["Invisible noise", "No", "No", "Yes"],
        ["Fit for 10+ accounts", "No", "Partially", "Yes"],
      ],
    },

    { t: "h2", id: "methode", html: "The method in 5 steps" },
    { t: "ol", items: [
      "<strong>Start from a video that already proved something.</strong> Spot your videos that over-performed and use them as the base. Don't duplicate at random.",
      "<strong>Generate the copies.</strong> One per account, each with its own file. This is the step DuupFlow automates.",
      "<strong>Stagger the publishing.</strong> Don't post all 10 copies within the same hour. Spread them over several days, respecting your audiences' time zones.",
      "<strong>Vary what's free.</strong> Caption and hashtags change from one account to another. It's a free test, don't waste it by copy-pasting.",
      "<strong>Measure per copy.</strong> The goal of volume isn't to pile up views, it's to identify what works so you can do it again.",
    ] },

    { t: "h2", id: "erreurs", html: "The mistakes that cost the most" },
    { t: "ul", items: [
      "<strong>Uploading the original file to every account.</strong> The number-one mistake, and the direct cause of the problem described above.",
      "<strong>Downloading your own video from TikTok to repost it.</strong> You get a watermarked file, explicitly cited as an unoriginal-content signal.",
      "<strong>Copy-pasting the same caption everywhere.</strong>",
      "<strong>Posting in bursts.</strong> Ten simultaneous posts across ten accounts look nothing like natural behavior.",
      "<strong>Not measuring.</strong> Without per-copy tracking, you produce volume without ever learning.",
    ] },

    { t: "h2", id: "conclusion", html: "In short" },
    { t: "p", html: "Multi-account reposting doesn't die on bans, it dies on duplicate detection. So every account must receive a genuinely distinct file. Manual re-editing gets there but doesn't scale; schedulers handle the calendar, not the file." },
    { t: "p", html: "<a href=\"/\" class=\"text-[#4f7bff] hover:text-[#4f7bff] underline underline-offset-2\">DuupFlow</a> takes your already-edited video and outputs as many unique copies as you have accounts — metadata, re-encoding and magic pixel included, in a few seconds." },
    { t: "cta", href: "/pricing", html: "Try DuupFlow" },
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
      return (
        <div key={i} className="my-2 overflow-x-auto rounded-2xl ring-1 ring-black/[0.08]">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#f5f6fb]">
                {b.head.map((h, j) => (
                  <th key={j} className={`px-4 py-3 font-semibold text-[#1a1a1a] ${j === 0 ? "" : "text-center"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, ri) => (
                <tr key={ri} className="border-t border-black/[0.06]">
                  {row.map((cell, ci) => (
                    <td key={ci} className={`px-4 py-3 ${ci === 0 ? "font-medium text-[#1a1a1a]" : "text-center text-[#3f4453]"}`}>{cell}</td>
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
    author: { "@type": "Organization", name: "DuupFlow" },
    publisher: { "@type": "Organization", name: "DuupFlow", logo: { "@type": "ImageObject", url: "https://www.duupflow.com/logo-mark.png" } },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://www.duupflow.com${isFr ? CANONICAL_FR : CANONICAL_EN}` },
  };

  const dateLabel = new Date(PUBLISHED_AT).toLocaleDateString(isFr ? "fr-FR" : "en-US", { day: "numeric", month: "long", year: "numeric" });
  const crumb = isFr ? "Reposter sur plusieurs comptes" : "Repost across multiple accounts";
  const tag = isFr ? "Stratégie multi-comptes" : "Multi-account strategy";
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
              <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-wider text-[#8a8a8a]">
                <time dateTime={PUBLISHED_AT}>{dateLabel}</time>
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

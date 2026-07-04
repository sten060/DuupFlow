// src/app/[locale]/blog/instagram-contenus-non-originaux/page.tsx
//
// Fully bilingual SEO article (FR + EN both indexed). Each locale is
// self-canonical and cross-linked via hreflang. The body is authored as
// localized "blocks" so the rich content (links, lists, bold) stays in one
// place per language.

import type { Metadata } from "next";
import Link from "@/components/LocaleLink";
import ArticleTOC, { type TocSection } from "../_components/ArticleTOC";

const SLUG = "instagram-contenus-non-originaux";
const PUBLISHED_AT = "2026-05-23";
const CANONICAL_FR = `/fr/blog/${SLUG}`;
const CANONICAL_EN = `/en/blog/${SLUG}`;
const READING = { fr: 7, en: 7 } as const;

const SECTIONS = {
  fr: [
    { id: "definition",    label: "Ce qu'Instagram considère comme « non original »" },
    { id: "impactes",      label: "Qui est impacté ?" },
    { id: "consequences",  label: "Les conséquences concrètes" },
    { id: "multi-comptes", label: "L'enjeu pour la diffusion multi-comptes" },
    { id: "conformite",    label: "Comment rester conforme" },
    { id: "duupflow",      label: "DuupFlow : industrialiser la variation" },
    { id: "conclusion",    label: "Conclusion" },
    { id: "faq",           label: "Questions fréquentes" },
  ],
  en: [
    { id: "definition",    label: "What Instagram now calls “unoriginal”" },
    { id: "impactes",      label: "Who is affected?" },
    { id: "consequences",  label: "The concrete consequences" },
    { id: "multi-comptes", label: "The real stake for multi-account posting" },
    { id: "conformite",    label: "How to stay compliant" },
    { id: "duupflow",      label: "DuupFlow: industrialize variation" },
    { id: "conclusion",    label: "Conclusion" },
    { id: "faq",           label: "FAQ" },
  ],
} satisfies Record<"fr" | "en", TocSection[]>;

const META = {
  fr: {
    title: "Contenus non originaux Instagram : nouveautés 2026",
    description: "Instagram limite la portée des comptes qui republient du contenu non original. Ce qui change en 2026 et comment rester conforme.",
    h1: "Instagram et les contenus non originaux : ce qui change pour vos comptes en 2026",
  },
  en: {
    title: "Instagram unoriginal content rule: what changes in 2026",
    description: "Instagram limits the reach of accounts that repost unoriginal content. What changes in 2026 and how to stay compliant.",
    h1: "Instagram and unoriginal content: what changes for your accounts in 2026",
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
    { q: "Qu'est-ce qu'un contenu non original pour Instagram en 2026 ?", a: "Instagram considère comme non original tout contenu republié sans transformation significative : reposts simples, vidéos avec filigrane ajouté, compilations issues d'autres plateformes. Le critère est la perception : un utilisateur doit pouvoir reconnaître une intention de création propre au compte." },
    { q: "Est-ce que poster le même contenu sur plusieurs de mes comptes est interdit ?", a: "Ce n'est pas interdit, mais c'est désormais pénalisé en visibilité. Si vos comptes diffusent la même vidéo sans variation, ils sont traités comme un doublon algorithmique. Pour éviter la perte de portée, chaque compte devrait recevoir une déclinaison distincte." },
    { q: "Modifier les métadonnées d'une vidéo suffit-il à rester conforme ?", a: "Non. Instagram analyse le contenu perçu (image, vidéo, audio), pas les métadonnées. Changer un bitrate ou les EXIF ne crée aucune différence à l'œil et n'a aucun effet sur le score d'originalité du compte." },
    { q: "Comment savoir si mon compte est impacté ?", a: "Si la portée moyenne de vos publications a chuté ces dernières semaines sans changement éditorial, vérifiez la part de contenu reposté par rapport à du contenu transformé sur les 30 derniers jours. Les statistiques Instagram affichent aussi une mention lorsqu'un compte est exclu des recommandations." },
  ],
  en: [
    { q: "What counts as unoriginal content for Instagram in 2026?", a: "Instagram treats as unoriginal any content reposted without meaningful transformation: simple reposts, videos with an added watermark, compilations pulled from other platforms. The criterion is perception: a user should be able to recognize a creative intent that belongs to the account." },
    { q: "Is posting the same content across several of my accounts forbidden?", a: "It isn't forbidden, but it's now penalized in reach. If your accounts push the same video without variation, they're treated as an algorithmic duplicate. To avoid losing reach, each account should get a distinct version." },
    { q: "Is changing a video's metadata enough to stay compliant?", a: "No. Instagram analyzes the perceived content (image, video, audio), not the metadata. Changing a bitrate or the EXIF creates no visible difference and has no effect on the account's originality score." },
    { q: "How do I know if my account is affected?", a: "If the average reach of your posts has dropped in recent weeks with no editorial change, check the share of reposted vs. transformed content over the last 30 days. Instagram's stats also show a notice when an account is excluded from recommendations." },
  ],
};

type Block =
  | { t: "lead"; html: string }
  | { t: "p"; html: string }
  | { t: "h2"; id: string; html: string }
  | { t: "h3"; html: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "cta"; href: string; html: string };

const BODY: Record<"fr" | "en", Block[]> = {
  fr: [
    { t: "lead", html: "Instagram a durci sa politique de recommandation : les comptes qui republient du contenu créé par d'autres voient leur visibilité chuter dans l'Explorer et le fil principal. La plateforme considère désormais que la valeur d'un compte se mesure à l'originalité de ce qu'il publie — et plus seulement au volume." },
    { t: "p", html: "Pour les agences sociales, les créateurs qui gèrent plusieurs comptes thématiques et les marques qui dupliquent leur contenu, le changement est concret : poster le même fichier sur plusieurs comptes devient un signal négatif. Cette mise à jour a été détaillée par <a href=\"https://www.leptidigital.fr/reseaux-sociaux/instagram-lutte-contenus-non-originaux-89802/\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-indigo-300 hover:text-indigo-200 underline underline-offset-2\">LeptiDigital</a>." },
    { t: "p", html: "Dans cet article, on décrypte ce qu'Instagram entend par <em>non original</em>, qui est concerné, ce que cela change pour la diffusion multi-comptes, et comment continuer à scaler sans tomber dans le piège des publications cloniques." },
    { t: "h2", id: "definition", html: "Ce qu'Instagram considère désormais comme « non original »" },
    { t: "p", html: "Instagram structure l'originalité autour de trois critères : le contenu est créé par l'utilisateur lui-même, il apporte une perspective unique, ou il transforme significativement un contenu préexistant. C'est ce dernier point qui change tout — la simple republication n'entre pas dans cette définition." },
    { t: "p", html: "Concrètement, sont considérés comme <strong>non originaux</strong> :" },
    { t: "ul", items: ["les reposts simples, même avec mention du créateur ;", "les vidéos repackagées avec un filigrane ou un crédit ajouté ;", "les contenus issus d'agrégateurs (compilations de TikToks, par exemple) ;", "les publications strictement identiques d'un compte à un autre."] },
    { t: "p", html: "À l'inverse, Instagram valorise les contenus <strong>transformés</strong> : un montage qui crée une nouvelle narration, un commentaire personnel sur une vidéo virale, une déclinaison qui adapte le format ou le ton à un public spécifique. La barrière n'est pas juridique mais éditoriale : ce qui compte, c'est qu'un utilisateur qui voit le post puisse percevoir une intention de création." },
    { t: "h2", id: "impactes", html: "Qui est impacté ?" },
    { t: "p", html: "Trois profils encaissent la mise à jour de plein fouet." },
    { t: "p", html: "<strong>Les agrégateurs et comptes de reposts.</strong> Tout compte dont la stratégie repose sur la republication systématique perd en portée : l'algorithme leur attribue un score d'originalité bas, ce qui les exclut progressivement des recommandations Explorer." },
    { t: "p", html: "<strong>Les comptes vitrines de marques et créateurs.</strong> Beaucoup d'entrepreneurs gèrent plusieurs comptes pour adresser des audiences distinctes. Si ces comptes diffusent les mêmes vidéos sans variation, ils sont traités comme des doublons." },
    { t: "h3", html: "Les setups multi-comptes : le profil le plus exposé" },
    { t: "p", html: "Les agences sociales et les créateurs OFM ont particulièrement à perdre. Quand cinq comptes du même opérateur postent la même vidéo le même jour, Instagram détecte la redondance et limite la portée organique des publications suivantes. Le coût est double : la performance d'un post chute, et la santé du compte se dégrade sur le long terme." },
    { t: "h2", id: "consequences", html: "Les conséquences concrètes" },
    { t: "p", html: "La sanction n'est pas une suspension mais une mise en sourdine algorithmique. Quatre effets observés :" },
    { t: "ol", items: ["<strong>Réduction de la portée organique.</strong> Les publications jugées non originales sont moins servies dans le fil des abonnés et quasi absentes des recommandations.", "<strong>Exclusion de l'Explorer.</strong> Le contenu reposté n'est plus poussé hors de la base d'abonnés.", "<strong>Limitation des recommandations.</strong> Le compte lui-même est moins suggéré aux utilisateurs intéressés.", "<strong>Démonétisation sur Facebook.</strong> Les comptes liés à un Facebook monétisé voient leurs revenus baisser quand la même règle s'applique côté Meta."] },
    { t: "h2", id: "multi-comptes", html: "Le vrai enjeu pour la diffusion multi-comptes" },
    { t: "p", html: "L'erreur classique est de penser ce changement comme un problème de « doublon » technique. Le vrai enjeu est ailleurs : Instagram compare le <strong>contenu perçu</strong>, pas uniquement le fichier brut. Deux vidéos identiques visuellement seront traitées comme du contenu non original, même avec des métadonnées ou des noms de fichier différents." },
    { t: "p", html: "Pour les opérateurs multi-comptes, aucun ajustement superficiel ne suffit. Ajouter un filigrane, modifier le bitrate, changer les EXIF — ces modifications restent invisibles à l'œil. Or le système Instagram juge ce qu'un humain verrait. Si la perception est identique, le signal « non original » est levé." },
    { t: "h2", id: "conformite", html: "Comment rester conforme" },
    { t: "p", html: "La réponse stratégique tient en un mot : <strong>varier</strong>. Pour qu'une même vidéo soit diffusée sur plusieurs comptes sans déclencher le signal de non-originalité, chaque diffusion doit présenter une différence perceptible." },
    { t: "p", html: "Pistes concrètes :" },
    { t: "ul", items: ["<strong>Recadrage et reformatage</strong> — adapter le ratio, le crop, le cadre au ton de chaque compte ;", "<strong>Variations visuelles</strong> — luminosité, contraste, ambiance colorimétrique qui modifient l'impression générale ;", "<strong>Modifications de mouvement</strong> — vitesse, zooms subtils, transitions distinctes ;", "<strong>Adaptations éditoriales</strong> — légende, intro vocale ou sous-titres adaptés à l'audience du compte."] },
    { t: "p", html: "L'objectif n'est pas de tromper l'algorithme mais de <strong>produire réellement</strong> plusieurs versions adaptées à chaque audience. À l'échelle, on ne peut pas refaire manuellement cinq variantes par publication et par compte." },
    { t: "h2", id: "duupflow", html: "DuupFlow : industrialiser la variation sans sacrifier la conformité" },
    { t: "p", html: "C'est exactement le besoin que <a href=\"/\" class=\"text-indigo-300 hover:text-indigo-200 underline underline-offset-2\">DuupFlow</a> adresse avec son module Variation IA. À partir d'un fichier source, l'outil génère plusieurs déclinaisons uniques, conçues pour qu'une audience perçoive chacune comme distincte. Chaque copie reste cohérente avec l'intention d'origine mais constitue bien un contenu transformé au sens de la politique Instagram." },
    { t: "p", html: "L'outil est testable gratuitement via le <a href=\"/pricing\" class=\"text-indigo-300 hover:text-indigo-200 underline underline-offset-2\">plan Free</a> (20 duplications d'images et 10 vidéos par mois), suffisant pour valider qu'il s'intègre à votre workflow." },
    { t: "h2", id: "conclusion", html: "Conclusion" },
    { t: "p", html: "Le durcissement d'Instagram n'est pas un retour en arrière contre le multi-comptes — c'est un signal pour passer d'une approche « duplication » à une approche « déclinaison ». Les opérateurs qui adapteront leur production y gagneront : qualité perçue en hausse, portée organique stabilisée, comptes qui ne sont plus pénalisés." },
    { t: "cta", href: "/pricing", html: "Essayer DuupFlow gratuitement" },
  ],
  en: [
    { t: "lead", html: "Instagram has tightened its recommendation policy: accounts that repost content created by others see their visibility drop in Explore and the main feed. The platform now measures an account's value by the originality of what it publishes — not just by volume." },
    { t: "p", html: "For social agencies, creators who run several themed accounts, and brands that duplicate their content, the change is concrete: posting the same file across several accounts becomes a negative signal. This update was detailed by <a href=\"https://www.leptidigital.fr/reseaux-sociaux/instagram-lutte-contenus-non-originaux-89802/\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-indigo-300 hover:text-indigo-200 underline underline-offset-2\">LeptiDigital</a>." },
    { t: "p", html: "In this article we break down what Instagram means by <em>unoriginal</em>, who's affected, what it changes for multi-account posting, and how to keep scaling without falling into the clone-post trap." },
    { t: "h2", id: "definition", html: "What Instagram now considers “unoriginal”" },
    { t: "p", html: "Instagram frames originality around three criteria: the content is created by the user themselves, it brings a unique perspective, or it significantly transforms pre-existing content. That last point changes everything — simple reposting doesn't meet the definition." },
    { t: "p", html: "In practice, the following are considered <strong>unoriginal</strong>:" },
    { t: "ul", items: ["simple reposts, even with a creator credit;", "videos repackaged with an added watermark or credit;", "content from aggregators (TikTok compilations, for example);", "posts that are strictly identical from one account to another."] },
    { t: "p", html: "Conversely, Instagram rewards <strong>transformed</strong> content: an edit that creates a new narrative, a personal take on a viral video, a version that adapts the format or tone to a specific audience. The bar isn't legal but editorial: what matters is that a user seeing the post can perceive a creative intent." },
    { t: "h2", id: "impactes", html: "Who is affected?" },
    { t: "p", html: "Three profiles take the update head-on." },
    { t: "p", html: "<strong>Aggregators and repost accounts.</strong> Any account whose strategy relies on systematic reposting loses reach: the algorithm assigns it a low originality score, which progressively excludes it from Explore recommendations." },
    { t: "p", html: "<strong>Brand and creator showcase accounts.</strong> Many entrepreneurs run several accounts to reach distinct audiences. If those accounts push the same videos without variation, they're treated as duplicates." },
    { t: "h3", html: "Multi-account setups: the most exposed profile" },
    { t: "p", html: "Social agencies and OFM creators have the most to lose. When five accounts from the same operator post the same video on the same day, Instagram detects the redundancy and limits the organic reach of the following posts. The cost is twofold: a post's performance drops, and the account's long-term health degrades." },
    { t: "h2", id: "consequences", html: "The concrete consequences" },
    { t: "p", html: "The penalty isn't a suspension but an algorithmic muting. Four observed effects:" },
    { t: "ol", items: ["<strong>Reduced organic reach.</strong> Posts deemed unoriginal are served less in followers' feeds and are nearly absent from recommendations.", "<strong>Exclusion from Explore.</strong> Reposted content is no longer pushed beyond the follower base.", "<strong>Limited recommendations.</strong> The account itself is suggested less to interested users.", "<strong>Demonetization on Facebook.</strong> Accounts tied to a monetized Facebook see revenue fall when the same rule applies on Meta's side."] },
    { t: "h2", id: "multi-comptes", html: "The real stake for multi-account posting" },
    { t: "p", html: "The classic mistake is to see this change as a technical “duplicate” problem. The real stake is elsewhere: Instagram compares the <strong>perceived content</strong>, not just the raw file. Two visually identical videos will be treated as unoriginal, even with different metadata or file names." },
    { t: "p", html: "For multi-account operators, no superficial tweak is enough. Adding a watermark, changing the bitrate, editing the EXIF — these stay invisible to the eye. Yet Instagram's system judges what a human would see. If the perception is identical, the “unoriginal” signal is raised." },
    { t: "h2", id: "conformite", html: "How to stay compliant" },
    { t: "p", html: "The strategic answer fits in one word: <strong>vary</strong>. For the same video to be posted across several accounts without triggering the unoriginality signal, each posting must show a perceptible difference." },
    { t: "p", html: "Concrete levers:" },
    { t: "ul", items: ["<strong>Reframing and reformatting</strong> — adapt the ratio, crop, and framing to each account's tone;", "<strong>Visual variations</strong> — brightness, contrast, color mood that change the overall impression;", "<strong>Motion changes</strong> — speed, subtle zooms, distinct transitions;", "<strong>Editorial adaptations</strong> — caption, voice intro, or subtitles tailored to the account's audience."] },
    { t: "p", html: "The goal isn't to fool the algorithm but to <strong>actually produce</strong> several versions tailored to each audience. At scale, you can't manually redo five variants per post per account." },
    { t: "h2", id: "duupflow", html: "DuupFlow: industrialize variation without sacrificing compliance" },
    { t: "p", html: "That's exactly the need <a href=\"/\" class=\"text-indigo-300 hover:text-indigo-200 underline underline-offset-2\">DuupFlow</a> addresses with its AI Variation module. From a source file, the tool generates several unique versions, designed so an audience perceives each as distinct. Each copy stays consistent with the original intent yet counts as transformed content under Instagram's policy." },
    { t: "p", html: "The tool is free to try on the <a href=\"/pricing\" class=\"text-indigo-300 hover:text-indigo-200 underline underline-offset-2\">Free plan</a> (20 image duplications and 10 videos per month), enough to check it fits your workflow." },
    { t: "h2", id: "conclusion", html: "Conclusion" },
    { t: "p", html: "Instagram's crackdown isn't a step back against multi-account strategies — it's a signal to move from a “duplication” approach to a “variation” approach. Operators who adapt their production will gain: higher perceived quality, stabilized organic reach, accounts that are no longer penalized." },
    { t: "cta", href: "/pricing", html: "Try DuupFlow for free" },
  ],
};

function renderBlock(b: Block, i: number) {
  switch (b.t) {
    case "lead":
      return <p key={i} className="text-lg md:text-xl text-white/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: b.html }} />;
    case "p":
      return <p key={i} dangerouslySetInnerHTML={{ __html: b.html }} />;
    case "h2":
      return <h2 key={i} id={b.id} className="pt-6 text-2xl md:text-3xl font-bold tracking-tight text-white" dangerouslySetInnerHTML={{ __html: b.html }} />;
    case "h3":
      return <h3 key={i} className="pt-4 text-xl md:text-2xl font-semibold tracking-tight text-white/95" dangerouslySetInnerHTML={{ __html: b.html }} />;
    case "ul":
      return <ul key={i} className="list-disc list-outside space-y-2 pl-6 marker:text-indigo-300/70">{b.items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: it }} />)}</ul>;
    case "ol":
      return <ol key={i} className="list-decimal list-outside space-y-2 pl-6 marker:text-indigo-300/70 marker:font-semibold">{b.items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: it }} />)}</ol>;
    case "cta":
      return (
        <div key={i} className="pt-6">
          <Link href={b.href} className="btn-glow inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white">
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
  const crumb = isFr ? "Contenus non originaux Instagram" : "Instagram unoriginal content";
  const tag = isFr ? "Algorithme Instagram" : "Instagram algorithm";
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
            <nav className="text-xs text-white/40 mb-6" aria-label="Breadcrumb">
              <Link href="/blog" className="hover:text-white/70 transition">Blog</Link>
              <span className="mx-2 text-white/20">/</span>
              <span className="text-white/55">{crumb}</span>
            </nav>

            <header className="mb-10">
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">{META[lang].h1}</h1>
              <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-wider text-white/40">
                <time dateTime={PUBLISHED_AT}>{dateLabel}</time>
                <span className="text-white/20">•</span>
                <span>{READING[lang]} {read}</span>
                <span className="text-white/20">•</span>
                <span>{tag}</span>
              </div>
            </header>

            <div className="space-y-6 text-[15px] md:text-base leading-relaxed text-white/80">
              {BODY[lang].map(renderBlock)}
            </div>

            <section className="mt-16 pt-10 border-t border-white/[0.08]">
              <h2 id="faq" className="scroll-mt-28 text-2xl md:text-3xl font-bold tracking-tight text-white mb-6">{faqTitle}</h2>
              <div className="space-y-6">
                {FAQ[lang].map((item, i) => (
                  <div key={i}>
                    <h3 className="text-base md:text-lg font-semibold text-white/95 mb-2">{item.q}</h3>
                    <p className="text-sm md:text-[15px] text-white/65 leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-12 pt-6 border-t border-white/[0.06]">
              <Link href="/blog" className="text-sm text-white/55 hover:text-white transition">{back}</Link>
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

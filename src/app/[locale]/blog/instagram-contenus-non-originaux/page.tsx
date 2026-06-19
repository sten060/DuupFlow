// src/app/[locale]/blog/instagram-contenus-non-originaux/page.tsx
//
// SEO article. FR-canonical, EN serves a small stub with link to the FR
// version (article is French only — see consigne). The JSON-LD FAQPage at
// the bottom of the FR render targets featured snippets.

import type { Metadata } from "next";
import Link from "@/components/LocaleLink";
import ArticleTOC, { type TocSection } from "../_components/ArticleTOC";

const SLUG = "instagram-contenus-non-originaux";
const PUBLISHED_AT = "2026-05-23";
const READING_MIN = 7;
const CANONICAL_FR = `/fr/blog/${SLUG}`;

/* ── Source of truth for the article's H2 sections.
 *    Used both as scroll-spy targets (via id) and as TOC items. */
const SECTIONS: TocSection[] = [
  { id: "definition",    label: "Ce qu'Instagram considère désormais comme « non original »" },
  { id: "impactes",      label: "Qui est impacté ?" },
  { id: "consequences",  label: "Les conséquences concrètes" },
  { id: "multi-comptes", label: "Le vrai enjeu pour la diffusion multi-comptes" },
  { id: "conformite",    label: "Comment rester conforme" },
  { id: "duupflow",      label: "DuupFlow : industrialiser la variation" },
  { id: "conclusion",    label: "Conclusion" },
  { id: "faq",           label: "Questions fréquentes" },
];

const META_TITLE_FR = "Contenus non originaux Instagram : nouveautés 2026";
const META_DESC_FR =
  "Instagram limite la portée des comptes qui republient du contenu non original. Ce qui change en 2026 et comment rester conforme.";

const META_TITLE_EN = "Instagram non-original content rule (2026) — in French";
const META_DESC_EN =
  "DuupFlow blog article on Instagram's 2026 non-original content policy. Available in French only.";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isFr = locale === "fr";
  return {
    title: isFr ? META_TITLE_FR : META_TITLE_EN,
    description: isFr ? META_DESC_FR : META_DESC_EN,
    alternates: {
      canonical: CANONICAL_FR,
      languages: { "fr-FR": CANONICAL_FR },
    },
    openGraph: {
      title: META_TITLE_FR,
      description: META_DESC_FR,
      url: `https://www.duupflow.com${CANONICAL_FR}`,
      type: "article",
      locale: "fr_FR",
      publishedTime: PUBLISHED_AT,
    },
  };
}

/* ── FAQ data — shared between rendered HTML and JSON-LD schema ─────── */
const FAQ: { q: string; a: string }[] = [
  {
    q: "Qu'est-ce qu'un contenu non original pour Instagram en 2026 ?",
    a:
      "Instagram considère comme non original tout contenu republié sans transformation significative : reposts simples, vidéos avec filigrane ajouté, compilations issues d'autres plateformes. Le critère est la perception : un utilisateur doit pouvoir reconnaître une intention de création propre au compte.",
  },
  {
    q: "Est-ce que poster le même contenu sur plusieurs de mes comptes est interdit ?",
    a:
      "Ce n'est pas interdit, mais c'est désormais pénalisé en visibilité. Si vos comptes diffusent la même vidéo sans variation, ils sont traités comme un doublon algorithmique. Pour éviter la perte de portée, chaque compte devrait recevoir une déclinaison distincte.",
  },
  {
    q: "Modifier les métadonnées d'une vidéo suffit-il à rester conforme ?",
    a:
      "Non. Instagram analyse le contenu perçu (image, vidéo, audio), pas les métadonnées. Changer un bitrate ou les EXIF ne crée aucune différence à l'œil et n'a aucun effet sur le score d'originalité du compte.",
  },
  {
    q: "Comment savoir si mon compte est impacté ?",
    a:
      "Si la portée moyenne de vos publications a chuté ces dernières semaines sans changement éditorial, vérifiez la part de contenu reposté par rapport à du contenu transformé sur les 30 derniers jours. Les statistiques Instagram affichent aussi une mention lorsqu'un compte est exclu des recommandations.",
  },
];

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const ARTICLE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Instagram et les contenus non originaux : ce qui change pour vos comptes en 2026",
  datePublished: PUBLISHED_AT,
  dateModified: PUBLISHED_AT,
  inLanguage: "fr-FR",
  author: { "@type": "Organization", name: "DuupFlow" },
  publisher: {
    "@type": "Organization",
    name: "DuupFlow",
    logo: { "@type": "ImageObject", url: "https://www.duupflow.com/logo-mark.png" },
  },
  mainEntityOfPage: { "@type": "WebPage", "@id": `https://www.duupflow.com${CANONICAL_FR}` },
};

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // EN visitors get a stub linking to the canonical FR version. We keep
  // /en/blog/<slug> live so internal nav stays consistent, but the SEO
  // canonical points at /fr/blog/<slug>.
  if (locale === "en") {
    return (
      <main className="px-6 py-24">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-indigo-300/60 mb-4">DuupFlow Blog</p>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-4">
            This article is currently available in French
          </h1>
          <p className="text-white/55 mb-8">
            We are publishing this analysis in French first. The English version is on the way.
          </p>
          <Link
            href={`/blog/${SLUG}`}
            className="btn-glow inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white"
          >
            Lire l&apos;article en français →
          </Link>
        </div>
      </main>
    );
  }

  const dateLabel = new Date(PUBLISHED_AT).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      {/* Schema.org structured data — visible to crawlers only */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ARTICLE_JSONLD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
      />

      <main className="px-6 py-12 md:py-16">
        {/* 12-col grid: article on the left, sticky TOC on the right.
            On <lg screens the TOC is hidden and the article goes full width. */}
        <div className="max-w-6xl mx-auto grid grid-cols-12 gap-10 lg:gap-14">
          <article className="col-span-12 lg:col-span-8 [&_h2]:scroll-mt-28 [&_h3]:scroll-mt-28">
          {/* Breadcrumb */}
          <nav className="text-xs text-white/40 mb-6" aria-label="Fil d'Ariane">
            <Link href="/blog" className="hover:text-white/70 transition">Blog</Link>
            <span className="mx-2 text-white/20">/</span>
            <span className="text-white/55">Contenus non originaux Instagram</span>
          </nav>

          {/* Header */}
          <header className="mb-10">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
              Instagram et les contenus non originaux : ce qui change pour vos comptes en 2026
            </h1>
            <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-wider text-white/40">
              <time dateTime={PUBLISHED_AT}>{dateLabel}</time>
              <span className="text-white/20">•</span>
              <span>{READING_MIN} min de lecture</span>
              <span className="text-white/20">•</span>
              <span>Algorithme Instagram</span>
            </div>
          </header>

          {/* Body — Tailwind utilities only (no @tailwindcss/typography dep) */}
          <div className="space-y-6 text-[15px] md:text-base leading-relaxed text-white/80">
            <p className="text-lg md:text-xl text-white/90 leading-relaxed">
              Instagram a durci sa politique de recommandation : les comptes qui republient du
              contenu créé par d&apos;autres voient leur visibilité chuter dans l&apos;Explorer et le fil
              principal. La plateforme considère désormais que la valeur d&apos;un compte se mesure à
              l&apos;originalité de ce qu&apos;il publie — et plus seulement au volume.
            </p>
            <p>
              Pour les agences sociales, les créateurs qui gèrent plusieurs comptes thématiques et
              les marques qui dupliquent leur contenu sur leurs propres canaux, le changement est
              concret : poster le même fichier sur plusieurs comptes devient un signal négatif. Cette
              mise à jour a été détaillée par{" "}
              <a
                href="https://www.leptidigital.fr/reseaux-sociaux/instagram-lutte-contenus-non-originaux-89802/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-300 hover:text-indigo-200 underline underline-offset-2"
              >
                LeptiDigital
              </a>
              .
            </p>
            <p>
              Dans cet article, on décrypte ce qu&apos;Instagram entend par <em>non original</em>, qui est
              concerné, ce que cela change pour la diffusion multi-comptes, et comment continuer à
              scaler sans tomber dans le piège des publications cloniques.
            </p>

            <h2 id="definition" className="pt-6 text-2xl md:text-3xl font-bold tracking-tight text-white">
              Ce qu&apos;Instagram considère désormais comme « non original »
            </h2>
            <p>
              Dans sa communication officielle, Instagram structure l&apos;originalité autour de trois
              critères : le contenu est créé par l&apos;utilisateur lui-même, il apporte une perspective
              unique, ou il transforme significativement un contenu préexistant. C&apos;est ce dernier
              point qui change tout — la simple republication n&apos;entre pas dans cette définition.
            </p>
            <p>Concrètement, sont considérés comme <strong>non originaux</strong> :</p>
            <ul className="list-disc list-outside space-y-2 pl-6 marker:text-indigo-300/70">
              <li>les reposts simples, même avec mention du créateur ;</li>
              <li>les vidéos repackagées avec un filigrane ou un crédit ajouté ;</li>
              <li>les contenus issus d&apos;agrégateurs (compilations de TikToks, par exemple) ;</li>
              <li>les publications strictement identiques d&apos;un compte à un autre.</li>
            </ul>
            <p>
              À l&apos;inverse, Instagram valorise les contenus <strong>transformés</strong> : un montage
              qui crée une nouvelle narration, un commentaire personnel sur une vidéo virale, une
              déclinaison qui adapte le format ou le ton à un public spécifique. La barrière n&apos;est
              pas juridique mais éditoriale : ce qui compte, c&apos;est qu&apos;un utilisateur qui voit le
              post puisse percevoir une intention de création.
            </p>

            <h2 id="impactes" className="pt-6 text-2xl md:text-3xl font-bold tracking-tight text-white">
              Qui est impacté ?
            </h2>
            <p>Trois profils encaissent la mise à jour de plein fouet.</p>
            <p>
              <strong>Les agrégateurs et comptes de reposts.</strong> Tout compte dont la stratégie
              repose sur la republication systématique perd en portée. L&apos;algorithme leur attribue
              désormais un score d&apos;originalité bas, ce qui les exclut progressivement des
              recommandations Explorer.
            </p>
            <p>
              <strong>Les comptes vitrines de marques et créateurs.</strong> Beaucoup
              d&apos;entrepreneurs gèrent plusieurs comptes Instagram pour adresser des audiences
              distinctes (B2B, B2C, thématique 1, thématique 2). Si ces comptes diffusent les mêmes
              vidéos sans variation, ils sont traités comme des doublons.
            </p>

            <h3 className="pt-4 text-xl md:text-2xl font-semibold tracking-tight text-white/95">
              Les setups multi-comptes : le profil le plus exposé
            </h3>
            <p>
              Les agences sociales et les créateurs OFM ont particulièrement à perdre. Quand cinq
              comptes appartenant au même opérateur postent la même vidéo le même jour, Instagram
              détecte la redondance et limite la portée organique des publications ultérieures. Le
              coût est double : la performance d&apos;un post chute, et la santé du compte sur le long
              terme se dégrade.
            </p>

            <h2 id="consequences" className="pt-6 text-2xl md:text-3xl font-bold tracking-tight text-white">
              Les conséquences concrètes
            </h2>
            <p>
              La sanction n&apos;est pas une suspension mais une mise en sourdine algorithmique.
              Quatre effets observés :
            </p>
            <ol className="list-decimal list-outside space-y-2 pl-6 marker:text-indigo-300/70 marker:font-semibold">
              <li>
                <strong>Réduction de la portée organique.</strong> Les publications jugées non
                originales sont moins servies dans le fil des abonnés et quasi absentes des
                recommandations.
              </li>
              <li>
                <strong>Exclusion de l&apos;Explorer.</strong> Le contenu reposté n&apos;est plus poussé
                hors de la base d&apos;abonnés du compte.
              </li>
              <li>
                <strong>Limitation des recommandations.</strong> Le compte lui-même est moins suggéré
                aux utilisateurs qui pourraient être intéressés.
              </li>
              <li>
                <strong>Démonétisation sur Facebook.</strong> Les comptes liés à un Facebook monétisé
                voient leurs revenus baissés quand la même règle s&apos;applique côté Meta.
              </li>
            </ol>
            <p>
              Instagram a également annoncé un outil de <strong>détection de similarité</strong> côté
              créateur, qui permettra aux comptes originaux de signaler quand leur contenu est
              republié sans transformation suffisante. Cela renforce la dimension communautaire du
              dispositif.
            </p>

            <h2 id="multi-comptes" className="pt-6 text-2xl md:text-3xl font-bold tracking-tight text-white">
              Le vrai enjeu pour la diffusion multi-comptes
            </h2>
            <p>
              L&apos;erreur classique est de penser ce changement comme un problème de « doublon » — au
              sens où deux fichiers identiques poseraient un souci de détection technique. Le vrai
              enjeu est ailleurs : Instagram compare le <strong>contenu perçu</strong>, pas
              uniquement le fichier brut. Deux vidéos identiques visuellement seront traitées comme
              du contenu non original, même si elles ont des métadonnées différentes ou des noms de
              fichier distincts.
            </p>
            <p>
              Pour les opérateurs multi-comptes, cela signifie qu&apos;aucun ajustement superficiel ne
              suffit. Ajouter un filigrane, modifier le bitrate, changer les EXIF — ces
              modifications restent invisibles à l&apos;œil. Or le système Instagram juge ce qu&apos;un
              humain verrait. Si la perception est identique, le signal « non original » est levé.
            </p>
            <p>
              L&apos;enjeu de visibilité n&apos;est donc plus de « passer entre les gouttes » mais bien de
              produire du contenu qui soit, à l&apos;œil nu, perçu comme distinct d&apos;un compte à
              l&apos;autre.
            </p>

            <h2 id="conformite" className="pt-6 text-2xl md:text-3xl font-bold tracking-tight text-white">
              Comment rester conforme
            </h2>
            <p>
              La réponse stratégique se résume en un mot : <strong>varier</strong>. Pour qu&apos;un
              même message — par exemple une vidéo produit — soit diffusé sur plusieurs comptes sans
              déclencher le signal de non-originalité, chaque diffusion doit présenter une
              différence perceptible.
            </p>
            <p>Pistes concrètes :</p>
            <ul className="list-disc list-outside space-y-2 pl-6 marker:text-indigo-300/70">
              <li><strong>Recadrage et reformatage</strong> — adapter le ratio, le crop, le cadre au ton de chaque compte ;</li>
              <li><strong>Variations visuelles</strong> — ajustements de luminosité, contraste, ambiance colorimétrique qui modifient l&apos;impression générale ;</li>
              <li><strong>Modifications de mouvement</strong> — changement de vitesse, zooms subtils, transitions distinctes ;</li>
              <li><strong>Adaptations éditoriales</strong> — légende, intro vocale ou sous-titres adaptés à l&apos;audience du compte.</li>
            </ul>
            <p>
              L&apos;objectif n&apos;est pas de tromper l&apos;algorithme mais de <strong>produire réellement</strong>
              {" "}plusieurs versions adaptées à chaque audience. C&apos;est exigeant : à l&apos;échelle, on ne
              peut pas refaire manuellement cinq variantes par publication et par compte.
            </p>

            <h3 className="pt-4 text-xl md:text-2xl font-semibold tracking-tight text-white/95">
              La variation à grande échelle : le vrai défi
            </h3>
            <p>
              C&apos;est précisément le point de rupture entre une stratégie multi-comptes artisanale et
              une approche industrielle. La conformité ne pose pas de problème pour celui qui a
              trente minutes par publication ; elle devient bloquante dès qu&apos;on parle de plusieurs
              dizaines de variantes par jour.
            </p>

            <h2 id="duupflow" className="pt-6 text-2xl md:text-3xl font-bold tracking-tight text-white">
              DuupFlow : industrialiser la variation sans sacrifier la conformité
            </h2>
            <p>
              C&apos;est exactement le besoin que <Link href="/" className="text-indigo-300 hover:text-indigo-200 underline underline-offset-2">DuupFlow</Link>{" "}
              adresse avec son module <Link href="/features" className="text-indigo-300 hover:text-indigo-200 underline underline-offset-2">Variation IA</Link>.
              À partir d&apos;un fichier source — image ou vidéo —, l&apos;outil génère plusieurs
              déclinaisons uniques, conçues pour qu&apos;une audience perçoive chacune comme distincte.
              Recadrages différents, retouches visuelles, ajustements de mouvement : chaque copie
              reste cohérente avec l&apos;intention créative d&apos;origine mais constitue bien un contenu
              transformé au sens de la politique Instagram.
            </p>
            <p>
              L&apos;approche est revendiquée comme <strong>alignée</strong> avec les exigences
              d&apos;originalité, pas en contournement :
            </p>
            <ul className="list-disc list-outside space-y-2 pl-6 marker:text-indigo-300/70">
              <li>chaque variante est conçue pour être perçue comme distincte par un humain, ce qui correspond à ce que valorise l&apos;algorithme ;</li>
              <li>le pipeline est pensé pour le multi-comptes — vous générez cinq variantes en une opération et les attribuez à chaque compte ;</li>
              <li>aucun engagement n&apos;est pris côté DuupFlow sur les métadonnées : le travail porte sur le contenu visuel et sonore, ce qu&apos;Instagram regarde réellement.</li>
            </ul>
            <p>
              L&apos;outil est testable gratuitement via le{" "}
              <Link href="/pricing" className="text-indigo-300 hover:text-indigo-200 underline underline-offset-2">plan Free</Link>
              {" "}(20 duplications d&apos;images et 10 vidéos par mois), suffisant pour valider qu&apos;il
              s&apos;intègre à votre workflow avant tout engagement.
            </p>

            <h2 id="conclusion" className="pt-6 text-2xl md:text-3xl font-bold tracking-tight text-white">
              Conclusion
            </h2>
            <p>
              Le durcissement d&apos;Instagram contre les contenus non originaux n&apos;est pas un retour en
              arrière contre le multi-comptes — c&apos;est un signal pour passer d&apos;une approche
              « duplication » à une approche « déclinaison ». Les opérateurs qui adapteront leur
              production y trouveront un avantage : la qualité perçue de leur fil augmente, leur
              portée organique se stabilise, leurs comptes ne sont plus pénalisés.
            </p>
            <p>
              Pour les agences et créateurs qui gèrent plusieurs comptes, l&apos;industrialisation de la
              variation devient un avantage compétitif.{" "}
              <Link href="/register" className="text-indigo-300 hover:text-indigo-200 underline underline-offset-2">
                Essayez DuupFlow gratuitement
              </Link>{" "}
              pour voir comment générer en quelques secondes les déclinaisons dont vos publications
              ont besoin.
            </p>

            <div className="pt-6">
              <Link
                href="/register"
                className="btn-glow inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white"
              >
                Commencer gratuitement
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>

          {/* FAQ */}
          <section className="mt-16 pt-10 border-t border-white/[0.08]">
            <h2 id="faq" className="scroll-mt-28 text-2xl md:text-3xl font-bold tracking-tight text-white mb-6">
              Questions fréquentes
            </h2>
            <div className="space-y-6">
              {FAQ.map((item, i) => (
                <div key={i}>
                  <h3 className="text-base md:text-lg font-semibold text-white/95 mb-2">{item.q}</h3>
                  <p className="text-sm md:text-[15px] text-white/65 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Back to index */}
          <div className="mt-12 pt-6 border-t border-white/[0.06]">
            <Link href="/blog" className="text-sm text-white/55 hover:text-white transition">
              ← Retour au blog
            </Link>
          </div>
        </article>

          {/* Sticky TOC — visible on lg+ screens.
              Sits beside the article and tracks the current heading via
              IntersectionObserver inside ArticleTOC (client component). */}
          <aside className="hidden lg:block lg:col-span-4">
            <div className="sticky top-28">
              <ArticleTOC sections={SECTIONS} />
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

// src/app/[locale]/blog/page.tsx
//
// Index of the DuupFlow blog. Each article lives in its own folder under
// /app/[locale]/blog/<slug>/page.tsx. To add a new article: create the
// folder, write page.tsx, then add an entry to ARTICLES below.
//
// This intentionally uses plain TSX (no MDX / CMS) so we don't pull in
// any new dependency. The data layer is a typed array — if we ever
// migrate to MDX or a CMS, this stays as the seed list during cutover.

import type { Metadata } from "next";
import Link from "@/components/LocaleLink";
import { notFound } from "next/navigation";
import { Label, BLUE } from "@/components/landing/shell";

type Article = {
  slug: string;          // FR / default slug
  slugEn?: string;       // EN slug when it differs from the FR one
  /** Locale in which the article is authored. Bilingual articles set both
   *  the *En fields; FR-only ones fall back to the FR copy under /en. */
  locale: "fr" | "en";
  title: string;
  titleEn?: string;
  excerpt: string;
  excerptEn?: string;
  publishedAt: string;   // ISO date
  readingMinutes: number;
};

const ARTICLES: Article[] = [
  {
    slug: "reposter-meme-video-plusieurs-comptes-tiktok-instagram",
    locale: "fr",
    title: "Reposter la même vidéo sur plusieurs comptes TikTok et Instagram : la méthode qui fonctionne en 2026",
    titleEn: "Reposting the same video across multiple TikTok and Instagram accounts: the method that works in 2026",
    excerpt:
      "Reposter le même fichier sur plusieurs comptes ne marche pas : les plateformes reconnaissent le doublon et coupent la portée. La solution est de générer des copies uniques.",
    excerptEn:
      "Reposting the same file across multiple accounts doesn't work: platforms recognize the duplicate and cut reach. The fix is to generate unique copies.",
    publishedAt: "2026-08-01",
    readingMinutes: 8,
  },
  {
    slug: "automatiser-production-contenu-api-duupflow",
    locale: "fr",
    title: "Automatiser toute sa production de contenu avec l'API DuupFlow",
    titleEn: "Automate your entire content production with the DuupFlow API",
    excerpt:
      "Un pipeline qui tourne seul : Google Drive → tri IA → duplication DuupFlow → dispatch par compte → planning. Le guide complet, avec un prompt Claude Code à copier-coller pour tout reproduire.",
    excerptEn:
      "A pipeline that runs itself: Google Drive → AI sort → DuupFlow duplication → per-account dispatch → schedule. The full guide, with a copy-paste Claude Code prompt to reproduce it all.",
    publishedAt: "2026-07-04",
    readingMinutes: 9,
  },
  {
    slug: "tiktok-ineligible-recommandations",
    slugEn: "tiktok-ineligible-for-recommendation",
    locale: "fr",
    title: "Pourquoi ton TikTok est « inéligible aux recommandations » — et comment vraiment régler le problème",
    titleEn: "Why your TikTok is “ineligible for recommendation” — and how to actually fix it",
    excerpt:
      "Tes vues TikTok ont chuté et tu es flag pour « contenu non original, de mauvaise qualité ou QR » ? Ce que ça veut vraiment dire, pourquoi faire appel ne suffit pas, et ce qui remet ton contenu dans le feed.",
    excerptEn:
      "Your TikTok views collapsed and you were flagged for “unoriginal, low-quality, or QR content”? What it really means, why appealing isn't enough, and what puts your content back in the feed.",
    publishedAt: "2026-06-21",
    readingMinutes: 8,
  },
  {
    slug: "instagram-contenus-non-originaux",
    locale: "fr",
    title: "Instagram et les contenus non originaux : ce qui change pour vos comptes en 2026",
    titleEn: "Instagram and unoriginal content: what changes for your accounts in 2026",
    excerpt:
      "Instagram limite la portée des comptes qui republient du contenu sans transformation. Décryptage de la mise à jour, des comptes impactés, et de la stratégie multi-comptes à adopter.",
    excerptEn:
      "Instagram limits the reach of accounts that repost content without transformation. A breakdown of the update, who's affected, and the multi-account strategy to adopt.",
    publishedAt: "2026-05-23",
    readingMinutes: 7,
  },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isFr = locale === "fr";
  return {
    title: isFr ? "Blog DuupFlow" : "DuupFlow Blog",
    description: isFr
      ? "Analyses et conseils sur la diffusion de contenu sur Instagram, TikTok et les plateformes sociales."
      : "Insights on content distribution across Instagram, TikTok and other social platforms.",
    alternates: { canonical: `/${locale}/blog` },
  };
}

export default async function BlogIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== "fr" && locale !== "en") notFound();
  const isFr = locale === "fr";

  const THUMBS = [
    "from-[#d9e6ff] to-[#e6ddff]",
    "from-[#e6ddff] to-[#d9e6ff]",
    "from-[#d4e8ff] to-[#dde2ff]",
    "from-[#e2e0ff] to-[#d9ecff]",
    "from-[#dbe4ff] to-[#ecdcff]",
  ];
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(isFr ? "fr-FR" : "en-US", { day: "numeric", month: "long", year: "numeric" });
  const pick = (a: Article) => ({
    slug: isFr ? a.slug : a.slugEn ?? a.slug,
    title: isFr ? a.title : a.titleEn ?? a.title,
    excerpt: isFr ? a.excerpt : a.excerptEn ?? a.excerpt,
  });

  const [featured, ...rest] = ARTICLES;
  const f = pick(featured);

  return (
    <div>
      {/* En-tête */}
      <section className="relative overflow-hidden px-6 pb-14 pt-12 sm:pt-16">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[520px]"
          style={{ background: "radial-gradient(60% 100% at 50% 0%, rgba(99,102,241,0.10), transparent 70%)" }} />
        <div className="relative mx-auto max-w-3xl text-center">
          <Label>{isFr ? "Blog" : "Blog"}</Label>
          <h1 className="mx-auto mt-6 max-w-2xl font-semibold tracking-[-0.03em] text-[#1a1a1a]"
            style={{ fontSize: "clamp(34px, 5vw, 58px)", lineHeight: 1.06 }}>
            {isFr ? "Reposter plus intelligemment." : "Repost smarter."}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-[#3a3f4b] sm:text-[18px]">
            {isFr
              ? "Analyses, mises à jour algo et stratégies de diffusion pour les créateurs et agences multi-comptes."
              : "Algorithm updates and distribution strategies for multi-account creators and agencies."}
          </p>
        </div>
      </section>

      {/* Articles */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-6xl">
          {/* À la une */}
          <Link href={`/blog/${f.slug}`}
            className="group grid overflow-hidden rounded-[32px] bg-white ring-1 ring-black/[0.06] shadow-[0_20px_60px_rgba(20,40,90,0.08)] transition hover:shadow-[0_28px_80px_rgba(20,40,90,0.12)] md:grid-cols-2">
            <div className={`relative min-h-[240px] bg-gradient-to-br ${THUMBS[0]} md:min-h-[360px]`}>
              <span className="absolute left-5 top-5 inline-flex items-center rounded-full bg-white/85 px-3 py-1 text-[12px] font-medium text-[#1a1a1a] shadow ring-1 ring-black/5 backdrop-blur">
                {isFr ? "À la une" : "Featured"}
              </span>
            </div>
            <div className="flex flex-col justify-center p-8 sm:p-10">
              <div className="flex items-center gap-2.5 text-[12px] text-[#8a8a8a]">
                <span>{fmt(featured.publishedAt)}</span><span className="text-black/20">•</span>
                <span>{featured.readingMinutes} min</span>
              </div>
              <h2 className="mt-3 text-[24px] font-semibold leading-snug tracking-tight text-[#1a1a1a] sm:text-[28px]">{f.title}</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[#605f5f]">{f.excerpt}</p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: BLUE }}>
                {isFr ? "Lire l'article" : "Read article"}
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </div>
          </Link>

          {/* Grille */}
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((a, i) => {
              const p = pick(a);
              return (
                <Link key={a.slug} href={`/blog/${p.slug}`}
                  className="group flex flex-col overflow-hidden rounded-[28px] bg-white ring-1 ring-black/[0.06] transition hover:shadow-[0_20px_50px_rgba(20,40,90,0.10)]">
                  <div className={`aspect-[16/10] bg-gradient-to-br ${THUMBS[(i + 1) % THUMBS.length]}`} />
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center gap-2.5 text-[12px] text-[#8a8a8a]">
                      <span>{fmt(a.publishedAt)}</span><span className="text-black/20">•</span>
                      <span>{a.readingMinutes} min</span>
                    </div>
                    <h3 className="mt-2.5 text-[18px] font-semibold leading-snug tracking-tight text-[#1a1a1a]">{p.title}</h3>
                    <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-[#605f5f]">{p.excerpt}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: BLUE }}>
                      {isFr ? "Lire l'article" : "Read article"}
                      <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

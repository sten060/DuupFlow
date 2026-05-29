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

type Article = {
  slug: string;
  /** Locale in which the article is authored. Visitors landing on another
   *  locale see a stub with a link to the canonical version. */
  locale: "fr" | "en";
  title: string;
  excerpt: string;
  publishedAt: string;   // ISO date
  readingMinutes: number;
};

const ARTICLES: Article[] = [
  {
    slug: "instagram-contenus-non-originaux",
    locale: "fr",
    title: "Instagram et les contenus non originaux : ce qui change pour vos comptes en 2026",
    excerpt:
      "Instagram limite la portée des comptes qui republient du contenu sans transformation. Décryptage de la mise à jour, des comptes impactés, et de la stratégie multi-comptes à adopter.",
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

  return (
    <main className="px-6 py-16 md:py-24">
      <div className="max-w-3xl mx-auto">
        <header className="mb-10">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-indigo-300/70 mb-3">
            {isFr ? "Le blog" : "Blog"}
          </p>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            {isFr ? "Distribuer son contenu, sans perdre en visibilité" : "Distribute your content without losing reach"}
          </h1>
          <p className="mt-4 text-base md:text-lg text-white/55 max-w-2xl">
            {isFr
              ? "Analyses, mises à jour algorithmiques et stratégies de diffusion pour les agences et créateurs multi-comptes."
              : "Algorithm updates and distribution strategies for agencies and multi-account creators."}
          </p>
        </header>

        <ul className="space-y-6">
          {ARTICLES.map((a) => {
            const dateLabel = new Date(a.publishedAt).toLocaleDateString(
              isFr ? "fr-FR" : "en-US",
              { day: "numeric", month: "long", year: "numeric" },
            );
            return (
              <li
                key={a.slug}
                className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition p-6 md:p-8"
              >
                <Link href={`/blog/${a.slug}`} className="block">
                  <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-white/40 mb-3">
                    <span>{dateLabel}</span>
                    <span className="text-white/20">•</span>
                    <span>{a.readingMinutes} min</span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white/95 group-hover:text-white transition">
                    {a.title}
                  </h2>
                  <p className="mt-3 text-sm md:text-base text-white/55 leading-relaxed">
                    {a.excerpt}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-300 group-hover:text-indigo-200 transition">
                    {isFr ? "Lire l'article" : "Read article"}
                    <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}

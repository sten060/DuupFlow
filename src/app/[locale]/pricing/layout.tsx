// Titre unique + canonical / hreflang de la page /pricing (la page elle-même est client).
import type { Metadata } from "next";
import { asLocale, pageMetadata } from "@/lib/i18n/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(asLocale(locale), "/pricing", {
    en: {
      title: "Pricing & plans — DuupFlow",
      description: "Compare DuupFlow plans: Solo, Pro and Agency. Unique copies of your videos and images for every account, monthly or yearly.",
    },
    fr: {
      title: "Tarifs et abonnements — DuupFlow",
      description: "Compare les offres DuupFlow : Solo, Pro et Agence. Des copies uniques de tes vidéos et images pour chaque compte, au mois ou à l’année.",
    },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Titre unique + canonical / hreflang de la page /partners (la page elle-même est client).
import type { Metadata } from "next";
import { asLocale, pageMetadata } from "@/lib/i18n/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(asLocale(locale), "/partners", {
    en: {
      title: "Partner program — DuupFlow",
      description: "Join the DuupFlow affiliate program and earn commissions on every client you refer.",
    },
    fr: {
      title: "Programme partenaire — DuupFlow",
      description: "Rejoins le programme d’affiliation DuupFlow et gagne des commissions sur chaque client que tu nous apportes.",
    },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Titre unique + canonical / hreflang de la page /demo-request (la page elle-même est client).
import type { Metadata } from "next";
import { asLocale, pageMetadata } from "@/lib/i18n/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(asLocale(locale), "/demo-request", {
    en: {
      title: "Contact us — DuupFlow",
      description: "Questions, demo or agency needs? Contact the DuupFlow team.",
    },
    fr: {
      title: "Nous contacter — DuupFlow",
      description: "Une question, une démo ou un besoin agence ? Contacte l’équipe DuupFlow.",
    },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

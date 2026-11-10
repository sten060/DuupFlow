// Titre unique + canonical / hreflang de la page /legal (la page elle-même est client).
import type { Metadata } from "next";
import { asLocale, pageMetadata } from "@/lib/i18n/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(asLocale(locale), "/legal", {
    en: {
      title: "Legal notice — DuupFlow",
      description: "DuupFlow legal information: publisher, hosting, terms of service and privacy policy.",
    },
    fr: {
      title: "Mentions légales — DuupFlow",
      description: "Informations légales de DuupFlow : éditeur, hébergement, CGU et politique de confidentialité.",
    },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

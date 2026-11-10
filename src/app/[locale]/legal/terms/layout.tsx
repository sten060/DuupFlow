// Titre unique + canonical / hreflang de la page /legal/terms (la page elle-même est client).
import type { Metadata } from "next";
import { asLocale, pageMetadata } from "@/lib/i18n/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(asLocale(locale), "/legal/terms", {
    en: {
      title: "Terms of Service — DuupFlow",
      description: "The terms that govern your use of DuupFlow: accounts, plans, payments, acceptable use and liability.",
    },
    fr: {
      title: "Conditions générales d’utilisation — DuupFlow",
      description: "Les conditions qui encadrent l’utilisation de DuupFlow : compte, abonnements, paiement, usage autorisé et responsabilité.",
    },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

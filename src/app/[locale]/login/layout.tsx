// Titre unique + canonical / hreflang de la page /login (la page elle-même est client).
import type { Metadata } from "next";
import { asLocale, pageMetadata } from "@/lib/i18n/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(asLocale(locale), "/login", {
    en: {
      title: "Log in — DuupFlow",
      description: "Log in to your DuupFlow account to duplicate your videos and images.",
    },
    fr: {
      title: "Connexion — DuupFlow",
      description: "Connecte-toi à ton compte DuupFlow pour dupliquer tes vidéos et images.",
    },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

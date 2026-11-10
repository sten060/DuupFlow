// Titre unique + canonical / hreflang de la page /register (la page elle-même est client).
import type { Metadata } from "next";
import { asLocale, pageMetadata } from "@/lib/i18n/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(asLocale(locale), "/register", {
    en: {
      title: "Create your account — DuupFlow",
      description: "Create your DuupFlow account and turn one video or image into unique copies for all your accounts.",
    },
    fr: {
      title: "Créer un compte — DuupFlow",
      description: "Crée ton compte DuupFlow et transforme une vidéo ou une image en copies uniques pour tous tes comptes.",
    },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

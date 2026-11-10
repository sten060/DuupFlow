// Titre unique + canonical / hreflang de la page / (la page elle-même est client).
import type { Metadata } from "next";
import { asLocale, pageMetadata } from "@/lib/i18n/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(asLocale(locale), "/", {
    en: {
      title: "DuupFlow — Multiply your content by 100 effortlessly",
      description: "Duplicate your content, let AI create variants, and feed all your accounts in minutes.",
    },
    fr: {
      title: "DuupFlow — Multiplie ton contenu par 100 sans effort",
      description: "Duplique ton contenu, laisse l’IA créer des variantes, et alimente tous tes comptes en quelques minutes.",
    },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

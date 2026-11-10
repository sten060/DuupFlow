// Titre unique + canonical / hreflang de la page /legal/privacy (la page elle-même est client).
import type { Metadata } from "next";
import { asLocale, pageMetadata } from "@/lib/i18n/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(asLocale(locale), "/legal/privacy", {
    en: {
      title: "Privacy Policy — DuupFlow",
      description: "How DuupFlow collects, uses and protects your personal data, and how to exercise your rights.",
    },
    fr: {
      title: "Politique de confidentialité — DuupFlow",
      description: "Comment DuupFlow collecte, utilise et protège tes données personnelles, et comment exercer tes droits.",
    },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

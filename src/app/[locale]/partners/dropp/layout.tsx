// Titre unique + canonical / hreflang + Open Graph de la page partenaire Dropp
// (la page elle-même est client).
import type { Metadata } from "next";
import { asLocale, pageMetadata } from "@/lib/i18n/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(asLocale(locale), "/partners/dropp", {
    en: {
      title: "DuupFlow × Dropp — Monetize your AI model on Telegram",
      description: "DuupFlow + Dropp: high-volume Instagram reels, an audience you own on Telegram, and fans who pay right inside the chat. The complete system to monetize your AI model.",
    },
    fr: {
      title: "DuupFlow × Dropp — Monétise ta modèle IA sur Telegram",
      description: "DuupFlow + Dropp : des reels Instagram en volume, une audience à toi sur Telegram, et des fans qui paient directement dans la conversation. Le système complet pour monétiser ta modèle IA.",
    },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

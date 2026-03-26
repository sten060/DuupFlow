// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "./ClientLayout";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.duupflow.com"),
  title: "DuupFlow — Duplique ton contenu en illimité",
  description:
    "DuupFlow vous permet de dupliquer vos contenus en quelques secondes, chaque fichier deviens unique aux yeux des plateformes. Conçu pour les agences souhaitant augmenter le volume de contenus sur les réseaux sociaux.",
  icons: {
    icon: "/og-image.png",
    shortcut: "/og-image.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "DuupFlow — Duplique ton contenu en illimité",
    description:
      "DuupFlow vous permet de dupliquer vos contenus en quelques secondes, chaque fichier deviens unique aux yeux des plateformes. Conçu pour les agences souhaitant augmenter le volume de contenus sur les réseaux sociaux.",
    url: "https://www.duupflow.com",
    siteName: "DuupFlow",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DuupFlow",
      },
    ],
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DuupFlow — Duplique ton contenu en illimité",
    description:
      "DuupFlow vous permet de dupliquer vos contenus en quelques secondes, chaque fichier deviens unique aux yeux des plateformes. Conçu pour les agences souhaitant augmenter le volume de contenus sur les réseaux sociaux.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="text-white antialiased">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

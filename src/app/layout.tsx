// app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import ClientLayout from "./ClientLayout";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.duupflow.com"),
  title: "DuupFlow — Duplique ton contenu en illimité",
  description:
    "DuupFlow vous permet de dupliquer vos contenus en quelques secondes, chaque fichier deviens unique aux yeux des plateformes. Conçu pour les agences souhaitant augmenter le volume de contenus sur les réseaux sociaux.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    shortcut: "/icon.png",
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
        <Script
          id="microsoft-clarity"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","w20nsuailx");`,
          }}
        />
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

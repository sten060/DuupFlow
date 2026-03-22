// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "./ClientLayout";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.duupflow.com"),
  title: "DuupFlow — Duplique ton contenu en illimité",
  description:
    "DuupFlow vous permet de dupliquer et transformer vos contenus en quelques secondes grâce à l'IA.",
  openGraph: {
    title: "DuupFlow — Duplique ton contenu en illimité",
    description:
      "DuupFlow vous permet de dupliquer et transformer vos contenus en quelques secondes grâce à l'IA.",
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
      "DuupFlow vous permet de dupliquer et transformer vos contenus en quelques secondes grâce à l'IA.",
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

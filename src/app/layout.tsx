// app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import ClientLayout from "./ClientLayout";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.duupflow.com"),
  title: "DuupFlow — Republie tes meilleurs contenus, partout",
  description:
    "Rends chaque copie unique aux yeux des algos et reposte ce qui a déjà cartonné, sans détection de doublon. Pour créateurs et agences.",
  // Favicon, icon and apple-touch-icon are emitted automatically from the App
  // Router metadata files (src/app/favicon.ico, src/app/icon.png,
  // src/app/apple-icon.png). An explicit `icons` config here only duplicates
  // those generated <link> tags, so we intentionally omit it.
  openGraph: {
    title: "DuupFlow — Republie tes meilleurs contenus, partout",
    description:
      "Rends chaque copie unique aux yeux des algos et reposte ce qui a déjà cartonné, sans détection de doublon. Pour créateurs et agences.",
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
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DuupFlow — Republie tes meilleurs contenus, partout",
    description:
      "Rends chaque copie unique aux yeux des algos et reposte ce qui a déjà cartonné, sans détection de doublon. Pour créateurs et agences.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="text-white antialiased">
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-G81RNL4BGW"
          strategy="afterInteractive"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-G81RNL4BGW');
            `,
          }}
        />
        <Script
          id="microsoft-clarity"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","w20nsuailx");`,
          }}
        />
        {/* FirstPromoter — script de suivi des parrainages. Pose les cookies
            `_fprom_ref` / `_fprom_tid` quand un visiteur arrive via un lien
            d'affilié (?ref=...). Le `tid` est ensuite transmis à Stripe. */}
        <Script
          id="firstpromoter"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w){w.fpr=w.fpr||function(){w.fpr.q=w.fpr.q||[];w.fpr.q[arguments[0]=='set'?'unshift':'push'](arguments);};})(window);fpr("init", {cid:"vhhiak0q"}); fpr("click");`,
          }}
        />
        <Script
          id="firstpromoter-cdn"
          src="https://cdn.firstpromoter.com/fpr.js"
          strategy="afterInteractive"
        />
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

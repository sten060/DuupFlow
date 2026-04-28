// app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import ClientLayout from "./ClientLayout";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.duupflow.com"),
  title: "DuupFlow — Duplicate your content infinitely",
  description:
    "DuupFlow lets you duplicate your content in seconds. Each file becomes unique in the eyes of platform algorithms. Built for agencies looking to scale their social media content.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    shortcut: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "DuupFlow — Duplicate your content infinitely",
    description:
      "DuupFlow lets you duplicate your content in seconds. Each file becomes unique in the eyes of platform algorithms. Built for agencies looking to scale their social media content.",
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
    title: "DuupFlow — Duplicate your content infinitely",
    description:
      "DuupFlow lets you duplicate your content in seconds. Each file becomes unique in the eyes of platform algorithms. Built for agencies looking to scale their social media content.",
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
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

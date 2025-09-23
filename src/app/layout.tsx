// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Content Duplicator",
  description: "My SaaS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-gray-900 text-white">
        {children}
      </body>
    </html>
  );
}
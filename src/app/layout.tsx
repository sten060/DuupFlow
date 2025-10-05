import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import UserHeader from "./UserHeader";

export const metadata: Metadata = {
  title: "Ton SaaS — Metadata & Duplication",
  description: "Outil OFM pour dupliquer et réécrire les métadonnées.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen">
        <div className="fixed inset-0 -z-10 pointer-events-none blur-3xl opacity-40 glow" />
        {children}
      </body>
    </html>
  );
}
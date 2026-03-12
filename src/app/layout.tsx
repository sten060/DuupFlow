// app/layout.tsx
"use client";

import "./globals.css";
import { usePathname } from "next/navigation";
import Header from "@/components/Header"; // ⚠️ adapte le nom si ton header s’appelle autrement

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");
  const isAuthPage = pathname.startsWith("/login");

  return (
    <html lang="fr">
      <body className="bg-[#0B0F1A] text-white">
        {/* Affiche le Header seulement sur les pages publiques */}
        {!isDashboard && !isAuthPage && <Header />}
        {children}
      </body>
    </html>
  );
}
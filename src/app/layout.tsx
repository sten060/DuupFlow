// app/layout.tsx
"use client";

import "./globals.css";
import { usePathname } from "next/navigation";
import Header from "@/components/Header";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");

  const showHeader = !isDashboard && !isAuthPage;

  return (
    <html lang="fr">
      <body className="bg-[#0B0F1A] text-white">
        {showHeader && <Header />}
        {/* Spacer so fixed header doesn't overlap content */}
        {showHeader && <div className="h-20" />}
        {children}
      </body>
    </html>
  );
}

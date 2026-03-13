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
      <body className="text-white antialiased">
        {/* ── Fixed background: deep blue gradient + white grid ── */}
        <div
          className="fixed inset-0 -z-20 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, #060c1e 0%, #0c1c80 22%, #1535c0 48%, #2d6ae8 72%, #70b0f8 100%)",
          }}
        />
        <div
          className="fixed inset-0 -z-20 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
            backgroundSize: "46px 46px",
          }}
        />

        {showHeader && <Header />}
        {/* Spacer so fixed header doesn't overlap content */}
        {showHeader && <div className="h-20" />}
        {children}
      </body>
    </html>
  );
}

// Chrome partagé de toutes les pages blog (index + articles) : thème clair
// "Lunera", nav en pilule + footer, base texte sombre (sinon les articles
// héritent du text-white global du <body>).

import { NavPill, Footer, SmoothScroll } from "@/components/landing/shell";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lunera min-h-screen bg-white text-[#1a1a1a]">
      <SmoothScroll />
      <NavPill />
      <div className="pt-24 sm:pt-28">{children}</div>
      <Footer />
    </div>
  );
}

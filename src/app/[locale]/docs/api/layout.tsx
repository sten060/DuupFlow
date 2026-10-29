// Chrome de la doc API publique : thème clair Lunera, nav pilule + footer (même
// habillage que les pages SEO / blog).

import { NavPill, Footer, SmoothScroll } from "@/components/landing/shell";

export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lunera min-h-screen bg-white text-[#1a1a1a]">
      <SmoothScroll />
      <NavPill />
      <div className="pt-24 sm:pt-28">{children}</div>
      <Footer />
    </div>
  );
}

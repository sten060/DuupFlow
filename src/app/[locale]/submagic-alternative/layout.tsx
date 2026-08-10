// Chrome for the top-level "Submagic alternative" SEO page: light "Lunera"
// theme, pill nav + footer (same as blog/layout). Wrapping here keeps the base
// text dark, otherwise the page would inherit the global text-white of <body>.

import { NavPill, Footer, SmoothScroll } from "@/components/landing/shell";

export default function SubmagicAlternativeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lunera min-h-screen bg-white text-[#1a1a1a]">
      <SmoothScroll />
      <NavPill />
      <div className="pt-24 sm:pt-28">{children}</div>
      <Footer />
    </div>
  );
}

"use client";

/* ─── « Ils nous font confiance » — entre les agences et les témoignages ───
   Fond bleuté des modules, carte transparente. Une carte large par
   partenaire ; à partir de deux, la grille passe en 2 colonnes.
   Le contenu vient de PARTNERS (partners.ts), jamais écrit en dur ici. */

import Link from "@/components/LocaleLink";
import { SECTION_TITLE, SECTION_TITLE_STYLE, SECTION_LEAD, BLUE } from "@/components/landing/shell";
import { MODULES_BG } from "@/components/landing/Bento";
import { useInViewOnce, useReducedMotion } from "@/components/landing/videoShowcase";
import { PARTNERS, PARTNER_BADGE, type Partner, type HighlightIcon } from "@/components/landing/partners";

const HIGHLIGHT_ICONS: Record<HighlightIcon, React.ReactNode> = {
  link: <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />,
  wallet: <><path d="M4 7a2 2 0 0 1 2-2h12v4" /><path d="M4 7v10a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2Z" /><circle cx="16" cy="14" r="1" /></>,
  bot: <><rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 4v4M9 13h.01M15 13h.01" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></>,
};
/* Filigrane : un voile bleu nuit très léger sur le fond de section. */
const WATERMARK = "rgba(40,50,130,0.07)";

/* Carte claire — page /partners (fond blanc). */
export function PartnerCard({ partner, locale }: { partner: Partner; locale: "fr" | "en" }) {
  return (
    <Link href={partner.href} className="review-glass group flex h-full flex-col rounded-3xl p-7 transition hover:-translate-y-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <img src={partner.logo} alt={partner.name} className="h-9 w-auto object-contain" />
        <span className="whitespace-nowrap rounded-full bg-white/80 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#4a4f5c] ring-1 ring-black/[0.06]">
          {PARTNER_BADGE[locale]}
        </span>
      </div>
      <p className="mt-6 flex-1 text-[15px] leading-relaxed text-[#1a1a1a]">{partner.blurb[locale]}</p>
      <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: BLUE }}>
        {partner.cta[locale]}
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
      </span>
    </Link>
  );
}

/* Carte de la landing : même fond que la section (transparente), bordée d'un
   liseré de verre. Logo en haut, texte calé en bas, pictogramme en filigrane. */
function FeaturedPartnerCard({ partner, locale }: { partner: Partner; locale: "fr" | "en" }) {
  const mask = `url("${partner.mark}") center / contain no-repeat`;
  return (
    <a href={partner.url} target="_blank" rel="noopener"
      className="group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-white/60 bg-[rgba(35,40,110,0.08)] p-8 shadow-[inset_1px_1px_0_rgba(255,255,255,0.7)] transition duration-200 ease-out hover:-translate-y-1 hover:border-white/90 sm:p-12 md:min-h-[420px]">
      {/* Filigrane : coupé par les bords haut et droit de la carte */}
      <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-[160px] w-[160px] sm:-right-12 sm:-top-12 sm:h-[280px] sm:w-[280px]"
        style={{ background: WATERMARK, WebkitMask: mask, mask }} />

      <img src={partner.logo} alt={partner.name} className="relative h-10 w-auto self-start object-contain sm:h-12" />

      <div className="relative mt-16 md:mt-auto">
        <h3 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-[#1a1a1a] sm:text-[48px]">
          {PARTNER_BADGE[locale]}
        </h3>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[#3a3f4b] sm:text-[18px]">
          {partner.pitch[locale]}
        </p>
        <span className="mt-6 inline-block text-[15px] font-medium text-[#1a1a1a] underline-offset-4 group-hover:underline">
          {partner.cta[locale]} →
        </span>
      </div>
    </a>
  );
}

export default function PartnersSection({ locale }: { locale: "fr" | "en" }) {
  const { ref, shown } = useInViewOnce<HTMLDivElement>();
  const reduced = useReducedMotion();
  const on = shown || reduced;
  const several = PARTNERS.length > 1;
  const highlights = PARTNERS.flatMap((p) => p.highlights);
  return (
    /* Même fond bleuté que les modules. Passe sous les coins arrondis du bas de
       la section Agences (-mt-12), et s'arrondit à son tour sur les témoignages. */
    <section className="relative z-10 -mt-12 rounded-b-[40px] px-6 pb-20 pt-32 sm:pb-[120px] sm:pt-[168px]" style={{ background: MODULES_BG }}>
      <div className="mx-auto max-w-[1100px]">
        <div className="text-center">
          <h2 className={`mx-auto max-w-2xl ${SECTION_TITLE}`} style={SECTION_TITLE_STYLE}>
            {locale === "en" ? "Backed by the best" : "Ils nous font confiance"}
          </h2>
          <p className={`mx-auto mt-4 max-w-xl ${SECTION_LEAD}`}>
            {locale === "en"
              ? "Trusted names in the creator economy work with DuupFlow."
              : "Les acteurs qui comptent dans l'économie des créateurs travaillent avec DuupFlow."}
          </p>
        </div>
        <div ref={ref} className={`mt-14 grid grid-cols-1 gap-5 ${several ? "md:grid-cols-2" : ""}`}
          style={{ opacity: on ? 1 : 0, transform: on ? "none" : "translateY(40px)", transition: "opacity .65s ease-out, transform .95s cubic-bezier(0.16,1,0.3,1)" }}>
          {PARTNERS.map((p) => (
            <FeaturedPartnerCard key={p.key} partner={p} locale={locale} />
          ))}
        </div>

        {/* Points forts : icône en tuile au-dessus, puis titre et texte — tout part
            du même bord gauche (une icône posée à côté du titre décalait chaque
            colonne de quelques pixels, le tracé ne remplissant pas son cadre). */}
        {highlights.length > 0 && (
          <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-6 sm:mt-14 sm:grid-cols-2 sm:gap-y-9 lg:grid-cols-4">
            {/* Téléphone : liste compacte (icône à gauche, texte à droite). */}
            {highlights.map((h) => (
              <div key={h.title.en} className="flex gap-4 sm:block">
                {/* Tuile texturée : dégradé de la pastille de la landing, liseré
                    blanc, reflet en haut et ombre colorée diffuse. */}
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#4a4ad8] shadow-[0_10px_24px_rgba(100,90,240,0.22),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-2px_4px_rgba(99,102,241,0.12)] ring-1 ring-white/80"
                  style={{ background: "linear-gradient(135deg,#ffffff 0%,#e9efff 52%,#efe8ff 100%)" }}>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {HIGHLIGHT_ICONS[h.icon]}
                  </svg>
                </span>
                <div className="min-w-0">
                  <h3 className="mt-0.5 text-[16px] font-semibold tracking-[-0.01em] text-[#1a1a1a] sm:mt-4 sm:text-[17px]">{h.title[locale]}</h3>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-[#605f5f] sm:mt-1.5 sm:text-[15px]">{h.desc[locale]}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

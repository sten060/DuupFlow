"use client";

// Shared marketing footer — the full column footer used on the landing page,
// reused on /demo, /pricing, etc.

import Link from "@/components/LocaleLink";
import { useTranslation } from "@/lib/i18n/context";

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-white/35">{title}</h4>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const cls = "text-sm text-white/65 hover:text-white transition inline-flex items-center gap-1.5";
  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{children}</a>;
  }
  return <Link href={href} className={cls}>{children}</Link>;
}

export default function SiteFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear().toString();
  return (
    <footer className="relative mt-12 border-t border-white/[0.06]">
      {/* Subtle top gradient tint to soften the section break */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(129,140,248,0.45), transparent)" }}
      />

      <div className="max-w-7xl mx-auto px-6 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">
          {/* ── Brand column ──────────────────────────────────────────── */}
          <div className="md:col-span-5 space-y-5">
            <div className="flex items-baseline text-3xl font-extrabold tracking-tight">
              <span style={{ color: "#818CF8" }}>Duup</span>
              <span className="text-white/85">Flow</span>
            </div>
            <p className="text-sm text-white/55 leading-relaxed max-w-md">
              {t("footer.tagline")}
            </p>
            <div className="pt-1">
              <Link
                href="/pricing#plans"
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-white/85 hover:text-white transition"
              >
                {t("footer.ctaTry")}
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </div>
            {/* Status pill — green dot + label */}
            <div className="pt-3 inline-flex items-center gap-2">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-emerald-400/60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-xs text-emerald-300/85 font-medium">{t("footer.status")}</span>
            </div>
          </div>

          {/* ── Platform column ───────────────────────────────────────── */}
          <div className="md:col-span-3">
            <FooterColumn title={t("footer.colPlatform")}>
              <li><FooterLink href="/features">{t("footer.navFeatures")}</FooterLink></li>
              <li><FooterLink href="/how-it-works">{t("footer.navHowItWorks")}</FooterLink></li>
              <li><FooterLink href="/pricing">{t("footer.navPricing")}</FooterLink></li>
              <li><FooterLink href="/benefits">{t("footer.navBenefits")}</FooterLink></li>
              <li><FooterLink href="/demo">{t("footer.navDemo")}</FooterLink></li>
              <li><FooterLink href="/blog">{t("footer.navBlog")}</FooterLink></li>
            </FooterColumn>
          </div>

          {/* ── Legal column ──────────────────────────────────────────── */}
          <div className="md:col-span-2">
            <FooterColumn title={t("footer.colLegal")}>
              <li><FooterLink href="/legal/terms">{t("footer.navCgu")}</FooterLink></li>
              <li><FooterLink href="/legal/privacy">{t("footer.navPrivacy")}</FooterLink></li>
              <li><FooterLink href="/legal">{t("footer.navLegal")}</FooterLink></li>
            </FooterColumn>
          </div>

          {/* ── About column ──────────────────────────────────────────── */}
          <div className="md:col-span-2">
            <FooterColumn title={t("footer.colAbout")}>
              <li><FooterLink href="/partners">{t("footer.navPartners")}</FooterLink></li>
              <li>
                <FooterLink href="https://t.me/DuupFlow_Support" external>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-sky-400/80">
                    <path d="M11.944 0A12 12 0 1 0 24 12.056A12.014 12.014 0 0 0 11.944 0ZM16.906 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472c-.18 1.898-.962 6.502-1.36 8.627c-.168.9-.499 1.201-.82 1.23c-.696.065-1.225-.46-1.9-.902c-1.056-.693-1.653-1.124-2.678-1.8c-1.185-.78-.417-1.21.258-1.91c.177-.184 3.247-2.977 3.307-3.23c.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345c-.48.33-.913.49-1.302.48c-.428-.008-1.252-.241-1.865-.44c-.752-.245-1.349-.374-1.297-.789c.027-.216.325-.437.893-.663c3.498-1.524 5.83-2.529 6.998-3.014c3.332-1.386 4.025-1.627 4.476-1.635Z"/>
                  </svg>
                  {t("footer.navSupport")}
                </FooterLink>
              </li>
              <li>
                <FooterLink href="mailto:hello@duupflow.com" external>
                  {t("footer.navContact")}
                </FooterLink>
              </li>
            </FooterColumn>
          </div>
        </div>

        {/* Big brand mark sitting under the Legal / About columns */}
        <div className="mt-6 flex justify-end">
          <img
            src="/logo-mark.png"
            alt="DuupFlow"
            className="h-28 w-auto opacity-90 select-none pointer-events-none"
          />
        </div>

        {/* ── Bottom strip ────────────────────────────────────────────── */}
        <div className="mt-14 pt-6 border-t border-white/[0.06] flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <p className="text-xs text-white/30">
            {t("footer.copyright").replace("{year}", year)}
          </p>
          {/* Tiny "duplication" motif — 5 vertical bars in decreasing opacity */}
          <div aria-hidden className="flex items-end gap-1 opacity-40">
            {[0.9, 0.7, 0.55, 0.4, 0.3].map((o, i) => (
              <span
                key={i}
                className="block w-[3px] bg-indigo-300/70 rounded-sm"
                style={{ height: `${8 + i * 4}px`, opacity: o }}
              />
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

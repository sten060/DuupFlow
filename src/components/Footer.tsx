// components/Footer.tsx
"use client";

import { useTranslation } from "@/lib/i18n/context";
import { useLocalizedHref } from "@/lib/i18n/href";

export default function Footer() {
  const { t } = useTranslation();
  const lh = useLocalizedHref();
  return (
    <footer className="border-t border-white/10 mt-16">
      <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-gray-400 flex items-center justify-between">
        <span>{t("common.copyright").replace("{year}", new Date().getFullYear().toString())}</span>
        <div className="flex gap-4">
          <a href={lh("/legal/terms")} className="hover:text-white transition">{t("footer.cgu")}</a>
          <a href={lh("/legal/privacy")} className="hover:text-white transition">{t("footer.confidentialite")}</a>
          <a href={lh("/legal")} className="hover:text-white transition">{t("footer.mentionsLegales")}</a>
          <a href="mailto:hello@duupflow.com" className="hover:text-white transition">{t("footer.contact")}</a>
        </div>
      </div>
    </footer>
  );
}
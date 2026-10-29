"use client";

/**
 * Référence des paramètres de l'API v1 — UNE seule source pour la page
 * Développeurs et le tiroir de documentation, pour qu'elles ne puissent plus
 * diverger. À tenir à jour avec src/app/api/v1/** (limites, champs, codes).
 * La version publique détaillée vit sur /docs/api (landing).
 */

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";

export default function ApiParamsReference() {
  const { t } = useTranslation();
  const rows: [string, string][] = [
    ["POST /images/duplicate", t("dashboard.developers.pImages")],
    ["POST /videos/duplicate", t("dashboard.developers.pVideos")],
    ["GET /jobs/:id", t("dashboard.developers.pJobs")],
    ["POST /compress", t("dashboard.developers.pCompress")],
    ["POST /ai-detection", t("dashboard.developers.pAiDetection")],
  ];
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-[var(--app-text-muted)]">{t("dashboard.developers.paramsTitle")}</p>
      <ul className="space-y-2.5">
        {rows.map(([ep, desc]) => (
          <li key={ep} className="text-[11px] leading-relaxed text-[var(--app-text-muted)]">
            <code className="mr-1.5 font-mono text-[var(--app-text)]">{ep}</code>
            {desc}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-[var(--app-text-faint)]">{t("dashboard.developers.pBools")}</p>
      <p className="text-[11px] text-[var(--app-text-faint)]">{t("dashboard.developers.pErrors")}</p>
      <Link href="/docs/api" target="_blank" className="inline-flex text-[11px] font-semibold text-indigo-500 hover:underline">
        {t("dashboard.developers.publicDocs")} →
      </Link>
    </div>
  );
}

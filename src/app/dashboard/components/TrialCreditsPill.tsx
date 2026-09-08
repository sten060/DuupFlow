"use client";

/**
 * Pastille « essais offerts » — affichée là où les crédits se dépensent
 * (duplication vidéo, Éditeur IA), pas seulement dans l'onboarding.
 *
 * Le doute qu'elle lève est celui du moment du clic : « est-ce que ça va me
 * coûter une vidéo de mon quota ? ». Rien ne s'affiche quand il n'en reste
 * plus : une mention à zéro ne rappellerait que ce qu'on n'a plus.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";

export default function TrialCreditsPill({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const [restants, setRestants] = useState(0);

  useEffect(() => {
    let annule = false;
    fetch("/api/trial-credits")
      .then((r) => r.json())
      .then((d) => { if (!annule && typeof d?.restants === "number") setRestants(d.restants); })
      .catch(() => { /* silencieux : la pastille est un bonus, pas une garantie */ });
    return () => { annule = true; };
  }, []);

  if (restants <= 0) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${className}`}
      style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.30)", color: "#34D399" }}
      title={t("trialCredits.tooltip")}
    >
      🎁 {t("trialCredits.pill", { n: restants })}
    </span>
  );
}

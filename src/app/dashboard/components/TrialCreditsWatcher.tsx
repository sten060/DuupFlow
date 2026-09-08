"use client";

/**
 * Surveille l'épuisement des crédits d'essai et prévient le user une fois.
 *
 * Pourquoi une surveillance et pas un simple affichage : les crédits se
 * consomment côté serveur, pendant un traitement qui dure des minutes. Sans
 * signal, le user découvre que ses essais sont finis en voyant son quota
 * baisser — c'est-à-dire trop tard. On l'annonce au moment où ça arrive.
 *
 * Déclencheur : la fin d'une duplication (le store de jobs), le moment exact
 * où des crédits ont pu partir. Pas de sondage périodique — rien à surveiller
 * tant que rien ne tourne.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { subscribe as subscribeJobs, snapshot as jobsSnapshot } from "../videos/jobStore";
import { pushNotification } from "./notificationStore";

const CLE_AVERTI = "duup_credits_epuises";
const AUCUN: ReturnType<typeof jobsSnapshot> = [];

export default function TrialCreditsWatcher({ userId }: { userId: string | null }) {
  const { t } = useTranslation();
  const jobs = useSyncExternalStore(subscribeJobs, jobsSnapshot, () => AUCUN);
  /** Jobs terminés déjà comptés : on ne réagit qu'aux NOUVEAUX. */
  const termines = useRef<number | null>(null);
  /** Le compte avait-il encore des crédits au dernier relevé ? Sans cette
   *  mémoire, un compte qui n'en a jamais eu recevrait l'avertissement. */
  const avaitDesCredits = useRef(false);

  const releverCredits = useCallback(async (peutAvertir: boolean) => {
    if (!userId) return;
    let d: { restants?: number; dansLaFenetre?: boolean };
    try {
      d = await (await fetch("/api/trial-credits")).json();
    } catch {
      return; // réseau : on retentera à la prochaine duplication
    }
    if (typeof d?.restants !== "number") return;

    if (d.restants > 0) { avaitDesCredits.current = true; return; }
    // Zéro crédit : on n'avertit que si le compte en avait, s'il est bien dans
    // sa fenêtre d'essai, et jamais au premier relevé — sinon on annoncerait au
    // rechargement de la page une nouvelle qui date d'hier.
    if (!peutAvertir || !avaitDesCredits.current || !d.dansLaFenetre) return;

    // Une seule fois par compte, sinon l'avertissement repart à chaque
    // duplication suivante.
    try {
      const cle = `${CLE_AVERTI}:${userId}`;
      if (localStorage.getItem(cle) === "1") return;
      localStorage.setItem(cle, "1");
    } catch { /* stockage indisponible : au pire l'avertissement repasse */ }

    pushNotification({
      kind: "info",
      title: t("dashboard.notif.trialDoneTitle"),
      body: t("dashboard.notif.trialDoneBody"),
      href: "/dashboard/abonnement",
    });
  }, [userId, t]);

  // Relevé d'ouverture : il sert à mémoriser l'état de départ, pas à avertir.
  useEffect(() => { void releverCredits(false); }, [releverCredits]);

  // Une duplication vient de se terminer → les crédits ont pu bouger.
  useEffect(() => {
    const nb = jobs.filter((j) => j.status === "done").length;
    if (termines.current === null) { termines.current = nb; return; }
    if (nb <= termines.current) return;
    termines.current = nb;
    void releverCredits(true);
  }, [jobs, releverCredits]);

  return null;
}

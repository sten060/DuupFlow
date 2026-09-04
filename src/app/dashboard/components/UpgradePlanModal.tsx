"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/lib/i18n/context";
import { planRank } from "@/lib/plans";
import { getFpTid } from "@/lib/firstpromoter";

type PaidPlan = "starter" | "solo" | "pro";
type Interval = "monthly" | "yearly";

/** Prix affichés, en euros PAR MOIS — l'annuel montre son équivalent mensuel
 *  (13/28/70 €), comme la page tarifs publique. Les montants réellement
 *  facturés viennent de Stripe, jamais d'ici. */
const PRIX: Record<PaidPlan, { monthly: number; yearly: number }> = {
  starter: { monthly: 19, yearly: 13 },
  solo: { monthly: 39, yearly: 28 },
  pro: { monthly: 99, yearly: 70 },
};

/* Les trois briques ci-dessous sont le PENDANT des cartes de la page tarifs
   publique (src/app/[locale]/pricing/page.tsx) : même icône, même pastille de
   check, mêmes points. Un abonné qui a choisi son plan sur le site doit
   retrouver exactement la même carte dans l'app — sinon il se demande s'il
   achète bien la même chose. Seules les couleurs passent par les variables de
   thème, pour tenir en clair comme en sombre. */

function CheckIcon({ color }: { color: string }) {
  return (
    <span
      className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
      style={{ background: `${color}20`, border: `1px solid ${color}40` }}
    >
      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="3">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

/** Icônes de plan : un anneau (se lancer), deux (l'original et sa copie),
 *  trois (la duplication à l'échelle). */
function PlanIcon({ plan, color }: { plan: PaidPlan; color: string }) {
  return (
    <div
      className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0"
      style={{ background: `${color}1F`, border: `1px solid ${color}3D` }}
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {plan === "starter" ? (
          <circle cx="12" cy="12" r="6" />
        ) : plan === "solo" ? (
          <><circle cx="9" cy="12" r="5" /><circle cx="15" cy="12" r="5" /></>
        ) : (
          <><circle cx="12" cy="8" r="4.3" /><circle cx="8" cy="15" r="4.3" /><circle cx="16" cy="15" r="4.3" /></>
        )}
      </svg>
    </div>
  );
}

/**
 * Sélecteur de plans Starter / Solo / Pro — le SEUL endroit où l'on change de
 * plan dans l'app.
 *
 * Trois cartes + une bascule Mensuel / Annuel. Le plan (et l'intervalle) en
 * cours porte la mention « Plan actuel » ; tout le reste est cliquable, dans
 * les deux sens.
 *
 * Routage — jamais de second abonnement créé :
 *   · Free            → /api/stripe/checkout (avec code promo optionnel)
 *   · palier au-dessus, ou passage à l'ANNUEL → /api/stripe/upgrade
 *     (prorata encaissé tout de suite, même abonnement)
 *   · palier en dessous, ou retour au MENSUEL → /api/stripe/downgrade
 *     (appliqué à l'échéance : ce qui est payé reste dû au user)
 *
 * ⚠️ Une montée est FACTURÉE SUR-LE-CHAMP. On ne déclenche donc jamais le
 * paiement sur un simple clic : un écran de confirmation affiche d'abord le
 * montant réel, récupéré auprès de Stripe (/api/stripe/upgrade-preview).
 *
 * Rendu en portal sur document.body. Utilisé depuis /dashboard/abonnement,
 * /dashboard/ai-detection et les modales de quota atteint (images / vidéos).
 */
export default function UpgradePlanModal({
  open,
  onClose,
  currentPlan = "free",
  currentInterval = null,
}: {
  open: boolean;
  onClose: () => void;
  /** The user's current plan — drives "Plan actuel" + safe routing for paid users. */
  currentPlan?: "free" | "starter" | "solo" | "pro";
  /**
   * Intervalle de facturation en cours. `null` = INCONNU, et c'est le défaut :
   * seule la page Plan & facturation lit l'abonnement Stripe. Les autres
   * appelants (modales de quota atteint) l'ignorent — sans ce null, un abonné
   * ANNUEL y verrait « Revenir au mensuel » sur son propre plan et pourrait
   * quitter son engagement d'un clic, sans l'avoir demandé.
   */
  currentInterval?: Interval | null;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<PaidPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Intervalle choisi dans la bascule. Il s'ouvre sur celui de l'abonnement en
  // cours : un abonné annuel doit se reconnaître dans ce qu'il voit.
  // (Nommé `intervalle` : `setInterval` masquerait la fonction globale.)
  const [intervalle, setIntervalle] = useState<Interval>(currentInterval ?? "monthly");
  useEffect(() => { setIntervalle(currentInterval ?? "monthly"); }, [currentInterval, open]);

  // Écran de confirmation d'une MONTÉE (facturée immédiatement) : le plan visé
  // et le montant renvoyé par Stripe.
  const [confirmFor, setConfirmFor] = useState<PaidPlan | null>(null);
  const [apercu, setApercu] = useState<{ dueNowCents: number; recurringCents: number; currency: string } | null>(null);
  const [apercuLoading, setApercuLoading] = useState(false);

  // Promo-code step (Free users only): clicking a plan opens this sub-view where
  // the user can enter a partner/promo code before paying.
  const [promoFor, setPromoFor] = useState<PaidPlan | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoState, setPromoState] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [promoMessage, setPromoMessage] = useState("");

  if (!open || !mounted) return null;

  const isFree = currentPlan === "free";

  const PLANS: {
    id: PaidPlan;
    name: string;
    desc: string;
    price: string;
    color: string;
    features: string[];
    cardBorder: string;
    btnBg: string;
    btnShadow: string;
    popular?: boolean;
  }[] = [
    {
      id: "starter",
      name: t("tarifs.planStarter"),
      desc: t("tarifs.starterDesc"),
      price: `${PRIX.starter[intervalle]} €`,
      color: "#C4B5FD",
      features: [
        t("tarifs.starterFeature1"),
        t("tarifs.starterFeature2"),
        t("tarifs.starterFeature3"),
        t("tarifs.soloFeature8"),
        t("tarifs.featExport1080"),
      ],
      cardBorder: "1px solid var(--app-border)",
      btnBg: "linear-gradient(135deg,#9F7AEA,#7C3AED)",
      btnShadow: "0 16px 30px -12px rgba(139,92,246,0.45), inset 0 1px 0 rgba(255,255,255,0.28)",
    },
    {
      id: "solo",
      name: t("tarifs.planSolo"),
      desc: t("tarifs.soloDesc"),
      price: `${PRIX.solo[intervalle]} €`,
      color: "#A78BFA",
      features: [
        t("tarifs.soloFeature1"),
        t("tarifs.soloFeature2"),
        t("tarifs.soloFeature3"),
        t("tarifs.soloFeature4"),
        t("tarifs.soloFeature8"),
        t("tarifs.featExport4k"),
      ],
      cardBorder: "1px solid var(--app-border)",
      btnBg: "linear-gradient(135deg,#7C3AED,#6366F1)",
      btnShadow: "0 16px 30px -12px rgba(124,58,237,0.55), inset 0 1px 0 rgba(255,255,255,0.28)",
      popular: true,
    },
    {
      id: "pro",
      name: t("tarifs.planPro"),
      desc: t("tarifs.proDesc"),
      price: `${PRIX.pro[intervalle]} €`,
      color: "#818CF8",
      features: [
        t("tarifs.proFeature1"),
        t("tarifs.proFeature2"),
        t("tarifs.proFeature3"),
        t("tarifs.proFeature4"),
        t("tarifs.proFeature6"),
        t("tarifs.proFeature8"),
        t("tarifs.proFeature9"),
        t("tarifs.featExport4k"),
      ],
      cardBorder: "1.5px solid rgba(99,102,241,0.35)",
      btnBg: "linear-gradient(135deg,#4f7bff,#7c5cff)",
      btnShadow: "0 16px 30px -12px rgba(56,189,248,0.45), inset 0 1px 0 rgba(255,255,255,0.28)",
    },
  ];

  function openPromo(plan: PaidPlan) {
    setPromoFor(plan);
    setPromoInput("");
    setPromoState("idle");
    setPromoMessage("");
    setError(null);
  }

  async function validatePromoCode(code: string) {
    const c = code.trim().toUpperCase();
    if (!c) { setPromoState("idle"); setPromoMessage(""); return; }
    setPromoState("validating");
    try {
      const res = await fetch(`/api/promo/validate?code=${encodeURIComponent(c)}`);
      const data = await res.json();
      if (data.valid) {
        setPromoState("valid");
        setPromoMessage(data.message ?? t("dashboard.plans.promoValid"));
      } else {
        setPromoState("invalid");
        setPromoMessage(t("dashboard.plans.promoInvalid"));
      }
    } catch {
      setPromoState("idle");
    }
  }

  /** L'abonnement visé est-il celui qu'on a déjà ? (plan ET intervalle)
   *  Intervalle inconnu → le plan suffit : on n'invente pas un changement
   *  d'engagement qu'on serait incapable de vérifier. */
  function estActuel(id: PaidPlan): boolean {
    return id === currentPlan && (currentInterval === null || intervalle === currentInterval);
  }

  /** Une MONTÉE = palier supérieur, ou même palier en passant à l'annuel.
   *  C'est le seul cas encaissé sur-le-champ — d'où la confirmation. */
  function estMontee(id: PaidPlan): boolean {
    if (isFree) return true;
    const r = planRank(id) - planRank(currentPlan);
    if (r > 0) return true;
    return r === 0 && currentInterval === "monthly" && intervalle === "yearly";
    // (currentInterval === null → false : cf. estActuel, le bouton est inactif.)
  }

  // Paid user changing tier — prorated upgrade or next-cycle downgrade, keeping
  // the same subscription (going through checkout would create a 2nd one).
  async function changePlan(target: PaidPlan) {
    const isUpgrade = estMontee(target);
    setLoading(target);
    setError(null);
    try {
      const res = await fetch(isUpgrade ? "/api/stripe/upgrade" : "/api/stripe/downgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: target, billing: intervalle }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        window.location.reload();
      } else {
        setError(data.error ?? t("dashboard.plans.errorGeneric"));
        setLoading(null);
      }
    } catch {
      setError(t("dashboard.plans.errorNetwork"));
      setLoading(null);
    }
  }

  async function startCheckout(targetPlan: PaidPlan, promoCode?: string) {
    setLoading(targetPlan);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // noTrial: this is an in-app upgrade by an existing (free) user — the
        // 3-day trial is a new-signup acquisition offer only.
        body: JSON.stringify({ plan: targetPlan, billing: intervalle, noTrial: true, ...(promoCode ? { promo_code: promoCode } : {}), ...(getFpTid() ? { fp_tid: getFpTid() } : {}) }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? t("dashboard.plans.errorNetwork"));
        setLoading(null);
      }
    } catch {
      setError(t("dashboard.plans.errorNetwork"));
      setLoading(null);
    }
  }

  function chooseLabel(id: PaidPlan): string {
    if (estActuel(id)) return t("dashboard.plans.currentPlan");
    if (loading === id) {
      return estMontee(id) && !isFree ? t("dashboard.plans.upgrading") : t("dashboard.plans.redirecting");
    }
    // Même palier, intervalle différent : l'action n'est pas « choisir un plan »
    // mais changer d'engagement — le bouton doit le dire.
    if (!isFree && id === currentPlan) {
      return intervalle === "yearly"
        ? t("dashboard.plans.switchToYearly")
        : t("dashboard.plans.switchToMonthly");
    }
    if (!isFree && planRank(id) < planRank(currentPlan)) return t("dashboard.plans.downgradeTo");
    return id === "starter"
      ? t("dashboard.plans.chooseStarter")
      : id === "solo"
      ? t("dashboard.plans.chooseSolo")
      : t("dashboard.plans.choosePro");
  }

  /** Demande à Stripe ce que cette montée coûte MAINTENANT, puis affiche
   *  l'écran de confirmation. Aucun encaissement tant qu'il n'est pas validé. */
  async function ouvrirConfirmation(id: PaidPlan) {
    setConfirmFor(id);
    setApercu(null);
    setApercuLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stripe/upgrade-preview?plan=${id}&billing=${intervalle}`);
      const d = await res.json();
      if (typeof d?.dueNowCents === "number") setApercu(d);
    } catch { /* montant indisponible : la confirmation reste affichable */ }
    setApercuLoading(false);
  }

  function onCardClick(id: PaidPlan) {
    if (estActuel(id)) return;
    if (isFree) { openPromo(id); return; }
    // Montée = paiement immédiat → on montre d'abord le montant.
    // Descente = appliquée à l'échéance, rien n'est débité → direct.
    if (estMontee(id)) void ouvrirConfirmation(id);
    else changePlan(id);
  }

  const promoMeta = promoFor ? PLANS.find((p) => p.id === promoFor)! : null;
  const confirmMeta = confirmFor ? PLANS.find((p) => p.id === confirmFor)! : null;

  const euros = (cents: number, devise = "EUR") =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: devise, maximumFractionDigits: 2 }).format(cents / 100);

  /* Écran de confirmation d'une montée. Fonction et non composant : un
     composant défini ici serait remonté à chaque rendu du parent. */
  function confirmationView() {
    if (!confirmMeta) return null;
    return (
      <div className="space-y-4">
        <div
          className="rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-faint)]">{confirmMeta.name}</p>
            <p className="text-sm text-[var(--app-text-muted)] mt-0.5">
              {intervalle === "yearly" ? t("tarifs.billingYearly") : t("tarifs.billingMonthly")}
            </p>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-2xl font-bold text-[var(--app-text)]">{confirmMeta.price}</span>
            <span className="text-[var(--app-text-faint)] text-xs">{t("dashboard.plans.perMonth")}</span>
          </div>
        </div>

        {/* Le montant réel, tel que Stripe le facturera dans l'instant. */}
        <div
          className="rounded-xl px-4 py-3.5"
          style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.22)" }}
        >
          {apercuLoading ? (
            <p className="text-sm text-[var(--app-text-muted)]">{t("dashboard.plans.confirmComputing")}</p>
          ) : apercu ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-[var(--app-text)]">{t("dashboard.plans.confirmDueNow")}</span>
                <span className="text-xl font-bold text-[var(--app-text)]">{euros(apercu.dueNowCents, apercu.currency)}</span>
              </div>
              <p className="mt-1.5 text-xs text-[var(--app-text-muted)]">
                {t("dashboard.plans.confirmThen", {
                  price: euros(apercu.recurringCents, apercu.currency),
                  per: intervalle === "yearly" ? t("dashboard.plans.perYear") : t("dashboard.plans.perMonth"),
                })}
              </p>
              <p className="mt-1 text-xs text-[var(--app-text-faint)]">{t("dashboard.plans.confirmProrata")}</p>
            </>
          ) : (
            <p className="text-sm text-[var(--app-text-muted)]">{t("dashboard.plans.confirmUnavailable")}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => changePlan(confirmFor!)}
          disabled={loading !== null || apercuLoading}
          className="w-full rounded-xl py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: confirmMeta.btnBg }}
        >
          {loading !== null ? t("dashboard.plans.upgrading") : t("dashboard.plans.confirmCta")}
        </button>
        <button
          type="button"
          onClick={() => { setConfirmFor(null); setApercu(null); }}
          disabled={loading !== null}
          className="w-full text-center text-xs text-[var(--app-text-faint)] hover:text-[var(--app-text-muted)] transition disabled:opacity-40"
        >
          ← {t("dashboard.plans.promoBack")}
        </button>
        <p className="text-center text-[11px] text-[var(--app-text-faint)]">{t("dashboard.plans.secure")}</p>
      </div>
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={() => loading === null && onClose()}
    >
      <div
        className="w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-2xl p-7 space-y-6"
        style={{ background: "var(--app-bg)", border: "1px solid var(--app-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--app-text)]">{t("dashboard.plans.title")}</h2>
            <p className="text-sm text-[var(--app-text)] mt-1">
              {t("dashboard.plans.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => loading === null && onClose()}
            disabled={loading !== null}
            className="text-[var(--app-text-faint)] hover:text-[var(--app-text-muted)] transition disabled:opacity-30 shrink-0"
            aria-label={t("dashboard.plans.closeAria")}
          >
            <svg viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {confirmFor !== null ? (
        confirmationView()
        ) : promoFor === null ? (
        <>
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full p-1" style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>
            {([["monthly", t("tarifs.billingMonthly")], ["yearly", t("tarifs.billingYearly")]] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setIntervalle(id as Interval)}
                disabled={loading !== null}
                className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition disabled:opacity-50 ${
                  intervalle === id ? "text-white" : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
                }`}
                style={intervalle === id ? { background: "linear-gradient(135deg,#6366F1,#38BDF8)" } : undefined}
              >
                {label}
                {id === "yearly" && (
                  <span className={`ml-1.5 text-[11px] font-bold ${intervalle === "yearly" ? "text-white/80" : "text-emerald-400"}`}>
                    {t("tarifs.yearlyBadge")}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className="relative rounded-3xl flex flex-col"
              style={{
                background: "var(--app-surface)",
                border: p.cardBorder,
                boxShadow: "0 24px 50px -24px rgba(20,40,90,0.14)",
              }}
            >
              {/* Ruban « le plus populaire » : incliné et débordant du coin,
                  comme sur la page tarifs. */}
              {p.popular && (
                <div className="absolute -top-3.5 -right-3 z-20 rotate-[10deg]">
                  <span
                    className="inline-block rounded-2xl px-3.5 py-1.5 text-[12px] font-bold text-white"
                    style={{
                      background: "linear-gradient(135deg,#4f7bff,#7c5cff)",
                      boxShadow: "0 12px 24px -8px rgba(56,189,248,0.55)",
                    }}
                  >
                    {t("tarifs.mostPopular")}
                  </span>
                </div>
              )}

              <div className="relative z-10 flex flex-1 flex-col p-6">
                <PlanIcon plan={p.id} color={p.color} />
                <h3 className="mt-4 text-lg font-bold text-[var(--app-text)]">{p.name}</h3>
                <p className="mt-1 text-sm text-[var(--app-text-faint)]">{p.desc}</p>

                <div className="mb-5 mt-4">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold text-[var(--app-text)]">{p.price}</span>
                    <span className="text-sm text-[var(--app-text-faint)]">{t("dashboard.plans.perMonth")}</span>
                    {intervalle === "yearly" && (
                      <span className="text-lg text-[var(--app-text-faint)] line-through">{PRIX[p.id].monthly} €</span>
                    )}
                  </div>
                  {/* Hauteur réservée : sans elle, les trois cartes se
                      décalent d'une ligne au passage à l'annuel. */}
                  <p className="mt-1.5 h-4 text-xs text-[var(--app-text-faint)]">
                    {intervalle === "yearly" ? t("tarifs.yearlyFreeMonth") : ""}
                  </p>
                </div>

                {/* Le bouton passe AU-DESSUS de la liste, comme sur la landing :
                    l'action est visible sans avoir à parcourir les points. */}
                <button
                  type="button"
                  onClick={() => onCardClick(p.id)}
                  disabled={loading !== null || estActuel(p.id)}
                  className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:opacity-50 disabled:hover:brightness-100"
                  style={{ background: p.btnBg, boxShadow: p.btnShadow }}
                >
                  {chooseLabel(p.id)}
                </button>

                <ul className="mt-6 flex-1 space-y-3">
                  <li className="flex items-start gap-3 text-sm font-medium text-[var(--app-text)]">
                    <img src="/claude-color.svg" alt="Claude" className="mt-0.5 h-5 w-5 shrink-0 object-contain" />
                    {t("tarifs.featAiEditor")}
                  </li>
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[var(--app-text)]">
                      <CheckIcon color={p.color} />
                      {f}
                    </li>
                  ))}
                  {/* Points communs à tous les plans — Drive, compresseur, scraper. */}
                  <li className="flex items-start gap-3 text-sm text-[var(--app-text)]">
                    <img src="/app/icons8-google-drive-96.png" alt="Google Drive" className="mt-0.5 h-5 w-5 shrink-0 object-contain" />
                    {t("tarifs.featGoogleDrive")}
                  </li>
                  <li className="flex items-start gap-3 text-sm text-[var(--app-text)]">
                    <CheckIcon color={p.color} />
                    {t("tarifs.featCompressor")}
                  </li>
                  <li className="flex items-start gap-3 text-sm text-[var(--app-text)]">
                    <CheckIcon color={p.color} />
                    {t("tarifs.featScraper")}
                  </li>
                </ul>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-[11px] text-[var(--app-text)]">
          {t("dashboard.plans.secure")}
        </p>
        </>
        ) : (
        <div className="space-y-4">
          {/* Selected plan summary */}
          <div
            className="rounded-xl px-4 py-3 flex items-center justify-between"
            style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-faint)]">
                {promoMeta?.name}
              </p>
              <p className="text-sm text-[var(--app-text-muted)] mt-0.5">{t("dashboard.plans.promoTitle")}</p>
            </div>
            <div className="flex items-baseline gap-1 shrink-0">
              <span className="text-2xl font-bold text-[var(--app-text)]">{promoMeta?.price}</span>
              <span className="text-[var(--app-text-faint)] text-xs">{t("dashboard.plans.perMonth")}</span>
            </div>
          </div>

          <p className="text-xs text-[var(--app-text-muted)]">{t("dashboard.plans.promoSubtitle")}</p>

          {/* Promo code input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={promoInput}
              onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoState("idle"); setPromoMessage(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); validatePromoCode(promoInput); } }}
              placeholder={t("dashboard.plans.promoPlaceholder")}
              className="flex-1 rounded-lg px-3 py-2 text-sm text-[var(--app-text)] placeholder-[var(--app-text-faint)] outline-none transition"
              style={{
                background: "var(--app-surface)",
                border: promoState === "valid"
                  ? "1px solid rgba(52,211,153,0.5)"
                  : promoState === "invalid"
                  ? "1px solid rgba(239,68,68,0.4)"
                  : "1px solid var(--app-border)",
              }}
            />
            <button
              type="button"
              onClick={() => validatePromoCode(promoInput)}
              disabled={promoState === "validating" || !promoInput.trim()}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-40"
              style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#818CF8" }}
            >
              {promoState === "validating" ? "..." : t("dashboard.plans.promoApply")}
            </button>
          </div>
          {promoMessage && (
            <p className={`text-xs ${promoState === "valid" ? "text-emerald-400" : "text-red-400"}`}>
              {promoState === "valid" && "✓ "}{promoMessage}
            </p>
          )}

          {/* Continue to Stripe */}
          <button
            type="button"
            onClick={() => startCheckout(promoFor, promoInput.trim() ? promoInput.trim().toUpperCase() : undefined)}
            disabled={loading !== null}
            className="w-full rounded-xl py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: promoMeta?.btnBg }}
          >
            {loading !== null ? t("dashboard.plans.redirecting") : t("dashboard.plans.promoContinue")}
          </button>

          <button
            type="button"
            onClick={() => setPromoFor(null)}
            disabled={loading !== null}
            className="w-full text-center text-xs text-[var(--app-text-faint)] hover:text-[var(--app-text-muted)] transition disabled:opacity-40"
          >
            ← {t("dashboard.plans.promoBack")}
          </button>

          <p className="text-center text-[11px] text-[var(--app-text-faint)]">{t("dashboard.plans.secure")}</p>
        </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

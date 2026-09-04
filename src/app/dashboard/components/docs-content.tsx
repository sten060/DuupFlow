"use client";

// Builds the per-module documentation topics fed to <DocsDrawer />. Keeps the
// content (and its i18n keys) in one place so the video + detection modules
// stay consistent. All strings come from the dashboard.docs / durationInfo /
// aiDetection / det namespaces (FR + EN).

import Link from "next/link";
import type { DocEntry } from "./DocsDrawer";
import { ImagesMockup, CompressMockup, ComparatorMockup, VariationMockup, ApiMockup } from "./docs-mockups";

type T = (key: string, vars?: Record<string, string | number>) => string;

/** "Which filters to choose" body — shared by the simple + advanced video pages. */
/** Shared bullet list — bolds the term before the "—" for scannability. */
function bulletList(lines: string[]) {
  return (
    <ul className="space-y-3.5">
      {lines.map((l, i) => {
        const idx = l.indexOf("—");
        const name = idx > -1 ? l.slice(0, idx).trim() : null;
        const rest = idx > -1 ? l.slice(idx + 1).trim() : l;
        return (
          <li key={i} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400/80" />
            <span>{name && <strong className="text-[var(--app-text)]">{name}</strong>}{name ? " — " : ""}{rest}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Recommendation / tip callout box. */
function callout(text: string) {
  return (
    <p className="rounded-xl px-4 py-3.5 text-[var(--app-text-muted)]" style={{ background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.22)" }}>
      {text}
    </p>
  );
}

/** "Which filters" — SIMPLE mode (preset, stackable packs). */
function filtersBody(t: T) {
  return (
    <div className="space-y-5">
      <p>{t("dashboard.docs.filtersIntro")}</p>
      {bulletList([
        t("dashboard.docs.filtersMeta"),
        t("dashboard.docs.filtersMetaTech"),
        t("dashboard.docs.filtersPixel"),
        t("dashboard.docs.filtersMotion"),
        t("dashboard.docs.filtersVisuals"),
        t("dashboard.docs.filtersAudio"),
      ])}
      {callout(t("dashboard.docs.filtersReco"))}
    </div>
  );
}

/** "What it's for" — ADVANCED mode (manual per-duplication settings + templates). */
function advancedUsageBody(t: T) {
  return (
    <div className="space-y-5">
      <p>{t("dashboard.docs.advancedIntro")}</p>
      {bulletList([
        t("dashboard.docs.advancedManual"),
        t("dashboard.docs.advancedPrecise"),
        t("dashboard.docs.advancedNoAuto"),
      ])}
      {callout(t("dashboard.docs.advancedTemplates"))}
      {callout(t("dashboard.docs.advancedSupport"))}
    </div>
  );
}

/** Liste numérotée — pour les marches à suivre (l'ordre compte). */
function stepList(lines: string[]) {
  return (
    <ol className="space-y-3.5">
      {lines.map((l, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}>
            {i + 1}
          </span>
          <span>{l}</span>
        </li>
      ))}
    </ol>
  );
}

/** Encadré d'avertissement — quand un réglage a une contrepartie à assumer. */
function warning(text: string) {
  return (
    <p className="rounded-xl px-4 py-3.5 text-[var(--app-text-muted)]" style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.28)" }}>
      ⚠️ {text}
    </p>
  );
}

/** Titre de sous-section à l'intérieur d'une entrée de doc. */
function subTitle(text: string) {
  return <h4 className="text-[13px] font-semibold text-[var(--app-text)]">{text}</h4>;
}

/**
 * « Conseils d'utilisation » — la doc que réclamaient les retours utilisateurs
 * (« mon contenu est détecté comme non original »).
 *
 * Organisée PAR CAS CLIENT et pas par réglage : le bon conseil dépend
 * entièrement d'une seule question — la vidéo contient-elle du texte à l'écran ?
 * Un utilisateur qui lit cette page doit tomber directement sur SA situation.
 *
 * Le fil rouge : les plateformes comparent les IMAGES, pas seulement les
 * métadonnées. Tant que ce n'est pas compris, l'utilisateur cumule des réglages
 * discrets et s'étonne du résultat.
 */
function adviceBody(t: T) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {subTitle(t("dashboard.docs.advicePrincipleTitle"))}
        <p>{t("dashboard.docs.advicePrincipleBody")}</p>
        {callout(t("dashboard.docs.advicePrincipleKey"))}
      </div>

      <div className="space-y-3 border-t border-[var(--app-border)] pt-5">
        {subTitle(t("dashboard.docs.adviceCase1Title"))}
        <p>{t("dashboard.docs.adviceCase1Intro")}</p>
        {bulletList([
          t("dashboard.docs.adviceCase1Reverse"),
          t("dashboard.docs.adviceCase1Watermark"),
        ])}
        {warning(t("dashboard.docs.adviceCase1Warning"))}
      </div>

      <div className="space-y-3 border-t border-[var(--app-border)] pt-5">
        {subTitle(t("dashboard.docs.adviceCase2Title"))}
        <p>{t("dashboard.docs.adviceCase2Intro")}</p>
        {stepList([
          t("dashboard.docs.adviceCase2Step1"),
          t("dashboard.docs.adviceCase2Step2"),
          t("dashboard.docs.adviceCase2Step3"),
        ])}
        {callout(t("dashboard.docs.adviceCase2Why"))}
        <Link
          href="/dashboard/ai-editor"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
        >
          {t("dashboard.docs.adviceCase2Cta")} →
        </Link>
      </div>

      <div className="space-y-3 border-t border-[var(--app-border)] pt-5">
        {subTitle(t("dashboard.docs.adviceCase3Title"))}
        <p>{t("dashboard.docs.adviceCase3Intro")}</p>
        <p>{t("dashboard.docs.adviceCase3Body")}</p>
        {warning(t("dashboard.docs.adviceCase3Warning"))}
      </div>
    </div>
  );
}

/** Fiche d'un pack de mouvement : ce qu'il fait, un exemple, les chiffres. */
function motionPack(t: T, prefix: string) {
  return (
    <div className="space-y-3">
      {subTitle(t(`dashboard.docs.${prefix}Title`))}
      <p>{t(`dashboard.docs.${prefix}What`)}</p>
      <p className="rounded-xl px-4 py-3.5 text-[var(--app-text-muted)]" style={{ background: "var(--app-surface-2)" }}>
        {t(`dashboard.docs.${prefix}Example`)}
      </p>
      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--app-text-faint)]">
          {t("dashboard.docs.motionSpecsLabel")}
        </span>
        <p className="text-[12.5px] leading-relaxed text-[var(--app-text-muted)]">{t(`dashboard.docs.${prefix}Specs`)}</p>
      </div>
      {callout(t(`dashboard.docs.${prefix}When`))}
    </div>
  );
}

/**
 * « Les 2 packs de mouvement, en détail ».
 *
 * Les deux packs agissent tous deux sur le cadrage : sans une fiche par pack, un
 * utilisateur ne peut pas deviner lequel prendre ni ce qu'il perd en échange.
 * Chaque fiche suit le même plan — ce que ça fait, un exemple concret sur une
 * vidéo réelle, les chiffres, et quand s'en servir — pour qu'on puisse comparer
 * les deux en lisant en diagonale.
 */
function motionPacksBody(t: T) {
  return (
    <div className="space-y-6">
      <p>{t("dashboard.docs.motionPacksIntro")}</p>
      {motionPack(t, "motionClassic")}
      <div className="border-t border-[var(--app-border)] pt-5">{motionPack(t, "motionDynamic")}</div>
      <div className="space-y-3 border-t border-[var(--app-border)] pt-5">
        {subTitle(t("dashboard.docs.motionStackTitle"))}
        <p>{t("dashboard.docs.motionStackBody")}</p>
      </div>
    </div>
  );
}

function tiktokDoc(t: T): DocEntry {
  return {
    title: t("dashboard.docs.tiktokTitle"),
    body: (
      <div className="space-y-4">
        <p>{t("dashboard.docs.tiktokBody")}</p>
        {bulletList([
          t("dashboard.docs.tiktokPoint1"),
          t("dashboard.docs.tiktokPoint2"),
          t("dashboard.docs.tiktokPoint3"),
        ])}
        <Link
          href="/dashboard/guides/tiktok"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
        >
          {t("dashboard.docs.tiktokCta")} →
        </Link>
      </div>
    ),
  };
}

/**
 * Docs for the video duplication pages.
 *  - Simple  : duration + "which filters" (preset packs).
 *  - Advanced: duration + "what it's for" (manual settings + templates) + TikTok guide.
 */
export function buildVideoDocs(t: T, opts?: { advanced?: boolean }): DocEntry[] {
  const duration: DocEntry = {
    title: t("dashboard.durationInfo.title"),
    body: <p>{t("dashboard.durationInfo.body")}</p>,
  };
  const advice: DocEntry = { title: t("dashboard.docs.adviceTitle"), body: adviceBody(t) };
  if (opts?.advanced) {
    return [
      advice,
      duration,
      { title: t("dashboard.docs.advancedUsageTitle"), body: advancedUsageBody(t) },
      tiktokDoc(t),
    ];
  }
  return [
    advice,
    duration,
    { title: t("dashboard.docs.filtersTitle"), body: filtersBody(t) },
    { title: t("dashboard.docs.motionPacksTitle"), body: motionPacksBody(t) },
  ];
}

/** Docs for the AI-detection page (moved out of the former inline accordions). */
export function buildDetectionDocs(t: T): DocEntry[] {
  return [
    {
      title: t("dashboard.aiDetection.platformNotice"),
      body: (
        <div className="space-y-4">
          <p>{t("dashboard.docs.detNoticeP1")}</p>
          <p>{t("dashboard.docs.detNoticeP2")}</p>
          {callout(t("dashboard.docs.detNoticeTip"))}
        </div>
      ),
    },
    {
      title: t("dashboard.aiDetection.howItWorks"),
      body: (
        <div className="space-y-4">
          <p>
            {t("det.howItWorksIntro1")} <strong className="text-[var(--app-text-muted)]">{t("det.howItWorksSteps")}</strong> {t("det.howItWorksIntro2")}
          </p>
          <ol className="space-y-3 list-decimal list-outside pl-5 marker:text-indigo-300/70 marker:font-semibold">
            <li><strong className="text-[var(--app-text)]">{t("det.step1Title")}</strong> — {t("det.step1Body")}</li>
            <li><strong className="text-[var(--app-text)]">{t("det.step2Title")}</strong> — {t("det.step2Body")}</li>
            <li><strong className="text-[var(--app-text)]">{t("det.step3Title")}</strong> — {t("det.step3Body")}</li>
          </ol>
        </div>
      ),
    },
  ];
}

/* ═══════════ Per-module doc builders (for the global docs hub) ═══════════ */

export function buildImageDocs(t: T): DocEntry[] {
  return [
    { title: t("dashboard.docs.usageTitle"), body: (
      <div className="space-y-5">
        <p>{t("dashboard.docs.imgUsageBody")}</p>
        {bulletList([t("dashboard.docs.imgUsageB1"), t("dashboard.docs.imgUsageB2")])}
        {callout(t("dashboard.docs.imgUsageReco"))}
        <ImagesMockup />
      </div>
    ) },
    { title: t("dashboard.docs.imgOptionsTitle"), body: (
      <div className="space-y-6">
        <p>{t("dashboard.docs.imgOptionsIntro")}</p>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[var(--app-text)]">{t("dashboard.docs.imgVisualTitle")}</p>
          {bulletList([t("dashboard.docs.imgOptVisuals"), t("dashboard.docs.imgOptReverse")])}
        </div>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[var(--app-text)]">{t("dashboard.docs.imgNoVisualTitle")}</p>
          {bulletList([
            t("dashboard.docs.imgOptFund"), t("dashboard.docs.imgOptSemi"),
            t("dashboard.docs.imgOptIphone"), t("dashboard.docs.imgOptCountry"),
          ])}
        </div>
      </div>
    ) },
  ];
}

export function buildCompressDocs(t: T): DocEntry[] {
  return [
    { title: t("dashboard.docs.usageTitle"), body: (
      <div className="space-y-4">
        <p>{t("dashboard.docs.cmpUsageBody")}</p>
        {callout(t("dashboard.docs.cmpUsageGuarantee"))}
        <CompressMockup />
      </div>
    ) },
    { title: t("dashboard.docs.cmpLevelsTitle"), body: bulletList([
      t("dashboard.docs.cmpLevelLight"), t("dashboard.docs.cmpLevelBalanced"), t("dashboard.docs.cmpLevelStrong"),
    ]) },
  ];
}

export function buildComparatorDocs(t: T): DocEntry[] {
  return [
    { title: t("dashboard.docs.usageTitle"), body: (
      <div className="space-y-4">
        <p>{t("dashboard.docs.comparatorUsageBody")}</p>
        {callout(t("dashboard.docs.comparatorUsageReco"))}
        <ComparatorMockup />
      </div>
    ) },
    { title: t("dashboard.docs.comparatorScoreTitle"), body: (
      <div className="space-y-6">
        {bulletList([t("dashboard.docs.comparatorScoreHigh"), t("dashboard.docs.comparatorScoreLow")])}
        <figure className="space-y-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/app/comparateur-metadonnees.png"
            alt={t("dashboard.docs.comparatorScoreTitle")}
            loading="lazy"
            className="w-full rounded-xl border border-[var(--app-border)]"
          />
          <figcaption className="text-[13px] text-[var(--app-text-muted)]">{t("dashboard.docs.comparatorGreen")}</figcaption>
        </figure>
      </div>
    ) },
  ];
}

export function buildVariationDocs(t: T): DocEntry[] {
  return [
    { title: t("dashboard.docs.usageTitle"), body: (
      <div className="space-y-4">
        <p>{t("dashboard.docs.varUsageBody")}</p>
        {callout(t("dashboard.docs.varUsageReco"))}
        <VariationMockup />
      </div>
    ) },
    { title: t("dashboard.docs.varCostTitle"), body: (
      <div className="space-y-4">
        <p>{t("dashboard.docs.varCostBody")}</p>
        {callout(t("dashboard.docs.varCostReco"))}
        <Link
          href="/dashboard/abonnement?view=tokens"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
        >
          {t("dashboard.docs.varTokenCta")} →
        </Link>
      </div>
    ) },
  ];
}

export function buildApiDocs(t: T): DocEntry[] {
  const endpoints: [string, string][] = [
    ["GET /me", t("dashboard.developers.descMe")],
    ["POST /images/duplicate", t("dashboard.developers.descImages")],
    ["POST /compress", t("dashboard.developers.descCompress")],
    ["POST /ai-detection", t("dashboard.developers.descAiDetection")],
    ["POST /videos/duplicate", t("dashboard.developers.descVideos")],
    ["GET /jobs/:id", t("dashboard.developers.descJobs")],
  ];
  return [
    { title: t("dashboard.docs.usageTitle"), body: (
      <div className="space-y-4">
        <p>{t("dashboard.docs.apiUsageBody")}</p>
        <div className="space-y-1.5">
          <p>{t("dashboard.docs.apiUsageKey")}</p>
          <p>{t("dashboard.docs.apiUsagePro")}</p>
        </div>
        <Link
          href="/dashboard/abonnement?upgrade=1"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
        >
          {t("dashboard.developers.proOnlyCta")} →
        </Link>
        <ApiMockup />
      </div>
    ) },
    {
      title: t("dashboard.developers.docsTitle"),
      body: (
        <div className="space-y-4">
          <p>{t("dashboard.developers.docsBaseLabel")} <code className="text-[var(--app-text-muted)]">https://www.duupflow.com/api/v1</code></p>
          <p>{t("dashboard.developers.docsAuthLabel")} <code className="text-[var(--app-text-muted)]">Authorization: Bearer dflw_live_…</code></p>
          <p>{t("dashboard.developers.docsLimit")}</p>
          <ul className="space-y-3.5">
            {endpoints.map(([ep, desc], i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400/80" />
                <span><code className="text-indigo-200/90">{ep}</code> — {desc}</span>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
  ];
}

function buildVideoDocsAll(t: T): DocEntry[] {
  return [
    // En premier ici aussi : c'est le conseil qui conditionne tous les réglages.
    { title: t("dashboard.docs.adviceTitle"), body: adviceBody(t) },
    { title: t("dashboard.durationInfo.title"), body: <p>{t("dashboard.durationInfo.body")}</p> },
    { title: t("dashboard.docs.filtersTitle"), body: filtersBody(t) },
    { title: t("dashboard.docs.motionPacksTitle"), body: motionPacksBody(t) },
    { title: t("dashboard.docs.advancedUsageTitle"), body: advancedUsageBody(t) },
    tiktokDoc(t),
  ];
}

/* ═══════════ Global registry: module → topics (home docs hub) ═══════════ */

export type DocModule = { id: string; label: string; icon: React.ReactNode; docs: DocEntry[] };

const mIcon = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

export function buildAllDocs(t: T): DocModule[] {
  return [
    { id: "images", label: t("dashboard.sidebar.images"), icon: mIcon(<><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>), docs: buildImageDocs(t) },
    { id: "videos", label: t("dashboard.sidebar.videos"), icon: mIcon(<><rect x="2" y="5" width="14" height="14" rx="2" /><path d="M16 9l5-3v12l-5-3V9z" /></>), docs: buildVideoDocsAll(t) },
    { id: "compress", label: t("dashboard.sidebar.compresseur"), icon: mIcon(<><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></>), docs: buildCompressDocs(t) },
    { id: "comparator", label: t("dashboard.sidebar.comparateur"), icon: mIcon(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>), docs: buildComparatorDocs(t) },
    { id: "variation", label: t("dashboard.sidebar.variationIA"), icon: mIcon(<path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />), docs: buildVariationDocs(t) },
    { id: "detection", label: t("dashboard.sidebar.detectionIA"), icon: mIcon(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />), docs: buildDetectionDocs(t) },
    { id: "api", label: "API", icon: mIcon(<><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>), docs: buildApiDocs(t) },
  ];
}

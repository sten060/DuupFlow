"use client";

import { useEffect, useState } from "react";
import { useInView } from "@/components/landing/useInView";
import { ClaudeScene, DriveScene, RolesScene, SpacesScene } from "@/components/landing/AgencyScenes";
import { CTA_GRAD, GradText, Label, SECTION_LEAD, SECTION_TITLE, SECTION_TITLE_STYLE } from "@/components/landing/shell";

/* ══════════════════════════════════════════════════════════════
 * BENTO GRIDS — « Tous les modules, inclus » puis « Pour les agences »,
 * même structure de cartes, en clair (DA DuupFlow).
 *
 * Une carte = un visuel en haut (mini-interface HTML/CSS, contenu réel),
 * séparé par une bordure, puis icône + titre + une ligne.
 * Grille 3 colonnes en quinconce ; 1 colonne sous 768 px.
 * Aucune animation : le visuel doit se lire à l'arrêt.
 *
 * ⚠️ Ne rien afficher que le produit ne fait pas. Vérifié dans le code :
 *   - Drive : import via le Picker, export dans « <Créatrice> — DuupFlow »
 *     (un dossier PAR CRÉATRICE, pas par VA) — google-drive-oauth.ts ;
 *   - rôles manager / VA, un VA ne voit que ses créatrices — workspaces.ts ;
 *   - 15 espaces sur Agence — plans.ts (PLAN_WORKSPACES) ;
 *   - Claude : outils MCP duplicate_videos… ; l'automatisation récurrente
 *     passe par l'API (Make, n8n), Claude ne planifie rien lui-même.
 * ══════════════════════════════════════════════════════════════ */

type L = "fr" | "en";
const T = (l: L, fr: string, en: string) => (l === "en" ? en : fr);

const THUMB = "/variant-thumb.jpg";
const REF = "/mock-reference.jpg";
const RUSH = "/mock-rush.jpg";
const POSTER = "/mock-output-poster.jpg";
const CLAUDE_MARK = "/claude-ai-logo-rounded-hd-free-png-1.webp";
const DRIVE_LOGO = "/google-drive.svg";

const ICON = "h-[18px] w-[18px]";

/* Fonds de section : une base bleutée + deux halos (bleu, violet) pour que
   l'effet verre des cartes ait quelque chose à flouter. */
const MODULES_BG =
  "radial-gradient(40% 38% at 10% 22%, rgba(79,123,255,0.55), transparent 70%)," +
  "radial-gradient(38% 40% at 90% 30%, rgba(124,92,255,0.50), transparent 70%)," +
  "radial-gradient(36% 34% at 70% 85%, rgba(56,189,248,0.40), transparent 70%)," +
  "radial-gradient(30% 30% at 25% 80%, rgba(236,72,153,0.22), transparent 70%)," +
  "linear-gradient(180deg,#dfe6ff 0%,#e6dfff 100%)";
/* Agences : même fond que les sections du haut — blanc + grille « blueprint »
   (lignes de 130 px, cf. page.tsx). */
const AGENCY_BG =
  "linear-gradient(to right, rgba(99,102,241,0.07) 1px, transparent 1px) 0 0 / 130px 130px," +
  "linear-gradient(to bottom, rgba(99,102,241,0.07) 1px, transparent 1px) 0 0 / 130px 130px," +
  "#fff";
const icons = {
  drive: <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>,
  roles: <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></svg>,
  spaces: <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
  claude: <svg className={ICON} viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 1.9 4.8L18 9.5l-4.1 1.7L12 16l-1.9-4.8L6 9.5l4.1-1.7Z" /></svg>,
  scraper: <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>,
  comparator: <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>,
  compressor: <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h6V4M20 14h-6v6M10 10 3 3M14 14l7 7" /></svg>,
  variation: <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 2.3 6.2L20.5 11l-6.2 2.3L12 19l-2.3-5.7L3.5 11l6.2-1.8Z" /></svg>,
  shield: <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>,
};

/* ─── Carte commune ─── */
function Card({ wide, visual, icon, brand, brandTile, title, desc }: {
  wide?: boolean; visual: React.ReactNode; icon: React.ReactNode; brand?: string; brandTile?: boolean; title: string; desc: string;
}) {
  return (
    <div className={`bento-card flex flex-col overflow-hidden rounded-2xl ${wide ? "md:col-span-2" : ""}`}>
      <div className="bento-visual flex min-h-[220px] items-center justify-center overflow-hidden p-5">
        {visual}
      </div>
      {/* Séparation nette : liseré blanc + filet bleuté, puis zone texte plus claire. */}
      <div className="bento-body flex-1 px-5 py-4">
        <div className="flex items-center gap-3">
        {brand && brandTile ? (
          /* Le logo est déjà une tuile arrondie (ex. Claude) : affiché tel quel. */
          <img src={brand} alt="" className="bento-icon h-12 w-12 shrink-0 object-contain drop-shadow-[0_6px_14px_rgba(20,40,90,0.12)]" />
        ) : brand ? (
          /* Logo de marque (ex. Google Drive) plutôt que l'icône générique. */
          <span className="bento-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-white shadow-[0_6px_16px_rgba(20,40,90,0.10)] ring-1 ring-black/[0.06]">
            <img src={brand} alt="" className="h-6 w-6 object-contain" />
          </span>
        ) : (
          <span className="bento-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-white shadow-[0_6px_16px_rgba(90,90,240,0.35)] [&>svg]:h-[22px] [&>svg]:w-[22px]" style={{ background: CTA_GRAD }}>
            {icon}
          </span>
        )}
        <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-[#1a1a1a]">{title}</h3>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-[#605f5f]">{desc}</p>
      </div>
    </div>
  );
}

const Arrow = ({ vertical = false }: { vertical?: boolean }) => (
  <svg className={`h-4 w-4 shrink-0 text-[#b9c0d2] ${vertical ? "rotate-90 sm:rotate-0" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

/* ══════════════ POUR LES AGENCES ══════════════ */

/* Les cartes Agences rejouent de vrais écrans du dashboard (AgencyScenes.tsx),
   remontés par `cycle` pour boucler. */
const AGENCY_CYCLE_MS = 7000;

export function AgencyBento({ locale: l }: { locale: L }) {
  const [cycle, setCycle] = useState(0);
  // La boucle ne tourne que si la section est à l'écran (sinon tout est figé).
  const { ref: viewRef, inView } = useInView<HTMLElement>();
  useEffect(() => {
    if (!inView) return;
    setCycle((c) => c + 1); // repart du début en revenant à l'écran
    const id = window.setInterval(() => setCycle((c) => c + 1), AGENCY_CYCLE_MS);
    return () => window.clearInterval(id);
  }, [inView]);
  return (
    /* Remonte sur le fond bleuté des modules : la jonction se fait en coins arrondis. */
    <section ref={viewRef} className={`relative z-20 -mt-12 rounded-[40px] px-6 py-20 shadow-[0_-18px_50px_rgba(60,70,200,0.10)] sm:py-24 ${inView ? "" : "anim-paused"}`} style={{ background: AGENCY_BG }}>
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Label icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></svg>}>
            {T(l, "Pour les agences", "For agencies")}
          </Label>
          <h2 className={`mx-auto mt-7 max-w-3xl ${SECTION_TITLE}`} style={SECTION_TITLE_STYLE}>
            {l === "en" ? <>Built for <GradText>your agency.</GradText></> : <>Optimisé pour <GradText>ton agence.</GradText></>}
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Drive */}
          <Card
            wide icon={icons.drive} brand={DRIVE_LOGO}
            title={T(l, "Branché à ton Google Drive", "Plugged into your Google Drive")}
            desc={T(l, "Importe le contenu brut depuis ton Drive, récupère les copies dans le dossier de chaque créatrice.", "Pull raw content from your Drive, get the copies back in each creator's folder.")}
            visual={<DriveScene key={cycle} l={l} />}
          />

          {/* Rôles */}
          <Card
            icon={icons.roles}
            title={T(l, "Rôles Manager & VA", "Manager & VA roles")}
            desc={T(l, "Chaque VA ne voit que les créatrices qui lui sont assignées.", "Each VA only sees the creators assigned to them.")}
            visual={<RolesScene l={l} />}
          />

          {/* 15 espaces */}
          <Card
            icon={icons.spaces}
            title={T(l, "15 espaces créatrices", "15 creator workspaces")}
            desc={T(l, "Brief, réglages et dossier Drive pour chacune.", "A brief, settings and a Drive folder for each one.")}
            visual={<SpacesScene l={l} />}
          />

          {/* Claude + API */}
          <Card
            wide icon={icons.claude} brand={CLAUDE_MARK} brandTile
            title={T(l, "Claude le fait à ta place", "Claude does it for you")}
            desc={T(l, "Lance tes duplications depuis Claude, ou automatise-les via l'API (Make, n8n…).", "Run your duplications from Claude, or automate them through the API (Make, n8n…).")}
            visual={<ClaudeScene key={cycle} l={l} />}
          />
        </div>
      </div>
    </section>
  );
}

/* ══════════════ TOUS LES MODULES, INCLUS ══════════════
   Onglets : la liste à gauche (~40 %), l'aperçu du module choisi à droite
   (~60 %). Sous 768 px : accordéon, l'aperçu s'ouvre sous le module cliqué.
   Changement d'onglet : simple fondu (duup-fade). */
type ModKey = "scraper" | "comparator" | "compressor" | "variation" | "detection";

const MODS: { k: ModKey; icon: React.ReactNode; name: { fr: string; en: string }; line: { fr: string; en: string } }[] = [
  { k: "scraper", icon: icons.scraper, name: { fr: "Scraper", en: "Scraper" }, line: { fr: "Trouve tes meilleurs reels", en: "Find your best-performing reels" } },
  { k: "comparator", icon: icons.comparator, name: { fr: "Comparateur", en: "Comparator" }, line: { fr: "Vérifie que tes copies sont uniques", en: "Check your copies are truly unique" } },
  { k: "compressor", icon: icons.compressor, name: { fr: "Compresseur", en: "Compressor" }, line: { fr: "Allège tes fichiers sans perte", en: "Shrink your files, keep the quality" } },
  { k: "variation", icon: icons.variation, name: { fr: "Variation IA", en: "AI Variation" }, line: { fr: "Nouvelles photos, même visage", en: "New photos, same face" } },
  { k: "detection", icon: icons.shield, name: { fr: "Détection IA", en: "AI Detection" }, line: { fr: "Repère les traces des outils IA", en: "Spot the traces AI tools leave" } },
];

/* ─── Aperçus animés : chaque module rejoue SON vrai parcours ───
   (libellés et couleurs repris des écrans du dashboard). Les visuels jouent une
   fois, avec des délais ; ModulesBento les remonte toutes les CYCLE_MS pour
   boucler. Keyframes md-* dans globals.css ; sous reduced-motion, l'état final
   s'affiche directement (les styles de base SONT l'état final). */
const CYCLE_MS = 7600;
const A = (name: string, delay: number, dur?: number, extra?: React.CSSProperties): React.CSSProperties => ({
  animationName: name,
  animationDelay: `${delay}s`,
  ...(dur ? { animationDuration: `${dur}s` } : {}),
  ...extra,
});
const VIOLET = "#7c5cff";
const EMERALD_GRAD = "linear-gradient(135deg,#10b981 0%,#14b8a6 100%)";
const FUCHSIA_GRAD = "linear-gradient(135deg,#d946ef 0%,#6366f1 100%)";
const INDIGO_GRAD = "linear-gradient(135deg,#6366F1 0%,#818CF8 100%)";

const Spinner = ({ color }: { color: string }) => (
  <span className="md-spin inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent" style={{ color }} />
);
const Check = ({ className = "h-3 w-3" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);
/* Bouton qui se fait « cliquer » (enfoncement bref). */
function PressBtn({ at, bg, children }: { at: number; bg: string; children: React.ReactNode }) {
  return (
    <span className="md-a inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-[0_6px_16px_rgba(60,70,200,0.25)]"
      style={{ background: bg, ...A("md-press", at, 0.4) }}>
      {children}
    </span>
  );
}

/* Le texte sous l'aperçu : un vrai paragraphe explicatif, fidèle au module réel. */
const MOD_COPY: Record<ModKey, { fr: string; en: string }> = {
  scraper: {
    fr: "Colle le lien d’un compte Instagram ou TikTok : DuupFlow repère ses vidéos qui marchent le mieux et les envoie vers la duplication.",
    en: "Paste an Instagram or TikTok account link: DuupFlow spots its best-performing videos and sends them to duplication.",
  },
  comparator: {
    fr: "Compare l’original et ta copie : un score de similarité te dit si elle est assez différente pour être republiée sans risque.",
    en: "Compare the original with your copy: a similarity score tells you if it’s different enough to repost safely.",
  },
  compressor: {
    fr: "Allège jusqu’à 30 images et vidéos d’un coup, sans perte visible. Un fichier compressé n’est jamais plus lourd que l’original.",
    en: "Shrink up to 30 images and videos at once, with no visible loss. A compressed file is never heavier than the original.",
  },
  variation: {
    fr: "À partir d’une seule photo, génère jusqu’à trois nouvelles images avec le même visage, le même décor et la même lumière.",
    en: "From a single photo, generate up to three new images with the same face, the same setting and the same lighting.",
  },
  detection: {
    fr: "Efface la signature laissée par les outils IA (EXIF, XMP, C2PA) et la remplace par une identité d’appareil réaliste.",
    en: "Wipes the signature AI tools leave behind (EXIF, XMP, C2PA) and replaces it with a realistic device identity.",
  },
};

/* Variation IA : une photo source, deux variations générées (même visage, même décor). */
const VAR_SRC = "/variation-1.jpg";
const VAR_OUT = ["/variation-2.jpg", "/variation-3.jpg"];

const REELS = [
  { v: "1.2M", like: "85K", er: "4.3%", top: true, img: THUMB },
  { v: "840K", like: "61K", er: "3.9%", top: true, img: REF },
  { v: "12K", like: "740", er: "1.1%", img: RUSH },
  { v: "3K", like: "120", er: "0.6%", img: POSTER },
];

function ModuleVisual({ k, l }: { k: ModKey; l: L }) {
  switch (k) {
    /* Scraper : lien du compte → Analyser → scan → top vidéos, les 2 meilleures cochées */
    case "scraper":
      return (
        <div className="w-full max-w-[470px] space-y-2.5">
          <div className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 shadow-[0_4px_14px_rgba(20,40,90,0.06)] ring-1 ring-black/[0.06]">
            <span className="min-w-0 flex-1 overflow-hidden">
              <span className="md-a md-type block truncate whitespace-nowrap font-mono text-[11px] text-[#1a1a1a]" style={A("md-type", 0.3, 1.1)}>instagram.com/ma.marque</span>
            </span>
            <span className="hidden shrink-0 rounded-md bg-[#f1f3f8] px-2 py-1 text-[10.5px] font-medium text-[#605f5f] sm:inline">{T(l, "les 4 meilleures", "top 4")}</span>
            <PressBtn at={1.5} bg={VIOLET}>{T(l, "Analyser", "Analyze")}</PressBtn>
          </div>
          <div className="relative">
            {/* Scan en cours, puis les résultats */}
            <div className="md-a absolute inset-0 z-10 flex items-center justify-center gap-2 text-[11.5px] font-medium text-[#4a4f5c]" style={{ opacity: 0, ...A("md-flash", 1.9, 1.4) }}>
              <Spinner color={VIOLET} /> {T(l, "Scrape du compte @ma.marque…", "Scraping @ma.marque…")}
            </div>
            <p className="md-a mb-1.5 text-[10.5px] font-medium text-[#8a8f99]" style={A("md-rise", 3.3)}>{T(l, "4 meilleures vidéos sur 30 j · 47 analysées", "Top 4 videos over 30 days · 47 scanned")}</p>
            <div className="mx-auto grid max-w-[300px] grid-cols-4 gap-2">
              {REELS.map((r, i) => (
                <div key={r.v} className="md-a" style={A("md-pop", 3.4 + i * 0.14)}>
                  <div className="relative aspect-[9/16] overflow-hidden rounded-lg bg-[#e3e8f2]">
                    <img src={r.img} alt="" className="h-full w-full object-cover" />
                    <span className="absolute left-1 top-1 rounded bg-black/75 px-1 text-[8.5px] font-bold text-white">#{i + 1}</span>
                    {r.top && (
                      <>
                        <span className="md-a absolute inset-0 rounded-lg ring-2 ring-inset" style={{ color: VIOLET, ["--tw-ring-color" as string]: VIOLET, ...A("md-pop", 4.4 + i * 0.25) } as React.CSSProperties} />
                        <span className="md-a absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded text-white" style={{ background: VIOLET, ...A("md-pop", 4.45 + i * 0.25) }}><Check className="h-2.5 w-2.5" /></span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 flex justify-between text-[9px] font-medium text-[#605f5f]">
                    <span>▶ {r.v}</span><span className="hidden text-[#a0a6b4] sm:inline">{r.er}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="md-a flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 shadow-[0_4px_14px_rgba(20,40,90,0.06)] ring-1 ring-black/[0.06]" style={A("md-rise", 5.0)}>
            <span className="text-[11px] font-medium text-[#1a1a1a]">{T(l, "2/4 vidéos prêtes", "2/4 videos ready")}</span>
            <span className="rounded-lg px-2.5 py-1 text-[10.5px] font-semibold text-white" style={{ background: VIOLET }}>{T(l, "Envoyer vers duplication", "Send to duplication")}</span>
          </div>
        </div>
      );

    /* Comparateur : 2 fichiers → Comparer → score unifié + verdict + champs qui diffèrent */
    case "comparator":
      return (
        <div className="w-full max-w-[460px] space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {[["Fichier 1", "File 1", "reel.mp4", "none"], ["Fichier 2", "File 2", "reel_copie.mp4", "saturate(106%) hue-rotate(1deg)"]].map(([fr, en, name, f], i) => (
              <div key={name} className="rounded-xl border border-dashed border-[#c9d1e2] bg-white/70 p-2">
                <p className="text-[9.5px] font-semibold uppercase tracking-wider text-[#8a8f99]">{T(l, fr, en)}</p>
                <div className="md-a mt-1 flex items-center gap-2" style={A("md-pop", 0.3 + i * 0.35)}>
                  <span className="h-10 w-[23px] shrink-0 overflow-hidden rounded-[4px]"><img src={THUMB} alt="" className="h-full w-full object-cover" style={{ filter: f }} /></span>
                  <span className="truncate font-mono text-[10px] text-[#1a1a1a]">{name}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center"><PressBtn at={1.3} bg={EMERALD_GRAD}>{T(l, "Comparer les fichiers", "Compare files")}</PressBtn></div>
          <div className="relative">
            <div className="md-a absolute inset-x-0 top-3 flex items-center justify-center gap-2 text-[11.5px] font-medium text-[#4a4f5c]" style={{ opacity: 0, ...A("md-flash", 1.6, 1.0) }}>
              <Spinner color="#10b981" /> {T(l, "Analyse en cours…", "Analyzing…")}
            </div>
            <div className="md-a flex items-center gap-3 rounded-xl border border-emerald-300/70 bg-emerald-50/80 px-3.5 py-2.5" style={A("md-rise", 2.6)}>
              <span className="text-[30px] font-bold leading-none tracking-[-0.02em] text-emerald-600">34%</span>
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold text-emerald-700">{T(l, "Fichiers distincts", "Distinct files")}</span>
                <span className="block truncate text-[9.5px] text-[#605f5f]">{T(l, "Image 41 % (poids 60 %) · Technique 23 % (poids 40 %)", "Image 41% (60% weight) · Technical 23% (40% weight)")}</span>
              </span>
            </div>
          </div>
          <div className="md-a overflow-hidden rounded-xl bg-white text-[10.5px] ring-1 ring-black/[0.06]" style={A("md-rise", 3.1)}>
            {[[T(l, "Encodeur", "Encoder"), "Lavf60.16", "Core Media"], [T(l, "Appareil", "Device"), "—", "iPhone 15"], ["Date", "12/10 18:42", "14/10 09:17"]].map(([c, a1, b1], i) => (
              <div key={c} className={`md-a grid grid-cols-[0.9fr_1fr_1fr] gap-2 px-3 py-1.5 ${i ? "border-t border-black/[0.05]" : ""}`} style={A("md-rise", 3.2 + i * 0.2)}>
                <span className="font-medium text-[#8a8f99]">{c}</span>
                <span className="truncate font-mono text-[#605f5f]">{a1}</span>
                <span className="truncate font-mono font-semibold text-emerald-600">{b1}</span>
              </div>
            ))}
          </div>
        </div>
      );

    /* Compresseur : fichier → niveau Équilibré → compression → -75 % */
    case "compressor":
      return (
        <div className="w-full max-w-[440px] space-y-2.5">
          <div className="md-a flex items-center gap-2.5 rounded-xl bg-white px-3 py-2 ring-1 ring-black/[0.06]" style={A("md-pop", 0.2)}>
            <span className="h-9 w-[20px] shrink-0 overflow-hidden rounded-[4px]"><img src={THUMB} alt="" className="h-full w-full object-cover" /></span>
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#1a1a1a]">reel.mp4</span>
            <span className="text-[11px] font-semibold text-[#605f5f]">{T(l, "12,4 Mo", "12.4 MB")}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[T(l, "Léger", "Light"), T(l, "Équilibré", "Balanced"), T(l, "Fort", "Strong")].map((lv, i) => (
              <div key={lv} className="relative rounded-xl bg-white px-2 py-2 text-center ring-1 ring-black/[0.06]">
                {i === 1 && <span className="md-a absolute inset-0 rounded-xl ring-2 ring-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.25)]" style={A("md-pop", 0.7)} />}
                <span className="flex items-center justify-center gap-1 text-[11px] font-semibold text-[#1a1a1a]">
                  {i === 1 && <span className="md-a h-1.5 w-1.5 rounded-full bg-emerald-500" style={A("md-pop", 0.75)} />}{lv}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-center"><PressBtn at={1.2} bg={EMERALD_GRAD}>{T(l, "Compresser", "Compress")}</PressBtn></div>
          <div>
            <div className="relative mb-1 h-4 text-[10.5px] font-medium">
              <span className="md-a absolute left-0 text-[#605f5f]" style={{ opacity: 0, ...A("md-flash", 1.4, 1.8) }}>{T(l, "Compression en cours…", "Compressing…")}</span>
              <span className="md-a absolute left-0 text-emerald-600" style={A("md-rise", 3.2)}>{T(l, "Terminé ✔", "Done ✔")}</span>
            </div>
            <span className="block h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-black/[0.05]">
              <span className="md-a block h-full rounded-full" style={{ width: "100%", background: EMERALD_GRAD, ...A("md-fill", 1.4, 1.8, { animationTimingFunction: "ease-in-out" }) }} />
            </span>
          </div>
          <div className="md-a flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-black/[0.06]" style={A("md-rise", 3.4)}>
            <span className="h-3.5 w-3.5 rounded border-2 border-emerald-500 bg-emerald-500 text-white"><Check className="h-2.5 w-2.5" /></span>
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#1a1a1a]">reel.mp4</span>
            <span className="text-[10.5px] text-[#8a8f99]">{T(l, "12,4 → 3,1 Mo", "12.4 → 3.1 MB")}</span>
            <span className="md-a rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700" style={A("md-pop", 3.7)}>-75%</span>
          </div>
        </div>
      );

    /* Variation IA : image de référence → 3 variations → Lancer → les variations sortent */
    case "variation":
      return (
        <div className="w-full max-w-[440px] space-y-3">
          <div className="flex items-stretch gap-3">
            <div className="md-a shrink-0" style={A("md-pop", 0.2)}>
              <span className="block h-[110px] w-[74px] overflow-hidden rounded-[10px] ring-2 ring-white shadow-[0_8px_22px_rgba(20,40,90,0.14)]"><img src={VAR_SRC} alt="" className="h-full w-full object-cover" /></span>
              <span className="mt-1 block text-center text-[9.5px] font-medium text-[#8a8f99]">{T(l, "Image de référence", "Reference image")}</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
              <span className="text-[10.5px] font-semibold text-[#605f5f]">{T(l, "Nombre de variations", "Number of variations")}</span>
              <div className="flex gap-1.5">
                {[1, 2, 3].map((n) => (
                  <span key={n} className="relative flex h-7 w-9 items-center justify-center rounded-lg bg-white text-[11.5px] font-semibold text-[#605f5f] ring-1 ring-black/[0.06]">
                    {n === 2 && <span className="md-a absolute inset-0 rounded-lg" style={{ background: FUCHSIA_GRAD, ...A("md-pop", 0.8) }} />}
                    <span className={`relative ${n === 2 ? "md-a" : ""}`} style={n === 2 ? A("md-white", 0.8, undefined, { color: "#fff" }) : undefined}>{n}</span>
                  </span>
                ))}
              </div>
              <div><PressBtn at={1.3} bg={FUCHSIA_GRAD}>{T(l, "Lancer", "Generate")}</PressBtn></div>
            </div>
          </div>
          <div className="mx-auto grid max-w-[200px] grid-cols-2 gap-2">
            {VAR_OUT.map((src, i) => (
              <div key={i} className="relative">
                <span className="relative block aspect-[3/4] overflow-hidden rounded-[9px] bg-[#ece8fb]">
                  <span className="md-a absolute inset-0 overflow-hidden" style={{ opacity: 0, ...A("md-flash", 1.6, 1.8) }}>
                    <span className="md-shimmer absolute inset-y-0 -left-1/2 w-1/2" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.7),transparent)" }} />
                  </span>
                  <img src={src} alt="" className="md-a absolute inset-0 h-full w-full object-cover"
                    style={{ objectPosition: "50% 30%", ...A("md-pop", 3.3 + i * 0.25) }} />
                </span>
                <span className="mt-1 block text-center text-[9.5px] font-medium text-[#8a8f99]">Variation {i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      );

    /* Détection IA : les métadonnées IA sont barrées puis remplacées par une identité humaine */
    case "detection":
      return (
        <div className="w-full max-w-[400px] space-y-2.5">
          <div className="md-a flex items-center gap-2.5 rounded-xl bg-white px-3 py-2 ring-1 ring-black/[0.06]" style={A("md-pop", 0.2)}>
            <span className="h-8 w-8 shrink-0 overflow-hidden rounded-[6px]"><img src={REF} alt="" className="h-full w-full object-cover" /></span>
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#1a1a1a]">IMG_2041.png</span>
          </div>
          <div className="overflow-hidden rounded-xl bg-white text-[11.5px] shadow-[0_8px_22px_rgba(20,40,90,0.08)] ring-1 ring-black/[0.06]">
            {[
              { k: T(l, "Logiciel", "Software"), ai: T(l, "Générateur IA", "AI generator"), hu: "—", ok: false },
              { k: "C2PA", ai: T(l, "signé IA", "AI-signed"), hu: T(l, "retiré", "removed"), ok: true },
              { k: "EXIF", ai: T(l, "vide", "empty"), hu: "iPhone 15", ok: true },
            ].map((r, i) => (
              <div key={r.k} className={`flex items-center justify-between px-3.5 py-2.5 ${i ? "border-t border-black/[0.05]" : ""}`}>
                <span className="font-medium text-[#8a8f99]">{r.k}</span>
                <span className="relative h-4 min-w-[96px] text-right">
                  <span className="md-a md-strike absolute right-0 whitespace-nowrap text-rose-500" style={{ opacity: 0, ...A("md-strikeout", 1.6 + i * 0.35, 1.2) }}>{r.ai}</span>
                  <span className={`md-a absolute right-0 flex items-center gap-1 whitespace-nowrap font-semibold ${r.ok ? "text-[#6366F1]" : "text-[#1a1a1a]"}`} style={A("md-pop", 2.85 + i * 0.35)}>
                    {r.ok && <Check />}{r.hu}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-center"><PressBtn at={1.2} bg={INDIGO_GRAD}>{T(l, "Masquer la signature IA", "Mask the AI signature")}</PressBtn></div>
          <div className="md-a rounded-xl border border-[#6366F1]/30 bg-[#6366F1]/[0.06] px-3 py-2 text-center text-[10.5px] font-medium text-[#4f46e5]" style={A("md-rise", 4.1)}>
            {T(l, "✓ 1 fichier traité, métadonnées effacées et réécrites.", "✓ 1 file processed — metadata wiped and rewritten.")}
          </div>
        </div>
      );
  }
}

/* Filtre SVG du « liquid glass » : un bruit très basse fréquence déplace
   légèrement le décor vu à travers les cartes (backdrop-filter: url(#lg-distort)). */
function LiquidGlassDefs() {
  return (
    <svg aria-hidden width="0" height="0" className="pointer-events-none absolute">
      <filter id="lg-distort" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="2" seed="92" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="2" result="blurred" />
        <feDisplacementMap in="SourceGraphic" in2="blurred" scale="60" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

/* Un item de la liste (onglet en desktop, en-tête d'accordéon en mobile). */
function ModItem({ m, l, active, onClick }: { m: (typeof MODS)[number]; l: L; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`flex w-full items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition duration-200 ${
        active ? "bento-glass bento-tab !border-[#4f7bff]/40" : "border-transparent hover:bg-white/40"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition ${active ? "text-white shadow-[0_6px_16px_rgba(90,90,240,0.35)]" : "bg-white text-[#4f7bff] ring-1 ring-black/[0.06]"}`}
        style={active ? { background: CTA_GRAD } : undefined}
      >
        {m.icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[15.5px] font-semibold text-[#1a1a1a]">{m.name[l]}</span>
        <span className="block truncate text-[13.5px] text-[#605f5f]">{m.line[l]}</span>
      </span>
    </button>
  );
}

/* Le paragraphe explicatif, posé sous le panneau (fondu au changement d'onglet). */
function ModText({ k, l }: { k: ModKey; l: L }) {
  return <p key={k} className="duup-fade text-[17px] font-medium leading-relaxed text-[#2a2e38] sm:text-[18px]">{MOD_COPY[k][l]}</p>;
}

/* Le panneau d'aperçu (fond blanc, bordure légère, zone visuelle texturée). */
function Preview({ k, l, tall, cycle }: { k: ModKey; l: L; tall?: boolean; cycle: number }) {
  return (
    <div className="bento-glass overflow-hidden rounded-2xl p-2">
      <div key={`${k}-${cycle}`} className={`bento-visual duup-fade flex items-center justify-center rounded-xl p-6 ${tall ? "h-[360px] overflow-hidden" : "min-h-[240px]"}`}>
        <ModuleVisual k={k} l={l} />
      </div>
    </div>
  );
}

export function ModulesBento({ locale: l }: { locale: L }) {
  const [active, setActive] = useState<ModKey>("scraper");
  // Relance l'animation de l'aperçu en boucle ; repart de zéro à chaque onglet.
  const [cycle, setCycle] = useState(0);
  const { ref: viewRef, inView } = useInView<HTMLElement>();
  useEffect(() => {
    if (!inView) return;
    setCycle((c) => c + 1); // repart du début (changement d'onglet ou retour à l'écran)
    const id = window.setInterval(() => setCycle((c) => c + 1), CYCLE_MS);
    return () => window.clearInterval(id);
  }, [active, inView]);
  return (
    /* Fond bleuté à halos, coins arrondis en haut ; le bas est recouvert par la
       section Agences (coins arrondis aussi). */
    <section ref={viewRef} className={`relative z-10 rounded-t-[40px] px-6 pb-32 pt-20 sm:pb-36 sm:pt-24 ${inView ? "" : "anim-paused"}`} style={{ background: MODULES_BG }}>
      <LiquidGlassDefs />
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <Label icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>}>
            {T(l, "Le reste de la boîte à outils", "The rest of the toolkit")}
          </Label>
          <h2 className={`mt-7 ${SECTION_TITLE}`} style={SECTION_TITLE_STYLE}>
            {l === "en" ? <>Every module, <GradText>included.</GradText></> : <>Tous les modules, <GradText>inclus.</GradText></>}
          </h2>
          <p className={`mx-auto mt-4 max-w-xl ${SECTION_LEAD}`}>
            {T(l, "Les outils du quotidien qui gravitent autour des deux gros — tous dans le même espace de travail.", "The smaller tools you reach for around the two big ones — all in the same workspace.")}
          </p>
        </div>

        {/* Desktop : onglets à gauche, aperçu à droite */}
        <div className="mt-12 hidden items-stretch gap-x-6 gap-y-4 md:grid md:grid-cols-[2fr_3fr]">
          {/* La liste s'étire sur la hauteur du panneau : les deux colonnes s'alignent. */}
          <div className="flex flex-col gap-1.5 [&>button]:flex-1">
            {MODS.map((m) => (
              <ModItem key={m.k} m={m} l={l} active={active === m.k} onClick={() => setActive(m.k)} />
            ))}
          </div>
          <Preview k={active} l={l} tall cycle={cycle} />
          {/* Ligne 2 : le texte sous le panneau, la liste reste alignée sur le panneau */}
          <div className="md:col-start-2"><ModText k={active} l={l} /></div>
        </div>

        {/* Mobile : accordéon, l'aperçu s'ouvre sous le module choisi */}
        <div className="mt-10 space-y-1.5 md:hidden">
          {MODS.map((m) => (
            <div key={m.k}>
              <ModItem m={m} l={l} active={active === m.k} onClick={() => setActive(m.k)} />
              {active === m.k && <div className="mt-2 mb-3 space-y-3"><Preview k={m.k} l={l} cycle={cycle} /><ModText k={m.k} l={l} /></div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

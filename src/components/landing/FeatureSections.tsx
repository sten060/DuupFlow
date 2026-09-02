"use client";

import Link from "@/components/LocaleLink";
import { useParams } from "next/navigation";
import { BLUE, CTA_GRAD, Label, SECTION_LEAD, SECTION_TITLE, SECTION_TITLE_STYLE } from "@/components/landing/shell";
import { showcaseUrl, useInViewOnce, useLoopInView, useReducedMotion } from "@/components/landing/videoShowcase";
import { CLAUDE_WORDMARK, DuplicationMockup, ModuleArt, VariantsMockup } from "@/components/landing/featureMockups";

/* ══════════════════════════════════════════════════════════════
 * FONCTIONNALITÉS — une section par feature principale, puis les modules.
 * Ordre volontaire : le générateur de variantes passe en premier (feature prioritaire).
 * Chaque section montre un screen record réel du produit, jamais un mockup.
 * Chargement paresseux + reduced-motion → @/components/landing/videoShowcase
 * ══════════════════════════════════════════════════════════════ */

type Media = {
  /** MP4 H.264 vertical 9:16, muet, en boucle — ex. showcaseUrl("feature-variants.mp4") */
  src: string;
  /** Poster JPEG/WebP 1080x1920 — OBLIGATOIRE, affiché avant toute lecture */
  poster: string;
  /** Description de ce que montre la capture (accessibilité) */
  alt: { fr: string; en: string };
};

type FeatureSection = {
  key: string;
  icon: React.ReactNode;
  eyebrow: { fr: string; en: string };
  title: { fr: string; en: string };
  /** UNE phrase, pas plus */
  sub: { fr: string; en: string };
  media: Media;
  /** Mockup animé affiché tant qu'aucun screen record n'est fourni */
  mockup: (locale: "fr" | "en", reduced: boolean) => React.ReactNode;
  /** Lignes listées sous le texte : détails techniques ou étapes */
  lines?: { fr: [string, string]; en: [string, string] }[];
  /** true → les lignes sont numérotées 1·2·3 au lieu d'être à puces */
  steps?: boolean;
  /** true → bandeau « Connecté à Claude » sous le cadran */
  poweredByClaude?: boolean;
};

const ICON = "h-4 w-4";

/* Échelle typographique : définie une seule fois dans shell.tsx. */
const TITLE_CLASS = SECTION_TITLE;
const TITLE_STYLE = SECTION_TITLE_STYLE;
const LEAD_CLASS = SECTION_LEAD;

/* ─────────────────────────────────────────────────────────────
 * SOURCE DE VÉRITÉ DES DEUX FEATURES PRINCIPALES (copy + visuels).
 * Les `src`/`poster` sont vides : chaque section affiche un emplacement
 * explicite tant que le screen record n'est pas déposé dans le bucket.
 * Pour les brancher :  src: showcaseUrl("feature-ai-editor.mp4")
 * ───────────────────────────────────────────────────────────── */
export const FEATURE_SECTIONS: FeatureSection[] = [
  {
    key: "variants",
    icon: <svg className={ICON} viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 1.9 4.8L18 9.5l-4.1 1.7L12 16l-1.9-4.8L6 9.5l4.1-1.7Z" /></svg>,
    mockup: (l, r) => <VariantsMockup locale={l} reduced={r} />,
    eyebrow: { fr: "Générateur de variantes", en: "Variant generator" },
    title: { fr: "Une vidéo, autant de versions que tu veux.", en: "One video, as many versions as you want." },
    sub: {
      fr: "L'IA remonte ta vidéo en série : chaque version a ses propres coupes, son accroche et son cadrage.",
      en: "The AI re-edits your video in batches: every version gets its own cuts, hook and framing.",
    },
    media: {
      src: "",
      poster: "",
      alt: {
        fr: "Capture du générateur de variantes : une vidéo de départ, un nombre de versions demandé, les montages différents qui sortent les uns après les autres.",
        en: "Variant generator screen record: one source video, a number of versions requested, the different edits coming out one after another.",
      },
    },
    /* Numérotées : ce sont des étapes, pas une liste de caractéristiques. */
    steps: true,
    poweredByClaude: true,
    lines: [
      {
        fr: ["Dépose ta vidéo", "Un montage déjà fini ou tes rushes bruts : les deux marchent, dans n'importe quel format."],
        en: ["Drop in your video", "A finished edit or your raw footage: both work, in any format."],
      },
      {
        fr: ["Dis combien de versions tu veux", "Un nombre, et rien d'autre à régler. Une consigne écrite ou une vidéo de référence si tu as un style précis en tête."],
        en: ["Say how many versions you want", "Just a number, nothing else to set. Add a written prompt or a reference video if you have a specific style in mind."],
      },
      {
        fr: ["Récupère-les toutes d'un coup", "Claude remonte chaque version différemment — coupes, accroche, cadrage, sous-titres — et te les rend prêtes à poster."],
        en: ["Get them all at once", "Claude edits every version differently — cuts, hook, framing, captions — and hands them back ready to post."],
      },
    ],
  },
  {
    key: "duplication",
    icon: <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>,
    mockup: (l) => <DuplicationMockup locale={l} />,
    eyebrow: { fr: "Duplication & variantes", en: "Duplication & variants" },
    title: { fr: "Reposte la même vidéo, encore et encore.", en: "Repost the same video, again and again." },
    sub: {
      fr: "Chaque copie repart comme un fichier neuf, sans que l'œil voie la différence.",
      en: "Every copy goes back out as a brand-new file, with no visible difference.",
    },
    media: {
      src: "",
      poster: "",
      alt: {
        fr: "Capture de la duplication : un fichier importé, le nombre de copies choisi, les variantes générées une à une.",
        en: "Duplication screen record: one file imported, a copy count set, variants generated one by one.",
      },
    },
    lines: [
      {
        fr: ["Une vidéo, dix publications", "Ton meilleur contenu repart sur tous tes comptes, et revient dans quelques semaines."],
        en: ["One video, ten posts", "Your best content goes out on every account, then comes back a few weeks later."],
      },
      {
        fr: ["Retouche imperceptible", "Luminosité, teinte, cadrage : les écarts restent sous le seuil de l'œil. Ton montage ne bouge pas."],
        en: ["Imperceptible retouch", "Brightness, hue, framing: the shifts stay below the eye's threshold. Your edit doesn't move."],
      },
      {
        fr: ["Qualité d'origine", "Une 1080p reste une 1080p, une 4K reste une 4K — et jamais plus lourd que le fichier de départ."],
        en: ["Original quality", "1080p stays 1080p, 4K stays 4K — and never heavier than the file you started from."],
      },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────
 * MODULES SECONDAIRES — repris de la barre latérale du produit.
 * Format court (carte + icône + une phrase) : ils complètent les deux
 * grandes sections ci-dessus sans leur voler la vedette.
 * ───────────────────────────────────────────────────────────── */
type Module = {
  key: string;
  icon: React.ReactNode;
  name: { fr: string; en: string };
  desc: { fr: string; en: string };
};

const MODULE_ICON = "h-4 w-4";

export const MODULES: Module[] = [
  {
    key: "scraper",
    icon: <svg className={MODULE_ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>,
    name: { fr: "Scraper", en: "Scraper" },
    desc: {
      fr: "Scanne ton compte, classe tes publications par performance et remonte tes meilleurs clips.",
      en: "Scans your account, ranks your posts by performance and surfaces your best clips.",
    },
  },
  {
    key: "compressor",
    icon: <svg className={MODULE_ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h6V4M20 14h-6v6M10 10 3 3M14 14l7 7" /></svg>,
    name: { fr: "Compresseur", en: "Compressor" },
    desc: {
      fr: "Réduit le poids de tes images et vidéos sans perte visible. Jamais plus lourd que l'original.",
      en: "Cuts the weight of your images and videos with no visible loss. Never heavier than the original.",
    },
  },
  {
    key: "comparator",
    icon: <svg className={MODULE_ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>,
    name: { fr: "Comparateur", en: "Comparator" },
    desc: {
      fr: "Mesure la similarité visuelle entre deux fichiers et te dit ce qui les distingue vraiment.",
      en: "Measures visual similarity between two files and tells you what actually sets them apart.",
    },
  },
  {
    key: "ai-variation",
    icon: <svg className={MODULE_ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 2.3 6.2L20.5 11l-6.2 2.3L12 19l-2.3-5.7L3.5 11l6.2-1.8Z" /></svg>,
    name: { fr: "Variation IA", en: "AI Variation" },
    desc: {
      fr: "Génère de nouvelles images à partir des tiennes : même visage, même décor, même ambiance.",
      en: "Generates new images from your own: same face, same set, same mood.",
    },
  },
  {
    key: "ai-detection",
    icon: <svg className={MODULE_ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>,
    name: { fr: "Détection IA", en: "AI Detection" },
    desc: {
      fr: "Analyse un fichier et liste les marqueurs techniques laissés par les outils de génération.",
      en: "Analyses a file and lists the technical markers left behind by generation tools.",
    },
  },
];

function useLocale(): "fr" | "en" {
  const params = useParams();
  const l = Array.isArray(params?.locale) ? params?.locale[0] : params?.locale;
  return l === "en" ? "en" : "fr";
}

/* ─── Le visuel : mockup animé du produit, ou screen record si fourni ─── */
function SectionMedia({ media, mockup, locale, reduced }: { media: Media; mockup: React.ReactNode; locale: "fr" | "en"; reduced: boolean }) {
  const { ref, playing } = useLoopInView(reduced, 0.25);
  const ready = Boolean(media.src && media.poster);

  /* Cadran large (16:10) : c'est lui qui donne la place au mockup animé.
     Un screen record 9:16 déposé plus tard se centre dedans, à pleine hauteur. */
  return (
    <div className="w-full" style={{ aspectRatio: "16 / 10" }}>
      {ready ? (
        <div className="flex h-full items-center justify-center">
          <div className="relative h-full overflow-hidden rounded-[14px] bg-[#eef1f7] shadow-[0_2px_6px_rgba(20,40,90,0.05),0_16px_38px_rgba(20,40,90,0.13)]" style={{ aspectRatio: "9 / 16" }}>
            <video
              ref={ref}
              src={media.src}
              poster={media.poster}
              aria-label={media.alt[locale]}
              preload="none"
              muted
              loop
              playsInline
              disablePictureInPicture
              className="h-full w-full object-cover"
            />
            {/* Voile de repos : s'efface dès que la boucle tourne */}
            <span aria-hidden className="pointer-events-none absolute inset-0 bg-black/5 transition-opacity duration-300" style={{ opacity: playing ? 0 : 1 }} />
          </div>
        </div>
      ) : (
        mockup
      )}
    </div>
  );
}

/* ─── Une feature = sa propre section : texte d'un côté, visuel de l'autre ───
   Le 9:16 tient dans un panneau qui l'épouse (w-fit) plutôt qu'au centre d'un
   grand vide : c'est ce qui permet de garder la section compacte. */
function Section({ section, locale, reduced, index }: { section: FeatureSection; locale: "fr" | "en"; reduced: boolean; index: number }) {
  const flipped = index % 2 === 1;   // une section sur deux inverse texte/visuel
  const { ref, shown } = useInViewOnce<HTMLDivElement>();
  const on = shown || reduced;

  /* Chaque colonne entre par le bord dont elle est la plus proche.
     `overflow-hidden` sur la section : sans lui, la translation créerait un
     débordement horizontal le temps de l'animation. */
  const slideFrom = (dir: -1 | 1) => ({
    opacity: on ? 1 : 0,
    transform: on ? "none" : `translateX(${dir * 110}px)`,
    transition: "opacity .65s ease-out, transform .95s cubic-bezier(0.16,1,0.3,1)",
  });

  return (
    <section className={`overflow-hidden px-6 py-20 sm:py-28 ${flipped ? "bg-[#f8f9fc]" : ""}`}>
      <div className="mx-auto max-w-6xl">
        {/* Seule la pastille est centrée sur la section */}
        <div className="text-center">
          <Label icon={section.icon}>{section.eyebrow[locale]}</Label>
        </div>

        {/* La colonne large suit le visuel : sans ça, la section inversée
            afficherait un mockup plus étroit que l'autre. */}
        <div ref={ref} className={`mt-14 grid items-center gap-12 lg:gap-16 ${flipped ? "lg:grid-cols-[1fr_1.12fr]" : "lg:grid-cols-[1.12fr_1fr]"}`}>
          {/* Visuel — sans cadre : le mockup porte lui-même son ombre.
              `min-w-0` : sans lui, le min-width:auto des éléments de grille
              empêche la colonne de rétrécir et le mockup déborde en mobile. */}
          <div className={`min-w-0 ${flipped ? "lg:order-2" : ""}`} style={slideFrom(flipped ? 1 : -1)}>
            <SectionMedia media={section.media} mockup={section.mockup(locale, reduced)} locale={locale} reduced={reduced} />

            {/* Signature : le montage est piloté depuis le Claude de l'utilisateur */}
            {section.poweredByClaude && (
              <div className="mt-6 flex justify-center">
                <span className="inline-flex items-center gap-2.5 rounded-full border border-white/60 bg-white/55 px-4 py-2 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_10px_30px_rgba(20,40,90,0.12)] backdrop-blur-xl backdrop-saturate-150">
                  <span className="text-[12.5px] font-medium text-[#4a4f5c]">
                    {locale === "en" ? "Connected to" : "Connecté à"}
                  </span>
                  <img src={CLAUDE_WORDMARK} alt="Claude" className="h-[18px] w-auto object-contain" />
                </span>
              </div>
            )}
          </div>

          {/* Texte — aligné à gauche, structure identique dans les deux sections */}
          <div className={`min-w-0 ${flipped ? "lg:order-1" : ""}`} style={slideFrom(flipped ? -1 : 1)}>
            <h2 className={TITLE_CLASS} style={TITLE_STYLE}>
              {section.title[locale]}
            </h2>
            {/* Deux lignes maximum : la copy est calibrée pour ça. */}
            <p className={`mt-4 max-w-lg ${LEAD_CLASS}`}>
              {section.sub[locale]}
            </p>

            {section.lines && (
              <ul className="mt-8 space-y-6 border-t border-black/[0.07] pt-7">
                {section.lines.map((line, i) => {
                  const [title, desc] = line[locale];
                  return (
                    <li key={i} className="flex gap-4">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12.5px] font-semibold text-white shadow-[0_6px_14px_rgba(90,90,240,0.30)]" style={{ background: CTA_GRAD }}>
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[16px] font-semibold leading-snug text-[#1a1a1a]">{title}</span>
                        <span className="mt-1 block text-[14.5px] leading-relaxed text-[#605f5f]">{desc}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Modules secondaires : format court, une carte par module ─── */
function Modules({ locale, reduced }: { locale: "fr" | "en"; reduced: boolean }) {
  const { ref, shown } = useInViewOnce<HTMLDivElement>("0px 0px -18% 0px");
  const on = shown || reduced;
  return (
    <section className="bg-[#f8f9fc] px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <Label icon={<svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>}>
            {locale === "en" ? "The rest of the toolkit" : "Le reste de la boîte à outils"}
          </Label>
          <h2 className={`mt-7 ${TITLE_CLASS}`} style={TITLE_STYLE}>
            {locale === "en" ? "Every module, included." : "Tous les modules, inclus."}
          </h2>
          <p className={`mx-auto mt-4 max-w-xl ${LEAD_CLASS}`}>
            {locale === "en"
              ? "The smaller tools you reach for around the two big ones — all in the same workspace."
              : "Les outils du quotidien qui gravitent autour des deux gros — tous dans le même espace de travail."}
          </p>
        </div>

        {/* Flex plutôt que grid : 5 modules, la dernière ligne se centre au lieu
            de laisser un trou à droite. */}
        <div ref={ref} className="mt-12 flex flex-wrap justify-center gap-3.5 lg:gap-4" style={{ perspective: "1400px" }}>
          {MODULES.map((m, i) => (
            <div key={m.key}
              style={{
                opacity: on ? 1 : 0,
                transform: on ? "none" : "rotateY(-72deg)",
                transformOrigin: "left center",
                transition: `opacity .45s ease-out ${i * 0.09}s, transform .75s cubic-bezier(0.16,1,0.3,1) ${i * 0.09}s`,
              }}
              className="w-full rounded-[24px] bg-white/70 p-6 ring-1 ring-black/[0.06] shadow-[0_14px_36px_rgba(20,40,90,0.07)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(20,40,90,0.12)] sm:w-[calc(50%-0.4375rem)] lg:w-[calc(33.333%-0.667rem)]">
              {/* Cadran : une mini-interface représentative du module */}
              <div className="relative flex h-[132px] items-center justify-center overflow-hidden rounded-[18px] ring-1 ring-black/[0.04]"
                style={{ background: "linear-gradient(140deg,#f3f6ff 0%,#f6f2ff 100%)" }}>
                <ModuleArt kind={m.key} locale={locale} />
                <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 shadow-[0_6px_16px_rgba(20,40,90,0.10)]" style={{ color: BLUE }}>
                  {m.icon}
                </span>
              </div>
              <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.01em] text-[#1a1a1a]">{m.name[locale]}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#605f5f]">{m.desc[locale]}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function FeatureSections() {
  const locale = useLocale();
  const reduced = useReducedMotion();

  return (
    <div id="features">
      {FEATURE_SECTIONS.map((s, i) => (
        <Section key={s.key} section={s} locale={locale} reduced={reduced} index={i} />
      ))}
      <Modules locale={locale} reduced={reduced} />

      {/* CTA — voir les tarifs / voir la FAQ */}
      <div className="px-6 pb-20 sm:pb-24">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/pricing"
            className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-medium text-white shadow-[0_12px_34px_rgba(90,90,240,0.4)] transition hover:opacity-90"
            style={{ background: CTA_GRAD }}>
            {locale === "en" ? "See pricing" : "Voir les tarifs"}
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
          <Link href="/#faq"
            className="inline-flex items-center rounded-full border border-black/10 bg-white px-7 py-3.5 text-[15px] font-medium text-[#1a1a1a] shadow-[0_10px_30px_rgba(20,40,90,0.06)] transition hover:bg-neutral-50">
            {locale === "en" ? "See the FAQ" : "Voir la FAQ"}
          </Link>
        </div>
      </div>
    </div>
  );
}

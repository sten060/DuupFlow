"use client";

import { useParams } from "next/navigation";
import { CTA_GRAD, GradText, Label, SECTION_LEAD, SECTION_TITLE, SECTION_TITLE_STYLE } from "@/components/landing/shell";
import { showcaseUrl, useInViewOnce, useLoopInView, useReducedMotion } from "@/components/landing/videoShowcase";
import { AiEditorMockup, CLAUDE_WORDMARK, DuplicationMockup } from "@/components/landing/featureMockups";
import { AgencyBento, ModulesBento } from "@/components/landing/Bento";

/* ══════════════════════════════════════════════════════════════
 * FONCTIONNALITÉS — une section par feature principale, puis les modules.
 * Ordre volontaire : l'éditeur IA passe en premier (feature prioritaire).
 * Chaque section montre un screen record réel du produit, jamais un mockup.
 * Chargement paresseux + reduced-motion → @/components/landing/videoShowcase
 * ══════════════════════════════════════════════════════════════ */

type Media = {
  /** MP4 H.264 vertical 9:16, muet, en boucle — ex. showcaseUrl("feature-ai-editor.mp4") */
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
  /** Mot ou groupe de mots du titre mis en dégradé de marque. */
  titleHi?: { fr: string; en: string };
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
    key: "duplication",
    icon: <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>,
    mockup: (l) => <DuplicationMockup locale={l} />,
    eyebrow: { fr: "Duplication & variantes", en: "Duplication & variants" },
    title: { fr: "Reposte la même vidéo, encore et encore.", en: "Repost the same video, again and again." },
    titleHi: { fr: "encore et encore", en: "again and again" },
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
  {
    key: "ai-editor",
    icon: <svg className={ICON} viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 1.9 4.8L18 9.5l-4.1 1.7L12 16l-1.9-4.8L6 9.5l4.1-1.7Z" /></svg>,
    mockup: (l, r) => <AiEditorMockup locale={l} reduced={r} />,
    eyebrow: { fr: "Éditeur IA", en: "AI Editor" },
    title: { fr: "Décris ton montage, l'IA s'occupe du reste.", en: "Describe your edit, the AI does the rest." },
    titleHi: { fr: "l'IA s'occupe du reste", en: "the AI does the rest" },
    sub: {
      fr: "Tes rushes bruts deviennent une vidéo montée en quelques minutes.",
      en: "Your raw footage becomes a finished video, in minutes.",
    },
    media: {
      src: "",
      poster: "",
      alt: {
        fr: "Capture de l'éditeur IA : des rushes uploadés, une consigne en langage naturel, le montage assemblé automatiquement.",
        en: "AI Editor screen record: uploaded footage, a plain-language prompt, the edit assembled automatically.",
      },
    },
    /* Numérotées : ce sont des étapes, pas une liste de caractéristiques. */
    steps: true,
    poweredByClaude: true,
    lines: [
      {
        fr: ["Ajoute ton style de montage", "Une vidéo de référence ou une consigne écrite : l'IA en déduit le rythme, les coupes et les sous-titres."],
        en: ["Set your editing style", "A reference video or a written prompt: the AI infers the pacing, the cuts and the captions."],
      },
      {
        fr: ["Rentre tes fichiers", "Glisse tes rushes bruts, dans n'importe quel format."],
        en: ["Drop in your files", "Add your raw footage, in any format."],
      },
      {
        fr: ["Laisse Claude faire le montage", "L'agent assemble, cale les coupes sur les beats et sort la vidéo prête à publier."],
        en: ["Let Claude do the edit", "The agent assembles it, locks the cuts to the beats and returns a video ready to post."],
      },
    ],
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
/* Titre avec un groupe de mots en dégradé (la 1re occurrence de `hi`). */
function TitleWithHi({ text, hi }: { text: string; hi?: string }) {
  const i = hi ? text.indexOf(hi) : -1;
  if (!hi || i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<GradText>{hi}</GradText>{text.slice(i + hi.length)}</>;
}

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

  // Pas de fond alterné : la grille « blueprint » court sous les deux sections,
  // la rupture vient avec les modules (fond gris) puis les agences.
  // Entre Duplication et Éditeur IA, marges réduites des deux côtés.
  const first = index === 0;
  const last = index === FEATURE_SECTIONS.length - 1;
  return (
    <section className={`overflow-hidden px-6 ${first ? "pt-20 sm:pt-28" : "pt-10 sm:pt-14"} ${last ? "pb-20 sm:pb-28" : "pb-10 sm:pb-14"}`}>
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
              <TitleWithHi text={section.title[locale]} hi={section.titleHi?.[locale]} />
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

export default function FeatureSections() {
  const locale = useLocale();
  const reduced = useReducedMotion();

  return (
    <div id="features">
      {/* Duplication → Éditeur IA → modules → agences */}
      {FEATURE_SECTIONS.map((s, i) => (
        <Section key={s.key} section={s} locale={locale} reduced={reduced} index={i} />
      ))}
      <ModulesBento locale={locale} />
      <AgencyBento locale={locale} />
    </div>
  );
}

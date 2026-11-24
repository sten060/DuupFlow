/* ══════════════════════════════════════════════════════════════
 * « DUPLICATE, THEN VARY » — juste après la section Duplication.
 *
 * Présente les deux niveaux de la duplication dans le même outil :
 *   1. Invisible : copies identiques à l'œil, fichiers neufs pour les plateformes ;
 *   2. Variations : la Duplication IA crée jusqu'à 50 versions visiblement
 *      différentes (src/lib/ai-dup/config.ts → MAX_COPIES).
 * + textes et sous-titres variés par copie (src/lib/text-overlay-config.ts).
 *
 * Volontairement SANS animation d'entrée ni contenu caché : tout le texte est
 * dans le HTML rendu par le serveur, lisible par Google et par les IA.
 * ══════════════════════════════════════════════════════════════ */

import Link from "@/components/LocaleLink";
import { CTA_GRAD, GradText, Label, SECTION_LEAD, SECTION_TITLE, SECTION_TITLE_STYLE } from "@/components/landing/shell";

type L = "fr" | "en";

const COPY = {
  en: {
    eyebrow: "Invisible copies + AI variations",
    titleA: "Duplicate, ",
    titleHi: "then vary.",
    lead: "Two levels in the same tool: copies that look identical but are brand-new files for the platforms, and AI variations that look like different posts.",
    levels: [
      {
        tag: "Level 1",
        name: "Invisible",
        text: "Copies identical to the eye, but every file is new for the platforms: new metadata, re-encoding and a unique fingerprint.",
        points: ["Same look, same quality", "New metadata and re-encoding", "Unique fingerprint per copy"],
      },
      {
        tag: "Level 2",
        name: "Variations",
        text: "The AI creates up to 50 visibly different versions of the same video, guided by your own instructions.",
        points: ["Rewritten caption and new style", "New framing, subtitles and speed", "Different colours on every version"],
      },
    ],
    extraTitle: "Captions and subtitles that change on every copy",
    extraText: "Add your text and automatic subtitles: each copy gets a different combination of fonts, colours and subtitle styles.",
    cta: "Create your account",
  },
  fr: {
    eyebrow: "Copies invisibles + variations IA",
    titleA: "Duplique, ",
    titleHi: "puis varie.",
    lead: "Deux niveaux dans le même outil : des copies qui se ressemblent mais sont des fichiers neufs pour les plateformes, et des variations IA qui ressemblent à d'autres posts.",
    levels: [
      {
        tag: "Niveau 1",
        name: "Invisible",
        text: "Des copies identiques à l'œil, mais chaque fichier est nouveau pour les plateformes : nouvelles métadonnées, réencodage et empreinte unique.",
        points: ["Même rendu, même qualité", "Nouvelles métadonnées et réencodage", "Une empreinte unique par copie"],
      },
      {
        tag: "Niveau 2",
        name: "Variations",
        text: "L'IA crée jusqu'à 50 versions visuellement différentes d'une même vidéo, guidées par tes propres consignes.",
        points: ["Légende réécrite et nouveau style", "Nouveau cadrage, sous-titres et vitesse", "Des couleurs différentes à chaque version"],
      },
    ],
    extraTitle: "Des textes et sous-titres qui changent à chaque copie",
    extraText: "Ajoute ton texte et des sous-titres automatiques : chaque copie prend une combinaison différente de polices, de couleurs et de styles de sous-titres.",
    cta: "Créer mon compte",
  },
} as const;

const ICON = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 1.9 4.8L18 9.5l-4.1 1.7L12 16l-1.9-4.8L6 9.5l4.1-1.7Z" /></svg>
);

export default function VariationsSection({ locale }: { locale: L }) {
  const c = COPY[locale];
  return (
    <section id="variations" className="px-6 py-10 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Label icon={ICON}>{c.eyebrow}</Label>
          <h2 className={`mx-auto mt-6 max-w-3xl ${SECTION_TITLE}`} style={SECTION_TITLE_STYLE}>
            {c.titleA}<GradText>{c.titleHi}</GradText>
          </h2>
          <p className={`mx-auto mt-4 max-w-2xl ${SECTION_LEAD}`}>{c.lead}</p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {c.levels.map((lv, i) => (
            <div
              key={lv.name}
              className={`rounded-2xl p-7 ${i === 1 ? "ring-1 ring-[#4f7bff]/25 shadow-[0_18px_44px_rgba(79,123,255,0.12)]" : "bg-[#f5f6fb] ring-1 ring-black/[0.05]"}`}
              style={i === 1 ? { background: "linear-gradient(135deg, rgba(79,123,255,0.07) 0%, rgba(124,92,255,0.10) 100%), #ffffff" } : undefined}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white shadow-[0_6px_14px_rgba(90,90,240,0.30)]" style={{ background: CTA_GRAD }}>
                  {i + 1}
                </span>
                <span className="text-[13px] font-medium uppercase tracking-wider text-[#8a8a8a]">{lv.tag}</span>
              </div>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight text-[#1a1a1a]">{lv.name}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#605f5f]">{lv.text}</p>
              <ul className="mt-5 space-y-2 border-t border-black/[0.07] pt-5">
                {lv.points.map((p) => (
                  <li key={p} className="flex gap-3 text-[14.5px] text-[#3f4453]">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4f7bff]" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-5 rounded-2xl bg-white p-7 ring-1 ring-black/[0.08] sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[#1a1a1a]">{c.extraTitle}</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-[#605f5f]">{c.extraText}</p>
          </div>
          <Link
            href="/register"
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full px-6 py-3 text-[15px] font-semibold text-white shadow-[0_12px_30px_rgba(90,90,240,0.35)] transition hover:opacity-90 sm:self-center"
            style={{ background: CTA_GRAD }}
          >
            {c.cta}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

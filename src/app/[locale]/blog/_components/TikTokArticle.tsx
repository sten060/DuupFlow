// Shared bilingual renderer for the TikTok "ineligible for recommendation"
// article. Two thin route folders (one per language slug) import this and pass
// `lang`. Mirrors the Instagram article's layout exactly (12-col grid, sticky
// ArticleTOC, FAQ, JSON-LD) for perfect visual consistency.

import NextLink from "next/link";
import Link from "@/components/LocaleLink";
import ArticleTOC, { type TocSection } from "./ArticleTOC";

export type Lang = "fr" | "en";

export const SLUG_FR = "tiktok-ineligible-recommandations";
export const SLUG_EN = "tiktok-ineligible-for-recommendation";
export const PUBLISHED_AT = "2026-06-21";
export const READING_MIN = 8;

export const CANONICAL: Record<Lang, string> = {
  fr: `/fr/blog/${SLUG_FR}`,
  en: `/en/blog/${SLUG_EN}`,
};

export const META: Record<Lang, { title: string; description: string }> = {
  fr: {
    title: 'TikTok « inéligible aux recommandations » : causes et vraie solution (2026)',
    description:
      "Tes vues TikTok ont chuté et tu es flag pour « contenu non original, de mauvaise qualité ou QR » ? Ce que ça veut dire vraiment, pourquoi les appels ne suffisent pas, et comment redevenir éligible.",
  },
  en: {
    title: 'TikTok "ineligible for recommendation": causes and the real fix (2026)',
    description:
      'Your TikTok views collapsed and you were flagged for "unoriginal, low-quality, or QR content"? What it really means, why appeals aren\'t enough, and how to become eligible again.',
  },
};

const IMG_SRC = "/SEO-page/tiktok-ineligibility-notice.png";

const SECTIONS: Record<Lang, TocSection[]> = {
  fr: [
    { id: "definition", label: "Ce que « inéligible aux recommandations » veut dire" },
    { id: "raisons", label: "Les trois raisons qui déclenchent le flag" },
    { id: "spoofers", label: "Pourquoi les métadonnées et les vieux spoofers ne marchent plus" },
    { id: "appel", label: "Pourquoi faire appel ne suffit presque jamais" },
    { id: "solution", label: "La seule chose qui marche : la transformation réelle" },
    { id: "faq", label: "Questions fréquentes" },
  ],
  en: [
    { id: "definition", label: "What “ineligible for recommendation” really means" },
    { id: "raisons", label: "The three reasons it gets flagged" },
    { id: "spoofers", label: "Why metadata and old spoofers no longer work" },
    { id: "appel", label: "Why appealing almost never works" },
    { id: "solution", label: "The only thing that works: real transformation" },
    { id: "faq", label: "Frequently asked questions" },
  ],
};

type FaqItem = { q: string; a: string };
const FAQ: Record<Lang, FaqItem[]> = {
  fr: [
    {
      q: "Que veut dire « inéligible aux recommandations » sur TikTok ?",
      a: "Ta vidéo n'est pas supprimée et ton compte n'est pas banni : elle reste sur ton profil et tes abonnés la voient, mais TikTok ne la pousse plus dans le For You. Le reach chute donc fortement — c'est une restriction de portée, pas un bannissement.",
    },
    {
      q: "Pourquoi TikTok dit que mon contenu est non original ?",
      a: "TikTok juge non original un contenu importé ou copié d'une autre source sans modification créative réelle. Re-uploader le même clip, même avec de nouvelles métadonnées, tombe dans cette catégorie. Un watermark d'une autre app ou un QR code renforcent ce signal.",
    },
    {
      q: "Est-ce que « inéligible aux recommandations » disparaît ?",
      a: "Une vidéo peut redevenir éligible, mais faire appel ne traite qu'un cas à la fois sans changer la cause. Tant que tu postes du contenu lu comme non original, les flags reviennent. La vraie sortie est de transformer réellement le contenu.",
    },
    {
      q: "Pourquoi mes vues TikTok ont chuté à presque zéro d'un coup ?",
      a: "Parce que la vidéo n'est plus diffusée au-delà de tes abonnés. Une vidéo qui ferait des milliers de vues via le For You n'en fait plus que quelques centaines — celles de ta base existante. La bascule est brutale car c'est la recommandation qui est coupée.",
    },
    {
      q: "Est-ce que reposter du contenu se fait flag sur TikTok ?",
      a: "Oui, si le repost est lu comme non original (même fichier, scène identique, simple ré-upload). TikTok analyse le contenu perçu — scène, mouvement, audio — pas le fichier. Pour rester éligible, chaque version doit être réellement différente, pas juste ré-encodée.",
    },
  ],
  en: [
    {
      q: "What does “ineligible for recommendation” mean on TikTok?",
      a: "Your video isn't removed and your account isn't banned: it stays on your profile and your followers still see it, but TikTok no longer pushes it to the For You feed. Reach drops sharply — it's a distribution limit, not a ban.",
    },
    {
      q: "Why does TikTok say my content is unoriginal?",
      a: "TikTok flags content imported or copied from another source with no real creative editing. Re-uploading the same clip, even with new metadata, falls here. A watermark from another app or a QR code reinforce that signal.",
    },
    {
      q: "Does “ineligible for recommendation” go away?",
      a: "A video can become eligible again, but appealing only addresses one case at a time without changing the cause. As long as you post content read as unoriginal, the flags return. The real way out is to genuinely transform the content.",
    },
    {
      q: "Why did my TikTok views suddenly drop to almost zero?",
      a: "Because the video is no longer shown beyond your followers. A video that would get thousands of views via For You now gets only a few hundred — your existing base. The drop is brutal because it's the recommendation that's cut off.",
    },
    {
      q: "Does reposting content get flagged on TikTok?",
      a: "Yes, if the repost reads as unoriginal (same file, identical scene, plain re-upload). TikTok analyses the perceived content — scene, motion, audio — not the file. To stay eligible, each version must be genuinely different, not just re-encoded.",
    },
  ],
};

/* Body copy, kept as data so the render stays single-source for both languages. */
const C = {
  fr: {
    breadcrumb: "TikTok : inéligible aux recommandations",
    h1: "Pourquoi ton TikTok est « inéligible aux recommandations » — et comment vraiment régler le problème",
    metaTag: "Algorithme TikTok",
    readLabel: "min de lecture",
    standfirst:
      "Tes vues sont passées de plusieurs milliers à presque rien du jour au lendemain. Une notice est apparue : contenu non original, de mauvaise qualité ou QR. Voici ce qui se passe vraiment, pourquoi faire appel ne suffit presque jamais, et ce qui remet réellement ton contenu dans le feed.",
    imgAlt:
      "Notice TikTok d'inéligibilité aux recommandations indiquant un contenu non original, de mauvaise qualité ou avec QR code",
    imgCaption:
      "La notice affichée par TikTok : « Unoriginal, low-quality, and QR code content » — les trois motifs d'inéligibilité.",
    s1: [
      "TikTok ne supprime pas ta vidéo et ne bannit pas ton compte. La vidéo reste sur ton profil, tes abonnés la voient — mais elle n'est plus poussée dans le For You.",
      "D'où la chute brutale de reach : une vidéo qui ferait des milliers de vues n'en fait plus que quelques centaines, parce qu'elle ne touche plus que tes abonnés existants. C'est une restriction de portée, pas un ban — ce qui, pour la croissance, revient presque à être invisible.",
    ],
    s2Intro:
      "TikTok regroupe l'inéligibilité sous trois motifs. Avant de chercher une parade, il faut savoir lequel te concerne.",
    cards: [
      {
        n: "01",
        title: "Contenu non original",
        body: "Contenu importé ou copié d'une autre source sans modification créative réelle. C'est le motif principal, et celui sur lequel butent les reposters : re-uploader le même clip, même avec de nouvelles métadonnées, tombe ici.",
      },
      {
        n: "02",
        title: "Mauvaise qualité",
        body: "Vidéos très courtes, images statiques, faible résolution, forte compression, vidéos composées uniquement de GIF. Si la source est mauvaise, aucun travail d'originalité ne sauve la vidéo.",
      },
      {
        n: "03",
        title: "Watermarks & QR codes",
        body: "Un logo ou filigrane d'une autre app (TikTok, CapCut, Snap) sur une vidéo réuploadée est à lui seul un signal fort de non-originalité. TikTok cite aussi explicitement les QR codes.",
      },
    ],
    s2Callout:
      "Avant d'accuser le « non-original », vérifie ton propre fichier : un watermark oublié ou un export basse résolution se font flag pareil — et c'est bien plus rapide à corriger.",
    s3: [
      "TikTok ne compare plus les fichiers, il analyse le contenu : la scène, le mouvement, l'audio, ce qui est réellement à l'écran.",
      "Donc changer les métadonnées ne fait rien (le système ne lit plus les propriétés du fichier). Ajouter du grain, décaler la teinte ou la saturation n'aide pas (la scène reste la même scène). Un recadrage léger ne suffit pas (le sujet, l'action et l'audio restent identiques).",
      "Si tu pousses les curseurs de ton ancien spoofer à fond et que tu es quand même flag, c'est exactement pour ça : tu agis sur la couche fichier alors que la détection est passée à la couche contenu.",
    ],
    s4: [
      "Faire appel demande à TikTok de re-vérifier UNE vidéo précise. Même si ça réussit, ça ne change rien à la raison du flag : si tu reposte du contenu lu comme non original, ta prochaine vidéo sera flag aussi.",
      "Faire appel traite le symptôme, une vidéo à la fois, pendant que la cause continue de produire des flags. C'est le piège : dépenser son énergie à faire appel au lieu de corriger l'entrée.",
    ],
    s5: [
      "Comme la détection lit le contenu lui-même, la seule vraie solution est de changer le contenu lui-même. Pas le fichier — les images.",
      "Le but n'est pas de « tromper » l'algo, mais de rendre chaque version assez réellement différente pour qu'elle soit lue comme un contenu à part entière.",
    ],
    s5ListIntro: "En pratique :",
    s5List: [
      "Recadrage dynamique — le cadre se déplace et zoome dans la durée.",
      "Mouvement progressif — rotation lente, zoom graduel.",
      "Vraie variation structurelle — couper le début/la fin, varier le rythme.",
    ],
    s5After:
      "Point crucial pour les créateurs dont le sujet EST la valeur : cette transformation change le cadrage et l'habillage sans déformer le sujet.",
    s5Callout:
      "Soyons honnêtes : aucune méthode ne rend le contenu indétectable pour toujours, et quiconque le promet te ment. L'objectif réaliste est de maximiser ta marge, pas de devenir invisible.",
    ctaTitle: "DuupFlow a été repensé exactement pour ça",
    ctaBody:
      "Au lieu de maquiller le fichier, DuupFlow applique une vraie transformation visuelle — recadrage dynamique, mouvement progressif, variation structurelle — pensée pour la détection d'aujourd'hui, tout en gardant le sujet intact. Un upload, plusieurs versions réellement différentes.",
    ctaButton: "Voir comment DuupFlow fonctionne →",
    faqTitle: "Questions fréquentes",
    back: "← Retour au blog",
  },
  en: {
    breadcrumb: "TikTok: ineligible for recommendation",
    h1: "Why your TikTok is “ineligible for recommendation” — and how to actually fix it",
    metaTag: "TikTok algorithm",
    readLabel: "min read",
    standfirst:
      "Your views went from thousands to almost nothing overnight. A notice appeared: unoriginal, low-quality, or QR content. Here's what's really happening, why appealing almost never works, and what actually puts your content back in the feed.",
    imgAlt:
      "TikTok ineligible-for-recommendation notice stating unoriginal, low-quality, and QR code content",
    imgCaption:
      "TikTok's own notice: “Unoriginal, low-quality, and QR code content” — the three reasons for ineligibility.",
    s1: [
      "TikTok doesn't remove your video and doesn't ban your account. The video stays on your profile, your followers see it — but it's no longer pushed to the For You feed.",
      "Hence the brutal reach collapse: a video that would get thousands of views now gets only a few hundred, because it only reaches your existing followers. It's a reach restriction, not a ban — which, for growth, is almost the same as being invisible.",
    ],
    s2Intro:
      "TikTok groups ineligibility under three reasons. Before looking for a workaround, you need to know which one applies to you.",
    cards: [
      {
        n: "01",
        title: "Unoriginal content",
        body: "Content imported or copied from another source with no real creative editing. This is the main one, and where reposters get stuck: re-uploading the same clip, even with new metadata, lands here.",
      },
      {
        n: "02",
        title: "Low quality",
        body: "Very short videos, static images, low resolution, heavy compression, videos made only of GIFs. If the source is poor, no amount of originality work saves the video.",
      },
      {
        n: "03",
        title: "Watermarks & QR codes",
        body: "A logo or watermark from another app (TikTok, CapCut, Snap) on a re-uploaded video is, on its own, a strong unoriginality signal. TikTok also explicitly calls out QR codes.",
      },
    ],
    s2Callout:
      "Before blaming “unoriginal”, check your own file: a forgotten watermark or a low-resolution export get flagged just the same — and they're far quicker to fix.",
    s3: [
      "TikTok no longer compares files — it analyses the content: the scene, the motion, the audio, what's actually on screen.",
      "So changing metadata does nothing (the system no longer reads file properties). Adding grain, shifting hue or saturation doesn't help (the scene is still the same scene). A slight crop isn't enough (the subject, the action and the audio stay identical).",
      "If you push your old spoofer's sliders to the max and still get flagged, this is exactly why: you're acting on the file layer while detection has moved to the content layer.",
    ],
    s4: [
      "Appealing asks TikTok to re-check ONE specific video. Even if it succeeds, it changes nothing about the reason for the flag: if you repost content read as unoriginal, your next video gets flagged too.",
      "Appealing treats the symptom, one video at a time, while the cause keeps producing flags. That's the trap: spending your energy appealing instead of fixing the input.",
    ],
    s5: [
      "Because detection reads the content itself, the only real fix is to change the content itself. Not the file — the frames.",
      "The goal isn't to “trick” the algorithm, but to make each version genuinely different enough that it's read as content in its own right.",
    ],
    s5ListIntro: "In practice:",
    s5List: [
      "Dynamic reframing — the frame moves and zooms over time.",
      "Progressive motion — slow rotation, gradual zoom.",
      "Real structural variation — trim the start/end, vary the pacing.",
    ],
    s5After:
      "Crucial for creators whose subject IS the value: this transformation changes the framing and packaging without distorting the subject.",
    s5Callout:
      "Let's be honest: no method makes content undetectable forever, and anyone who promises that is lying to you. The realistic goal is to maximise your margin, not to become invisible.",
    ctaTitle: "DuupFlow was rebuilt for exactly this",
    ctaBody:
      "Instead of disguising the file, DuupFlow applies a real visual transformation — dynamic reframing, progressive motion, structural variation — designed for today's detection, while keeping the subject intact. One upload, several genuinely different versions.",
    ctaButton: "See how DuupFlow works →",
    faqTitle: "Frequently asked questions",
    back: "← Back to the blog",
  },
} as const;

function jsonLd(lang: Lang) {
  const c = C[lang];
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: c.h1,
    datePublished: PUBLISHED_AT,
    dateModified: PUBLISHED_AT,
    inLanguage: lang === "fr" ? "fr-FR" : "en-US",
    image: `https://www.duupflow.com${IMG_SRC}`,
    author: { "@type": "Organization", name: "DuupFlow" },
    publisher: {
      "@type": "Organization",
      name: "DuupFlow",
      logo: { "@type": "ImageObject", url: "https://www.duupflow.com/logo-mark.png" },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://www.duupflow.com${CANONICAL[lang]}` },
  };
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ[lang].map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return [article, faq];
}

export default function TikTokArticle({ lang }: { lang: Lang }) {
  const c = C[lang];
  const sections = SECTIONS[lang];
  const faq = FAQ[lang];
  const [articleLd, faqLd] = jsonLd(lang);
  const ctaHref = `/${lang}?utm_source=blog&utm_medium=organic&utm_campaign=tiktok_ineligible`;
  const dateLabel = new Date(PUBLISHED_AT).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const H2 = "pt-6 text-2xl md:text-3xl font-bold tracking-tight text-white";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <main className="px-6 py-12 md:py-16">
        <div className="max-w-6xl mx-auto grid grid-cols-12 gap-10 lg:gap-14">
          <article className="col-span-12 lg:col-span-8 [&_h2]:scroll-mt-28 [&_h3]:scroll-mt-28">
            {/* Breadcrumb */}
            <nav className="text-xs text-white/40 mb-6" aria-label={lang === "fr" ? "Fil d'Ariane" : "Breadcrumb"}>
              <Link href="/blog" className="hover:text-white/70 transition">Blog</Link>
              <span className="mx-2 text-white/20">/</span>
              <span className="text-white/55">{c.breadcrumb}</span>
            </nav>

            {/* Header */}
            <header className="mb-10">
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">{c.h1}</h1>
              <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-wider text-white/40">
                <time dateTime={PUBLISHED_AT}>{dateLabel}</time>
                <span className="text-white/20">•</span>
                <span>{READING_MIN} {c.readLabel}</span>
                <span className="text-white/20">•</span>
                <span>{c.metaTag}</span>
              </div>
            </header>

            <div className="space-y-6 text-[15px] md:text-base leading-relaxed text-white/80">
              <p className="text-lg md:text-xl text-white/90 leading-relaxed">{c.standfirst}</p>

              {/* Proof image */}
              <figure className="my-8">
                <img
                  src={IMG_SRC}
                  alt={c.imgAlt}
                  width={804}
                  height={546}
                  loading="lazy"
                  className="w-full h-auto rounded-xl border border-white/10"
                />
                <figcaption className="mt-2 text-xs text-white/40 text-center">{c.imgCaption}</figcaption>
              </figure>

              {/* S1 */}
              <h2 id="definition" className={H2}>{sections[0].label}</h2>
              {c.s1.map((p, i) => <p key={i}>{p}</p>)}

              {/* S2 — three cards */}
              <h2 id="raisons" className={H2}>{sections[1].label}</h2>
              <p>{c.s2Intro}</p>
              <div className="grid gap-4 sm:grid-cols-3 not-prose">
                {c.cards.map((card) => (
                  <div key={card.n} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="text-xs font-mono font-semibold tracking-widest text-indigo-300/80">{card.n}</div>
                    <h3 className="mt-2 text-base font-bold text-white">{card.title}</h3>
                    <p className="mt-2 text-sm text-white/60 leading-relaxed">{card.body}</p>
                  </div>
                ))}
              </div>
              <Callout>{c.s2Callout}</Callout>

              {/* S3 */}
              <h2 id="spoofers" className={H2}>{sections[2].label}</h2>
              {c.s3.map((p, i) => <p key={i}>{p}</p>)}

              {/* S4 */}
              <h2 id="appel" className={H2}>{sections[3].label}</h2>
              {c.s4.map((p, i) => <p key={i}>{p}</p>)}

              {/* S5 */}
              <h2 id="solution" className={H2}>{sections[4].label}</h2>
              {c.s5.map((p, i) => <p key={i}>{p}</p>)}
              <p>{c.s5ListIntro}</p>
              <ul className="list-disc list-outside space-y-2 pl-6 marker:text-indigo-300/70">
                {c.s5List.map((li, i) => <li key={i}>{li}</li>)}
              </ul>
              <p>{c.s5After}</p>
              <Callout>{c.s5Callout}</Callout>

              {/* CTA block */}
              <div className="my-8 rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-indigo-500/[0.12] to-sky-500/[0.08] p-6 md:p-8">
                <h3 className="text-xl md:text-2xl font-bold tracking-tight text-white">{c.ctaTitle}</h3>
                <p className="mt-3 text-sm md:text-[15px] text-white/70 leading-relaxed">{c.ctaBody}</p>
                <NextLink
                  href={ctaHref}
                  className="btn-glow mt-5 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white"
                >
                  {c.ctaButton}
                </NextLink>
              </div>
            </div>

            {/* FAQ */}
            <section className="mt-16 pt-10 border-t border-white/[0.08]">
              <h2 id="faq" className="scroll-mt-28 text-2xl md:text-3xl font-bold tracking-tight text-white mb-6">
                {c.faqTitle}
              </h2>
              <div className="space-y-6">
                {faq.map((item, i) => (
                  <div key={i}>
                    <h3 className="text-base md:text-lg font-semibold text-white/95 mb-2">{item.q}</h3>
                    <p className="text-sm md:text-[15px] text-white/65 leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Back to index */}
            <div className="mt-12 pt-6 border-t border-white/[0.06]">
              <Link href="/blog" className="text-sm text-white/55 hover:text-white transition">{c.back}</Link>
            </div>
          </article>

          {/* Sticky TOC */}
          <aside className="hidden lg:block lg:col-span-4">
            <div className="sticky top-28">
              <ArticleTOC sections={sections} />
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-2 rounded-xl border border-indigo-400/30 bg-indigo-500/[0.07] p-4 text-[15px] leading-relaxed text-white/80">
      {children}
    </div>
  );
}

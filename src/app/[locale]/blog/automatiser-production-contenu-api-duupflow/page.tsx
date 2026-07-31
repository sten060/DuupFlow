// src/app/[locale]/blog/automatiser-production-contenu-api-duupflow/page.tsx
//
// Fully bilingual SEO article (FR + EN both indexed). Each locale is
// self-canonical and cross-linked via hreflang. Explains the full
// Drive → AI sort → DuupFlow → dispatch → planning automation built on the
// DuupFlow API, with a copy-paste Claude Code prompt.

import type { Metadata } from "next";
import Link from "@/components/LocaleLink";
import ArticleTOC, { type TocSection } from "../_components/ArticleTOC";
import YouTubeLazy from "../_components/YouTubeLazy";
import CopyBlock from "../_components/CopyBlock";

const SLUG = "automatiser-production-contenu-api-duupflow";
const PUBLISHED_AT = "2026-07-04";
const CANONICAL_FR = `/fr/blog/${SLUG}`;
const CANONICAL_EN = `/en/blog/${SLUG}`;

// ⬇️ REMPLACE par l'ID de ta vidéo YouTube (la partie après "watch?v=" ou
//    "youtu.be/"). Ex : pour https://youtu.be/OEj9wxKF_TA → "OEj9wxKF_TA".
const YOUTUBE_ID: string = "fgnqSi3s0F8";

const READING = { fr: 9, en: 9 } as const;

const SECTIONS = {
  fr: [
    { id: "pipeline", label: "Le pipeline en 5 étapes" },
    { id: "cle-api",  label: "La clé API : le moteur du pipeline" },
    { id: "etapes",   label: "Les 5 étapes en détail" },
    { id: "prompt",   label: "Le prompt à copier-coller" },
    { id: "demarrer", label: "Démarrer" },
    { id: "faq",      label: "Questions fréquentes" },
  ],
  en: [
    { id: "pipeline", label: "The 5-step pipeline" },
    { id: "cle-api",  label: "The API key: the engine" },
    { id: "etapes",   label: "The 5 steps in detail" },
    { id: "prompt",   label: "The copy-paste prompt" },
    { id: "demarrer", label: "Get started" },
    { id: "faq",      label: "FAQ" },
  ],
} satisfies Record<"fr" | "en", TocSection[]>;

const META = {
  fr: {
    title: "Automatiser sa production de contenu avec l'API DuupFlow",
    description:
      "Un pipeline qui tourne seul : Google Drive → tri IA → duplication DuupFlow → dispatch → planning. Le guide complet + un prompt Claude Code à copier-coller.",
  },
  en: {
    title: "Automate your content production with the DuupFlow API",
    description:
      "A pipeline that runs itself: Google Drive → AI sort → DuupFlow duplication → dispatch → planning. The full guide + a copy-paste Claude Code prompt.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isFr = locale === "fr";
  const m = isFr ? META.fr : META.en;
  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: isFr ? CANONICAL_FR : CANONICAL_EN,
      languages: { "fr-FR": CANONICAL_FR, "en": CANONICAL_EN, "x-default": CANONICAL_EN },
    },
    openGraph: {
      title: m.title,
      description: m.description,
      url: `https://www.duupflow.com${isFr ? CANONICAL_FR : CANONICAL_EN}`,
      type: "article",
      locale: isFr ? "fr_FR" : "en_US",
      publishedTime: PUBLISHED_AT,
    },
  };
}

/* ── The 5-step pipeline (mirrors the site's "Ce qu'on construit" section) ── */
const STEPS = {
  fr: [
    { n: "01", emoji: "📁", title: "Drive",    desc: "Détecte les nouveaux clips" },
    { n: "02", emoji: "🧠", title: "Tri IA",   desc: "Filtre & catégorise" },
    { n: "03", emoji: "∞",  title: "DuupFlow", desc: "1 clip → N variantes" },
    { n: "04", emoji: "🗂️", title: "Dispatch", desc: "Range par compte" },
    { n: "05", emoji: "✅", title: "Prêt",     desc: "Planning + log auto" },
  ],
  en: [
    { n: "01", emoji: "📁", title: "Drive",    desc: "Detects new clips" },
    { n: "02", emoji: "🧠", title: "AI sort",  desc: "Filter & categorize" },
    { n: "03", emoji: "∞",  title: "DuupFlow", desc: "1 clip → N variants" },
    { n: "04", emoji: "🗂️", title: "Dispatch", desc: "Sort by account" },
    { n: "05", emoji: "✅", title: "Ready",    desc: "Schedule + auto log" },
  ],
};

/* ── The copy-paste Claude Code prompt (the centrepiece) ── */
const CLAUDE_PROMPT = {
  fr: `Tu es mon ingénieur automatisation. Construis un pipeline qui tourne tout seul et republie mes contenus en plusieurs variantes uniques, à partir de mon Google Drive, en utilisant l'API DuupFlow.

CONTEXTE
- Je gère plusieurs comptes (réseaux sociaux / OFM). Chaque clip doit être publié en plusieurs variantes uniques (une par compte) pour ne pas être pénalisé pour "contenu non original".
- J'ai une clé API DuupFlow (plan Pro) : dflw_live_XXXXXXXXXXXX
- Base API : https://www.duupflow.com/api/v1
- Auth : header  Authorization: Bearer dflw_live_XXXXXXXXXXXX

LE PIPELINE (5 étapes), à lancer via un cron toutes les heures :

1) DRIVE — Détecter les nouveaux clips
   - Surveille un dossier Google Drive SOURCE (id : METS_ICI_L_ID_DU_DOSSIER).
   - Récupère les nouveaux fichiers vidéo (mp4/mov) pas encore traités.
   - Garde un état local (processed.json) des ids déjà faits pour ne jamais retraiter deux fois.

2) TRI IA — Filtrer & catégoriser
   - Pour chaque nouveau clip, déduis la catégorie / le compte cible (nom de fichier, tag, ou analyse rapide).
   - Ignore les fichiers trop courts, corrompus ou hors format.

3) DUUPFLOW — Dupliquer (1 clip → N variantes)
   - Pour chaque clip, lance la duplication (N = nombre de comptes) :
     POST /videos/duplicate  (multipart/form-data)
       file=@clip.mp4   count=N   packs=visual,motion,metadata_technical
     -> réponse 202 : { "job_id": "...", "status": "queued" }
   - Poll GET /jobs/{job_id} toutes les 5 s jusqu'à "status": "completed".
   - Télécharge chaque variante via result.files[].url (avec le header Authorization). Dispo 16 h.

4) DISPATCH — Ranger par compte
   - Réuploade chaque variante dans le sous-dossier Google Drive du compte correspondant (un dossier par compte).

5) PRÊT — Planning + log auto
   - Génère un planning de publication (CSV ou Google Sheet) : quelle variante, quel compte, quelle date/heure.
   - Écris un log par exécution (date, clip source, nb de variantes, comptes, statut).

CONTRAINTES
- Idempotent : relançable sans doublon grâce à processed.json.
- Robuste : retry sur les appels API, gestion des timeouts de job.
- Secrets dans un .env (clé API, ids de dossiers Drive) — jamais en dur.
- Ajoute le cron (crontab ou GitHub Actions) qui lance le script toutes les heures.

Stack : Node.js ou Python, au choix. Commence par me proposer l'arborescence des fichiers, puis code tout.`,
  en: `You are my automation engineer. Build a pipeline that runs entirely on its own and reposts my content as several unique variants, starting from my Google Drive, using the DuupFlow API.

CONTEXT
- I run several accounts (social media / OFM). Each clip must be published as several unique variants (one per account) so it isn't penalized for "unoriginal content".
- I have a DuupFlow API key (Pro plan): dflw_live_XXXXXXXXXXXX
- API base: https://www.duupflow.com/api/v1
- Auth: header  Authorization: Bearer dflw_live_XXXXXXXXXXXX

THE PIPELINE (5 steps), run via a cron every hour:

1) DRIVE — Detect new clips
   - Watch a SOURCE Google Drive folder (id: PUT_YOUR_FOLDER_ID_HERE).
   - Pick up new video files (mp4/mov) not yet processed.
   - Keep a local state (processed.json) of already-done ids so nothing is processed twice.

2) AI SORT — Filter & categorize
   - For each new clip, infer the category / target account (filename, tag, or a quick analysis).
   - Skip files that are too short, corrupted, or in the wrong format.

3) DUUPFLOW — Duplicate (1 clip → N variants)
   - For each clip, start a duplication (N = number of accounts):
     POST /videos/duplicate  (multipart/form-data)
       file=@clip.mp4   count=N   packs=visual,motion,metadata_technical
     -> 202 response: { "job_id": "...", "status": "queued" }
   - Poll GET /jobs/{job_id} every 5s until "status": "completed".
   - Download each variant from result.files[].url (with the Authorization header). Available for 16h.

4) DISPATCH — Sort by account
   - Re-upload each variant into the matching account's Google Drive subfolder (one folder per account).

5) READY — Schedule + auto log
   - Generate a publishing schedule (CSV or Google Sheet): which variant, which account, which date/time.
   - Write a log per run (date, source clip, number of variants, accounts, status).

CONSTRAINTS
- Idempotent: safe to re-run without duplicates thanks to processed.json.
- Robust: retry API calls, handle job timeouts.
- Secrets in a .env (API key, Drive folder ids) — never hardcoded.
- Add the cron (crontab or GitHub Actions) that runs the script every hour.

Stack: Node.js or Python, your call. Start by proposing the file structure, then code everything.`,
};

const FAQ = {
  fr: [
    { q: "Faut-il savoir coder pour mettre en place cette automatisation ?", a: "Non. Le principe : tu copies le prompt ci-dessous, tu le colles dans Claude Code, et il construit le pipeline pour toi. Tu n'as qu'à renseigner ta clé API DuupFlow et les identifiants de tes dossiers Google Drive." },
    { q: "Qu'est-ce que la clé API DuupFlow permet exactement ?", a: "Elle permet d'appeler DuupFlow depuis n'importe quel outil (Make, n8n, un script, Claude Code) pour dupliquer images et vidéos en variantes uniques, compresser, ou masquer la signature IA — sans passer par l'interface. Une seule clé débloque tous les endpoints. Elle est réservée au plan Pro." },
    { q: "Combien de variantes puis-je générer par vidéo ?", a: "Jusqu'à 10 variantes par appel sur l'endpoint vidéo. Tu choisis le nombre via le paramètre count, et les packs de transformation (visuel, mouvement, métadonnées, pixel magique) via le paramètre packs." },
    { q: "Le pipeline tourne-t-il vraiment tout seul ?", a: "Oui. Une fois construit, un cron le lance à l'intervalle de ton choix (par ex. toutes les heures). Il détecte les nouveaux clips sur le Drive, les duplique via l'API, range les variantes par compte et met à jour ton planning — sans intervention." },
    { q: "Où récupérer ma clé API ?", a: "Dans ton dashboard DuupFlow, onglet API (Développeurs). Génère une clé, copie-la (elle n'est affichée qu'une fois) et colle-la dans ton .env." },
  ],
  en: [
    { q: "Do I need to know how to code to set this up?", a: "No. The idea: you copy the prompt below, paste it into Claude Code, and it builds the pipeline for you. All you do is fill in your DuupFlow API key and your Google Drive folder ids." },
    { q: "What exactly does the DuupFlow API key let me do?", a: "It lets you call DuupFlow from any tool (Make, n8n, a script, Claude Code) to duplicate images and videos into unique variants, compress, or mask the AI signature — without using the interface. One key unlocks every endpoint. It's available on the Pro plan." },
    { q: "How many variants can I generate per video?", a: "Up to 10 variants per call on the video endpoint. You choose the number with the count parameter, and the transformation packs (visual, motion, metadata, magic pixel) with the packs parameter." },
    { q: "Does the pipeline really run on its own?", a: "Yes. Once built, a cron runs it at the interval you choose (e.g. every hour). It detects new clips on the Drive, duplicates them via the API, sorts the variants by account and updates your schedule — hands-off." },
    { q: "Where do I get my API key?", a: "In your DuupFlow dashboard, API (Developers) tab. Generate a key, copy it (it's shown only once) and paste it into your .env." },
  ],
};

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isFr = locale === "fr";
  const lang: "fr" | "en" = isFr ? "fr" : "en";

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ[lang].map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: META[lang].title,
    datePublished: PUBLISHED_AT,
    dateModified: PUBLISHED_AT,
    inLanguage: isFr ? "fr-FR" : "en-US",
    author: { "@type": "Organization", name: "DuupFlow" },
    publisher: { "@type": "Organization", name: "DuupFlow", logo: { "@type": "ImageObject", url: "https://www.duupflow.com/logo-mark.png" } },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://www.duupflow.com${isFr ? CANONICAL_FR : CANONICAL_EN}` },
  };

  const dateLabel = new Date(PUBLISHED_AT).toLocaleDateString(isFr ? "fr-FR" : "en-US", { day: "numeric", month: "long", year: "numeric" });
  const hasVideo = YOUTUBE_ID !== "REMPLACER_PAR_TON_ID";

  // Localised copy
  const c = isFr ? {
    crumb: "Automatiser avec l'API DuupFlow",
    h1: "Automatiser toute sa production de contenu avec l'API DuupFlow",
    tag: "API & automatisation", read: "min de lecture",
    lead: "Et si toute ta chaîne de production tournait sans que tu n'y touches ? Un dossier Google Drive où tu déposes tes clips bruts, une IA qui trie, DuupFlow qui génère les variantes uniques, et un dispatch automatique par compte avec un planning prêt à publier. C'est exactement ce que la clé API DuupFlow rend possible.",
    lead2Pre: "Dans ce guide, on décortique le pipeline complet montré dans la vidéo, et surtout : on te donne le ", lead2Strong: "prompt exact à copier-coller dans Claude Code", lead2Post: " pour qu'il te construise toute l'automatisation, même si tu ne codes pas.",
    videoCaption: "Démonstration complète du pipeline en vidéo.",
    videoPlaceholder: "La vidéo YouTube sera affichée ici (renseigne l'ID dans YOUTUBE_ID).",
    h2pipeline: "Le pipeline en 5 étapes",
    pipelineP: "L'idée : un flux linéaire qui part de tes contenus bruts et ressort des variantes uniques, rangées et planifiées. Claude Code le construit une fois — ensuite un cron le relance tout seul, tu ne touches plus à rien.",
    h2api: "La clé API : le moteur du pipeline",
    apiP1Pre: "Au cœur du flux, il y a la ", apiP1Link: "clé API DuupFlow", apiP1Post: ". Elle permet d'appeler DuupFlow depuis n'importe quel outil — Make, n8n, un script, ou Claude Code — sans passer par l'interface. Une seule clé débloque tous les endpoints : duplication d'images et de vidéos, compression, masquage de signature IA.",
    apiLi: ["<b>Base</b> : <code>https://www.duupflow.com/api/v1</code>", "<b>Authentification</b> : header <code>Authorization: Bearer dflw_live_…</code>", "<b>Vidéo (asynchrone)</b> : on lance un job de duplication, puis on interroge son statut jusqu'à récupérer les fichiers.", "<b>Réservé au plan Pro</b> — la clé se génère dans ton dashboard, onglet API."],
    h2steps: "Les 5 étapes en détail",
    steps: [
      ["1 · Drive — détecter les nouveaux clips", "Le script surveille un dossier Google Drive « source ». À chaque exécution, il repère les fichiers vidéo pas encore traités et laisse le reste tranquille (grâce à un état local, il ne retraite jamais deux fois le même clip)."],
      ["2 · Tri IA — filtrer & catégoriser", "Chaque clip est classé automatiquement : à quel compte / thème il appartient, combien de variantes en tirer. Les fichiers trop courts ou hors format sont écartés."],
      ["3 · DuupFlow — 1 clip → N variantes", "Le cœur du réacteur. Pour chaque clip, le script appelle l'API DuupFlow pour générer N variantes uniques, attend la fin du traitement, puis télécharge les fichiers. Chaque variante est perçue comme distincte — exactement ce qu'exigent les algorithmes."],
      ["4 · Dispatch — ranger par compte", "Les variantes sont réuploadées automatiquement dans le bon sous-dossier Google Drive : un dossier par compte, prêt à alimenter tes publications."],
      ["5 · Prêt — planning + log auto", "Enfin, le script génère un planning de publication (quelle variante, quel compte, quand) et un log de chaque exécution. Tu ouvres ton planning, tu publies — le reste est déjà fait."],
    ],
    h2prompt: "Le prompt à copier-coller dans Claude Code",
    promptPPre: "Voici le brief complet. Copie-le, colle-le dans ", promptLink: "Claude Code", promptPPost: ", remplace la clé API et les identifiants de dossiers Drive, et laisse-le construire le pipeline. Il te proposera l'architecture puis codera tout.",
    promptTip: "💡 Astuce : garde ta clé API secrète — colle-la uniquement dans ton fichier .env local, jamais dans un dépôt public.",
    h2start: "Démarrer",
    startPPre: "Il te faut deux choses : un ", startLink: "plan Pro", startPPost: " pour générer ta clé API, et cinq minutes pour lancer le prompt dans Claude Code. Une fois le pipeline en place, ta production tourne en autonomie.",
    cta: "Passer au Pro et récupérer ma clé API",
    faqTitle: "Questions fréquentes",
    back: "← Retour au blog",
  } : {
    crumb: "Automate with the DuupFlow API",
    h1: "Automate your entire content production with the DuupFlow API",
    tag: "API & automation", read: "min read",
    lead: "What if your whole production chain ran without you touching it? A Google Drive folder where you drop your raw clips, an AI that sorts them, DuupFlow generating the unique variants, and automatic per-account dispatch with a ready-to-publish schedule. That's exactly what the DuupFlow API key makes possible.",
    lead2Pre: "In this guide we break down the full pipeline shown in the video, and above all: we give you the ", lead2Strong: "exact prompt to copy-paste into Claude Code", lead2Post: " so it builds the whole automation for you — even if you don't code.",
    videoCaption: "Full pipeline demo on video.",
    videoPlaceholder: "The YouTube video will show here (set the ID in YOUTUBE_ID).",
    h2pipeline: "The 5-step pipeline",
    pipelineP: "The idea: a linear flow that starts from your raw content and outputs unique variants, sorted and scheduled. Claude Code builds it once — then a cron re-runs it on its own, and you never touch it again.",
    h2api: "The API key: the engine of the pipeline",
    apiP1Pre: "At the heart of the flow is the ", apiP1Link: "DuupFlow API key", apiP1Post: ". It lets you call DuupFlow from any tool — Make, n8n, a script, or Claude Code — without using the interface. One key unlocks every endpoint: image and video duplication, compression, AI-signature masking.",
    apiLi: ["<b>Base</b>: <code>https://www.duupflow.com/api/v1</code>", "<b>Authentication</b>: header <code>Authorization: Bearer dflw_live_…</code>", "<b>Video (async)</b>: you start a duplication job, then poll its status until the files are ready.", "<b>Pro plan only</b> — the key is generated in your dashboard, API tab."],
    h2steps: "The 5 steps in detail",
    steps: [
      ["1 · Drive — detect new clips", "The script watches a “source” Google Drive folder. On each run it picks up the video files not yet processed and leaves the rest alone (thanks to a local state, it never processes the same clip twice)."],
      ["2 · AI sort — filter & categorize", "Each clip is classified automatically: which account / theme it belongs to, how many variants to make. Files that are too short or in the wrong format are skipped."],
      ["3 · DuupFlow — 1 clip → N variants", "The core. For each clip, the script calls the DuupFlow API to generate N unique variants, waits for processing to finish, then downloads the files. Each variant is perceived as distinct — exactly what the algorithms require."],
      ["4 · Dispatch — sort by account", "The variants are re-uploaded automatically into the right Google Drive subfolder: one folder per account, ready to feed your posts."],
      ["5 · Ready — schedule + auto log", "Finally, the script generates a publishing schedule (which variant, which account, when) and a log of each run. You open your schedule, you publish — the rest is already done."],
    ],
    h2prompt: "The prompt to copy-paste into Claude Code",
    promptPPre: "Here's the full brief. Copy it, paste it into ", promptLink: "Claude Code", promptPPost: ", replace the API key and Drive folder ids, and let it build the pipeline. It will propose the architecture then code everything.",
    promptTip: "💡 Tip: keep your API key secret — paste it only into your local .env file, never into a public repository.",
    h2start: "Get started",
    startPPre: "You need two things: a ", startLink: "Pro plan", startPPost: " to generate your API key, and five minutes to run the prompt in Claude Code. Once the pipeline is in place, your production runs on autopilot.",
    cta: "Go Pro and get my API key",
    faqTitle: "Frequently asked questions",
    back: "← Back to blog",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <main className="px-6 py-12 md:py-16">
        <div className="max-w-6xl mx-auto grid grid-cols-12 gap-10 lg:gap-14">
          <article className="col-span-12 lg:col-span-8 [&_h2]:scroll-mt-28 [&_h3]:scroll-mt-28">
            <nav className="text-xs text-[#8a8a8a] mb-6" aria-label="Breadcrumb">
              <Link href="/blog" className="hover:text-[#3f4453] transition">Blog</Link>
              <span className="mx-2 text-[#8a8a8a]">/</span>
              <span className="text-[#3f4453]">{c.crumb}</span>
            </nav>

            <header className="mb-10">
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">{c.h1}</h1>
              <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-wider text-[#8a8a8a]">
                <time dateTime={PUBLISHED_AT}>{dateLabel}</time>
                <span className="text-[#8a8a8a]">•</span>
                <span>{READING[lang]} {c.read}</span>
                <span className="text-[#8a8a8a]">•</span>
                <span>{c.tag}</span>
              </div>
            </header>

            <div className="space-y-6 text-[15px] md:text-base leading-relaxed text-[#1a1a1a]">
              <p className="text-lg md:text-xl text-[#1a1a1a] leading-relaxed">{c.lead}</p>
              <p>{c.lead2Pre}<strong>{c.lead2Strong}</strong>{c.lead2Post}</p>

              {hasVideo ? (
                <div className="pt-2">
                  <YouTubeLazy videoId={YOUTUBE_ID} title={c.h1} />
                  <p className="mt-2 text-center text-xs text-[#8a8a8a] italic">{c.videoCaption}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/15 bg-[#f6f7f9] px-4 py-6 text-center text-sm text-[#8a8a8a]">🎬 {c.videoPlaceholder}</div>
              )}

              <h2 id="pipeline" className="pt-8 text-2xl md:text-3xl font-bold tracking-tight text-[#1a1a1a]">{c.h2pipeline}</h2>
              <p>{c.pipelineP}</p>

              <div className="not-prose grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
                {STEPS[lang].map((s) => (
                  <div key={s.n} className="rounded-xl p-4" style={{ background: "rgba(10,14,40,0.55)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="text-[11px] font-mono text-[#8a8a8a] mb-2">{s.n}</div>
                    <div className="text-xl mb-1.5">{s.emoji}</div>
                    <div className="text-sm font-semibold text-[#1a1a1a]">{s.title}</div>
                    <div className="text-xs text-[#8a8a8a] mt-0.5 leading-snug">{s.desc}</div>
                  </div>
                ))}
              </div>

              <h2 id="cle-api" className="pt-8 text-2xl md:text-3xl font-bold tracking-tight text-[#1a1a1a]">{c.h2api}</h2>
              <p>{c.apiP1Pre}<Link href="/dashboard/developers" className="text-[#4f7bff] hover:text-[#4f7bff] underline underline-offset-2">{c.apiP1Link}</Link>{c.apiP1Post}</p>
              <ul className="list-disc list-outside space-y-2 pl-6 marker:text-[#4f7bff]/70">
                {c.apiLi.map((li, i) => <li key={i} dangerouslySetInnerHTML={{ __html: li }} />)}
              </ul>

              <h2 id="etapes" className="pt-8 text-2xl md:text-3xl font-bold tracking-tight text-[#1a1a1a]">{c.h2steps}</h2>
              {c.steps.map(([h, p], i) => (
                <div key={i}>
                  <h3 className="pt-2 text-xl md:text-2xl font-semibold tracking-tight text-[#1a1a1a]">{h}</h3>
                  <p>{p}</p>
                </div>
              ))}

              <h2 id="prompt" className="pt-8 text-2xl md:text-3xl font-bold tracking-tight text-[#1a1a1a]">{c.h2prompt}</h2>
              <p>{c.promptPPre}<a href="https://claude.com/claude-code" target="_blank" rel="noopener noreferrer" className="text-[#4f7bff] hover:text-[#4f7bff] underline underline-offset-2">{c.promptLink}</a>{c.promptPPost}</p>
              <CopyBlock code={CLAUDE_PROMPT[lang]} />
              <p className="text-sm text-[#8a8a8a]">{c.promptTip}</p>

              <h2 id="demarrer" className="pt-8 text-2xl md:text-3xl font-bold tracking-tight text-[#1a1a1a]">{c.h2start}</h2>
              <p>{c.startPPre}<Link href="/pricing" className="text-[#4f7bff] hover:text-[#4f7bff] underline underline-offset-2">{c.startLink}</Link>{c.startPPost}</p>
              <div className="pt-4">
                <Link href="/pricing" className="btn-glow inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-[#1a1a1a]">
                  {c.cta}<span aria-hidden>→</span>
                </Link>
              </div>
            </div>

            <section className="mt-16 pt-10 border-t border-black/10">
              <h2 id="faq" className="scroll-mt-28 text-2xl md:text-3xl font-bold tracking-tight text-[#1a1a1a] mb-6">{c.faqTitle}</h2>
              <div className="space-y-6">
                {FAQ[lang].map((item, i) => (
                  <div key={i}>
                    <h3 className="text-base md:text-lg font-semibold text-[#1a1a1a] mb-2">{item.q}</h3>
                    <p className="text-sm md:text-[15px] text-[#3f4453] leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-12 pt-6 border-t border-black/10">
              <Link href="/blog" className="text-sm text-[#3f4453] hover:text-[#1a1a1a] transition">{c.back}</Link>
            </div>
          </article>

          <aside className="hidden lg:block lg:col-span-4">
            <div className="sticky top-28">
              <ArticleTOC sections={SECTIONS[lang]} />
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

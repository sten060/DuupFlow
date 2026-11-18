// Contenu du centre d'aide public (/docs/<slug>) — V1 texte, FR + EN.
//
// ⚠️ Chaque chiffre vient du code (relevé 11/2026) : à tenir à jour avec
//   src/lib/plans.ts (quotas, espaces, membres), processVideos.ts (120 s,
//   formats), material-ingest.ts (Éditeur IA), tokens.ts (Scraper, Variation),
//   compress-limits.ts, SimilarityClient.tsx (seuils du score).
// Ne rien promettre que le produit ne fait pas : pas de maximum de copies
// inventé ; rétention = ~1 h (sauf Duplication IA : 5 jours, history.ts).
// Tokens : 1 € = 10 000 tokens (tokens.ts, TOKENS_PER_CENT) — les montants du
// code sont en centimes, à multiplier par 100 pour l'affichage.
//
// UNE SEULE SOURCE pour le site ET le dashboard : la page publique /docs/<slug>
// et le panneau « ? » du dashboard (PageHelp.tsx, choisi par `app`) lisent ces
// mêmes textes. Le panneau montre le résumé, le premier bloc d'étapes et les
// encadrés : garde-les autonomes. Les 6 pages ajoutées en 11/2026 vivent dans
// helpCenterExtra.ts. Visuels : bloc { type: "visual", id } (HelpVisuals.tsx),
// seulement quand un schéma explique mieux qu'une phrase.
//
// Texte : **gras** et `code` sont rendus par <Rich> (ApiDocsPage.tsx).

import type { Block, Lang } from "./apiDocsContent";
import { EXTRA_DOCS } from "./helpCenterExtra";

export type HelpSection = { id: string; title: string; blocks: Block[] };
export type HelpCategory = "start" | "duplicate" | "create" | "analyze" | "connect" | "account";
export type HelpDoc = {
  slug: string;
  category: HelpCategory;
  /** Pages du dashboard où le bouton « ? » ouvre cette aide (préfixes). */
  app?: string[];
  badge?: "beta";
  /** Pages à proposer à la suite (slugs). */
  related?: string[];
  title: Record<Lang, string>;
  summary: Record<Lang, string>;
  sections: Record<Lang, HelpSection[]>;
  faq: Record<Lang, { q: string; a: string }[]>;
};

export const HELP_CATEGORIES: { id: HelpCategory; emoji: string; title: Record<Lang, string>; lead: Record<Lang, string> }[] = [
  { id: "start", emoji: "🚀", title: { fr: "Bien démarrer", en: "Getting started" }, lead: { fr: "Les bases, les plans et ta première duplication.", en: "The basics, the plans and your first duplication." } },
  { id: "duplicate", emoji: "🔁", title: { fr: "Dupliquer", en: "Duplicate" }, lead: { fr: "Transformer un contenu en copies uniques, prêtes à poster.", en: "Turn one piece of content into unique copies, ready to post." } },
  { id: "create", emoji: "✨", title: { fr: "Créer avec l'IA", en: "Create with AI" }, lead: { fr: "Monter des vidéos et générer des images avec l'IA.", en: "Edit videos and generate images with AI." } },
  { id: "analyze", emoji: "🔍", title: { fr: "Analyser et optimiser", en: "Analyze and optimize" }, lead: { fr: "Trouver ce qui marche, vérifier tes copies, alléger tes fichiers.", en: "Find what works, check your copies, lighten your files." } },
  { id: "connect", emoji: "🔌", title: { fr: "Connecter et travailler en équipe", en: "Connect and work as a team" }, lead: { fr: "Google Drive, espaces créatrices, rôles et API.", en: "Google Drive, creator workspaces, roles and API." } },
  { id: "account", emoji: "🛟", title: { fr: "Compte et dépannage", en: "Account and troubleshooting" }, lead: { fr: "Abonnement, tokens, et quoi faire quand ça bloque.", en: "Subscription, tokens, and what to do when something's stuck." } },
];

export const HELP_UI: Record<Lang, {
  label: string; title: string; metaTitle: string; lead: string; toc: string; faq: string; more: string; read: string; apiSummary: string;
  beta: string; related: string; search: string; noResult: string;
  /** Définition de DuupFlow : en tête du centre d'aide, en pied de chaque page
   *  et dans les données structurées — c'est ce que lisent les IA (LLM) pour
   *  comprendre le produit. À garder factuel et à jour. */
  aboutTitle: string; about: string; aboutShort: string;
}> = {
  fr: {
    label: "Centre d'aide",
    title: "Centre d'aide DuupFlow",
    metaTitle: "Centre d'aide — DuupFlow",
    lead: "Comment fonctionne chaque fonctionnalité de DuupFlow : étapes, limites, formats et plans concernés.",
    toc: "Sur cette page",
    faq: "Questions fréquentes",
    more: "Autres pages du centre d'aide",
    read: "Lire",
    apiSummary: "Automatise la duplication, la compression et le masquage IA depuis tes outils (Make, n8n, code).",
    beta: "Beta",
    related: "À lire ensuite",
    search: "Rechercher dans l'aide…",
    noResult: "Aucune page ne correspond.",
    aboutTitle: "Qu'est-ce que DuupFlow ?",
    about: "DuupFlow est une application web pour les créateurs de contenu et les agences qui publient le même contenu sur plusieurs comptes (Instagram, TikTok, YouTube Shorts…). Son cœur : transformer une vidéo ou une image en **copies uniques**, identiques à l'œil mais vues comme des fichiers neufs par les plateformes, pour éviter d'être signalé comme « contenu non original ». Autour : la **Duplication IA** qui fabrique des copies toutes différentes, des **captions et sous-titres** automatiques, un **Éditeur IA** qui monte tes rushes avec Claude, un **Scraper** qui trouve les vidéos qui marchent sur un compte, un **Comparateur**, un **Compresseur**, la **Variation IA** d'images, et des outils d'équipe (espaces par créatrice, rôles Manager et VA, Google Drive, API).",
    aboutShort: "DuupFlow est une application web qui transforme une vidéo ou une image en copies uniques pour publier sur plusieurs comptes Instagram et TikTok, avec des outils IA de montage, de captions et d'analyse.",
  },
  en: {
    label: "Help Center",
    title: "DuupFlow Help Center",
    metaTitle: "Help Center — DuupFlow",
    lead: "How every DuupFlow feature works: steps, limits, formats and which plans include it.",
    toc: "On this page",
    faq: "FAQ",
    more: "More help center pages",
    read: "Read",
    apiSummary: "Automate duplication, compression and AI masking from your own tools (Make, n8n, code).",
    beta: "Beta",
    related: "Read next",
    search: "Search the help center…",
    noResult: "No page matches.",
    aboutTitle: "What is DuupFlow?",
    about: "DuupFlow is a web app for content creators and agencies who post the same content on several accounts (Instagram, TikTok, YouTube Shorts…). At its core, it turns one video or image into **unique copies** that look identical but are seen as brand-new files by platforms, so they aren't flagged as “unoriginal content”. Around it: **AI duplication** that builds copies that all look different, automatic **captions and subtitles**, an **AI Editor** that edits your footage with Claude, a **Scraper** that finds an account's best videos, a **Comparator**, a **Compressor**, image **AI Variation**, and team tools (one workspace per creator, Manager and VA roles, Google Drive, API).",
    aboutShort: "DuupFlow is a web app that turns one video or image into unique copies to post on several Instagram and TikTok accounts, with AI tools for editing, captions and analysis.",
  },
};

/* Rappel commun sur les fichiers générés (supprimés ~1 h après). */
const KEEP_FR = "Les fichiers générés sont **temporaires** : télécharge-les ou envoie-les vers Google Drive rapidement, ils sont supprimés automatiquement au bout d'environ une heure.";
const KEEP_EN = "Generated files are **temporary**: download them or send them to Google Drive quickly, they are deleted automatically after about an hour.";

const CORE_DOCS: HelpDoc[] = [
  /* ─────────────── Duplication vidéo ─────────────── */
  {
    slug: "duplication-video",
    category: "duplicate", app: ["/dashboard/videos/simple", "/dashboard/videos/advanced", "/dashboard/videos"], related: ["textes-video", "duplication-ia", "comparateur"],
    title: { fr: "Duplication vidéo", en: "Video duplication" },
    summary: {
      fr: "Transforme une vidéo en plusieurs copies uniques, chacune vue comme un fichier neuf par les plateformes, sans différence visible.",
      en: "Turn one video into several unique copies, each seen as a brand-new file by platforms, with no visible difference.",
    },
    sections: {
      fr: [
        { id: "principe", title: "Ce que ça fait", blocks: [
          { type: "p", text: "Le duplicateur prend une vidéo déjà montée et en sort autant de **copies uniques** que tu veux. Chaque copie a ses propres métadonnées, de légères variations visuelles invisibles à l'œil et une empreinte de fichier différente. Ton montage, ton audio et ta qualité restent identiques." },
          { type: "visual", id: "dup-fingerprint", caption: "Même image, même son : seules l'identité et l'empreinte du fichier changent d'une copie à l'autre." },
          { type: "p", text: "Deux modes : **Simple** (packs prêts à l'emploi, recommandé) et **Avancé** (chaque réglage à la main). Pour laisser l'IA tout régler, vois la **Duplication IA en 1 clic**." },
        ] },
        { id: "simple", title: "Utiliser le mode Simple", blocks: [
          { type: "steps", items: [
            "Ouvre **Duplication → Vidéos**, puis choisis le mode **Simple**.",
            "Dépose tes vidéos ou clique sur **Importer depuis Google Drive**.",
            "Choisis le **nombre de copies** par vidéo.",
            "Choisis une intensité : **Léger**, **Équilibré** (recommandé) ou **Fort**. Tu peux aussi activer les packs un par un.",
            "Règle les options si besoin (voir plus bas), puis clique sur **Dupliquer**.",
            "Télécharge tes copies (ZIP), envoie-les vers Google Drive ou vers l'Éditeur IA.",
          ] },
          { type: "table", head: ["Pack", "Ce qu'il modifie"], rows: [
            ["Métadonnées", "Appareil, date, encodeur, informations du fichier"],
            ["Métadonnées techniques", "Paramètres d'encodage du fichier"],
            ["Pixel magique", "Une couche de bruit invisible sur l'image"],
            ["Audio", "Micro-variations audio inaudibles"],
            ["Mouvement", "Léger mouvement de l'image (doux ou fort)"],
            ["Mouvement avancé", "Mouvement plus marqué (doux ou fort)"],
            ["Visuels", "Luminosité, teinte, contraste sous le seuil de perception"],
          ] },
          { type: "callout", tone: "info", text: "**Équilibré** = Léger + Visuels + un watermark aléatoire très discret. **Fort** active les 7 packs avec un mouvement plus marqué." },
        ] },
        { id: "avance", title: "Le mode Avancé", blocks: [
          { type: "p", text: "Dans **Duplication → Vidéos → Avancé**, chaque réglage a une plage min / max (couleurs, mouvement, recadrage, vitesse, audio, encodage…) et le watermark est entièrement configurable (formes, logo, opacité, taille). Des modèles **TikTok SOFT** et **TikTok HARD** sont fournis, et tu peux enregistrer les tiens." },
        ] },
        { id: "options", title: "Options", blocks: [
          { type: "list", items: [
            "**Priorité d'algorithme** : ajoute des métadonnées réalistes d'iPhone (modèle différent sur chaque copie). La copie sort en `.mov`.",
            "**Pays** : renseigne une localisation cohérente (ville et GPS) dans les métadonnées.",
            "**Retirer la détection IA** : masque la signature laissée par les outils de génération. Voir la page dédiée.",
            "**Watermark**, **miroir**, **retournement**, **tremblement** : effets supplémentaires facultatifs.",
            "**Captions** et **Sous-titres** (mode Simple, beta) : un texte fixe et/ou la voix écrite à l'écran, réglables à la souris dans l'aperçu. Voir la page dédiée.",
          ] },
          { type: "callout", tone: "info", text: "**Captions et sous-titres** (beta) : sous les options du mode Simple, ajoute un texte fixe et/ou la voix écrite à l'écran (karaoké, mot par mot…). Place-les à la souris dans l'aperçu et fais-les varier sur chaque copie." },
          { type: "callout", tone: "info", text: "**Templates** : en bas du mode Simple, enregistre tous tes réglages sous un nom (« TikTok karaoké jaune ») et réapplique-les en un clic, sur tous tes appareils. Le mode Avancé a les siens." },
        ] },
        { id: "limites", title: "Limites et formats", blocks: [
          { type: "table", head: ["", "Limite"], rows: [
            ["Formats", "MP4, MOV, MKV, AVI, WEBM"],
            ["Durée max par vidéo", "120 secondes (les vidéos plus longues sont ignorées)"],
            ["Poids max par fichier", "5 Go"],
            ["Vidéos par lot", "40"],
            ["Copies", "Autant que ton quota mensuel le permet"],
          ] },
          { type: "p", text: "Le quota consommé = nombre de vidéos × nombre de copies. Quotas mensuels : **Solo 300 vidéos**, **Pro et Agence illimités**." },
          { type: "callout", tone: "warn", text: KEEP_FR },
        ] },
      ],
      en: [
        { id: "principe", title: "What it does", blocks: [
          { type: "p", text: "The duplicator takes an already-edited video and outputs as many **unique copies** as you want. Each copy has its own metadata, slight visual variations invisible to the eye and a different file fingerprint. Your edit, audio and quality stay identical." },
          { type: "visual", id: "dup-fingerprint", caption: "Same picture, same sound: only the file's identity and fingerprint change from one copy to the next." },
          { type: "p", text: "Two modes: **Simple** (ready-made packs, recommended) and **Advanced** (every setting by hand). To let the AI handle everything, see **1-click AI duplication**." },
        ] },
        { id: "simple", title: "Using Simple mode", blocks: [
          { type: "steps", items: [
            "Open **Duplication → Videos**, then pick **Simple** mode.",
            "Drop your videos or click **Import from Google Drive**.",
            "Pick the **number of copies** per video.",
            "Pick an intensity: **Light**, **Balanced** (recommended) or **Strong**. You can also toggle packs one by one.",
            "Set options if needed (see below), then click **Duplicate**.",
            "Download your copies (ZIP), send them to Google Drive or to the AI Editor.",
          ] },
          { type: "table", head: ["Pack", "What it changes"], rows: [
            ["Metadata", "Device, date, encoder, file information"],
            ["Technical metadata", "The file's encoding parameters"],
            ["Magic pixel", "An invisible noise layer on the image"],
            ["Audio", "Inaudible audio micro-variations"],
            ["Motion", "Slight image movement (soft or strong)"],
            ["Advanced motion", "Stronger movement (soft or strong)"],
            ["Visuals", "Brightness, hue, contrast below the perception threshold"],
          ] },
          { type: "callout", tone: "info", text: "**Balanced** = Light + Visuals + a very discreet random watermark. **Strong** turns on all 7 packs with stronger motion." },
        ] },
        { id: "avance", title: "Advanced mode", blocks: [
          { type: "p", text: "In **Duplication → Videos → Advanced**, every setting has a min / max range (colours, motion, crop, speed, audio, encoding…) and the watermark is fully configurable (shapes, logo, opacity, size). **TikTok SOFT** and **TikTok HARD** templates are included, and you can save your own." },
        ] },
        { id: "options", title: "Options", blocks: [
          { type: "list", items: [
            "**Algorithm priority**: adds realistic iPhone metadata (a different model on each copy). The copy comes out as `.mov`.",
            "**Country**: sets a consistent location (city and GPS) in the metadata.",
            "**Remove AI detection**: masks the signature left by generation tools. See the dedicated page.",
            "**Watermark**, **mirror**, **flip**, **shake**: optional extra effects.",
            "**Captions** and **Subtitles** (Simple mode, beta): a fixed text and/or the voice written on screen, adjusted with the mouse in the preview. See the dedicated page.",
          ] },
          { type: "callout", tone: "info", text: "**Captions and subtitles** (beta): below the Simple mode options, add a fixed text and/or the voice written on screen (karaoke, word by word…). Place them with the mouse in the preview and make them vary on each copy." },
          { type: "callout", tone: "info", text: "**Templates**: at the bottom of Simple mode, save all your settings under a name (“TikTok yellow karaoke”) and reapply them in one click, on all your devices. Advanced mode has its own." },
        ] },
        { id: "limites", title: "Limits and formats", blocks: [
          { type: "table", head: ["", "Limit"], rows: [
            ["Formats", "MP4, MOV, MKV, AVI, WEBM"],
            ["Max length per video", "120 seconds (longer videos are skipped)"],
            ["Max size per file", "5 GB"],
            ["Videos per batch", "40"],
            ["Copies", "As many as your monthly quota allows"],
          ] },
          { type: "p", text: "Quota used = number of videos × number of copies. Monthly quotas: **Solo 300 videos**, **Pro and Agency unlimited**." },
          { type: "callout", tone: "warn", text: KEEP_EN },
        ] },
      ],
    },
    faq: {
      fr: [
        { q: "Ma vidéo fait plus de 2 minutes, comment faire ?", a: "Le duplicateur accepte 120 secondes maximum par vidéo. Coupe-la en plusieurs parties avant de la dupliquer." },
        { q: "La qualité baisse-t-elle ?", a: "Non. La résolution et le bitrate d'origine sont conservés, jusqu'en 4K, et une copie n'est jamais plus lourde que l'original." },
        { q: "Quel mode choisir ?", a: "Le mode **Simple** en **Équilibré** couvre la grande majorité des cas. Le mode **Avancé** sert si tu veux contrôler chaque réglage." },
        { q: "Combien de copies puis-je faire ?", a: "Autant que ton quota le permet : 300 vidéos par mois avec Solo, illimité avec Pro et Agence. 10 vidéos × 5 copies = 50 vidéos de quota." },
      ],
      en: [
        { q: "My video is longer than 2 minutes, what can I do?", a: "The duplicator accepts up to 120 seconds per video. Split it into several parts before duplicating." },
        { q: "Does quality drop?", a: "No. The original resolution and bitrate are kept, up to 4K, and a copy is never heavier than the original." },
        { q: "Which mode should I pick?", a: "**Simple** mode on **Balanced** covers the vast majority of cases. **Advanced** mode is for controlling every setting." },
        { q: "How many copies can I make?", a: "As many as your quota allows: 300 videos a month on Solo, unlimited on Pro and Agency. 10 videos × 5 copies = 50 videos of quota." },
      ],
    },
  },

  /* ─────────────── Duplication image ─────────────── */
  {
    slug: "duplication-image",
    category: "duplicate", app: ["/dashboard/images"], related: ["retirer-detection-ia", "comparateur"],
    title: { fr: "Duplication d'image", en: "Image duplication" },
    summary: {
      fr: "Crée plusieurs copies uniques d'une même photo, prêtes à poster sur plusieurs comptes.",
      en: "Create several unique copies of the same photo, ready to post across several accounts.",
    },
    sections: {
      fr: [
        { id: "utiliser", title: "Comment l'utiliser", blocks: [
          { type: "steps", items: [
            "Ouvre **Duplication → Images**.",
            "Dépose tes photos ou importe-les depuis Google Drive.",
            "Choisis le **nombre de copies** par image et les options.",
            "Lance la duplication, puis télécharge le ZIP ou envoie les copies vers Drive.",
          ] },
        ] },
        { id: "options", title: "Options", blocks: [
          { type: "list", items: [
            "**Sans modification visuelle** : **Filtres fondamentaux** (activés par défaut : taille, qualité, couleurs, profil et métadonnées du fichier) et **Reverse** (miroir horizontal, facultatif).",
            "**Avec modification visuelle** : **Semi-visuels** (activés par défaut : micro-recadrage et léger redimensionnement, presque imperceptibles) et **Filtres visuels** (luminosité, saturation, contraste, teinte, facultatifs).",
            "**Priorité d'algorithme** : métadonnées EXIF réalistes d'iPhone.",
            "**Pays** : localisation cohérente dans les métadonnées.",
            "**Retirer la détection IA** : pour les images générées par IA.",
          ] },
        ] },
        { id: "limites", title: "Limites et formats", blocks: [
          { type: "table", head: ["", "Limite"], rows: [
            ["Formats acceptés", "JPG, PNG, WEBP, HEIC"],
            ["Format de sortie", "JPEG (WEBP si l'original est en WEBP)"],
            ["Images par lot", "50"],
            ["Quota mensuel", "Solo 400 images · Pro et Agence illimités"],
          ] },
          { type: "p", text: "Les photos HEIC sont converties automatiquement. Un PNG transparent ressort sur fond blanc." },
          { type: "callout", tone: "warn", text: KEEP_FR },
        ] },
      ],
      en: [
        { id: "utiliser", title: "How to use it", blocks: [
          { type: "steps", items: [
            "Open **Duplication → Images**.",
            "Drop your photos or import them from Google Drive.",
            "Pick the **number of copies** per image and the options.",
            "Run the duplication, then download the ZIP or send the copies to Drive.",
          ] },
        ] },
        { id: "options", title: "Options", blocks: [
          { type: "list", items: [
            "**No visual change**: **Fundamental filters** (on by default: size, quality, colours, profile and file metadata) and **Reverse** (horizontal mirror, optional).",
            "**With visual change**: **Semi-visual** (on by default: micro-crop and slight resize, barely noticeable) and **Visual filters** (brightness, saturation, contrast, hue, optional).",
            "**Algorithm priority**: realistic iPhone EXIF metadata.",
            "**Country**: a consistent location in the metadata.",
            "**Remove AI detection**: for AI-generated images.",
          ] },
        ] },
        { id: "limites", title: "Limits and formats", blocks: [
          { type: "table", head: ["", "Limit"], rows: [
            ["Accepted formats", "JPG, PNG, WEBP, HEIC"],
            ["Output format", "JPEG (WEBP if the original is WEBP)"],
            ["Images per batch", "50"],
            ["Monthly quota", "Solo 400 images · Pro and Agency unlimited"],
          ] },
          { type: "p", text: "HEIC photos are converted automatically. A transparent PNG comes out on a white background." },
          { type: "callout", tone: "warn", text: KEEP_EN },
        ] },
      ],
    },
    faq: {
      fr: [
        { q: "Mes photos iPhone (HEIC) sont-elles acceptées ?", a: "Oui, elles sont converties automatiquement en JPEG." },
        { q: "La copie se voit-elle à l'œil ?", a: "À peine. Par défaut, seul un micro-recadrage presque imperceptible s'ajoute (Semi-visuels). Le **Reverse** (miroir) et les **Filtres visuels**, facultatifs, rendent la différence visible." },
      ],
      en: [
        { q: "Are iPhone photos (HEIC) supported?", a: "Yes, they're converted to JPEG automatically." },
        { q: "Can you see the difference on a copy?", a: "Barely. By default, only a near-invisible micro-crop is added (Semi-visual). **Reverse** (mirror) and **Visual filters**, which are optional, make the difference visible." },
      ],
    },
  },

  /* ─────────────── Éditeur IA ─────────────── */
  {
    slug: "editeur-ia",
    category: "create", app: ["/dashboard/ai-editor"], related: ["claude-integre", "createurs-et-roles"],
    title: { fr: "Éditeur IA", en: "AI Editor" },
    summary: {
      fr: "Un agent de montage piloté par Claude : tu donnes une vidéo de référence et tes rushes, Claude monte la vidéo et la décline en variantes.",
      en: "An editing agent driven by Claude: you provide a reference video and your footage, Claude edits the video and spins it into variants.",
    },
    sections: {
      fr: [
        { id: "principe", title: "Comment ça marche", blocks: [
          { type: "p", text: "L'Éditeur IA se pilote avec Claude, de deux façons : **Claude intégré**, directement dans la page (rien à installer, fonctionne aux tokens), ou **ton propre Claude** (claude.ai, Claude Desktop ou mobile, même en plan gratuit) grâce à un connecteur. Tu décris le montage voulu, Claude assemble la vidéo avec ta matière, puis en sort des **variantes** visuellement différentes. Les vidéos apparaissent en direct dans DuupFlow." },
          { type: "visual", id: "editor-flow" },
          { type: "callout", tone: "info", text: "Tu utilises Claude intégré ? Passe l'étape 1 : tout se fait dans la page. Voir **Claude intégré**." },
        ] },
        { id: "connecter", title: "1. Connecter Claude (une seule fois)", blocks: [
          { type: "steps", items: [
            "Dans **Éditeur IA**, copie l'adresse du connecteur.",
            "Dans Claude : **Réglages → Connecteurs → Ajouter un connecteur personnalisé**, puis colle l'adresse.",
            "Clique sur **Connecter**, puis **Autoriser** sur l'écran DuupFlow. C'est branché définitivement.",
          ] },
        ] },
        { id: "reference", title: "2. Ajouter une référence (facultatif)", blocks: [
          { type: "p", text: "La référence est la vidéo dont tu veux reprendre le style : la tienne qui a marché, ou celle d'un concurrent. L'IA en analyse la **structure** (hook, rythme, coupes, sous-titres), jamais le contenu." },
          { type: "list", items: [
            "Un fichier MP4 ou MOV, ou un lien TikTok, Instagram ou YouTube.",
            "Maximum **300 Mo** et **2 minutes**.",
            "Tu peux passer cette étape et décrire le style à Claude par écrit.",
          ] },
        ] },
        { id: "matiere", title: "3. Ajouter ta matière", blocks: [
          { type: "p", text: "Ta matière = tes rushes, images et sons. Ajoute une courte **description** à chaque fichier (ex. « plan du produit de face ») : c'est ce qui aide Claude à bien placer chaque élément." },
          { type: "table", head: ["", "Limite"], rows: [
            ["Vidéo", "MP4, MOV, M4V, MKV, WEBM · 2 min max"],
            ["Image", "JPG, PNG, WEBP, HEIC"],
            ["Audio", "MP3, M4A, WAV, AAC, OGG, FLAC · 4 min max"],
            ["Poids max", "300 Mo par fichier"],
          ] },
          { type: "p", text: "Tu peux aussi importer depuis Google Drive, ou envoyer directement des copies du duplicateur vers l'éditeur." },
        ] },
        { id: "monter", title: "4. Demander le montage à Claude", blocks: [
          { type: "p", text: "Dans ta conversation Claude, décris ce que tu veux. Le bouton **Copier le prompt** de l'éditeur te donne un point de départ. Exemples :" },
          { type: "list", items: [
            "« Reproduis ma référence avec mes rushes, hook en texte blanc sur les 2 premières secondes. »",
            "« Fais 3 variantes avec des hooks et des styles de sous-titres différents. »",
            "« Raccourcis le hook et remonte les sous-titres. »",
          ] },
          { type: "p", text: "Chaque variante apparaît dans DuupFlow dès qu'elle est prête. Tu la télécharges, l'envoies vers Drive, ou la fais passer dans le duplicateur." },
        ] },
        { id: "retouche", title: "Retoucher une variante à la main", blocks: [
          { type: "p", text: "Sur une variante, clique sur **Ouvrir l'éditeur** : tu modifies toi-même les textes, leurs couleurs et l'ordre des plans, avec un aperçu en direct, puis **Exporter la vidéo** crée une nouvelle variante." },
          { type: "callout", tone: "info", text: "La retouche et son export sont **gratuits** : seule la variante d'origine a compté dans ton quota." },
        ] },
        { id: "brief", title: "Le brief par créatrice", blocks: [
          { type: "p", text: "Avec les espaces créatrices (plans Pro et Agence), chaque créatrice a un **brief** (jusqu'à 4 000 caractères) : style de captions, ton, hooks qui marchent, choses à éviter. Claude le lit automatiquement au début de chaque conversation, et l'applique à chaque variante." },
        ] },
        { id: "quota", title: "Quota et conservation", blocks: [
          { type: "p", text: "Chaque variante créée compte pour **1 vidéo** dans ton quota mensuel (Solo 300, Pro et Agence illimités). L'éditeur est inclus dans tous les plans payants." },
          { type: "callout", tone: "warn", text: "Les variantes sont **temporaires** : télécharge celles que tu veux garder ou envoie-les vers Drive, les autres sont supprimées automatiquement." },
        ] },
      ],
      en: [
        { id: "principe", title: "How it works", blocks: [
          { type: "p", text: "The AI Editor is driven by Claude, in two ways: **built-in Claude**, right in the page (nothing to install, runs on tokens), or **your own Claude** (claude.ai, Claude Desktop or mobile, even on the free plan) through a connector. You describe the edit you want, Claude assembles the video with your material, then outputs visually different **variants**. The videos show up live in DuupFlow." },
          { type: "visual", id: "editor-flow" },
          { type: "callout", tone: "info", text: "Using built-in Claude? Skip step 1: everything happens in the page. See **Built-in Claude**." },
        ] },
        { id: "connecter", title: "1. Connect Claude (once)", blocks: [
          { type: "steps", items: [
            "In **AI Editor**, copy the connector address.",
            "In Claude: **Settings → Connectors → Add custom connector**, then paste the address.",
            "Click **Connect**, then **Authorize** on the DuupFlow screen. It stays connected.",
          ] },
        ] },
        { id: "reference", title: "2. Add a reference (optional)", blocks: [
          { type: "p", text: "The reference is the video whose style you want to reuse: your own that performed, or a competitor's. The AI analyses its **structure** (hook, pacing, cuts, subtitles), never its content." },
          { type: "list", items: [
            "An MP4 or MOV file, or a TikTok, Instagram or YouTube link.",
            "Up to **300 MB** and **2 minutes**.",
            "You can skip this step and describe the style to Claude in writing.",
          ] },
        ] },
        { id: "matiere", title: "3. Add your material", blocks: [
          { type: "p", text: "Your material = your footage, images and sounds. Add a short **description** to each file (e.g. “product shot, front view”): it helps Claude place each element correctly." },
          { type: "table", head: ["", "Limit"], rows: [
            ["Video", "MP4, MOV, M4V, MKV, WEBM · 2 min max"],
            ["Image", "JPG, PNG, WEBP, HEIC"],
            ["Audio", "MP3, M4A, WAV, AAC, OGG, FLAC · 4 min max"],
            ["Max size", "300 MB per file"],
          ] },
          { type: "p", text: "You can also import from Google Drive, or send copies straight from the duplicator to the editor." },
        ] },
        { id: "monter", title: "4. Ask Claude for the edit", blocks: [
          { type: "p", text: "In your Claude conversation, describe what you want. The editor's **Copy the prompt** button gives you a starting point. Examples:" },
          { type: "list", items: [
            "“Recreate my reference with my footage, white text hook over the first 2 seconds.”",
            "“Make 3 variants with different hooks and subtitle styles.”",
            "“Shorten the hook and move the subtitles up.”",
          ] },
          { type: "p", text: "Each variant appears in DuupFlow as soon as it's ready. Download it, send it to Drive, or run it through the duplicator." },
        ] },
        { id: "retouche", title: "Retouching a variant by hand", blocks: [
          { type: "p", text: "On a variant, click **Open the editor**: change the texts, their colours and the order of the shots yourself, with a live preview, then **Export the video** creates a new variant." },
          { type: "callout", tone: "info", text: "Retouching and exporting are **free**: only the original variant counted against your quota." },
        ] },
        { id: "brief", title: "The creator brief", blocks: [
          { type: "p", text: "With creator workspaces (Pro and Agency plans), each creator has a **brief** (up to 4,000 characters): caption style, tone, hooks that work, things to avoid. Claude reads it automatically at the start of each conversation and applies it to every variant." },
        ] },
        { id: "quota", title: "Quota and retention", blocks: [
          { type: "p", text: "Each variant created counts as **1 video** in your monthly quota (Solo 300, Pro and Agency unlimited). The editor is included in every paid plan." },
          { type: "callout", tone: "warn", text: "Variants are **temporary**: download the ones you want to keep or send them to Drive, the rest are deleted automatically." },
        ] },
      ],
    },
    faq: {
      fr: [
        { q: "Faut-il un abonnement Claude payant ?", a: "Non. Le connecteur fonctionne avec le plan gratuit de Claude, et **Claude intégré** n'a besoin d'aucun compte Claude : il utilise tes tokens IA DuupFlow." },
        { q: "Claude ne voit pas ma matière, que faire ?", a: "Vérifie que les fichiers ont fini d'être analysés dans l'éditeur (badge « enregistré »), puis redemande à Claude de lister ta matière." },
        { q: "L'IA invente-t-elle des personnages ?", a: "Non. L'éditeur monte tes vrais rushes ; il ne génère ni avatar ni vidéo synthétique." },
        { q: "Quels formats marchent le mieux ?", a: "Les formats simples et répétables : face cam, plans de vie quotidienne, texte à l'écran, sous-titres." },
      ],
      en: [
        { q: "Do I need a paid Claude subscription?", a: "No. The connector works on Claude's free plan, and **built-in Claude** needs no Claude account at all: it uses your DuupFlow AI tokens." },
        { q: "Claude can't see my material, what should I do?", a: "Check the files have finished being analysed in the editor (“saved” badge), then ask Claude to list your material again." },
        { q: "Does the AI invent characters?", a: "No. The editor cuts your real footage; it doesn't generate avatars or synthetic video." },
        { q: "Which formats work best?", a: "Simple, repeatable formats: face cam, everyday-life shots, on-screen text, subtitles." },
      ],
    },
  },

  /* ─────────────── Scraper ─────────────── */
  {
    slug: "scraper",
    category: "analyze", app: ["/dashboard/import"], related: ["duplication-video", "abonnement-et-tokens"],
    title: { fr: "Scraper Instagram et TikTok", en: "Instagram and TikTok scraper" },
    summary: {
      fr: "Analyse un compte Instagram ou TikTok, classe ses vidéos par performance et envoie les meilleures vers la duplication ou Google Drive.",
      en: "Analyse an Instagram or TikTok account, rank its videos by performance and send the best ones to duplication or Google Drive.",
    },
    sections: {
      fr: [
        { id: "utiliser", title: "Comment l'utiliser", blocks: [
          { type: "steps", items: [
            "Ouvre **Scraper** dans le dashboard.",
            "Colle le lien du compte (Instagram ou TikTok) ou son `@pseudo`.",
            "Choisis combien de vidéos garder (la meilleure, ou les 2, 3, 5 ou 10 meilleures) et la période (7 jours, 30 jours, 90 jours, 1 an).",
            "Clique sur **Analyser** : DuupFlow passe le compte en revue (30 s à 2 min).",
            "Sélectionne les vidéos, puis **Envoyer vers duplication** ou **Envoyer vers Drive**.",
          ] },
        ] },
        { id: "classement", title: "Comment les vidéos sont classées", blocks: [
          { type: "p", text: "Chaque vidéo reçoit un score de 0 à 100, relatif à la meilleure vidéo du compte : surtout la portée (vues), plus un bonus pour le taux d'engagement. Jusqu'à 100 vidéos sont analysées par scan." },
        ] },
        { id: "cout", title: "Coût en tokens", blocks: [
          { type: "p", text: "Le Scraper fonctionne avec des **tokens**, au même prix sur tous les plans. Le coût est affiché avant le clic, débité une seule fois (téléchargement inclus) et **remboursé si le compte est inaccessible**." },
          { type: "table", head: ["Période", "Base", "+ par vidéo"], rows: [
            ["7 jours", "1 000", "Instagram 100 · TikTok 300"],
            ["30 jours", "2 500", "Instagram 100 · TikTok 300"],
            ["90 jours", "4 000", "Instagram 100 · TikTok 300"],
            ["1 an", "5 000", "Instagram 100 · TikTok 300"],
          ] },
          { type: "p", text: "Exemple : TikTok, 30 jours, 5 meilleures vidéos = 2 500 + 5 × 300 = **4 000 tokens** (0,40 €). Recharges : 10 € = 100 000 tokens, 40 € = 440 000, 100 € = 1 120 000." },
        ] },
      ],
      en: [
        { id: "utiliser", title: "How to use it", blocks: [
          { type: "steps", items: [
            "Open **Scraper** in the dashboard.",
            "Paste the account link (Instagram or TikTok) or its `@handle`.",
            "Pick how many videos to keep (the best one, or the top 2, 3, 5 or 10) and the period (7 days, 30 days, 90 days, 1 year).",
            "Click **Analyze**: DuupFlow goes through the account (30 s to 2 min).",
            "Select the videos, then **Send to duplication** or **Send to Drive**.",
          ] },
        ] },
        { id: "classement", title: "How videos are ranked", blocks: [
          { type: "p", text: "Each video gets a score from 0 to 100, relative to the account's best video: mostly reach (views), plus a bonus for engagement rate. Up to 100 videos are analysed per scan." },
        ] },
        { id: "cout", title: "Token cost", blocks: [
          { type: "p", text: "The Scraper runs on **tokens**, at the same price on every plan. The cost is shown before you click, charged once (download included) and **refunded if the account can't be reached**." },
          { type: "table", head: ["Period", "Base", "+ per video"], rows: [
            ["7 days", "1,000", "Instagram 100 · TikTok 300"],
            ["30 days", "2,500", "Instagram 100 · TikTok 300"],
            ["90 days", "4,000", "Instagram 100 · TikTok 300"],
            ["1 year", "5,000", "Instagram 100 · TikTok 300"],
          ] },
          { type: "p", text: "Example: TikTok, 30 days, top 5 videos = 2,500 + 5 × 300 = **4,000 tokens** (€0.40). Top-ups: €10 = 100,000 tokens, €40 = 440,000, €100 = 1,120,000." },
        ] },
      ],
    },
    faq: {
      fr: [
        { q: "Puis-je analyser le compte d'un concurrent ?", a: "Oui, tout compte public Instagram ou TikTok." },
        { q: "Que se passe-t-il si le scan échoue ?", a: "Rien n'est débité : les tokens sont remboursés automatiquement si le compte est inaccessible." },
      ],
      en: [
        { q: "Can I analyse a competitor's account?", a: "Yes, any public Instagram or TikTok account." },
        { q: "What if the scan fails?", a: "Nothing is charged: tokens are refunded automatically if the account can't be reached." },
      ],
    },
  },

  /* ─────────────── Comparateur ─────────────── */
  {
    slug: "comparateur",
    category: "analyze", app: ["/dashboard/similarity"], related: ["duplication-video"],
    title: { fr: "Comparateur", en: "Comparator" },
    summary: {
      fr: "Vérifie qu'une copie est assez différente de l'original avant de la republier, avec un score de similarité unique.",
      en: "Check a copy is different enough from the original before reposting it, with a single similarity score.",
    },
    sections: {
      fr: [
        { id: "utiliser", title: "Comment l'utiliser", blocks: [
          { type: "steps", items: [
            "Ouvre **Comparateur** dans le dashboard.",
            "Dépose l'original dans **Fichier 1** et la copie dans **Fichier 2** (vidéo ou image, ou depuis Drive).",
            "Clique sur **Comparer les fichiers**.",
          ] },
        ] },
        { id: "score", title: "Lire le score", blocks: [
          { type: "p", text: "Le score combine l'**image** (60 %) et les **métadonnées techniques** (40 %). Pour une vidéo, 5 images réparties sur toute la durée sont comparées." },
          { type: "visual", id: "similarity-scale" },
          { type: "table", head: ["Score", "Verdict", "Ce que ça veut dire"], rows: [
            ["75 % et plus", "Très similaires", "Risque d'être vu comme un doublon"],
            ["45 à 74 %", "Similarité modérée", "Différence partielle"],
            ["Moins de 45 %", "Fichiers distincts", "Bien différencié, sûr à republier"],
          ] },
          { type: "p", text: "Le détail affiche aussi, champ par champ, ce qui diffère entre les deux fichiers (en vert)." },
        ] },
      ],
      en: [
        { id: "utiliser", title: "How to use it", blocks: [
          { type: "steps", items: [
            "Open **Comparator** in the dashboard.",
            "Drop the original in **File 1** and the copy in **File 2** (video or image, or from Drive).",
            "Click **Compare files**.",
          ] },
        ] },
        { id: "score", title: "Reading the score", blocks: [
          { type: "p", text: "The score combines the **image** (60%) and the **technical metadata** (40%). For a video, 5 frames spread across its length are compared." },
          { type: "visual", id: "similarity-scale" },
          { type: "table", head: ["Score", "Verdict", "What it means"], rows: [
            ["75% and above", "Very similar", "Likely to be seen as a duplicate"],
            ["45 to 74%", "Moderate similarity", "Partial difference"],
            ["Below 45%", "Distinct files", "Well differentiated, safe to repost"],
          ] },
          { type: "p", text: "The breakdown also shows, field by field, what differs between the two files (in green)." },
        ] },
      ],
    },
    faq: {
      fr: [
        { q: "Le Comparateur consomme-t-il mon quota ?", a: "Non, il ne consomme ni quota ni tokens. Il est inclus dans tous les plans payants." },
        { q: "Un score bas, c'est bien ?", a: "Oui : plus le score est bas, plus ta copie est différente de l'original." },
      ],
      en: [
        { q: "Does the Comparator use my quota?", a: "No, it uses neither quota nor tokens. It's included in every paid plan." },
        { q: "Is a low score good?", a: "Yes: the lower the score, the more your copy differs from the original." },
      ],
    },
  },

  /* ─────────────── Compresseur ─────────────── */
  {
    slug: "compresseur",
    category: "analyze", app: ["/dashboard/compress"],
    title: { fr: "Compresseur", en: "Compressor" },
    summary: {
      fr: "Réduis le poids de tes images et vidéos sans perte visible, jusqu'à 30 fichiers à la fois.",
      en: "Shrink your images and videos with no visible loss, up to 30 files at a time.",
    },
    sections: {
      fr: [
        { id: "utiliser", title: "Comment l'utiliser", blocks: [
          { type: "steps", items: [
            "Ouvre **Compresseur** dans le dashboard.",
            "Dépose tes fichiers (images et vidéos mélangées possibles).",
            "Choisis le niveau : **Léger**, **Équilibré** (recommandé) ou **Fort**.",
            "Clique sur **Compresser**, puis télécharge les fichiers ou envoie-les vers Drive.",
          ] },
        ] },
        { id: "niveaux", title: "Les niveaux", blocks: [
          { type: "table", head: ["Niveau", "Pour qui", "Taille max"], rows: [
            ["Léger", "Qualité maximale, réduction modérée", "Taille d'origine"],
            ["Équilibré", "Le meilleur compromis", "2 560 px"],
            ["Fort", "Réduction maximale du poids", "1 920 px"],
          ] },
          { type: "p", text: "Si la version compressée n'est pas plus légère, l'original est conservé : un fichier n'est **jamais plus lourd** qu'avant." },
        ] },
        { id: "limites", title: "Limites et formats", blocks: [
          { type: "table", head: ["", "Limite"], rows: [
            ["Images", "JPG, PNG, WEBP, HEIC"],
            ["Vidéos", "MP4, MOV, MKV, AVI, WEBM"],
            ["Par lot", "30 fichiers et 10 Go au total"],
            ["Coût", "Aucun quota ni token, inclus dans les plans payants"],
          ] },
          { type: "callout", tone: "info", text: "Garde la page ouverte pendant l'envoi. Une fois l'envoi terminé, tu peux la quitter : la compression continue." },
        ] },
      ],
      en: [
        { id: "utiliser", title: "How to use it", blocks: [
          { type: "steps", items: [
            "Open **Compressor** in the dashboard.",
            "Drop your files (images and videos can be mixed).",
            "Pick the level: **Light**, **Balanced** (recommended) or **Strong**.",
            "Click **Compress**, then download the files or send them to Drive.",
          ] },
        ] },
        { id: "niveaux", title: "Levels", blocks: [
          { type: "table", head: ["Level", "For", "Max size"], rows: [
            ["Light", "Maximum quality, moderate reduction", "Original size"],
            ["Balanced", "The best trade-off", "2,560 px"],
            ["Strong", "Maximum weight reduction", "1,920 px"],
          ] },
          { type: "p", text: "If the compressed version isn't lighter, the original is kept: a file is **never heavier** than before." },
        ] },
        { id: "limites", title: "Limits and formats", blocks: [
          { type: "table", head: ["", "Limit"], rows: [
            ["Images", "JPG, PNG, WEBP, HEIC"],
            ["Videos", "MP4, MOV, MKV, AVI, WEBM"],
            ["Per batch", "30 files and 10 GB in total"],
            ["Cost", "No quota or tokens, included in paid plans"],
          ] },
          { type: "callout", tone: "info", text: "Keep the page open while uploading. Once the upload is done, you can leave: compression carries on." },
        ] },
      ],
    },
    faq: {
      fr: [
        { q: "Le Compresseur consomme-t-il mon quota ?", a: "Non, ni quota ni tokens." },
        { q: "Pourquoi un fichier affiche « déjà optimal » ?", a: "Parce que la compression ne le rendait pas plus léger : l'original est conservé tel quel." },
      ],
      en: [
        { q: "Does the Compressor use my quota?", a: "No, neither quota nor tokens." },
        { q: "Why does a file say “already optimal”?", a: "Because compression didn't make it lighter: the original is kept as is." },
      ],
    },
  },

  /* ─────────────── Variation IA ─────────────── */
  {
    slug: "variation-ia",
    category: "create", app: ["/dashboard/generate"], related: ["abonnement-et-tokens"],
    title: { fr: "Variation IA", en: "AI Variation" },
    summary: {
      fr: "Génère jusqu'à trois nouvelles images à partir d'une seule photo : même visage, même décor, même lumière, seule l'action change.",
      en: "Generate up to three new images from a single photo: same face, same setting, same lighting, only the action changes.",
    },
    sections: {
      fr: [
        { id: "utiliser", title: "Comment l'utiliser", blocks: [
          { type: "steps", items: [
            "Ouvre **Variation IA** dans le dashboard.",
            "Choisis le mode : **Variation pure**, ou **Avec prompt** pour décrire le changement voulu (ex. « change l'arrière-plan en plage au coucher du soleil »).",
            "Dépose une image de référence (ou importe-la depuis Drive).",
            "Choisis **1, 2 ou 3** variations, puis clique sur **Lancer**.",
            "Télécharge celles que tu veux (ou tout en ZIP).",
          ] },
        ] },
        { id: "cout", title: "Coût en tokens", blocks: [
          { type: "table", head: ["Plan", "Coût par image générée"], rows: [
            ["Solo", "9 000 tokens (0,90 €)"],
            ["Pro et Agence", "7 000 tokens (0,70 €)"],
          ] },
          { type: "p", text: "Le coût est affiché avant de lancer, avec ton solde après. Une image qui échoue est **remboursée automatiquement**. La Variation IA ne consomme pas ton quota mensuel." },
        ] },
      ],
      en: [
        { id: "utiliser", title: "How to use it", blocks: [
          { type: "steps", items: [
            "Open **AI Variation** in the dashboard.",
            "Pick the mode: **Pure variation**, or **With prompt** to describe the change you want (e.g. “change the background to a beach at sunset”).",
            "Drop a reference image (or import it from Drive).",
            "Pick **1, 2 or 3** variations, then click **Generate**.",
            "Download the ones you want (or everything as a ZIP).",
          ] },
        ] },
        { id: "cout", title: "Token cost", blocks: [
          { type: "table", head: ["Plan", "Cost per generated image"], rows: [
            ["Solo", "9,000 tokens (€0.90)"],
            ["Pro and Agency", "7,000 tokens (€0.70)"],
          ] },
          { type: "p", text: "The cost is shown before you generate, along with your balance afterwards. A failed image is **refunded automatically**. AI Variation doesn't use your monthly quota." },
        ] },
      ],
    },
    faq: {
      fr: [
        { q: "Le visage reste-t-il le même ?", a: "Oui : l'identité, le décor et la lumière sont conservés, seule l'action change." },
        { q: "Combien de variations par image ?", a: "1 à 3 par lancement." },
      ],
      en: [
        { q: "Does the face stay the same?", a: "Yes: identity, setting and lighting are kept, only the action changes." },
        { q: "How many variations per image?", a: "1 to 3 per run." },
      ],
    },
  },

  /* ─────────────── Retirer la détection IA ─────────────── */
  {
    slug: "retirer-detection-ia",
    category: "duplicate", app: ["/dashboard/ai-detection"], related: ["duplication-video", "duplication-image"],
    title: { fr: "Retirer la détection IA", en: "Remove AI detection" },
    summary: {
      fr: "Masque la signature laissée par les outils de génération IA dans tes images et vidéos, directement pendant la duplication.",
      en: "Masks the signature AI generation tools leave in your images and videos, right during duplication.",
    },
    sections: {
      fr: [
        { id: "ou", title: "Où le trouver", blocks: [
          { type: "p", text: "C'est une **option** à cocher (🛡️ Retirer la détection IA) dans :" },
          { type: "list", items: [
            "**Duplication → Vidéos**, en mode Simple et Avancé ;",
            "**Duplication → Images** ;",
            "l'**API** (`remove_ai_detection`, ou la route dédiée `/api/v1/ai-detection`).",
          ] },
        ] },
        { id: "quoi", title: "Ce que ça fait", blocks: [
          { type: "list", items: [
            "**Images** : efface les métadonnées laissées par les outils IA (EXIF, XMP, IPTC, C2PA), les remplace par une identité d'appareil réaliste, et ajoute un léger grain de capteur.",
            "**Vidéos** : ajoute un contre-watermark presque invisible et différent sur chaque copie, en plus des métadonnées déjà réécrites par la duplication.",
          ] },
          { type: "callout", tone: "warn", text: "Certains watermarks robustes intégrés au pixel (de type SynthID) ne peuvent pas être retirés de façon garantie." },
        ] },
      ],
      en: [
        { id: "ou", title: "Where to find it", blocks: [
          { type: "p", text: "It's an **option** to tick (🛡️ Remove AI detection) in:" },
          { type: "list", items: [
            "**Duplication → Videos**, in Simple and Advanced mode;",
            "**Duplication → Images**;",
            "the **API** (`remove_ai_detection`, or the dedicated route `/api/v1/ai-detection`).",
          ] },
        ] },
        { id: "quoi", title: "What it does", blocks: [
          { type: "list", items: [
            "**Images**: wipes the metadata left by AI tools (EXIF, XMP, IPTC, C2PA), replaces it with a realistic device identity, and adds slight sensor grain.",
            "**Videos**: adds a near-invisible counter-watermark that differs on each copy, on top of the metadata already rewritten by duplication.",
          ] },
          { type: "callout", tone: "warn", text: "Some robust watermarks baked into the pixels (SynthID-type) can't be removed with any guarantee." },
        ] },
      ],
    },
    faq: {
      fr: [
        { q: "Faut-il un module séparé ?", a: "Non, c'est une option de la duplication vidéo et image. L'ancien module « Détection IA » a été intégré au duplicateur." },
        { q: "C'est disponible dans l'API ?", a: "Oui, à partir du plan Pro, via `remove_ai_detection` ou la route `/api/v1/ai-detection` (images jusqu'à 25 Mo, vidéos jusqu'à 150 Mo et 120 s)." },
      ],
      en: [
        { q: "Is it a separate module?", a: "No, it's an option in video and image duplication. The former “AI Detection” module was merged into the duplicator." },
        { q: "Is it available in the API?", a: "Yes, from the Pro plan, via `remove_ai_detection` or the `/api/v1/ai-detection` route (images up to 25 MB, videos up to 150 MB and 120 s)." },
      ],
    },
  },

  /* ─────────────── Créatrices et rôles ─────────────── */
  {
    slug: "createurs-et-roles",
    category: "connect", app: ["/dashboard/workspaces"], related: ["google-drive", "editeur-ia"],
    title: { fr: "Espaces créatrices et rôles d'équipe", en: "Creator workspaces and team roles" },
    summary: {
      fr: "Un espace par créatrice avec son brief, ses réglages et son dossier Drive, et des rôles Manager / VA pour que chacun ne voie que ce qui le concerne.",
      en: "One workspace per creator with her brief, settings and Drive folder, plus Manager / VA roles so everyone only sees what concerns them.",
    },
    sections: {
      fr: [
        { id: "espaces", title: "Les espaces créatrices", blocks: [
          { type: "p", text: "Chaque créatrice a son propre espace, que tu choisis dans le **sélecteur de créateur** en haut de la barre latérale. Un espace contient :" },
          { type: "list", items: [
            "son **brief** pour l'Éditeur IA (jusqu'à 4 000 caractères, plus jusqu'à 10 images et 5 vidéos de référence) ;",
            "ses **réglages de duplication** enregistrés (images, vidéo simple, vidéo avancée), appliqués automatiquement ;",
            "son **dossier Google Drive**, nommé « <nom de la créatrice> — DuupFlow ».",
          ] },
          { type: "table", head: ["Plan", "Espaces créatrices", "Membres invités"], rows: [
            ["Solo", "—", "—"],
            ["Pro", "2", "3"],
            ["Agence", "15", "10"],
          ] },
        ] },
        { id: "roles", title: "Les rôles", blocks: [
          { type: "table", head: ["Rôle", "Ce qu'il peut faire"], rows: [
            ["Propriétaire", "Tout, y compris la facturation et les membres de l'équipe"],
            ["Manager", "Tous les créateurs : crée, modifie et assigne les VA. Pas d'accès à la facturation"],
            ["VA", "Uniquement les créateurs qui lui sont assignés. Peut produire et télécharger, ne supprime rien"],
          ] },
        ] },
        { id: "mettre-en-place", title: "Mettre en place ton équipe", blocks: [
          { type: "steps", items: [
            "Dans **Gérer les créateurs**, crée un espace par créatrice.",
            "Invite tes membres depuis **Paramètres → Équipe** (rôle VA par défaut, ou Manager).",
            "Sur chaque créatrice, clique sur **Assigner des VA** et coche les VA concernés. Le changement est immédiat.",
            "Rédige le brief de chaque créatrice et enregistre ses réglages de duplication.",
          ] },
        ] },
      ],
      en: [
        { id: "espaces", title: "Creator workspaces", blocks: [
          { type: "p", text: "Each creator has her own workspace, which you pick in the **creator switcher** at the top of the sidebar. A workspace holds:" },
          { type: "list", items: [
            "her **brief** for the AI Editor (up to 4,000 characters, plus up to 10 reference images and 5 reference videos);",
            "her saved **duplication settings** (images, simple video, advanced video), applied automatically;",
            "her **Google Drive folder**, named “<creator name> — DuupFlow”.",
          ] },
          { type: "table", head: ["Plan", "Creator workspaces", "Invited members"], rows: [
            ["Solo", "—", "—"],
            ["Pro", "2", "3"],
            ["Agency", "15", "10"],
          ] },
        ] },
        { id: "roles", title: "Roles", blocks: [
          { type: "table", head: ["Role", "What they can do"], rows: [
            ["Owner", "Everything, including billing and team members"],
            ["Manager", "All creators: create, edit and assign VAs. No billing access"],
            ["VA", "Only the creators assigned to them. Can produce and download, can't delete anything"],
          ] },
        ] },
        { id: "mettre-en-place", title: "Setting up your team", blocks: [
          { type: "steps", items: [
            "In **Manage creators**, create one workspace per creator.",
            "Invite your members from **Settings → Team** (VA role by default, or Manager).",
            "On each creator, click **Assign VAs** and tick the right VAs. The change is immediate.",
            "Write each creator's brief and save her duplication settings.",
          ] },
        ] },
      ],
    },
    faq: {
      fr: [
        { q: "Un VA peut-il voir les autres créatrices ?", a: "Non, un VA ne voit que les créatrices qui lui sont assignées." },
        { q: "Les membres invités ont-ils les fonctionnalités Pro ?", a: "Oui, ils profitent du plan du propriétaire du compte tant qu'il est Pro ou Agence." },
      ],
      en: [
        { q: "Can a VA see the other creators?", a: "No, a VA only sees the creators assigned to them." },
        { q: "Do invited members get Pro features?", a: "Yes, they use the account owner's plan as long as it's Pro or Agency." },
      ],
    },
  },

  /* ─────────────── Google Drive ─────────────── */
  {
    slug: "google-drive",
    category: "connect", related: ["createurs-et-roles"],
    title: { fr: "Google Drive", en: "Google Drive" },
    summary: {
      fr: "Importe tes fichiers depuis Google Drive et renvoie tes copies directement dedans, avec un dossier par créatrice.",
      en: "Import your files from Google Drive and send your copies straight back, with one folder per creator.",
    },
    sections: {
      fr: [
        { id: "connecter", title: "Connecter Google Drive", blocks: [
          { type: "steps", items: [
            "Va dans **Paramètres → Google Drive** et clique sur **Connecter Google Drive**.",
            "Choisis ton compte Google, puis **Autorise** en laissant la case Drive cochée.",
          ] },
          { type: "p", text: "Seul le propriétaire du compte connecte Drive ; les membres de l'équipe utilisent sa connexion. DuupFlow n'accède qu'aux fichiers que tu lui donnes, jamais à tout ton Drive." },
        ] },
        { id: "importer", title: "Importer depuis Drive", blocks: [
          { type: "p", text: "Le bouton **Importer depuis Google Drive** est disponible dans la duplication vidéo et image, la Variation IA, le Comparateur, le Compresseur et la matière de l'Éditeur IA. Les vidéos de plus de 120 secondes et les fichiers non pris en charge sont ignorés automatiquement." },
        ] },
        { id: "envoyer", title: "Envoyer vers Drive", blocks: [
          { type: "list", items: [
            "Depuis le dashboard, **Envoyer vers Drive** te laisse choisir le dossier de destination.",
            "Depuis Claude (Éditeur IA), les variantes partent dans le dossier de la créatrice, « <nom de la créatrice> — DuupFlow » (ou « DuupFlow variantes » sans espaces créatrices).",
          ] },
        ] },
      ],
      en: [
        { id: "connecter", title: "Connecting Google Drive", blocks: [
          { type: "steps", items: [
            "Go to **Settings → Google Drive** and click **Connect Google Drive**.",
            "Pick your Google account, then **Authorize** with the Drive box ticked.",
          ] },
          { type: "p", text: "Only the account owner connects Drive; team members use that connection. DuupFlow only accesses the files you give it, never your whole Drive." },
        ] },
        { id: "importer", title: "Importing from Drive", blocks: [
          { type: "p", text: "The **Import from Google Drive** button is available in video and image duplication, AI Variation, the Comparator, the Compressor and the AI Editor material. Videos over 120 seconds and unsupported files are skipped automatically." },
        ] },
        { id: "envoyer", title: "Sending to Drive", blocks: [
          { type: "list", items: [
            "From the dashboard, **Save to Drive** lets you pick the destination folder.",
            "From Claude (AI Editor), variants go to the creator's folder, “<creator name> — DuupFlow” (or “DuupFlow variantes” without creator workspaces).",
          ] },
        ] },
      ],
    },
    faq: {
      fr: [
        { q: "DuupFlow voit-il tout mon Drive ?", a: "Non. DuupFlow n'accède qu'aux fichiers que tu sélectionnes et à ceux qu'il crée." },
        { q: "Mes VA peuvent-ils connecter leur propre Drive ?", a: "Non, seul le propriétaire du compte connecte Drive ; toute l'équipe utilise cette connexion." },
      ],
      en: [
        { q: "Can DuupFlow see my whole Drive?", a: "No. DuupFlow only accesses the files you select and the ones it creates." },
        { q: "Can my VAs connect their own Drive?", a: "No, only the account owner connects Drive; the whole team uses that connection." },
      ],
    },
  },
];

/** Toutes les pages, dans l'ordre des rubriques (HELP_CATEGORIES). */
export const HELP_DOCS: HelpDoc[] = HELP_CATEGORIES.flatMap((c) =>
  [...CORE_DOCS, ...EXTRA_DOCS].filter((d) => d.category === c.id),
);

/** Page d'aide à ouvrir depuis une page du dashboard (préfixe le plus long). */
export function helpDocForPath(pathname: string): HelpDoc | null {
  let best: { doc: HelpDoc; len: number } | null = null;
  for (const d of HELP_DOCS) for (const p of d.app ?? []) {
    const hit = p === "/dashboard" ? pathname === p : pathname === p || pathname.startsWith(p + "/");
    if (hit && (!best || p.length > best.len)) best = { doc: d, len: p.length };
  }
  return best?.doc ?? null;
}

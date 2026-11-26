// Pages du centre d'aide ajoutées en 11/2026 (même format, mêmes règles que
// helpCenterContent.ts — lis son en-tête avant de modifier).
//
// Chiffres relevés dans le code le 17/11/2026 :
//   plans        : pricing/page.tsx (39/99/249 €, annuel 28/70/176 €/mois), plans.ts
//   tokens       : tokens.ts (1 € = 10 000 tokens, recharges 10/40/100 €),
//                  fr.json pricing.tokensSolo/Pro/Agency (30k/80k/200k IA par mois)
//   Duplication IA : lib/ai-dup/config.ts (1-50 copies, 1 vidéo de quota par copie,
//                  estimation 200 + 100 tokens/copie en Variations), history.ts (5 jours)
//   Textes       : lib/text-overlay-config.ts (4 styles de sous-titres, fenêtre)

import type { HelpDoc } from "./helpCenterContent";

export const EXTRA_DOCS: HelpDoc[] = [
  /* ─────────────── Bien démarrer ─────────────── */
  {
    slug: "premiers-pas",
    category: "start",
    app: ["/dashboard"],
    related: ["duplication-video", "abonnement-et-tokens"],
    title: { fr: "Premiers pas avec DuupFlow", en: "Getting started with DuupFlow" },
    summary: {
      fr: "Ce que fait chaque module, ta première duplication en 2 minutes, et ce que contient chaque plan.",
      en: "What each module does, your first duplication in 2 minutes, and what each plan includes.",
    },
    sections: {
      fr: [
        { id: "modules", title: "Quel module pour quoi ?", blocks: [
          { type: "table", head: ["Tu veux…", "Utilise"], rows: [
            ["Poster la même vidéo sur plusieurs comptes", "**Duplication vidéo** (Simple ou Avancé)"],
            ["Laisser l'IA fabriquer des copies toutes différentes", "**Duplication IA en 1 clic**"],
            ["Ajouter une caption ou des sous-titres sur tes copies", "**Captions et sous-titres** (mode Simple)"],
            ["Poster la même photo sur plusieurs comptes", "**Duplication d'image**"],
            ["Monter une vidéo à partir de tes rushes", "**Éditeur IA**"],
            ["Trouver les vidéos qui marchent sur un compte", "**Scraper**"],
            ["Vérifier qu'une copie est assez différente", "**Comparateur**"],
          ] },
        ] },
        { id: "premiere", title: "Ta première duplication", blocks: [
          { type: "steps", items: [
            "Dans la barre latérale, ouvre **Duplication → Vidéos**, puis le mode **Simple**.",
            "Dépose une vidéo de moins de 2 minutes.",
            "Choisis **5 copies** et l'intensité **Équilibré**.",
            "Clique sur **Dupliquer**, attends la fin, puis télécharge le ZIP ou envoie les copies vers Google Drive.",
          ] },
          { type: "callout", tone: "warn", text: "Les fichiers générés sont **temporaires** (environ 1 h, 5 jours pour la Duplication IA) : télécharge-les ou envoie-les vers Drive." },
        ] },
        { id: "plans", title: "Les plans", blocks: [
          { type: "table", head: ["Plan", "Prix / mois", "Ce qui est inclus"], rows: [
            ["Gratuit", "0 €", "Tu explores tout le dashboard, sans créer de copies"],
            ["Solo", "39 €", "300 vidéos et 400 images par mois · 30 000 tokens IA par mois"],
            ["Pro", "99 €", "Vidéos et images illimitées · 2 espaces créatrices · 3 membres · API · 80 000 tokens IA par mois"],
            ["Agence", "249 €", "Tout Pro · 15 espaces créatrices · 10 membres · 200 000 tokens IA par mois"],
          ] },
          { type: "p", text: "En annuel, le prix baisse de **29 %** (28 €, 70 € et 176 € par mois, facturés une fois par an). Les quotas se remettent à zéro chaque mois." },
        ] },
        { id: "autour", title: "Aussi dans le dashboard", blocks: [
          { type: "list", items: [
            "**Accueil** : ton activité en un coup d'œil (duplications par jour, derniers lancements, temps gagné).",
            "**Amélioration** (barre latérale) : envoie-nous une idée ou une demande en quelques mots.",
            "**Aide** (barre latérale) : toutes les pages d'aide, les problèmes fréquents et le contact. Chaque module a aussi un bouton **Documentations** en haut à droite.",
          ] },
        ] },
      ],
      en: [
        { id: "modules", title: "Which module for what?", blocks: [
          { type: "table", head: ["You want to…", "Use"], rows: [
            ["Post the same video on several accounts", "**Video duplication** (Simple or Advanced)"],
            ["Let the AI build copies that all look different", "**1-click AI duplication**"],
            ["Add a caption or subtitles to your copies", "**Captions and subtitles** (Simple mode)"],
            ["Post the same photo on several accounts", "**Image duplication**"],
            ["Edit a video from your raw footage", "**AI Editor**"],
            ["Find the videos that perform on an account", "**Scraper**"],
            ["Check a copy is different enough", "**Comparator**"],
          ] },
        ] },
        { id: "premiere", title: "Your first duplication", blocks: [
          { type: "steps", items: [
            "In the sidebar, open **Duplication → Videos**, then **Simple** mode.",
            "Drop a video shorter than 2 minutes.",
            "Pick **5 copies** and the **Balanced** intensity.",
            "Click **Duplicate**, wait for it to finish, then download the ZIP or send the copies to Google Drive.",
          ] },
          { type: "callout", tone: "warn", text: "Generated files are **temporary** (about 1 h, 5 days for AI duplication): download them or send them to Drive." },
        ] },
        { id: "plans", title: "Plans", blocks: [
          { type: "table", head: ["Plan", "Price / month", "What's included"], rows: [
            ["Free", "€0", "Explore the whole dashboard, without creating copies"],
            ["Solo", "€39", "300 videos and 400 images a month · 30,000 AI tokens a month"],
            ["Pro", "€99", "Unlimited videos and images · 2 creator workspaces · 3 members · API · 80,000 AI tokens a month"],
            ["Agency", "€249", "Everything in Pro · 15 creator workspaces · 10 members · 200,000 AI tokens a month"],
          ] },
          { type: "p", text: "Yearly billing is **29% cheaper** (€28, €70 and €176 a month, billed once a year). Quotas reset every month." },
        ] },
        { id: "autour", title: "Also in the dashboard", blocks: [
          { type: "list", items: [
            "**Home**: your activity at a glance (duplications per day, latest runs, time saved).",
            "**Suggest a feature** (sidebar): send us an idea or a request in a few words.",
            "**Help** (sidebar): every help page, common problems and how to reach us. Every module also has a **Documentation** button at the top right.",
          ] },
        ] },
      ],
    },
    faq: {
      fr: [
        { q: "Le plan gratuit permet-il de tester ?", a: "Il permet de tout explorer et de voir comment chaque module fonctionne, mais pas de créer de copies. Passe à un plan payant pour produire." },
        { q: "Mon quota se remet-il à zéro ?", a: "Oui, chaque mois, à la date de ton abonnement." },
      ],
      en: [
        { q: "Can I test with the free plan?", a: "You can explore everything and see how each module works, but not create copies. Switch to a paid plan to produce." },
        { q: "Does my quota reset?", a: "Yes, every month, on your subscription date." },
      ],
    },
  },

  /* ─────────────── Duplication IA en 1 clic ─────────────── */
  {
    slug: "duplication-ia",
    category: "duplicate",
    badge: "beta",
    app: ["/dashboard/videos/ai"],
    related: ["duplication-video", "textes-video", "abonnement-et-tokens"],
    title: { fr: "Duplication IA en 1 clic", en: "1-click AI duplication" },
    summary: {
      fr: "Dépose une vidéo, choisis un mode et un nombre de copies : l'IA regarde ta vidéo et fabrique des copies uniques, prêtes à poster.",
      en: "Drop a video, pick a mode and a number of copies: the AI watches your video and builds unique copies, ready to post.",
    },
    sections: {
      fr: [
        { id: "utiliser", title: "Comment l'utiliser", blocks: [
          { type: "steps", items: [
            "Ouvre **Duplication → Vidéos**, puis **Duplication IA en 1 clic**.",
            "Dépose ta vidéo (1 vidéo, 2 min et 300 Mo maximum) et attends la fin de l'analyse.",
            "Choisis le mode : **Invisible** ou **Variations**.",
            "Choisis le nombre de copies (1 à 50) et, si tu veux, ajoute des **indications**.",
            "Clique sur **Dupliquer**. Chaque copie apparaît dès qu'elle est prête : télécharge-la, ou envoie tout vers Google Drive.",
          ] },
        ] },
        { id: "modes", title: "Les deux modes", blocks: [
          { type: "visual", id: "ai-dup-modes" },
          { type: "table", head: ["Mode", "Ce qui change sur chaque copie", "Tokens IA"], rows: [
            ["Invisible", "Rien de visible : métadonnées, réencodage et pixel magique différents", "Aucun"],
            ["Variations", "En plus : caption réécrite, sous-titres, cadrage, vitesse et couleurs", "Oui (voir plus bas)"],
          ] },
        ] },
        { id: "caption", title: "Réécrire la caption d'origine", blocks: [
          { type: "p", text: "En mode Variations, l'option **Réécrire la caption d'origine** repère le texte déjà incrusté dans ta vidéo, le recouvre et écrit à la place une version reformulée, avec une typo, une couleur et une forme de fond différentes sur chaque copie." },
          { type: "callout", tone: "info", text: "Ça marche le mieux quand la caption d'origine est sur un fond uni ou un endroit calme de l'image. Si elle ne peut pas être recouverte proprement, la copie garde la caption d'origine." },
        ] },
        { id: "indications", title: "Les indications", blocks: [
          { type: "p", text: "Un champ libre (1 000 caractères max) pour guider l'IA. Des indications toutes prêtes s'ajoutent en un clic :" },
          { type: "list", items: [
            "Varie le style de typographie · les couleurs des captions · les formes des blocs de texte",
            "Textes courts et percutants · ton humoristique · pas d'emoji · textes en anglais",
            "Pas de texte en plus de la caption",
          ] },
        ] },
        { id: "cout", title: "Ce que ça coûte", blocks: [
          { type: "list", items: [
            "**Quota** : 1 vidéo par copie. Une copie écartée par le contrôle qualité n'est **pas décomptée**.",
            "**Tokens IA** (mode Variations seulement) : environ 200 tokens par lancement + 100 par copie. 10 copies ≈ 1 200 tokens. Ils sont pris d'abord sur le volume inclus dans ton plan, puis sur ton solde.",
          ] },
        ] },
        { id: "historique", title: "Historique et conservation", blocks: [
          { type: "p", text: "Sous le bouton **Dupliquer**, **Tes duplications** liste tes lancements : **Voir** rouvre les copies, la croix supprime la duplication." },
          { type: "callout", tone: "warn", text: "Les copies sont gardées **5 jours**, puis supprimées automatiquement. Télécharge ou envoie vers Drive celles que tu veux garder." },
        ] },
      ],
      en: [
        { id: "utiliser", title: "How to use it", blocks: [
          { type: "steps", items: [
            "Open **Duplication → Videos**, then **1-click AI duplication**.",
            "Drop your video (1 video, 2 min and 300 MB max) and wait for the analysis to finish.",
            "Pick the mode: **Invisible** or **Variations**.",
            "Pick the number of copies (1 to 50) and, if you like, add **instructions**.",
            "Click **Duplicate**. Each copy shows up as soon as it's ready: download it, or send everything to Google Drive.",
          ] },
        ] },
        { id: "modes", title: "The two modes", blocks: [
          { type: "visual", id: "ai-dup-modes" },
          { type: "table", head: ["Mode", "What changes on each copy", "AI tokens"], rows: [
            ["Invisible", "Nothing visible: different metadata, re-encoding and magic pixel", "None"],
            ["Variations", "On top: rewritten caption, subtitles, framing, speed and colours", "Yes (see below)"],
          ] },
        ] },
        { id: "caption", title: "Rewriting the original caption", blocks: [
          { type: "p", text: "In Variations mode, the **Rewrite the original caption** option spots the text already burned into your video, covers it and writes a reworded version instead, with a different font, colour and background shape on each copy." },
          { type: "callout", tone: "info", text: "It works best when the original caption sits on a plain background or a calm part of the image. If it can't be covered cleanly, the copy keeps the original caption." },
        ] },
        { id: "indications", title: "Instructions", blocks: [
          { type: "p", text: "A free field (1,000 characters max) to guide the AI. Ready-made instructions can be added in one click:" },
          { type: "list", items: [
            "Vary the font style · the caption colours · the text box shapes",
            "Short, punchy texts · humorous tone · no emoji · texts in English",
            "No text besides the caption",
          ] },
        ] },
        { id: "cout", title: "What it costs", blocks: [
          { type: "list", items: [
            "**Quota**: 1 video per copy. A copy rejected by the quality check is **not counted**.",
            "**AI tokens** (Variations mode only): about 200 tokens per run + 100 per copy. 10 copies ≈ 1,200 tokens. They come out of your plan's included volume first, then your balance.",
          ] },
        ] },
        { id: "historique", title: "History and retention", blocks: [
          { type: "p", text: "Under the **Duplicate** button, **Your duplications** lists your runs: **View** reopens the copies, the cross deletes the duplication." },
          { type: "callout", tone: "warn", text: "Copies are kept for **5 days**, then deleted automatically. Download or send to Drive the ones you want to keep." },
        ] },
      ],
    },
    faq: {
      fr: [
        { q: "Quel mode choisir ?", a: "**Invisible** si tu veux exactement la même vidéo sur chaque compte. **Variations** si tu veux que chaque copie ait l'air d'un post différent." },
        { q: "L'IA peut-elle se tromper ?", a: "Oui. Chaque copie passe un contrôle visuel, mais vérifie tes copies avant de publier. La fonction est en beta." },
        { q: "Pourquoi une copie est « écartée » ?", a: "Le contrôle qualité l'a jugée ratée (texte coupé, caption d'origine encore visible…). Elle n'est pas décomptée de ton quota." },
      ],
      en: [
        { q: "Which mode should I pick?", a: "**Invisible** if you want the exact same video on every account. **Variations** if you want each copy to look like a different post." },
        { q: "Can the AI make mistakes?", a: "Yes. Every copy goes through a visual check, but review your copies before posting. The feature is in beta." },
        { q: "Why is a copy “rejected”?", a: "The quality check found a problem (cut-off text, original caption still visible…). It isn't counted against your quota." },
      ],
    },
  },

  /* ─────────────── Captions et sous-titres ─────────────── */
  {
    slug: "textes-video",
    category: "duplicate",
    badge: "beta",
    related: ["duplication-video", "duplication-ia"],
    title: { fr: "Captions et sous-titres", en: "Captions and subtitles" },
    summary: {
      fr: "Ajoute une caption et/ou des sous-titres sur tes copies, place-les à la souris, et fais-les varier d'une copie à l'autre. Plans Pro et Agence.",
      en: "Add a caption and/or subtitles to your copies, place them with the mouse, and make them vary from one copy to the next. Pro and Agency plans.",
    },
    sections: {
      fr: [
        { id: "ou", title: "Où les trouver", blocks: [
          { type: "p", text: "Dans **Duplication → Vidéos → Simple**, sous les options : deux blocs, **Captions** (un texte fixe que tu écris) et **Sous-titres** (ce qui est dit dans la vidéo, écrit automatiquement). Tu peux utiliser l'un, l'autre ou les deux. L'aperçu à droite montre le résultat sur ta vidéo." },
          { type: "callout", tone: "info", text: "Les captions et sous-titres sont disponibles avec les plans **Pro** et **Agence**. Sur les autres plans, les deux blocs restent visibles mais verrouillés." },
        ] },
        { id: "caption", title: "La caption", blocks: [
          { type: "steps", items: [
            "Active **Ajouter une caption** et écris ton texte. Appuie sur Entrée pour aller à la ligne : la caption ne passe jamais à la ligne toute seule.",
            "Dans l'aperçu, **glisse la caption** pour la placer. Elle s'aimante au centre, et peut dépasser du cadre si tu veux.",
            "Tire la **pastille du coin** pour l'agrandir ou la réduire.",
            "Choisis la police, le fond (aucun, bandeau, bloc arrondi, bloc carré) et les couleurs.",
          ] },
        ] },
        { id: "quand", title: "Quand elle s'affiche", blocks: [
          { type: "p", text: "Par défaut, la caption reste toute la vidéo. Avec **Personnalisé**, tu choisis quand elle apparaît et disparaît : au début, au milieu, à la fin, ou une plage précise avec les deux curseurs. L'aperçu respecte ce timing." },
          { type: "visual", id: "caption-timing" },
        ] },
        { id: "sous-titres", title: "Les sous-titres", blocks: [
          { type: "p", text: "Active **Ajouter des sous-titres** et choisis un ou plusieurs styles. Glisse-les dans l'aperçu pour les placer." },
          { type: "visual", id: "subtitle-styles" },
          { type: "table", head: ["Style", "Rendu"], rows: [
            ["Karaoké", "2 à 4 mots en gros, le mot prononcé s'allume en couleur"],
            ["Mot par mot", "Un seul mot à la fois, très gros : rythme rapide"],
            ["Bandeau TikTok", "La phrase sur un fond de couleur, comme le texte natif"],
            ["Classique", "La phrase sur 2 lignes, blanc avec un fin contour"],
          ] },
          { type: "callout", tone: "info", text: "Les sous-titres sont écrits à partir de ce qui est dit dans chaque vidéo. Une vidéo sans voix n'aura pas de sous-titres." },
        ] },
        { id: "varier", title: "Varier sur chaque copie", blocks: [
          { type: "p", text: "Active **Varier sur chaque copie** puis sélectionne plusieurs polices, fonds, couleurs ou styles : chaque copie prend une combinaison différente. Le compteur affiche combien de combinaisons tu as, et les flèches de l'aperçu font défiler les copies." },
        ] },
        { id: "plusieurs", title: "Avec plusieurs vidéos", blocks: [
          { type: "steps", items: [
            "Règle la caption et les sous-titres sur la vidéo affichée dans l'aperçu.",
            "Clique sur **Valider pour cette vidéo** (ou **Aucune caption sur cette vidéo** / **Aucun sous-titre sur cette vidéo**) : elle passe dans **Vidéos validées** et l'aperçu passe à la suivante.",
            "Clique sur une vidéo validée pour la rouvrir avec ses réglages et les modifier.",
          ] },
          { type: "p", text: "Les vidéos non validées prennent les réglages affichés. Pour tout régler d'un coup, coche **Mêmes réglages pour toutes les vidéos**." },
        ] },
      ],
      en: [
        { id: "ou", title: "Where to find them", blocks: [
          { type: "p", text: "In **Duplication → Videos → Simple**, below the options: two blocks, **Captions** (a fixed text you write) and **Subtitles** (what's said in the video, written automatically). Use one, the other or both. The preview on the right shows the result on your video." },
          { type: "callout", tone: "info", text: "Captions and subtitles are available on the **Pro** and **Agency** plans. On other plans, both blocks stay visible but locked." },
        ] },
        { id: "caption", title: "The caption", blocks: [
          { type: "steps", items: [
            "Turn on **Add a caption** and type your text. Press Enter for a new line: the caption never wraps on its own.",
            "In the preview, **drag the caption** to place it. It snaps to the centre, and can go past the frame if you want.",
            "Pull the **corner handle** to make it bigger or smaller.",
            "Pick the font, the background (none, banner, rounded block, square block) and the colours.",
          ] },
        ] },
        { id: "quand", title: "When it shows", blocks: [
          { type: "p", text: "By default, the caption stays for the whole video. With **Custom**, you choose when it appears and disappears: at the start, in the middle, at the end, or an exact range with the two sliders. The preview follows this timing." },
          { type: "visual", id: "caption-timing" },
        ] },
        { id: "sous-titres", title: "Subtitles", blocks: [
          { type: "p", text: "Turn on **Add subtitles** and pick one or more styles. Drag them in the preview to place them." },
          { type: "visual", id: "subtitle-styles" },
          { type: "table", head: ["Style", "Look"], rows: [
            ["Karaoke", "2 to 4 big words, the spoken word lights up in colour"],
            ["Word by word", "One word at a time, very big: fast pace"],
            ["TikTok band", "The sentence on a colour background, like native text"],
            ["Classic", "The sentence on 2 lines, white with a thin outline"],
          ] },
          { type: "callout", tone: "info", text: "Subtitles are written from what's said in each video. A video with no voice gets no subtitles." },
        ] },
        { id: "varier", title: "Vary on every copy", blocks: [
          { type: "p", text: "Turn on **Vary on every copy**, then select several fonts, backgrounds, colours or styles: each copy takes a different combination. The counter shows how many combinations you have, and the preview arrows step through the copies." },
        ] },
        { id: "plusieurs", title: "With several videos", blocks: [
          { type: "steps", items: [
            "Set the caption and subtitles on the video shown in the preview.",
            "Click **Confirm for this video** (or **No caption on this video** / **No subtitles on this video**): it moves to **Confirmed videos** and the preview jumps to the next one.",
            "Click a confirmed video to reopen it with its settings and change them.",
          ] },
          { type: "p", text: "Videos you don't confirm use the settings on screen. To set everything at once, tick **Same settings for all videos**." },
        ] },
      ],
    },
    faq: {
      fr: [
        { q: "Les textes consomment-ils plus de quota ?", a: "Non. Le quota reste nombre de vidéos × nombre de copies." },
        { q: "Puis-je retrouver mes réglages la prochaine fois ?", a: "Oui : enregistre un **template** en bas de la page, il garde aussi tes captions et sous-titres." },
        { q: "L'aperçu est-il exact ?", a: "Il est très proche, mais indicatif : le rendu final est fait sur la vidéo en pleine résolution. La fonction est en beta, vérifie une copie avant de publier." },
      ],
      en: [
        { q: "Do texts use more quota?", a: "No. Quota is still number of videos × number of copies." },
        { q: "Can I get my settings back next time?", a: "Yes: save a **template** at the bottom of the page, it keeps your captions and subtitles too." },
        { q: "Is the preview exact?", a: "It's very close, but indicative: the final render is made on the full-resolution video. The feature is in beta, check one copy before posting." },
      ],
    },
  },

  /* ─────────────── Claude intégré ─────────────── */
  {
    slug: "claude-integre",
    category: "create",
    related: ["editeur-ia", "abonnement-et-tokens"],
    title: { fr: "Claude intégré", en: "Built-in Claude" },
    summary: {
      fr: "Parle à Claude directement dans l'Éditeur IA : il voit ta référence et ta matière, monte tes variantes et les affiche à côté. Rien à connecter.",
      en: "Talk to Claude right inside the AI Editor: it sees your reference and material, edits your variants and shows them alongside. Nothing to connect.",
    },
    sections: {
      fr: [
        { id: "utiliser", title: "Comment l'utiliser", blocks: [
          { type: "steps", items: [
            "Ouvre **Éditeur IA** et clique sur **Utiliser Claude intégré**.",
            "Ajoute ta référence et ta matière dans la colonne de gauche.",
            "Écris à Claude dans le chat à droite, par exemple « Fais-moi 3 variantes avec des hooks différents ».",
            "Les variantes apparaissent au centre dès qu'elles sont prêtes. Demande des retouches dans le chat.",
          ] },
          { type: "p", text: "Claude peut aussi dupliquer tes vidéos et images, envoyer tes variantes vers Google Drive et enregistrer une consigne dans le brief du créateur. Le bouton **Arrêter Claude** coupe une demande en cours." },
        ] },
        { id: "tokens", title: "Tokens", blocks: [
          { type: "p", text: "Claude intégré utilise des **tokens IA**, débités à chaque réponse selon le travail fait. Chaque plan inclut un volume par mois, partagé avec la Duplication IA :" },
          { type: "table", head: ["Plan", "Tokens IA inclus par mois"], rows: [
            ["Solo", "30 000"],
            ["Pro", "80 000"],
            ["Agence", "200 000"],
          ] },
          { type: "p", text: "Une fois le volume inclus épuisé, Claude continue sur ton solde de tokens (recharges dans **Plan & token**, menu du compte en bas de la barre latérale). Le volume inclus repart à zéro le 1er de chaque mois. Le chat affiche en permanence ce qu'il te reste." },
        ] },
        { id: "difference", title: "Claude intégré ou ton propre Claude ?", blocks: [
          { type: "table", head: ["", "Claude intégré", "Ton propre Claude (connecteur)"], rows: [
            ["Installation", "Aucune", "Ajouter le connecteur une fois"],
            ["Où tu écris", "Dans l'Éditeur IA", "Sur claude.ai, Desktop ou mobile"],
            ["Coût", "Tokens IA DuupFlow", "Ton abonnement Claude (gratuit possible)"],
          ] },
        ] },
      ],
      en: [
        { id: "utiliser", title: "How to use it", blocks: [
          { type: "steps", items: [
            "Open **AI Editor** and click **Use built-in Claude**.",
            "Add your reference and material in the left column.",
            "Write to Claude in the chat on the right, for example “Make me 3 variants with different hooks”.",
            "Variants show up in the middle as soon as they're ready. Ask for tweaks in the chat.",
          ] },
          { type: "p", text: "Claude can also duplicate your videos and images, send your variants to Google Drive and save an instruction in the creator brief. The **Stop Claude** button cancels a request in progress." },
        ] },
        { id: "tokens", title: "Tokens", blocks: [
          { type: "p", text: "Built-in Claude uses **AI tokens**, charged on each reply based on the work done. Each plan includes a monthly volume, shared with AI duplication:" },
          { type: "table", head: ["Plan", "AI tokens included per month"], rows: [
            ["Solo", "30,000"],
            ["Pro", "80,000"],
            ["Agency", "200,000"],
          ] },
          { type: "p", text: "Once the included volume is used up, Claude carries on with your token balance (top-ups in **Plan & tokens**, account menu at the bottom of the sidebar). The included volume resets on the 1st of each month. The chat always shows what you have left." },
        ] },
        { id: "difference", title: "Built-in Claude or your own Claude?", blocks: [
          { type: "table", head: ["", "Built-in Claude", "Your own Claude (connector)"], rows: [
            ["Setup", "None", "Add the connector once"],
            ["Where you write", "In the AI Editor", "On claude.ai, Desktop or mobile"],
            ["Cost", "DuupFlow AI tokens", "Your Claude subscription (free works)"],
          ] },
        ] },
      ],
    },
    faq: {
      fr: [
        { q: "Mes membres d'équipe peuvent-ils l'utiliser ?", a: "Oui. Les tokens utilisés sont ceux du propriétaire du compte." },
        { q: "Claude voit-il le brief du créateur ?", a: "Oui, il le lit au début de chaque conversation et l'applique à chaque variante." },
      ],
      en: [
        { q: "Can my team members use it?", a: "Yes. The tokens used are the account owner's." },
        { q: "Does Claude see the creator brief?", a: "Yes, it reads it at the start of each conversation and applies it to every variant." },
      ],
    },
  },

  /* ─────────────── Abonnement et tokens ─────────────── */
  {
    slug: "abonnement-et-tokens",
    category: "account",
    app: ["/dashboard/abonnement", "/dashboard/tokens"],
    related: ["premiers-pas", "depannage"],
    title: { fr: "Abonnement, quotas et tokens", en: "Subscription, quotas and tokens" },
    summary: {
      fr: "Ce que comptent les quotas, à quoi servent les tokens, et comment changer de plan.",
      en: "What quotas count, what tokens are for, and how to change plans.",
    },
    sections: {
      fr: [
        { id: "quotas", title: "Les quotas", blocks: [
          { type: "p", text: "Le quota compte ce que tu produis chaque mois : **1 copie = 1 vidéo** (ou 1 image). 10 vidéos × 5 copies = 50 vidéos. Solo : 300 vidéos et 400 images par mois. Pro et Agence : illimité. Le quota repart à zéro chaque mois, à la date anniversaire de ton abonnement." },
          { type: "callout", tone: "info", text: "**Pour démarrer** : en Solo, tes **5 premières vidéos** du premier mois sont offertes (elles passent avant le quota), et des **tokens de bienvenue** sont crédités sur ton solde à l'abonnement." },
          { type: "p", text: "Le Comparateur et le Compresseur ne consomment ni quota ni tokens." },
        ] },
        { id: "tokens", title: "Les tokens", blocks: [
          { type: "p", text: "Les tokens paient les fonctions qui coûtent à l'usage. **1 € = 10 000 tokens.**" },
          { type: "table", head: ["Fonction", "Coût"], rows: [
            ["Variation IA", "9 000 tokens par image en Solo · 7 000 en Pro et Agence"],
            ["Scraper", "1 000 à 5 000 tokens selon la période, + 100 (Instagram) ou 300 (TikTok) par vidéo"],
            ["Claude intégré, Duplication IA (Variations)", "Selon l'usage, d'abord sur les tokens IA inclus dans ton plan"],
          ] },
          { type: "table", head: ["Recharge", "Tokens crédités"], rows: [
            ["10 €", "100 000"],
            ["40 €", "440 000 (dont 40 000 offerts)"],
            ["100 €", "1 120 000 (dont 120 000 offerts)"],
          ] },
          { type: "callout", tone: "info", text: "Une génération ou un scan qui échoue est **remboursé automatiquement**. Les tokens IA inclus dans ton plan repartent à zéro le 1er de chaque mois." },
        ] },
        { id: "changer", title: "Changer de plan ou résilier", blocks: [
          { type: "steps", items: [
            "Ouvre **Plan & token** (menu du compte, en bas de la barre latérale).",
            "Choisis un autre plan, mensuel ou annuel, ou clique sur **Résilier l'abonnement**.",
          ] },
          { type: "p", text: "En cas de résiliation, ton plan reste actif jusqu'à la fin de la période déjà payée." },
        ] },
      ],
      en: [
        { id: "quotas", title: "Quotas", blocks: [
          { type: "p", text: "Quota counts what you produce each month: **1 copy = 1 video** (or 1 image). 10 videos × 5 copies = 50 videos. Solo: 300 videos and 400 images a month. Pro and Agency: unlimited. Quota resets every month, on your subscription anniversary date." },
          { type: "callout", tone: "info", text: "**To get started**: on Solo, your **first 5 videos** of the first month are free (they come before the quota), and **welcome tokens** are added to your balance when you subscribe." },
          { type: "p", text: "The Comparator and the Compressor use neither quota nor tokens." },
        ] },
        { id: "tokens", title: "Tokens", blocks: [
          { type: "p", text: "Tokens pay for the features billed by usage. **€1 = 10,000 tokens.**" },
          { type: "table", head: ["Feature", "Cost"], rows: [
            ["AI Variation", "9,000 tokens per image on Solo · 7,000 on Pro and Agency"],
            ["Scraper", "1,000 to 5,000 tokens depending on the period, + 100 (Instagram) or 300 (TikTok) per video"],
            ["Built-in Claude, AI duplication (Variations)", "Based on usage, first from the AI tokens included in your plan"],
          ] },
          { type: "table", head: ["Top-up", "Tokens credited"], rows: [
            ["€10", "100,000"],
            ["€40", "440,000 (40,000 free)"],
            ["€100", "1,120,000 (120,000 free)"],
          ] },
          { type: "callout", tone: "info", text: "A generation or scan that fails is **refunded automatically**. The AI tokens included in your plan reset on the 1st of each month." },
        ] },
        { id: "changer", title: "Changing plans or cancelling", blocks: [
          { type: "steps", items: [
            "Open **Plan & tokens** (account menu, at the bottom of the sidebar).",
            "Pick another plan, monthly or yearly, or click **Cancel subscription**.",
          ] },
          { type: "p", text: "If you cancel, your plan stays active until the end of the period you've already paid for." },
        ] },
      ],
    },
    faq: {
      fr: [
        { q: "Que se passe-t-il quand mon quota est atteint ?", a: "Les nouvelles duplications sont bloquées jusqu'au mois suivant. Passe à Pro pour l'illimité." },
        { q: "Un abonnement donne-t-il des tokens ?", a: "Oui, chaque plan inclut des tokens IA chaque mois (Claude intégré et Duplication IA). La Variation IA et le Scraper utilisent ton solde." },
      ],
      en: [
        { q: "What happens when I hit my quota?", a: "New duplications are blocked until next month. Upgrade to Pro for unlimited." },
        { q: "Does a subscription come with tokens?", a: "Yes, each plan includes AI tokens every month (built-in Claude and AI duplication). AI Variation and the Scraper use your balance." },
      ],
    },
  },

  /* ─────────────── Dépannage ─────────────── */
  {
    slug: "depannage",
    category: "account",
    app: ["/dashboard/support"],
    related: ["abonnement-et-tokens", "premiers-pas"],
    title: { fr: "Dépannage", en: "Troubleshooting" },
    summary: {
      fr: "Les problèmes les plus fréquents et comment les régler en une minute.",
      en: "The most common problems and how to fix them in a minute.",
    },
    sections: {
      fr: [
        { id: "duplication", title: "Duplication", blocks: [
          { type: "table", head: ["Problème", "Solution"], rows: [
            ["Ma vidéo a été ignorée", "Elle dépasse 2 minutes ou n'est pas dans un format accepté (MP4, MOV, MKV, AVI, WEBM). Coupe-la ou convertis-la."],
            ["« Fichier corrompu » ou échec sans raison", "Relance une fois : c'est souvent une surcharge passagère. Si ça recommence, réexporte la vidéo depuis ton téléphone ou ton logiciel de montage."],
            ["C'est très long", "Les vidéos 4K HDR d'iPhone en 60 i/s demandent plus de calcul. Exporte en 1080p pour aller plus vite, la qualité reste identique sur les réseaux."],
            ["Mes copies ont disparu", "Les fichiers sont temporaires : ~1 h pour la duplication classique, 5 jours pour la Duplication IA. Relance la duplication."],
          ] },
        ] },
        { id: "editeur", title: "Éditeur IA et Claude", blocks: [
          { type: "table", head: ["Problème", "Solution"], rows: [
            ["Claude ne voit pas ma matière", "Attends le badge « enregistré » sur chaque fichier, puis redemande à Claude de lister ta matière."],
            ["« Volume inclus épuisé »", "Les tokens IA inclus du mois sont utilisés : recharge des tokens, ou attends le mois suivant."],
          ] },
        ] },
        { id: "compte", title: "Compte et Google Drive", blocks: [
          { type: "table", head: ["Problème", "Solution"], rows: [
            ["« Envoyer vers Drive » ne marche pas", "Va dans **Paramètres → Google Drive** et reconnecte ton compte. Seul le propriétaire du compte peut le faire."],
            ["Mon paiement a échoué", "Mets à jour ta carte dans **Plan & token** : l'accès revient dès que le paiement passe."],
          ] },
        ] },
        { id: "contact", title: "Toujours bloqué ?", blocks: [
          { type: "p", text: "Écris-nous sur Telegram (**@DuupFlow_Support**) ou à **hello@duupflow.com**, avec une capture d'écran et le nom du fichier concerné." },
        ] },
      ],
      en: [
        { id: "duplication", title: "Duplication", blocks: [
          { type: "table", head: ["Problem", "Fix"], rows: [
            ["My video was skipped", "It's longer than 2 minutes or not in a supported format (MP4, MOV, MKV, AVI, WEBM). Trim or convert it."],
            ["“Corrupted file” or failure for no reason", "Try once more: it's often a temporary overload. If it happens again, re-export the video from your phone or editing software."],
            ["It's taking very long", "iPhone 4K HDR videos at 60 fps need more processing. Export in 1080p to go faster, quality looks the same on social media."],
            ["My copies are gone", "Files are temporary: ~1 h for classic duplication, 5 days for AI duplication. Run the duplication again."],
          ] },
        ] },
        { id: "editeur", title: "AI Editor and Claude", blocks: [
          { type: "table", head: ["Problem", "Fix"], rows: [
            ["Claude can't see my material", "Wait for the “saved” badge on each file, then ask Claude to list your material again."],
            ["“Included volume used up”", "This month's included AI tokens are used: top up tokens, or wait for next month."],
          ] },
        ] },
        { id: "compte", title: "Account and Google Drive", blocks: [
          { type: "table", head: ["Problem", "Fix"], rows: [
            ["“Send to Drive” doesn't work", "Go to **Settings → Google Drive** and reconnect your account. Only the account owner can do this."],
            ["My payment failed", "Update your card in **Plan & tokens**: access comes back as soon as the payment goes through."],
          ] },
        ] },
        { id: "contact", title: "Still stuck?", blocks: [
          { type: "p", text: "Message us on Telegram (**@DuupFlow_Support**) or at **hello@duupflow.com**, with a screenshot and the name of the file involved." },
        ] },
      ],
    },
    faq: { fr: [], en: [] },
  },
];

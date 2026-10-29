// Contenu de la documentation PUBLIQUE de l'API (/fr/docs/api, /en/docs/api).
//
// Écrit pour deux lecteurs : un développeur, et un assistant IA (ChatGPT,
// Claude…) à qui un prospect pose ses questions — tout ce qu'il faut pour
// répondre sans passer par le support est ici, factuel et vérifiable.
//
// ⚠️ À tenir à jour avec src/app/api/v1/** (limites, champs, codes d'erreur) et
// src/app/dashboard/developers/ApiParamsReference.tsx.
// ⚠️ Sécurité : rien d'interne ici — ni hébergeur, ni architecture, ni stockage
// des clés, ni identifiants. Seulement le contrat public de l'API.

export type Lang = "fr" | "en";

export type Block =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "code"; label?: string; code: string }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "callout"; tone: "info" | "warn"; text: string }
  | { type: "endpoint"; method: "GET" | "POST"; path: string; summary: string };

export type Section = { id: string; title: string; blocks: Block[] };

const BASE = "https://www.duupflow.com/api/v1";

const CURL_ME = `curl -H "Authorization: Bearer dflw_live_YOUR_KEY" \\
  ${BASE}/me`;

const CURL_IMG = `curl -X POST ${BASE}/images/duplicate \\
  -H "Authorization: Bearer dflw_live_YOUR_KEY" \\
  -F "file=@photo.jpg" \\
  -F "count=3" \\
  -F "iphone_meta=1" \\
  -o copies.zip`;

const CURL_VID = `curl -X POST ${BASE}/videos/duplicate \\
  -H "Authorization: Bearer dflw_live_YOUR_KEY" \\
  -F "file=@clip.mp4" \\
  -F "count=3" \\
  -F "packs=visual,motion,metadata_technical"`;

const RES_VID = `{
  "job_id": "3f1c…",
  "status": "queued",
  "poll_url": "${BASE}/jobs/3f1c…"
}`;

const RES_JOB = `{
  "id": "3f1c…",
  "type": "videos.duplicate",
  "status": "completed",
  "progress": 100,
  "message": "Done",
  "result": {
    "files": [
      { "name": "…_c01_….mp4", "bytes": 8123456, "url": "${BASE}/jobs/3f1c…/files/…_c01_….mp4" }
    ]
  },
  "error": null,
  "created_at": "2026-10-29T10:00:00Z"
}`;

const CURL_FILE = `curl -H "Authorization: Bearer dflw_live_YOUR_KEY" \\
  "${BASE}/jobs/JOB_ID/files/FILE_NAME" -o copy.mp4`;

const CURL_COMPRESS = `curl -X POST ${BASE}/compress \\
  -H "Authorization: Bearer dflw_live_YOUR_KEY" \\
  -F "file=@photo.jpg" -F "level=strong" -D headers.txt -o compressed.jpg`;

const CURL_AI = `curl -X POST ${BASE}/ai-detection \\
  -H "Authorization: Bearer dflw_live_YOUR_KEY" \\
  -F "file=@image.png" -o cleaned.png`;

const PY_FLOW = `import time, requests

API = "${BASE}"
H = {"Authorization": "Bearer dflw_live_YOUR_KEY"}

# 1) Start the job
with open("clip.mp4", "rb") as f:
    r = requests.post(f"{API}/videos/duplicate", headers=H,
                      files={"file": f}, data={"count": "3"})
r.raise_for_status()
job_id = r.json()["job_id"]

# 2) Poll until it's done
while True:
    job = requests.get(f"{API}/jobs/{job_id}", headers=H).json()
    if job["status"] in ("completed", "failed"):
        break
    time.sleep(8)

# 3) Download every copy
if job["status"] == "completed":
    for f in job["result"]["files"]:
        data = requests.get(f["url"], headers=H).content
        open(f["name"], "wb").write(data)
else:
    print("Failed:", job["error"])`;

const JS_FLOW = `const API = "${BASE}";
const H = { Authorization: "Bearer dflw_live_YOUR_KEY" };

const form = new FormData();
form.append("file", new Blob([await fs.promises.readFile("clip.mp4")]), "clip.mp4");
form.append("count", "3");

const { job_id } = await (await fetch(\`\${API}/videos/duplicate\`, { method: "POST", headers: H, body: form })).json();

let job;
do {
  await new Promise((r) => setTimeout(r, 8000));
  job = await (await fetch(\`\${API}/jobs/\${job_id}\`, { headers: H })).json();
} while (job.status === "queued" || job.status === "processing");

for (const f of job.result?.files ?? []) {
  const buf = Buffer.from(await (await fetch(f.url, { headers: H })).arrayBuffer());
  await fs.promises.writeFile(f.name, buf);
}`;

const ERR_JSON = `{ "error": { "code": "file_too_large", "message": "File exceeds the 150 MB limit." } }`;

export const META: Record<Lang, { title: string; description: string }> = {
  fr: {
    title: "Documentation API — DuupFlow",
    description:
      "Tout sur l'API DuupFlow : authentification, endpoints (images, vidéos, compression, détection IA), limites, erreurs, exemples et FAQ.",
  },
  en: {
    title: "API documentation — DuupFlow",
    description:
      "Everything about the DuupFlow API: authentication, endpoints (images, videos, compression, AI detection), limits, errors, examples and FAQ.",
  },
};

export const CANONICAL: Record<Lang, string> = { fr: "/fr/docs/api", en: "/en/docs/api" };

export const UI: Record<Lang, { label: string; h1: string; lead: string; toc: string; summaryTitle: string; cta: string; ctaSecondary: string; copy: string; copied: string }> = {
  fr: {
    label: "Documentation API",
    h1: "L'API DuupFlow, point par point",
    lead: "Duplique des images et des vidéos, compresse et retire la détection IA depuis tes propres outils (scripts, Make, n8n, Zapier, agents IA). Cette page contient tout ce qu'il faut savoir — y compris pour l'assistant IA à qui tu poses tes questions.",
    toc: "Sur cette page",
    summaryTitle: "Résumé (pour les humains et les assistants IA)",
    cta: "Voir les tarifs",
    ctaSecondary: "Parler au support",
    copy: "Copier",
    copied: "Copié",
  },
  en: {
    label: "API documentation",
    h1: "The DuupFlow API, step by step",
    lead: "Duplicate images and videos, compress, and remove AI detection from your own tools (scripts, Make, n8n, Zapier, AI agents). This page has everything you need to know — including for the AI assistant you ask your questions to.",
    toc: "On this page",
    summaryTitle: "Summary (for humans and AI assistants)",
    cta: "See pricing",
    ctaSecondary: "Talk to support",
    copy: "Copy",
    copied: "Copied",
  },
};

export const SUMMARY: Record<Lang, string[]> = {
  fr: [
    "API REST : `" + BASE + "`, authentification par en-tête `Authorization: Bearer dflw_live_…`.",
    "Incluse sans frais dans les plans **Pro** et **Agence** (pas dans Solo ni le plan gratuit). Duplications **illimitées** via l'API.",
    "Images : réponse **immédiate** (le fichier, ou un zip). Vidéos : **asynchrone** (un job à suivre, puis téléchargement).",
    "Limites : 300 requêtes/min par clé · 100 jobs vidéo en attente · images ≤ 25 Mo (1–20 copies) · vidéos ≤ 150 Mo et ≤ 120 s (1–10 copies).",
    "Formats vidéo : mp4, mov, mkv, avi, webm — le vertical 9:16 (Reels, TikTok, Shorts) est pris en charge, résolution et qualité conservées.",
    "Résultats téléchargeables pendant **16 h**. Webhook de fin de traitement : **en cours de développement** (pour l'instant, interroger le job toutes les 5–10 s).",
    "Pas d'essai gratuit de l'API ; le Pro mensuel est sans engagement. Une démo est possible via le support Telegram.",
  ],
  en: [
    "REST API: `" + BASE + "`, authenticated with the header `Authorization: Bearer dflw_live_…`.",
    "Included at no extra cost in the **Pro** and **Agency** plans (not in Solo or the free plan). **Unlimited** duplications through the API.",
    "Images: **immediate** response (the file, or a zip). Videos: **asynchronous** (a job to poll, then download).",
    "Limits: 300 requests/min per key · 100 pending video jobs · images ≤ 25 MB (1–20 copies) · videos ≤ 150 MB and ≤ 120 s (1–10 copies).",
    "Video formats: mp4, mov, mkv, avi, webm — vertical 9:16 (Reels, TikTok, Shorts) is supported, resolution and quality preserved.",
    "Results downloadable for **16 h**. Completion webhook: **in development** (for now, poll the job every 5–10 s).",
    "No free API trial; the monthly Pro plan has no commitment. A demo is available through Telegram support.",
  ],
};

export const SECTIONS: Record<Lang, Section[]> = {
  fr: [
    {
      id: "overview",
      title: "1. À quoi sert l'API",
      blocks: [
        { type: "p", text: "L'API donne accès, sans passer par le site, aux mêmes traitements que le dashboard DuupFlow :" },
        {
          type: "list",
          items: [
            "**Dupliquer une image** en 1 à 20 copies uniques (métadonnées, pixels invisibles, identité d'appareil).",
            "**Dupliquer une vidéo** en 1 à 10 copies uniques, identiques à l'œil.",
            "**Compresser une image** sans jamais l'alourdir.",
            "**Retirer la détection IA** d'une image, ou l'activer en option sur une duplication.",
          ],
        },
        { type: "p", text: "Cas typiques : automatiser un flux de publication multi-comptes, brancher DuupFlow dans Make / n8n / Zapier (module HTTP), ou laisser un agent IA (Claude Code, scripts) lancer les duplications." },
      ],
    },
    {
      id: "access",
      title: "2. Accès et tarifs",
      blocks: [
        {
          type: "table",
          head: ["Plan", "Accès API", "Prix indicatif"],
          rows: [
            ["Gratuit / Solo", "Non", "—"],
            ["Pro", "Oui, sans frais en plus", "99 €/mois, ou 70 €/mois en annuel"],
            ["Agence", "Oui, sans frais en plus", "249 €/mois, ou 176 €/mois en annuel"],
          ],
        },
        { type: "list", items: [
          "Les duplications via l'API sont **illimitées** sur Pro et Agence — pas de quota mensuel, pas de coût à l'appel.",
          "Les invités d'une équipe Pro ou Agence peuvent créer leurs propres clés.",
          "Pas d'essai gratuit de l'API. Le Pro mensuel est **sans engagement** (résiliable à tout moment). Une démo personnalisée est possible via le support Telegram.",
          "Les prix à jour sont toujours sur la page Tarifs.",
        ] },
      ],
    },
    {
      id: "quickstart",
      title: "3. Démarrage rapide",
      blocks: [
        {
          type: "steps",
          items: [
            "Passe sur le plan **Pro** ou **Agence**.",
            "Dans le dashboard, ouvre **Développeurs** et clique sur **Générer une clé**.",
            "**Copie la clé tout de suite** : elle n'est affichée qu'une seule fois.",
            "Vérifie qu'elle fonctionne avec `GET /me` (exemple ci-dessous).",
            "Lance ta première duplication.",
          ],
        },
        { type: "code", label: "Tester la clé", code: CURL_ME },
        { type: "code", label: "Réponse", code: `{ "user_id": "…", "plan": "pro", "api_version": "v1" }` },
      ],
    },
    {
      id: "auth",
      title: "4. Authentification et clés",
      blocks: [
        { type: "list", items: [
          "Chaque requête envoie l'en-tête `Authorization: Bearer dflw_live_…`.",
          "Jusqu'à **3 clés** par compte (une par intégration, par exemple).",
          "Une clé supprimée est **désactivée immédiatement** et ne peut pas être récupérée.",
          "Si l'abonnement passe sous le plan Pro ou se retrouve en défaut de paiement, l'API répond `403 plan_required` jusqu'à régularisation.",
        ] },
        { type: "callout", tone: "warn", text: "Une clé donne accès à ton compte : garde-la **côté serveur** (variables d'environnement, coffre de secrets). Ne la mets jamais dans du code front-end, une application mobile ou un dépôt public. En cas de fuite, supprime-la et génère-en une nouvelle." },
      ],
    },
    {
      id: "images",
      title: "5. Dupliquer une image",
      blocks: [
        { type: "endpoint", method: "POST", path: "/images/duplicate", summary: "Synchrone — renvoie directement le résultat." },
        {
          type: "table",
          head: ["Champ", "Valeur", "Défaut"],
          rows: [
            ["file", "Image png, jpg, jpeg, webp, gif, heic, heif — ≤ 25 Mo", "requis"],
            ["count", "Nombre de copies, 1 à 20", "1"],
            ["fundamentals", "Métadonnées réécrites", "1"],
            ["semi", "Retouche de pixels imperceptible", "1"],
            ["visuals", "Léger décalage visuel", "0"],
            ["reverse", "Effet miroir horizontal", "0"],
            ["iphone_meta", "Identité d'iPhone réaliste (EXIF Apple)", "0"],
            ["country", "Code pays ISO (ex. FR, US) pour la localisation", "—"],
            ["remove_ai_detection", "Retirer la détection IA avant duplication", "0"],
          ],
        },
        { type: "p", text: "**Réponse :** 1 copie → le fichier image directement ; plusieurs copies → une archive **zip**. Les noms de fichiers sont neutres (aucune mention de DuupFlow)." },
        { type: "code", label: "Exemple", code: CURL_IMG },
      ],
    },
    {
      id: "videos",
      title: "6. Dupliquer une vidéo (asynchrone)",
      blocks: [
        { type: "endpoint", method: "POST", path: "/videos/duplicate", summary: "Asynchrone — crée un job et répond 202 tout de suite." },
        {
          type: "table",
          head: ["Champ", "Valeur", "Défaut"],
          rows: [
            ["file", "Vidéo mp4, mov, mkv, avi, webm — ≤ 150 Mo et ≤ 120 s", "requis"],
            ["count", "Nombre de copies, 1 à 10", "1"],
            ["packs", "Liste séparée par des virgules : visual, motion, metadata_technical, pixel_magic", "visual,motion,metadata_technical"],
            ["country", "Code pays ISO pour les métadonnées de localisation", "—"],
            ["iphone_meta", "Métadonnées d'iPhone réalistes (sortie .mov, HEVC)", "0"],
            ["remove_ai_detection", "Contre-filigrane invisible, différent sur chaque copie", "0"],
          ],
        },
        { type: "list", items: [
          "**visual** : micro-variations de luminosité, contraste et couleur, invisibles à l'œil.",
          "**motion** : léger mouvement de caméra.",
          "**metadata_technical** : paramètres d'encodage et métadonnées techniques uniques.",
          "**pixel_magic** : bruit imperceptible pour une empreinte unique.",
        ] },
        { type: "p", text: "La résolution et la qualité d'origine sont conservées (4K comprise), et une copie n'est jamais plus lourde que la source. Le 9:16 vertical est pris en charge." },
        { type: "code", label: "Lancer le job", code: CURL_VID },
        { type: "code", label: "Réponse (202)", code: RES_VID },
      ],
    },
    {
      id: "jobs",
      title: "7. Suivre un job et télécharger",
      blocks: [
        { type: "endpoint", method: "GET", path: "/jobs/:id", summary: "État du job et liens de téléchargement." },
        { type: "list", items: [
          "`status` : `queued` → `processing` → `completed` ou `failed`.",
          "`progress` : 0 à 100 ; `message` : étape en cours.",
          "Quand `completed`, `result.files` liste chaque copie avec son `url`.",
          "Quand `failed`, `error` explique pourquoi (fichier illisible, trop long…).",
          "Si le serveur est momentanément saturé, le job est **relancé automatiquement** (il repasse en `queued`) — rien à faire de ton côté.",
        ] },
        { type: "code", label: "Réponse (terminé)", code: RES_JOB },
        { type: "endpoint", method: "GET", path: "/jobs/:id/files/:name", summary: "Télécharge une copie — avec la même clé API." },
        { type: "code", label: "Télécharger", code: CURL_FILE },
        { type: "callout", tone: "info", text: "Les fichiers produits restent disponibles **16 heures**, puis sont supprimés. Télécharge-les dès que le job est terminé. Un temps de traitement typique est de quelques dizaines de secondes à quelques minutes par vidéo, selon sa durée, sa résolution et la charge." },
      ],
    },
    {
      id: "flow",
      title: "8. Exemple complet (vidéo)",
      blocks: [
        { type: "code", label: "Python", code: PY_FLOW },
        { type: "code", label: "Node.js", code: JS_FLOW },
        { type: "p", text: "Dans Make, n8n ou Zapier : un module HTTP « multipart/form-data » pour lancer le job, une boucle avec temporisation (8 s) sur `GET /jobs/:id`, puis un module HTTP par fichier pour le télécharger." },
      ],
    },
    {
      id: "compress",
      title: "9. Compresser une image",
      blocks: [
        { type: "endpoint", method: "POST", path: "/compress", summary: "Synchrone — renvoie l'image compressée." },
        { type: "table", head: ["Champ", "Valeur", "Défaut"], rows: [
          ["file", "Image png, jpg, jpeg, webp — ≤ 25 Mo", "requis"],
          ["level", "light, balanced ou strong", "balanced"],
        ] },
        { type: "p", text: "Le résultat n'est **jamais plus lourd** que l'original (sinon l'original est renvoyé). Le gain est indiqué dans les en-têtes `X-DuupFlow-Saved-Percent`, `X-DuupFlow-Original-Bytes` et `X-DuupFlow-Output-Bytes`. La compression vidéo via l'API n'est pas encore disponible." },
        { type: "code", label: "Exemple", code: CURL_COMPRESS },
      ],
    },
    {
      id: "ai-detection",
      title: "10. Retirer la détection IA",
      blocks: [
        { type: "endpoint", method: "POST", path: "/ai-detection", summary: "Synchrone — renvoie l'image nettoyée." },
        { type: "p", text: "Efface les métadonnées de provenance IA (C2PA, XMP…) et retouche les pixels de façon invisible (grain, micro-flou, couleurs), en gardant le format et la résolution. Image jpg, png ou webp ≤ 25 Mo. Pour les vidéos, utilise l'option `remove_ai_detection` de `/videos/duplicate`." },
        { type: "callout", tone: "warn", text: "Soyons honnêtes : aucun outil ne peut garantir qu'un contenu ne sera jamais détecté. Un filigrane robuste intégré par certains générateurs (type SynthID) est conçu pour survivre à ce genre de traitement, et les plateformes utilisent aussi leurs propres classifieurs." },
        { type: "code", label: "Exemple", code: CURL_AI },
      ],
    },
    {
      id: "limits",
      title: "11. Limites",
      blocks: [
        { type: "table", head: ["Élément", "Limite"], rows: [
          ["Requêtes", "300 par minute et par clé"],
          ["Jobs vidéo en attente", "100 par compte"],
          ["Image — taille / copies", "25 Mo / 1 à 20 copies"],
          ["Vidéo — taille / durée / copies", "150 Mo / 120 s / 1 à 10 copies"],
          ["Conservation des résultats vidéo", "16 heures"],
          ["Clés API", "3 par compte"],
          ["Duplications", "Illimitées (Pro et Agence)"],
        ] },
      ],
    },
    {
      id: "errors",
      title: "12. Erreurs",
      blocks: [
        { type: "p", text: "Toutes les erreurs ont le même format JSON :" },
        { type: "code", code: ERR_JSON },
        { type: "table", head: ["HTTP", "code", "Que faire"], rows: [
          ["400", "invalid_body · missing_file · read_failed", "Envoyer un multipart/form-data avec un champ `file`."],
          ["401", "missing_key · invalid_key", "Vérifier l'en-tête Authorization et que la clé n'a pas été supprimée."],
          ["403", "plan_required", "Le compte doit être sur Pro ou Agence, paiement à jour."],
          ["404", "job_not_found · file_not_found", "Mauvais identifiant, ou résultat expiré (16 h)."],
          ["413", "file_too_large", "Réduire le fichier sous la limite."],
          ["415", "unsupported_type · video_not_supported", "Utiliser un format accepté (extension du fichier comprise)."],
          ["429", "rate_limited · too_many_jobs", "Attendre (en-tête Retry-After) puis réessayer."],
          ["500", "processing_failed · store_failed", "Réessayer ; si ça persiste, contacter le support."],
        ] },
      ],
    },
    {
      id: "best-practices",
      title: "13. Bonnes pratiques",
      blocks: [
        { type: "list", items: [
          "Interroger un job toutes les **5 à 10 secondes**, pas plus souvent.",
          "Sur 429 ou 5xx : réessayer avec un délai croissant (backoff).",
          "Garder la **bonne extension** dans le nom de fichier envoyé : c'est elle qui détermine le format.",
          "Télécharger les résultats dès la fin du job (ils expirent après 16 h).",
          "Une clé par intégration : en cas de problème, tu en coupes une sans casser les autres.",
          "Chaque appel produit des copies **différentes** : relancer la même source donne de nouvelles variantes.",
        ] },
      ],
    },
    {
      id: "webhooks",
      title: "14. Webhooks",
      blocks: [
        { type: "callout", tone: "info", text: "Une notification automatique (webhook) vers ton URL à la fin d'un job est **en cours de développement**. En attendant, interroge `GET /jobs/:id`." },
      ],
    },
    {
      id: "faq",
      title: "15. Questions fréquentes",
      blocks: [
        { type: "table", head: ["Question", "Réponse"], rows: [
          ["Peut-on tout automatiser sans toucher au site ?", "Oui. Une fois la clé créée, tout se fait par l'API."],
          ["Y a-t-il un coût par appel ou un quota ?", "Non. L'API est incluse dans Pro et Agence, duplications illimitées. Seules les limites techniques s'appliquent (section 11)."],
          ["Fonctionne avec Make, n8n, Zapier ?", "Oui, via leur module HTTP (multipart/form-data)."],
          ["Les vidéos verticales 9:16 sont-elles prises en charge ?", "Oui, et la résolution d'origine est conservée."],
          ["Une copie peut-elle être plus lourde que l'original ?", "Non, le débit est plafonné sur celui de la source."],
          ["Peut-on choisir un « créateur » (workspace) via l'API ?", "Non, l'API agit au niveau du compte. Les créateurs se gèrent dans le dashboard."],
          ["Peut-on enregistrer des réglages prédéfinis ?", "Il suffit de renvoyer les mêmes paramètres à chaque appel depuis ton script."],
          ["Combien de temps les fichiers sont-ils gardés ?", "Les résultats vidéo 16 h. Les fichiers envoyés sont supprimés après traitement."],
          ["Peut-on tester avant d'acheter ?", "Pas d'essai gratuit de l'API ; le Pro mensuel est sans engagement, et une démo est possible via le support."],
          ["Y a-t-il un webhook ?", "En cours de développement ; pour l'instant, polling de GET /jobs/:id."],
          ["La détection IA est-elle garantie ?", "Non, aucun outil ne peut le garantir (voir section 10)."],
          ["Où trouver de l'aide ?", "Support Telegram : t.me/DuupFlow_Support."],
        ] },
      ],
    },
  ],
  en: [
    {
      id: "overview",
      title: "1. What the API does",
      blocks: [
        { type: "p", text: "The API gives you access, without going through the website, to the same processing as the DuupFlow dashboard:" },
        { type: "list", items: [
          "**Duplicate an image** into 1 to 20 unique copies (metadata, invisible pixel changes, device identity).",
          "**Duplicate a video** into 1 to 10 unique copies that look identical.",
          "**Compress an image** without ever making it heavier.",
          "**Remove AI detection** from an image, or enable it as an option on a duplication.",
        ] },
        { type: "p", text: "Typical uses: automate a multi-account publishing flow, plug DuupFlow into Make / n8n / Zapier (HTTP module), or let an AI agent (Claude Code, scripts) run duplications." },
      ],
    },
    {
      id: "access",
      title: "2. Access and pricing",
      blocks: [
        { type: "table", head: ["Plan", "API access", "Indicative price"], rows: [
          ["Free / Solo", "No", "—"],
          ["Pro", "Yes, no extra cost", "€99/month, or €70/month billed yearly"],
          ["Agency", "Yes, no extra cost", "€249/month, or €176/month billed yearly"],
        ] },
        { type: "list", items: [
          "API duplications are **unlimited** on Pro and Agency — no monthly quota, no per-call cost.",
          "Guests of a Pro or Agency team can create their own keys.",
          "No free API trial. The monthly Pro plan has **no commitment** (cancel anytime). A personalised demo is available through Telegram support.",
          "Up-to-date prices are always on the Pricing page.",
        ] },
      ],
    },
    {
      id: "quickstart",
      title: "3. Quick start",
      blocks: [
        { type: "steps", items: [
          "Switch to the **Pro** or **Agency** plan.",
          "In the dashboard, open **Developers** and click **Generate a key**.",
          "**Copy the key right away**: it is shown only once.",
          "Check it works with `GET /me` (example below).",
          "Run your first duplication.",
        ] },
        { type: "code", label: "Test the key", code: CURL_ME },
        { type: "code", label: "Response", code: `{ "user_id": "…", "plan": "pro", "api_version": "v1" }` },
      ],
    },
    {
      id: "auth",
      title: "4. Authentication and keys",
      blocks: [
        { type: "list", items: [
          "Every request sends the header `Authorization: Bearer dflw_live_…`.",
          "Up to **3 keys** per account (one per integration, for example).",
          "A deleted key is **disabled immediately** and cannot be recovered.",
          "If the subscription drops below Pro or a payment is overdue, the API answers `403 plan_required` until it is resolved.",
        ] },
        { type: "callout", tone: "warn", text: "A key gives access to your account: keep it **server-side** (environment variables, secret manager). Never put it in front-end code, a mobile app or a public repository. If it leaks, delete it and generate a new one." },
      ],
    },
    {
      id: "images",
      title: "5. Duplicate an image",
      blocks: [
        { type: "endpoint", method: "POST", path: "/images/duplicate", summary: "Synchronous — returns the result directly." },
        { type: "table", head: ["Field", "Value", "Default"], rows: [
          ["file", "png, jpg, jpeg, webp, gif, heic, heif image — ≤ 25 MB", "required"],
          ["count", "Number of copies, 1 to 20", "1"],
          ["fundamentals", "Metadata rewritten", "1"],
          ["semi", "Imperceptible pixel change", "1"],
          ["visuals", "Subtle visual shift", "0"],
          ["reverse", "Horizontal mirror", "0"],
          ["iphone_meta", "Realistic iPhone identity (Apple EXIF)", "0"],
          ["country", "ISO country code (e.g. FR, US) for location", "—"],
          ["remove_ai_detection", "Remove AI detection before duplicating", "0"],
        ] },
        { type: "p", text: "**Response:** 1 copy → the image file directly; several copies → a **zip** archive. File names are neutral (no mention of DuupFlow)." },
        { type: "code", label: "Example", code: CURL_IMG },
      ],
    },
    {
      id: "videos",
      title: "6. Duplicate a video (asynchronous)",
      blocks: [
        { type: "endpoint", method: "POST", path: "/videos/duplicate", summary: "Asynchronous — creates a job and answers 202 right away." },
        { type: "table", head: ["Field", "Value", "Default"], rows: [
          ["file", "mp4, mov, mkv, avi, webm video — ≤ 150 MB and ≤ 120 s", "required"],
          ["count", "Number of copies, 1 to 10", "1"],
          ["packs", "Comma-separated list: visual, motion, metadata_technical, pixel_magic", "visual,motion,metadata_technical"],
          ["country", "ISO country code for location metadata", "—"],
          ["iphone_meta", "Realistic iPhone metadata (.mov output, HEVC)", "0"],
          ["remove_ai_detection", "Invisible counter-watermark, different on every copy", "0"],
        ] },
        { type: "list", items: [
          "**visual**: invisible micro-variations of brightness, contrast and colour.",
          "**motion**: subtle camera movement.",
          "**metadata_technical**: unique encoding parameters and technical metadata.",
          "**pixel_magic**: imperceptible noise for a unique fingerprint.",
        ] },
        { type: "p", text: "Original resolution and quality are preserved (4K included), and a copy is never heavier than the source. Vertical 9:16 is supported." },
        { type: "code", label: "Start the job", code: CURL_VID },
        { type: "code", label: "Response (202)", code: RES_VID },
      ],
    },
    {
      id: "jobs",
      title: "7. Track a job and download",
      blocks: [
        { type: "endpoint", method: "GET", path: "/jobs/:id", summary: "Job status and download links." },
        { type: "list", items: [
          "`status`: `queued` → `processing` → `completed` or `failed`.",
          "`progress`: 0 to 100; `message`: current step.",
          "When `completed`, `result.files` lists every copy with its `url`.",
          "When `failed`, `error` explains why (unreadable file, too long…).",
          "If the server is momentarily busy, the job is **retried automatically** (it goes back to `queued`) — nothing to do on your side.",
        ] },
        { type: "code", label: "Response (completed)", code: RES_JOB },
        { type: "endpoint", method: "GET", path: "/jobs/:id/files/:name", summary: "Downloads one copy — with the same API key." },
        { type: "code", label: "Download", code: CURL_FILE },
        { type: "callout", tone: "info", text: "Output files stay available for **16 hours**, then are deleted. Download them as soon as the job completes. Typical processing time is a few dozen seconds to a few minutes per video, depending on duration, resolution and load." },
      ],
    },
    {
      id: "flow",
      title: "8. Full example (video)",
      blocks: [
        { type: "code", label: "Python", code: PY_FLOW },
        { type: "code", label: "Node.js", code: JS_FLOW },
        { type: "p", text: "In Make, n8n or Zapier: an HTTP \"multipart/form-data\" module to start the job, a loop with an 8 s delay on `GET /jobs/:id`, then one HTTP module per file to download it." },
      ],
    },
    {
      id: "compress",
      title: "9. Compress an image",
      blocks: [
        { type: "endpoint", method: "POST", path: "/compress", summary: "Synchronous — returns the compressed image." },
        { type: "table", head: ["Field", "Value", "Default"], rows: [
          ["file", "png, jpg, jpeg, webp image — ≤ 25 MB", "required"],
          ["level", "light, balanced or strong", "balanced"],
        ] },
        { type: "p", text: "The result is **never heavier** than the original (otherwise the original is returned). Savings are reported in the `X-DuupFlow-Saved-Percent`, `X-DuupFlow-Original-Bytes` and `X-DuupFlow-Output-Bytes` headers. Video compression through the API is not available yet." },
        { type: "code", label: "Example", code: CURL_COMPRESS },
      ],
    },
    {
      id: "ai-detection",
      title: "10. Remove AI detection",
      blocks: [
        { type: "endpoint", method: "POST", path: "/ai-detection", summary: "Synchronous — returns the cleaned image." },
        { type: "p", text: "Erases AI provenance metadata (C2PA, XMP…) and invisibly retouches the pixels (grain, micro-blur, colours), keeping format and resolution. jpg, png or webp image ≤ 25 MB. For videos, use the `remove_ai_detection` option of `/videos/duplicate`." },
        { type: "callout", tone: "warn", text: "To be honest: no tool can guarantee content will never be detected. A robust watermark embedded by some generators (e.g. SynthID) is designed to survive this kind of processing, and platforms also run their own classifiers." },
        { type: "code", label: "Example", code: CURL_AI },
      ],
    },
    {
      id: "limits",
      title: "11. Limits",
      blocks: [
        { type: "table", head: ["Item", "Limit"], rows: [
          ["Requests", "300 per minute per key"],
          ["Pending video jobs", "100 per account"],
          ["Image — size / copies", "25 MB / 1 to 20 copies"],
          ["Video — size / duration / copies", "150 MB / 120 s / 1 to 10 copies"],
          ["Video result retention", "16 hours"],
          ["API keys", "3 per account"],
          ["Duplications", "Unlimited (Pro and Agency)"],
        ] },
      ],
    },
    {
      id: "errors",
      title: "12. Errors",
      blocks: [
        { type: "p", text: "Every error uses the same JSON format:" },
        { type: "code", code: ERR_JSON },
        { type: "table", head: ["HTTP", "code", "What to do"], rows: [
          ["400", "invalid_body · missing_file · read_failed", "Send multipart/form-data with a `file` field."],
          ["401", "missing_key · invalid_key", "Check the Authorization header and that the key wasn't deleted."],
          ["403", "plan_required", "The account must be on Pro or Agency, payment up to date."],
          ["404", "job_not_found · file_not_found", "Wrong id, or result expired (16 h)."],
          ["413", "file_too_large", "Bring the file under the limit."],
          ["415", "unsupported_type · video_not_supported", "Use an accepted format (file extension included)."],
          ["429", "rate_limited · too_many_jobs", "Wait (Retry-After header) then retry."],
          ["500", "processing_failed · store_failed", "Retry; if it persists, contact support."],
        ] },
      ],
    },
    {
      id: "best-practices",
      title: "13. Best practices",
      blocks: [
        { type: "list", items: [
          "Poll a job every **5 to 10 seconds**, not more often.",
          "On 429 or 5xx: retry with an increasing delay (backoff).",
          "Keep the **right extension** in the uploaded file name: it determines the format.",
          "Download results as soon as the job completes (they expire after 16 h).",
          "One key per integration: if something goes wrong, you revoke one without breaking the others.",
          "Every call produces **different** copies: running the same source again gives new variants.",
        ] },
      ],
    },
    {
      id: "webhooks",
      title: "14. Webhooks",
      blocks: [
        { type: "callout", tone: "info", text: "An automatic notification (webhook) to your URL when a job completes is **in development**. Meanwhile, poll `GET /jobs/:id`." },
      ],
    },
    {
      id: "faq",
      title: "15. FAQ",
      blocks: [
        { type: "table", head: ["Question", "Answer"], rows: [
          ["Can everything be automated without using the website?", "Yes. Once the key is created, everything goes through the API."],
          ["Is there a per-call cost or a quota?", "No. The API is included in Pro and Agency, unlimited duplications. Only the technical limits apply (section 11)."],
          ["Does it work with Make, n8n, Zapier?", "Yes, through their HTTP module (multipart/form-data)."],
          ["Are vertical 9:16 videos supported?", "Yes, and the original resolution is preserved."],
          ["Can a copy be heavier than the original?", "No, the bitrate is capped at the source's."],
          ["Can I target a \"creator\" (workspace) through the API?", "No, the API works at account level. Creators are managed in the dashboard."],
          ["Can I save presets?", "Just send the same parameters on every call from your script."],
          ["How long are files kept?", "Video results 16 h. Uploaded files are deleted after processing."],
          ["Can I test before buying?", "No free API trial; the monthly Pro plan has no commitment, and a demo is available through support."],
          ["Is there a webhook?", "In development; for now, poll GET /jobs/:id."],
          ["Is AI detection removal guaranteed?", "No, no tool can guarantee it (see section 10)."],
          ["Where can I get help?", "Telegram support: t.me/DuupFlow_Support."],
        ] },
      ],
    },
  ],
};

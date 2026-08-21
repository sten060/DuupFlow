# DuupFlow

**Republie la même vidéo sur plusieurs comptes sans te faire repérer.**

Un créateur qui poste le même reel sur 10 comptes Instagram ou TikTok se fait
signaler pour « contenu non original ». DuupFlow produit N copies d'un même
fichier qui sont techniquement différentes — métadonnées, encodage, micro-
variations d'image — tout en restant visuellement identiques à l'original.

Autour de ce cœur, le produit a grossi vers l'édition vidéo assistée par IA.

Production : **https://www.duupflow.com** (toujours avec le `www`)
Hébergement : **Railway** — déploiement automatique sur un push vers `main`.

---

## Démarrer

```bash
npm install
cp .env.example .env.local     # puis remplis les valeurs, voir plus bas
npm run dev                    # http://localhost:3000
```

**Next.js 14.2** (App Router) · **React 18.2** · **Node 20+** (développé sous
Node 24). ffmpeg est installé automatiquement au build par
`scripts/setup-ffmpeg.cjs`.

### Se connecter en local

L'authentification passe par des liens magiques par email, ce qui est pénible
en développement. Un raccourci existe :

1. va sur **`/dev-login`**
2. entre l'email d'un compte existant
3. tu es connecté, sans email

Bloqué en dur en production (`src/app/api/dev-login/route.ts`).

### ⚠️ Deux pièges à connaître

**Ne lance jamais `npm run build` pendant que `npm run dev` tourne.** Les deux
écrivent dans `.next/` et le corrompent. Symptôme : des erreurs de modules
introuvables qui n'ont aucun sens. Remède : `rm -rf .next`.

**`npm run lint` est cassé.** ESLint n'est déclaré dans aucune dépendance du
projet alors qu'un `eslint.config.mjs` existe. À réparer — mais attention,
`next build` lance ESLint : le réinstaller peut faire échouer le build sur du
code qui n'a jamais été vérifié. À tester en local avant de pousser.

---

## Ce qu'il y a dans le produit

Tout vit sous `/dashboard`. Les noms ci-dessous sont ceux du menu.

| Menu | Route | Ce que ça fait |
| --- | --- | --- |
| **Duplication** | `/dashboard/videos`, `/dashboard/images` | Le cœur. N copies uniques d'un fichier. |
| **Éditeur IA** | `/dashboard/ai-editor` | Reproduit le montage d'une vidéo de référence sur tes propres rushs. Piloté par Claude via un connecteur MCP. |
| **Scraper** | `/dashboard/import` | Récupère les meilleures vidéos d'un compte Instagram/TikTok (via Apify) pour les dupliquer. |
| **Compresseur** | `/dashboard/compress` | Allège une vidéo sans perte visible. |
| **Comparateur** | `/dashboard/similarity` | Mesure l'écart entre deux fichiers — sert à vérifier qu'une copie reste crédible. |
| **Variation IA** | `/dashboard/generate` | Génération d'images. |
| **Détection IA** | `/dashboard/ai-detection` | Estime si un contenu sera perçu comme généré par IA. |
| **Plan & tokens** | `/dashboard/abonnement` | Abonnement Stripe, quotas, consommation. |
| **Développeurs** | `/dashboard/developers` | Clés d'API publique (réservé au plan Pro). |

Autres espaces : `/[locale]/*` (site public, blog, tarifs, pages SEO),
`/admin/*` (affiliation, réservé à `ADMIN_USER_ID`), `/affiliate/*` (espace
affilié), `/api/v1/*` (API publique documentée).

---

## Comment c'est organisé

```
src/
  app/
    [locale]/      site public — landing, blog, tarifs, légal, pages SEO
    dashboard/     produit connecté (une page = un dossier)
    api/           80 routes — REST interne, webhooks, API publique v1
    admin/         administration affiliation
    studio/        ⚠️ MORT — voir « Dettes connues »
  lib/
    ai-editor/     moteur de montage IA — LIRE SON README AVANT DE TOUCHER
    studio/        ⚠️ MORT (sauf pipeline.ts, dont ai-editor dépend)
    supabase/      3 clients : navigateur, serveur, admin (service_role)
    i18n/          traductions fr/en
  components/
    landing/       chrome partagé du site public — LIRE SON README
    marketing/     pages de contenu (comparatifs, features)
    ui/            ⚠️ MORT — personne ne l'importe
supabase/migrations/   56 migrations SQL numérotées
scripts/               tests de non-régression + outillage
```

### Deux fichiers à lire avant de coder

- **`src/lib/ai-editor/README.md`** — la charte du moteur de montage. Le
  module le plus complexe du projet ; ne le modifie pas sans l'avoir lu.
- **`src/components/landing/README.md`** — les tokens de marque et le chrome
  partagé (`shell.tsx`). Une seule source de vérité pour la nav et le footer.

### Les commentaires sont de la documentation

Dans les zones délicates (rendu vidéo, couleur HDR, quotas), les commentaires
n'expliquent pas *ce que* fait le code — ils racontent **le bug qui a mené au
choix actuel**, avec sa date et son symptôme.

```ts
// ⚠ Les fichiers NON SONDABLES comptent comme non-HDR. Ils étaient écartés
// du décompte : un projet mêlant un rush HLG et un fichier dont la ligne
// couleur n'est pas lisible était déclaré « tout HDR »…
```

**Ne les supprime pas, et lis-les avant de « simplifier ».** Beaucoup de code
qui a l'air tordu l'est pour une raison écrite juste au-dessus.

---

## Base de données

PostgreSQL via Supabase. 56 migrations dans `supabase/migrations/`, numérotées
séquentiellement.

⚠️ **Les migrations ne sont PAS appliquées automatiquement.** Le script
`scripts/migrate.cjs` existe et tourne au `prestart`, mais `SUPABASE_DB_URL`
n'est pas renseignée en production : **elles sont appliquées à la main dans
l'éditeur SQL de Supabase.**

Conséquence directe : avant d'écrire dans une colonne ajoutée par une migration
récente, **vérifie qu'elle existe vraiment en production**. Une migration
oubliée a déjà cassé l'inscription.

---

## Tests

```bash
npx tsx scripts/ai-editor-render-e2e.mts   # moteur de rendu (vrais ffmpeg)
npx tsx scripts/ai-editor-color-e2e.mts    # couleur, HDR → SDR
npx tsx scripts/ai-editor-ref-e2e.mts      # analyse de référence (appelle Gemini)
```

**À lancer avant tout déploiement touchant `src/lib/ai-editor/`.** Chaque
régression trouvée en production doit devenir un cas permanent dans ces
harnais.

Il n'y a **aucun autre test** dans le projet. La duplication vidéo, la
facturation Stripe, les quotas et l'API publique n'ont pas de filet.

---

## Configuration

72 variables d'environnement, toutes listées et commentées dans
**`.env.example`**. Pour un développement local minimal, seuls les blocs
« SOCLE » et « SUPABASE » sont nécessaires : le reste dégrade proprement.

Les secrets vivent dans `.env.local` (jamais versionné) et dans les variables
Railway en production.

---

## Dettes connues

Écrit noir sur blanc pour que personne ne perde une journée dessus.

### 🔴 `/studio` est mort — 36 fichiers, 7 050 lignes

Un ancien générateur de reels, avec son propre moteur ffmpeg, son propre
système de jobs et ses propres composants. **Aucun lien n'y mène nulle part.**
Jamais terminé : 12 `TODO: brancher`, stockage local, données factices
(`src/lib/mock-data.ts`).

C'est l'ancêtre abandonné de l'éditeur IA, pas un module actif.

⚠️ **Un nœud avant de le supprimer :** `src/lib/ai-editor/render.ts` importe
`runFFmpeg` depuis `src/lib/studio/pipeline.ts`. Il faut déplacer ce fichier
d'abord, sinon on casse l'éditeur IA.

### 🔴 Pages sans lien entrant

- `/dashboard/enhance` : page complète, aucun lien vers elle. C'est aussi le
  seul consommateur de `REPLICATE_API_TOKEN` et de `src/lib/ai/enhance.ts`.
- `/dashboard/tokens` : remplacée, son contenu a migré dans `/dashboard/abonnement`.

Elles sont conservées pour l'instant : contrairement aux fichiers orphelins,
supprimer une page est une décision produit, pas un nettoyage.

> **Déjà nettoyé :** 29 fichiers jamais importés (2 819 lignes) ont été
> supprimés — anciens composants de landing, `VideoFormClient` remplacé par
> les variantes Simple/Advanced, un `Footer.tsx` mort qui se confondait avec
> le `SiteFooter.tsx` vivant, et un dossier `components/ui/` que personne
> n'importait mais qui laissait croire à un système de composants.

### 🟠 Fichiers très longs

`render.ts` (2 410 lignes), `processVideos.ts` (1 716),
`VideoFormAdvancedClient.tsx` (1 655), `mcp-tools.ts` (1 372),
`dashboard/actions.ts` (1 144).

Les deux premiers sont denses mais organisés et commentés — les découper est un
chantier, pas une urgence. **`dashboard/actions.ts` est un fourre-tout sans
thème** : c'est celui à découper en premier.

### 🟠 Un utilisateur nommé `"local"`

`resolveUserId()` (`src/app/dashboard/utils.ts:22`) renvoie la chaîne `"local"`
quand aucune session n'est trouvée, au lieu de refuser. Quinze modules en
dépendent.

Les endpoints facturés sont protégés par ailleurs (le contrôle de quota refuse
les anonymes), mais trois routes non facturées — dont une qui **supprime** des
fichiers — atterrissent dans un dossier partagé accessible sans compte.

### 🟠 Quatre implémentations ffmpeg

`lib/studio/pipeline.ts`, `lib/ai-editor/render.ts`,
`dashboard/videos/processVideos.ts`, `dashboard/similarity/probeActions.ts` —
chacune avec ses propres délais, threads et gestion d'erreur.

### 🟠 Le dépôt pèse 689 Mo

66 fichiers médias sont versionnés, dont deux vidéos de démonstration de 80 Mo.
L'historique Git les garde même après suppression : les retirer demande une
réécriture d'historique.

---

## Conventions

- **Français** dans les commentaires, les libellés produit et les messages
  d'erreur destinés à l'utilisateur. Anglais accepté dans le code technique.
- **`www.duupflow.com`** toujours avec le `www`, dans les liens comme dans la
  documentation.
- **Police par défaut** : General Sans (Fontshare), Inter en repli.
- **Textes produit** : jamais de pavé. Une phrase d'accroche, puis des puces,
  des paragraphes courts, un encadré si besoin.
- **Tous les libellés passent par `t()`**, jamais de texte en dur. Une
  exception traîne : « Scraper » dans `sidebar.tsx` — à traduire.
- **Ne jamais pousser sans validation explicite.** Une tâche à la fois.

# Éditeur IA — charte & architecture

> **La promesse** : *reproduis ce qui marche*. Le user donne une **référence**
> (une vidéo qui a marché) + sa **matière** (rushs, images, sons). Claude — via
> le connecteur MCP — perçoit la réf et la reproduit avec la matière du user.

> 📖 **L'analyse de référence (le cœur du produit) a sa propre doc pas-à-pas :
> [ANALYSE-REF.md](ANALYSE-REF.md)** — à mettre à jour DANS LE MÊME COMMIT que
> toute modification du pipeline. Ses seuils vivent dans
> [analysis-config.ts](analysis-config.ts). Test : `npx tsx scripts/ai-editor-ref-e2e.mts`.

## 📜 Les règles de la feature (ne pas dévier)

1. **La réf EST le template.** Pas de bibliothèque d'effets, pas de galerie de
   modèles, pas de presets imposés. Ce que Claude reproduit vient de la réf
   analysée, pas d'un catalogue.
2. **Des primitives composables, jamais des « effets nommés ».** On n'implémente
   pas « l'effet bulle OpusClip » ; on implémente *overlay + shape circle +
   carte de couleur* et Claude compose. Toute demande d'effet se traduit en
   « quelle primitive manque ? » — si aucune, c'est de la guidance.
3. **La barre : la STRUCTURE, pas le pixel-perfect.** Claude doit reproduire le
   layout, le rythme, le texte, les couleurs, les moments d'une réf. Le motion
   design lourd (3D, particules, morphings) est hors périmètre : on APPROXIME
   avec les primitives (get_reference marque « non reproductible »), on
   n'échoue pas.
4. **La matière du user, uniquement.** Jamais de stock, jamais de contenu
   généré, jamais d'asset externe. Pas d'asset adapté → pas d'effet. (B-roll
   compris.)
5. **Nettoyage du rush : on enlève le déchet, jamais le propos.** Blancs,
   hésitations, ratés, redites = coupés. Choix éditorial (réordonner, résumer,
   « meilleur passage ») = interdit.
6. **Sobriété par le moteur, pas par la confiance.** Claude sur-dose (grade,
   effets) → les bornes sont DANS le moteur (clamps gradeChain, budget
   d'entrées, durée max). La guidance prêche, le moteur garantit.
7. **Peu d'outils MCP, profonds.** `get_reference` (percevoir) ·
   `list_material`/`get_material` (la matière) · `create_variant`/
   `update_variant` (exécuter + itérer). On creuse ces outils, on n'en ajoute
   pas de nouveaux à la légère.
8. **La boucle fait la qualité.** create_variant renvoie keyframes + durée →
   Claude REGARDE et corrige. Toute primitive doit être observable dans les
   keyframes.

## 🗺 Architecture (qui fait quoi)

```
   user (DuupFlow UI)                    Claude du user (client MCP)
        │ upload réf + matière                   │ conversations
        ▼                                        ▼
   analyze.ts ──────────► store.ts ◄──────── mcp-tools.ts   ← outils MCP + schémas
   (à l'upload)          (projet/fichiers)       │           (= ce que Claude sait faire)
        │                                        ▼
        ├─ ref-profile.ts   mesures ffmpeg : coupes, beats/drops, énergie,
        │                   SILENCES précis (VAD ~23 ms), mouvement, couleur
        ├─ gemini.ts        compréhension (Gemini A REGARDÉ la vidéo) : plans,
        │                   captions lues à l'écran, transitions, layouts
        │                   (bulle/panneau), b-roll, « pourquoi ça marche »
        ├─ transcribe-*.ts  ASR verbatim : Deepgram → Groq → whisper local ;
        │                   mots horodatés (~ms) — base du nettoyage & des captions
        ▼
   render.ts        LE MOTEUR : exécute un EditPlan (ffmpeg 4.4 + sharp)
   plan-types.ts    LE VOCABULAIRE : types du plan (segments, captions,
                    overlays, grade…) — partagé moteur/schémas/futur édit manuel
   director.ts      variantes autonomes (mode sans Claude)
```

**Flux d'une variante** : Claude lit `get_reference` (perception en vocabulaire
de primitives) + `get_material` (matière, voix, blancs, reprises) → compose un
`EditPlan` → `create_variant` → `render.ts` exécute → keyframes → Claude itère.

## 🧱 Les primitives (résumé — détail dans plan-types.ts)

- **Segments** : coupes multi-fichiers, vitesse/freeze/rampe/reverse, recadrage
  (scale/offset), motion simulé, transitions (cut/fade/whip/slide/zoomPunch/
  flash/glitch), fondus noir/blanc, zoomPunch, secousses, flous de zone, grade.
- **Overlays** (dans un segment) : média OU **carte de couleur**, boîte w×h %
  (recadrage cover), **shape rect/square/circle** (bulle), coins arrondis
  (masque réel), opacité, zIndex, anims entrée/sortie. Patterns : speaker en
  bulle · panneau + liste · b-roll plein cadre (la voix continue) · split/pip.
- **Captions** : 6 polices, spans (couleur/police PAR MOT), styles outline/box/
  sticker, ombre, néon, anims entrée + **sortie**, wordByWord/karaoké calés sur
  les mots ASR, `words[].color`, **compteur animé**.
- **Audio** : piste musicale mix/replace, ducking, micro-fondus de couture
  (12 ms) à chaque jointure.

## ⚙️ Contraintes techniques (à connaître avant de coder)

- **Le moteur ffmpeg est choisi PAR CAPACITÉ, pas par ordre fixe**
  (`getFfmpegBin` dans `src/lib/studio/pipeline.ts`) : on prend le premier
  binaire qui possède les filtres requis (`xfade` = marqueur d'un ffmpeg ≥ 4.3),
  parmi `FFMPEG_BIN` → `ffmpeg-static` → PATH → `@ffmpeg-installer`. Aucun
  moderne trouvé → on garde l'ancien et on le dit BRUYAMMENT dans les logs.
  ⚠ Leçon coûteuse : la prod tournait sur `@ffmpeg-installer/linux-x64` figé en
  **4.1 (2018)** pendant que les tests locaux utilisaient 4.4/8.x. Résultat :
  toutes les transitions étaient silencieusement remplacées par des coupes
  (« No such filter: xfade ») et le moteur ancien produisait des montages faux
  (durées ×9) impossibles à reproduire en local. **Un filtergraph validé
  localement ne prouve RIEN si le binaire de prod diffère** — d'où la sélection
  par capacité et le cas de non-régression « transitions » dans le harnais.

- **Budget : 48 entrées ffmpeg max** par rendu (MAX_FFMPEG_INPUTS) — les
  features génératrices d'entrées (wordByWord, karaoké, compteur) doivent se
  DÉGRADER proprement, jamais faire échouer le rendu.
- **libx264 : dimensions PAIRES obligatoires** (yuv420p). Garde `trunc/2*2`.
- **Polices** : `public/fonts/*.ttf` + fontconfig restreint. Ajouter une
  famille = déposer le .ttf + 1 entrée FONT_FAMILY (render.ts). ⚠ Sur macOS la
  config est IGNORÉE (rendu polices non testable en local) ; en prod (Linux)
  elle fait foi.
- **Captions = SVG → PNG (sharp), pas drawtext** : testable en local
  (`captionPng` est exportée pour ça) — profites-en avant de livrer.
- **Rendu complet non testable en local** sans matière réelle : les changements
  de graphe se valident par filtergraphs isolés sur le binaire 4.4 + le test
  produit (Claude + keyframes).
- **Concurrence** : MAX_CONCURRENT_RENDERS (env AI_EDITOR_MAX_RENDERS).

## 🧰 Exigences de qualité de code (analyse & moteur)

Ce module est destiné à être repris par quelqu'un qui n'a pas participé à son
écriture (un autre Claude Code ou un humain). La structure est un livrable.

- **Une responsabilité par fichier** : analyze.ts orchestre, ref-profile.ts
  mesure (signal), gemini.ts comprend (vision), transcribe-\*.ts écoutent,
  render.ts exécute, mcp-tools.ts expose, plan-types.ts nomme.
- **Aucune constante magique** : tout seuil d'ANALYSE vit dans
  [analysis-config.ts](analysis-config.ts), nommé, avec la justification de sa
  valeur. Modifier un seuil = modifier sa justification.
- **Échecs BRUYANTS** : aucune dégradation silencieuse. Toute étape qui échoue
  pousse une `note` qui remonte jusqu'à `get_reference` (⚠️/🛑). Un try/catch
  qui avale une erreur sans la signaler est un bug.
- **Commentaires sur le POURQUOI** : « on rogne 50 ms pour protéger les
  attaques de syllabes », pas « boucle sur les frames ».
- **Docs à jour dans le même commit** : [ANALYSE-REF.md](ANALYSE-REF.md) pour
  le pipeline d'analyse, ce README pour la charte/architecture.
- **Tests reproductibles — À LANCER AVANT TOUT DÉPLOIEMENT** :
  - `npx tsx scripts/ai-editor-ref-e2e.mts` — chaîne d'ANALYSE de référence
    (fixture synthétique → Gemini → styles de captions détectés).
  - `npx tsx scripts/ai-editor-color-e2e.mts` — DÉCISIONS COULEUR (HDR iPhone) :
    matière mixte HDR+SDR reconnue, aucune étiquette HDR sur une sortie mixte,
    conversion tentée par fichier. ⚠ Vérifie les DÉCISIONS, pas le rendu : la
    conversion exige un ffmpeg avec `zscale`, absent de la plupart des postes —
    c'est précisément pourquoi le défaut a atteint la prod.
  - `npx tsx scripts/ai-editor-render-e2e.mts` — MOTEUR DE RENDU sur un projet
    jetable : durées vérifiées sur les 3 chemins (décodeur mutualisé, pré-rendu
    retimé, composite/b-roll), captions, montage à 39 micro-plans.
  ⚠ Leçon du 14/08 : tester des cas PURS ne suffit pas. Le cas « transitions »
  n'utilisait que des fondus ; en prod, un montage MÉLANGE cuts et transitions,
  et c'est le raccord entre les deux qui cassait (concat → xfade). Un harnais
  vert sur des cas purs peut masquer un défaut sur 100 % des rendus réels.
  Règle : **toute régression trouvée en prod devient un cas permanent** dans
  ces harnais, dans le même commit que le correctif. C'est ce qui manquait —
  un correctif de perf a cassé les effets de vitesse EN SILENCE, et personne ne
  l'a vu avant le déploiement.
- **Invariants plutôt que confiance** : le moteur vérifie APRÈS rendu que la
  durée du fichier correspond au plan (un écart = filtergraph faux → échec
  bruyant), et aucun message d'erreur ne peut être vide.

## ✅ Checklist « ajouter une primitive »

1. **Type** dans `plan-types.ts` (avec commentaire d'intention).
2. **Moteur** dans `render.ts` — bornes de sobriété DANS le code, dégradation
   propre si budget/erreur, filtergraph validé sur ffmpeg 4.4.
3. **Schéma MCP** dans `mcp-tools.ts` — description = guidance d'usage (quand,
   comment, exemples), pas juste la forme.
4. **Perception** si la réf peut la détecter : champ `GeminiShot`/prompt dans
   `gemini.ts` + ligne de sortie `get_reference` dans `mcp-tools.ts` qui MAPPE
   vers la primitive (« → overlays[]: {…} »).
5. **Test** : visuel local si possible (captions/sharp), filtergraph 4.4 sinon,
   puis un rendu produit réel via Claude.

## 🔭 Hors périmètre (décidé, ne pas re-débattre)

- Découpage long → clips (créer du contenu), voix off IA, calendrier social,
  analytics (couvert par Sten Insights) : **dehors**.
- Presets nommés / galerie de styles : mis de côté (la réf commande) — si un
  jour, c'est de la DONNÉE dans les descriptions MCP, pas des features.
- Recadrage/format auto : reporté (jugé non prioritaire).

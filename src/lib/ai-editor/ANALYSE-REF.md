# Analyse de référence — le pipeline de A à Z

> ⚠️ **RÈGLE ABSOLUE — LIRE AVANT DE MODIFIER** : cette page décrit le pipeline
> réel, étape par étape. **Toute modification du pipeline (nouvelle étape,
> nouveau champ, seuil déplacé, étape supprimée) DOIT être répercutée ici dans
> le même commit** — que la modification vienne de toi, d'un autre Claude Code
> ou d'un développeur humain. Une doc fausse est pire qu'aucune doc : le
> prochain intervenant s'y fiera. Même règle pour les seuils : ils vivent TOUS
> dans [analysis-config.ts](analysis-config.ts), jamais en dur dans le code.

**Pourquoi ce module est le cœur du produit** : la promesse est « reproduis ce
qui marche ». Tout ce que le moteur de rendu sait faire ne sert à rien si la
perception de la réf est fausse — Claude reproduirait un style deviné. La
qualité du rendu final est bornée par la qualité de cette analyse.

## Vue d'ensemble

```
UPLOAD RÉF (UI DuupFlow)
   └─► analyzeReferenceVideo()            [analyze.ts — ORCHESTRATEUR]
        ├─ 1. probe                        durée / résolution / fps / audio
        ├─ 2. sceneScores                  timecodes de COUPE (ffmpeg, seuil SCENE_CUT_THRESHOLD)
        ├─ 3. cutStrips                    bandes ±0,3 s autour de chaque coupe (pour Gemini)
        ├─ 4. ┌ compréhension Gemini       EN PARALLÈLE du reste (best-effort)
        │     │  [gemini.ts]               regarde le .mp4 : plans, CAPTIONS+STYLE,
        │     │                            transitions, layouts, b-roll, why-it-works
        ├─ 5. │ transcript                 Deepgram → Groq → whisper local
        │     │  [transcribe-*.ts]         phrases + MOTS horodatés (verbatim)
        ├─ 6. │ keyframes                  1 image au MILIEU de chaque plan + hook
        ├─ 7. │ shots + couleur            mouvement/intensité par plan, colorimétrie
        │     │  [ref-profile.ts]
        ├─ 8. └ audio                      beats, BPM, drops, énergie, SILENCES (~23 ms)
        └─► ReferenceAnalysis              stocké sur le projet [store.ts]

CLAUDE (connecteur MCP) appelle get_reference   [mcp-tools.ts]
   └─► formatage « prêt à consommer » : chaque mesure est exprimée dans les
       unités de create_variant, avec le mapping explicite (→ champ: valeur).
```

## Les étapes en détail

### 1. Probe (`analyze.ts` → `probe`)
`ffmpeg -i`, lecture du stderr : durée, largeur×hauteur, fps, présence audio.
Aucune décision ici — juste les faits.

### 2. Coupes (`sceneScores`, seuil `SCENE_CUT_THRESHOLD`)
Détection de changement de plan ffmpeg. Ces timecodes pilotent TROIS choses :
les bandes de coupes (étape 3), le choix des keyframes (étape 6) et le résumé
de rythme (`Rythme : N coupes · ~X s/plan`).

### 3. Bandes de coupes (`cutStrip`)
Pour chaque coupe : 6 vignettes sur ±0,3 s, en une seule image. C'est ce qui
permet à Gemini de qualifier la NATURE d'une transition (whip/flash/glitch…) —
un échantillonnage à 2 img/s ne voit pas un effet de 0,2 s.

### 4. Compréhension Gemini (`gemini.ts` → `analyzeReferenceWithGemini`)
**La couche qui lit le style.** Upload du .mp4 via la Files API, puis
`generateContent` avec un schéma structuré strict. Renvoie :
- `shots[]` : contenu, mouvement, vitesse, freeze, sujet, composition,
  incrustation (bulle/pip : forme, position, taille), panneau de couleur,
  b-roll, fondus, transition d'entrée, secousse, zones floutées ;
- `captions[]` : texte, timing, position, taille (@1080), **police (match sur
  le catalogue de rendu)**, **graisse (400/700/900)**, couleur, contour,
  **ombre douce**, fond/sticker, **alignement**, animation, néon,
  **emphase deux-tailles** (`emphasisText` ×`emphasisMul`) ;
- `cuts[]` : nature de chaque transition + confiance (+ `other` = non
  reproductible, à remonter en roadmap) ;
- `whyItWorks`, ducking, emojis.

**Modèle** : `GEMINI_DEFAULT_MODEL` (alias roulant `gemini-flash-latest` —
⚠️ Google RETIRE les modèles versionnés : `gemini-2.0-flash` est mort en 2026
et a rendu toute la couche muette pendant des semaines). Si l'alias échoue,
cascade sur les modèles listés par l'API, triés par un score (récent > flash >
non-lite > non-preview). Override : `AI_EDITOR_GEMINI_MODEL`.

**Best-effort MAIS BRUYANT** : tout échec → `comprehension: null` + une note
dans `analysis.notes`, et `get_reference` affiche alors `🛑 STYLES DE CAPTIONS
NON LUS` avec la consigne de ne PAS deviner et de prévenir le user. Un échec
silencieux ici a déjà coûté une session de test entière.

### 5. Transcript (`transcribe-deepgram.ts` → `transcribe-groq.ts` → local)
Même chaîne que pour la matière : Deepgram nova (VERBATIM : les reprises
restent, mots horodatés ~ms), repli Groq Whisper (+ prompt anti-lissage),
repli whisper.cpp local. Stocké : `phrases[]` + `fullText` + `words[]`.
Les mots servent à mesurer la cadence réelle de sous-titrage et à croiser
voix ↔ captions détectées.

### 6. Keyframes (`pickTimestamps` + `keyframeAt`)
**Au MILIEU de chaque plan** (bornes = coupes de l'étape 2) + une frame
« hook » très tôt. JAMAIS sur les coupes : une frame prise sur une coupe tombe
en pleine transition/animation → style illisible (un faux « bug d'opacité » a
été diagnostiqué deux fois à cause de ça). Qualité : `REF_KEYFRAME_WIDTH` px,
`-q:v REF_KEYFRAME_QV` (~JPEG 90) — le texte fin des captions doit rester
lisible. Max `REF_KEYFRAMES_MAX`.

### 7. Plans mesurés + colorimétrie (`ref-profile.ts`)
- `analyzeShots` : 2 frames par plan (début/fin) → classification du mouvement
  (static/zoom/pan/handheld) + intensité par diff de pixels. Si Gemini a
  répondu, c'est LUI l'autorité sur le TYPE de mouvement ; la mesure fournit
  l'INTENSITÉ (croisement fait dans mcp-tools).
- `analyzeColor` : saturation/luminosité/chaud-froid/N&B moyens → sert au
  `gradeSuggested` (écart réf↔matière, PAS valeur absolue de la réf).

### 8. Audio (`analyzeAudioBeats`)
PCM décodé une fois → beats (onsets), BPM, drops (ruptures), courbe d'énergie
0,25 s, et **silences précis** (RMS ~23 ms, seuil adaptatif au plancher de
bruit — constantes `SILENCE_*`). Les silences de la réf servent au snap des
mots ; ceux de la MATIÈRE pilotent le nettoyage de rush (blancs/micro-pauses).

### Sortie : get_reference (`mcp-tools.ts`)
Principe « gradeSuggested » partout : **mesurer, convertir dans les unités de
create_variant, donner le mapping explicite** (`→ strokeColor: "none"`,
`→ spans[]: fontSize base×1.6`, `→ overlays[]: { shape: "circle", … }`).
Zéro interprétation laissée au consommateur. En tête de sortie : les `notes`
(⚠️ ANALYSE PARTIELLE) et l'alerte compréhension absente le cas échéant.

## Modes de dégradation (tous BRUYANTS)

| Étape en échec | Conséquence | Signalement |
|---|---|---|
| Gemini (clé/modèle/réseau) | pas de styles de captions ni layouts | note + 🛑 dans get_reference |
| Transcript (3 replis) | pas de voix/mots | note « Transcription indisponible » |
| Coupes | rythme approximatif, keyframes régulières | note |
| Keyframes | pas d'images | note « vidéo illisible ? » |
| Audio | pas de beats/silences | note |

## Tester

```bash
npx tsx scripts/ai-editor-ref-e2e.mts
```
Fabrique une fausse réf (2 plans, 2 captions incrustées par le vrai moteur,
dont une emphase deux-tailles) et la passe dans la chaîne complète. Vérifie :
keyframes aux milieux, ≥ 2 captions détectées, emphase repérée, modèle Gemini
résolu. Clés lues dans `.env.local`. À faire tourner après TOUTE modification
du pipeline — et à enrichir si tu ajoutes une détection.

## Limites connues

- La précision des mesures Gemini (px, ratios) est ~±15 % — suffisant pour le
  style, pas du pixel-perfect. Si un jour c'est insuffisant sur des cas réels :
  la piste « OCR local » (PaddleOCR) est documentée dans l'historique, mais on
  a choisi de NE PAS l'implémenter (stack Python entière pour dupliquer le VLM).
- Le catalogue de polices borne le match (`font` = le plus PROCHE des familles
  de rendu). Ajouter une police : déposer le .ttf dans `public/fonts/` +
  `FONT_FAMILY` (render.ts) + l'énum du prompt/schéma (gemini.ts + mcp-tools).
- Les emojis lus par Gemini peuvent différer de l'original (👏 lu 🔥).
- `silences` / `words` n'existent que sur les analyses POSTÉRIEURES à leur
  ajout — une réf uploadée avant doit être ré-uploadée.
- Le disque Railway est ÉPHÉMÈRE : un déploiement efface les fichiers uploadés
  (les métadonnées survivent) → ré-upload nécessaire après chaque deploy.

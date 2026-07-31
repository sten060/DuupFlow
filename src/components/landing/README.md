# Branding DuupFlow — thème clair « Lunera »

Source de vérité du chrome partagé (nav, footer, tokens, smooth-scroll) :
**`src/components/landing/shell.tsx`**. La landing, le blog et la page contact
(`demo-request`) l'importent — un seul endroit à modifier.

## Couleurs (tokens dans `shell.tsx`)

| Token / usage            | Valeur                                                        |
| ------------------------ | ------------------------------------------------------------ |
| `BLUE` (accent primaire) | `#4686FE`                                                    |
| `INK` (texte principal)  | `#1a1a1a`                                                    |
| `GRAY` (texte secondaire)| `#605f5f` (sous-titres hero assombris en `#3a3f4b`)          |
| `CTA_GRAD` (boutons)     | `linear-gradient(135deg,#4f7bff,#7c5cff)` — bleu → violet    |
| Indigo (grille, halos)   | `rgba(99,102,241,…)`                                          |
| Champ de fond (page)     | `linear-gradient(to right,#b8d0ff,#c6bcf5)` — bleu → violet  |
| Fonds de section clairs  | `#f6f7f9`, `#f4f5f8`                                          |
| Cartes (grises)          | `linear-gradient(180deg,#fcfcfe,#f1f3f7)` + `ring-black/[0.06]` |
| Footer                   | bleu `#4074ff→#1a53ec` + voile violet `rgba(124,60,255,.55)` |

Le violet n'apparaît que dans les **accents** (CTA, vague, footer, halos), jamais
comme fond plein. Le fond de page bleu→violet est **horizontal** (`to right`) pour
que la vague animée se prolonge sans rupture verticale.

## Typographie

- Police : **Geist** (via la classe `.lunera`), fallback Inter. Mono : Fragment Mono (`.lunera-mono`).
- Titres : `font-semibold`, `tracking-[-0.03em]`, tailles en `clamp(...)`.
- Logo nav « DuupFlow » : `font-bold`.
- Corps : 15–19px, `text-[#605f5f]` / `#3a3f4b`.

## Composants partagés (`shell.tsx`)

- **`NavPill`** — nav fixe en pilule blanche (ring + ombre). Large au chargement,
  se réduit au 1er scroll. Logo infini + DuupFlow, liens (Fonctionnalités `/#features`,
  Blog, FAQ `/#faq`, Contact), icône login (`/login`) + bouton « Commencer » (`/pricing`).
- **`Footer`** — bloc bleu + voile violet, colonnes + newsletter + réseaux + wordmark
  géant « DuupFlow » (opacité 70 %, coupé en bas).
- **`SmoothScroll`** — lerp `0.13` (désactivé sur tactile).
- **`Label`** — petite pilule de section (`bg-black/[0.04]`, ring).

## Conventions de structure (par page)

```
<main className="lunera min-h-screen bg-white text-[#1a1a1a]">
  <SmoothScroll /> <NavPill />
  <section className="px-6 pt-36 sm:pt-44 …">   ← pt pour dégager la nav fixe
     <Label>…</Label>
     <h1 clamp(...) font-semibold tracking-[-0.03em]>
     …
  </section>
  <Footer />
</main>
```

- Cartes : `rounded-[28px]`, `ring-1 ring-black/[0.06]`, ombre douce
  `shadow-[0_18px_48px_rgba(20,40,90,0.10)]`.
- Boutons : pilule dégradé (`CTA_GRAD`) pour le primaire, pilule blanche + ring pour le secondaire.
- Flèche `→` sur les CTA, icône ✦/flèche possible.
- Grille « blueprint » (Features→Intégrations) : lignes `rgba(99,102,241,0.07)`,
  mailles `130px`, masque radial de fondu.

## Animations (dans `globals.css`)

`lunera-shine` (texte dégradé animé), `lunera-wave-x` (vague), `lunera-blob-*`
(halos), `lunera-float-*` (icônes réseaux flottantes). Toutes coupées en
`prefers-reduced-motion`.

## Layout

Les pages Lunera (`/`, `/blog`, `/demo-request`) masquent le Header marketing
global et le fond sombre via `ClientLayout` (`isLunera`).

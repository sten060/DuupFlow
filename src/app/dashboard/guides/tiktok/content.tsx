/* eslint-disable react/no-unescaped-entities */
import React from "react";
import type { Locale } from "@/lib/i18n/context";

/* ===========================================================================
   TikTok guide content — SINGLE SOURCE OF TRUTH.
   The page AND the side table-of-contents are generated from TIKTOK_GUIDE
   below, so adding / removing / reordering a chapter updates the TOC too.

   To edit copy: change the strings inside each `fr` / `en`. Keep the tags
   (<h3>, <p>, <ul>, <ol>, <strong>, <Callout>) for the premium styling.
   =========================================================================== */

/** Highlighted note box. tone="accent" (sky) for framing, "warn" (amber) for cautions. */
export function Callout({
  tone = "accent",
  children,
}: {
  tone?: "accent" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    tone === "warn"
      ? "border-amber-400/30 bg-amber-400/[0.06]"
      : "border-sky-400/30 bg-sky-400/[0.06]";
  return (
    <div className={`my-5 rounded-xl border ${cls} p-4 text-[15px] leading-relaxed text-white/85`}>
      {children}
    </div>
  );
}

export type GuideChapter = {
  id: string;
  num: string;
  title: Record<Locale, string>;
  lead: Record<Locale, string>;
  body: Record<Locale, React.ReactNode>;
};

export const TIKTOK_GUIDE: GuideChapter[] = [
  /* ---------------- PART 1 ---------------- */
  {
    id: "prevention",
    num: "01",
    title: {
      fr: "Prévention & templates TikTok",
      en: "Prevention & TikTok templates",
    },
    lead: {
      fr: "Maximise tes chances — sans te promettre l'impossible.",
      en: "Maximise your odds — without promising the impossible.",
    },
    body: {
      fr: (
        <>
          <Callout>
            <strong>Soyons clairs :</strong> le risque zéro n'existe pas. Aucun outil ne peut garantir
            qu'un repost passera — et quiconque te le promet te ment. Ce que ce guide et les templates
            de DuupFlow font, c'est <strong>maximiser ta marge</strong> : rendre ton contenu assez
            différent pour lui donner les meilleures chances de rester éligible. L'objectif, ce sont de
            meilleures probabilités, pas l'invisibilité.
          </Callout>

          <h3>Pourquoi TikTok détecte le contenu non-original aujourd'hui</h3>
          <p>
            Avant, TikTok comparait les fichiers — même empreinte de fichier, même hash audio, flag.
            Modifier les métadonnées suffisait à passer. Cette époque est révolue. TikTok analyse
            désormais le contenu lui-même : la scène, le mouvement, le son, ce qui est réellement à
            l'écran. C'est pour ça que changer simplement les propriétés d'un fichier ne marche plus —
            la plateforme reconnaît la même vidéo même si le fichier est techniquement différent. Pour
            rester éligible, le contenu doit vraiment paraître différent, pas juste être un autre fichier.
          </p>

          <h3>À quoi servent les templates SOFT et HARD</h3>
          <p>
            Le mode avancé de DuupFlow inclut deux templates prêts à l'emploi, conçus spécifiquement
            pour ce problème. Les deux appliquent de vraies transformations visuelles — recadrage
            dynamique, rotation progressive, zoom et micro-mouvements — qui changent ce que l'algorithme
            perçoit image par image, et c'est ça qui fait vraiment la différence aujourd'hui. Ce qui les
            distingue, c'est l'intensité.
          </p>

          <h3>SOFT ou HARD : laquelle choisir</h3>
          <ul>
            <li>
              <strong>SOFT</strong> — les transformations sont poussées juste à la limite de ce qui
              reste invisible. Tes spectateurs ne remarquent rien ; le contenu paraît intact. À utiliser
              quand préserver l'apparence exacte de ton contenu prime, et que tu acceptes une marge un
              peu plus faible contre la détection.
            </li>
            <li>
              <strong>HARD</strong> — les transformations vont plus loin et se voient. Le contenu est
              clairement modifié, mais ton sujet reste parfaitement reconnaissable et la vidéo reste
              publiable. À utiliser quand passer la détection compte plus que garder le contenu au pixel
              près.
            </li>
          </ul>
          <p>
            Règle simple : commence en <strong>SOFT</strong>. Si le contenu sur ce compte continue de se
            faire flag, passe en <strong>HARD</strong>.
          </p>

          <h3>Comment les appliquer</h3>
          <ol>
            <li>Ouvre <strong>Duplication Vidéo — Avancé</strong> et importe ta vidéo.</li>
            <li>Dans <strong>Templates</strong>, sélectionne <strong>TikTok SOFT</strong> ou <strong>TikTok HARD</strong>.</li>
            <li>Génère. Chaque copie sort avec une trajectoire de mouvement différente, donc les doublons ne sont pas identiques entre eux.</li>
          </ol>
        </>
      ),
      en: (
        <>
          <Callout>
            <strong>Honest framing:</strong> zero risk doesn't exist. No tool can guarantee a repost
            passes — and anyone promising that is lying to you. What this guide and DuupFlow's templates
            do is <strong>maximise your margin</strong>: make your content different enough to give it
            the best possible chance of staying eligible. The goal is better odds, not invisibility.
          </Callout>

          <h3>Why TikTok flags non-original content today</h3>
          <p>
            TikTok used to compare files — same file fingerprint, same audio hash, flagged. Tweaking
            metadata was enough to pass. That era is over. TikTok now analyses the content itself: the
            scene, the motion, the audio, what's actually on screen. This is why simply changing a file's
            properties no longer works — the platform recognises the same video even when the file is
            technically different. To stay eligible, the content has to actually look different, not just
            be a different file.
          </p>

          <h3>What the SOFT and HARD templates are for</h3>
          <p>
            DuupFlow's advanced mode includes two ready-made templates built specifically for this
            problem. Both apply real visual transformations — dynamic cropping, progressive rotation,
            zoom and micro-motion — that change what the algorithm perceives frame by frame, which is
            what actually moves the needle today. The difference between them is intensity.
          </p>

          <h3>SOFT or HARD: when to use which</h3>
          <ul>
            <li>
              <strong>SOFT</strong> — transformations are pushed right up to the edge of what stays
              invisible. Your viewers won't notice anything; the content looks untouched. Use it when
              preserving the exact look of your content matters most, and you accept a slightly smaller
              margin against detection.
            </li>
            <li>
              <strong>HARD</strong> — transformations go further and are visible. The content is clearly
              modified, but your subject stays fully recognisable and the video stays publishable. Use it
              when getting past detection matters more than keeping the content pixel-perfect.
            </li>
          </ul>
          <p>
            A simple rule: start <strong>SOFT</strong>. If content on that account keeps getting flagged,
            move to <strong>HARD</strong>.
          </p>

          <h3>How to apply them</h3>
          <ol>
            <li>Open <strong>Video Duplication — Advanced</strong> and upload your video.</li>
            <li>Under <strong>Templates</strong>, select <strong>TikTok SOFT</strong> or <strong>TikTok HARD</strong>.</li>
            <li>Generate. Each copy comes out with a different motion trajectory, so duplicates aren't identical to each other.</li>
          </ol>
        </>
      ),
    },
  },

  /* ---------------- PART 2 ---------------- */
  {
    id: "validated-posts",
    num: "02",
    title: {
      fr: "Maximise ton taux de posts validés",
      en: "Maximise your approved-post rate",
    },
    lead: {
      fr: "Un bon fichier sur un mauvais compte galérera quand même.",
      en: "A great file on a bad account will still struggle.",
    },
    body: {
      fr: (
        <>
          <Callout>
            Le template s'occupe de ton contenu. Cette section parle de tout ce que l'outil ne peut pas
            contrôler — ton compte et ton comportement — qui compte tout autant.
          </Callout>

          <h3>Les erreurs qui te font flag à coup sûr</h3>
          <ul>
            <li>
              <strong>Poster exactement le même audio sur plusieurs comptes.</strong> L'audio est l'un
              des signaux de correspondance les plus forts de TikTok, et la plupart des retouches
              visuelles n'y touchent pas. Si chaque variante porte la bande-son identique, tu laisses le
              signal le plus facile grand ouvert.
            </li>
            <li>
              <strong>Poster trop de variantes du même clip dans un court laps de temps.</strong> Même
              avec des montages différents, inonder le réseau de contenus quasi identiques invite la
              correspondance inter-comptes — TikTok recoupe les signaux entre comptes, pas seulement
              vidéo par vidéo.
            </li>
            <li>
              <strong>Réutiliser la même légende, le même hook et les mêmes hashtags sur chaque repost.</strong>{" "}
              Le texte fait partie de la façon dont le post est lu. Un emballage identique rend une série
              de reposts évidente.
            </li>
          </ul>

          <h3>Pourquoi un compte propre est essentiel</h3>
          <p>Un fichier modifié n'a une vraie chance que sur un compte sain. Deux choses comptent par-dessus tout :</p>
          <ul>
            <li>
              <strong>Pas de mauvais passif.</strong> Un compte déjà flag, restreint ou shadowban traîne
              ce poids dans chaque nouveau post. Un contenu propre n'efface pas un historique abîmé.
            </li>
            <li>
              <strong>Pas trop récent.</strong> Un compte tout neuf qui se met aussitôt à poster du
              contenu reposté en volume ressemble exactement à ce que TikTok est fait pour attraper.
              Laisse un nouveau compte exister d'abord — poste un peu d'activité normale, construis un
              minimum d'historique — avant d'y faire passer des reposts. En règle générale, accorde-lui
              au moins 1 à 2 semaines d'activité légère et normale avant de pousser des reposts.
            </li>
          </ul>

          <h3>TikTok surveille les comptes qu'il juge suspects</h3>
          <p>
            La détection ne porte pas que sur la vidéo — elle porte sur le comportement. La cadence de
            publication, les schémas d'engagement, la façon dont le compte a été créé, s'il se comporte
            comme un vrai utilisateur ou comme une automatisation. Un contenu bien monté sur un compte au
            comportement suspect sous-performera quand même. La vidéo n'est que la moitié de l'équation ;
            le compte est l'autre moitié.
          </p>

          <Callout tone="warn">
            <strong>Cadrage sain :</strong> l'objectif ici, ce sont des <strong>comptes sains</strong>,
            pas de duper la plateforme. Un compte qui se comporte comme un vrai créateur — rythme
            raisonnable, activité réelle, historique propre — c'est celui qui donne systématiquement à
            ton contenu sa meilleure chance.
          </Callout>
        </>
      ),
      en: (
        <>
          <Callout>
            The template handles your content. This section is about everything the tool can't control —
            your account and your behaviour — which matters just as much.
          </Callout>

          <h3>Mistakes that get you flagged every time</h3>
          <ul>
            <li>
              <strong>Posting the exact same audio across many accounts.</strong> Audio is one of
              TikTok's strongest matching signals, and most visual edits don't touch it. If every variant
              carries the identical soundtrack, you've left the easiest signal wide open.
            </li>
            <li>
              <strong>Posting too many variants of the same clip in a short window.</strong> Even with
              different edits, flooding the network with near-identical content invites cross-account
              matching — TikTok recoups signals between accounts, not just per video.
            </li>
            <li>
              <strong>Reusing the exact same caption, hook and hashtags on every repost.</strong> The
              text layer is part of how the post is read. Identical packaging makes a batch of reposts
              obvious.
            </li>
          </ul>

          <h3>Why a clean account matters</h3>
          <p>A modified file only gets a fair chance on a healthy account. Two things matter most:</p>
          <ul>
            <li>
              <strong>No bad history.</strong> An account that's already been flagged, restricted or
              shadowbanned carries that weight into every new post. Clean content won't undo a damaged
              track record.
            </li>
            <li>
              <strong>Not too new.</strong> A brand-new account that immediately starts posting reposted
              content at volume looks exactly like what TikTok is built to catch. Let a new account exist
              first — post some normal activity, build a minimal history — before you push reposts through
              it. As a baseline, give it at least 1–2 weeks of light, normal activity before pushing
              reposts through.
            </li>
          </ul>

          <h3>TikTok watches accounts it considers suspicious</h3>
          <p>
            Detection isn't only about the video — it's about behaviour. Posting cadence, engagement
            patterns, how the account was set up, whether it behaves like a real user or like an
            automation. Well-edited content on an account that behaves suspiciously will still
            underperform. The video is only half the equation; the account is the other half.
          </p>

          <Callout tone="warn">
            <strong>Healthy framing:</strong> the goal here is <strong>healthy accounts</strong>, not
            tricking the platform. An account that behaves like a genuine creator — reasonable pace, real
            activity, clean history — is one that consistently gives your content its best shot.
          </Callout>
        </>
      ),
    },
  },

  /* ---------------- PART 3 ---------------- */
  {
    id: "not-only-original",
    num: "03",
    title: {
      fr: "TikTok ne flag pas QUE le non-original",
      en: "TikTok doesn't ONLY flag non-original",
    },
    lead: {
      fr: "Avant d'accuser le « non-original », vérifie ton propre contenu.",
      en: "Before blaming 'non-original', check your own content.",
    },
    body: {
      fr: (
        <>
          <p>
            Quand un post devient inéligible, le réflexe est de se dire « TikTok a repéré mon repost ».
            Souvent, ce n'est pas ça du tout. L'avis d'inéligibilité de TikTok lui-même liste plusieurs
            raisons — et le non-original n'en est qu'une. Avant de dégainer un template plus agressif,
            écarte les causes plus simples.
          </p>

          <h3>Un contenu de basse qualité</h3>
          <p>
            TikTok déclasse le contenu qu'il juge de basse qualité, originalité ou pas. Vidéos très
            courtes, images fixes, basse résolution, gros artefacts de compression. Si ta source est
            déjà de mauvaise qualité, aucun template n'y remédie — et le flag n'a peut-être rien à voir
            avec l'originalité. Pars d'une source propre et en haute résolution.
          </p>

          <h3>Logos / watermarks d'autres plateformes</h3>
          <p>
            Un watermark d'une autre appli — un logo TikTok sur une vidéo réuploadée, un tampon CapCut,
            une marque Snap ou d'une autre plateforme — est traité comme un fort signal de non-original à
            lui seul. Tu peux transformer la vidéo parfaitement et te faire flag quand même si un
            watermark étranger traîne dans l'image. Vérifie chaque clip pour repérer les logos parasites
            avant de dupliquer.
          </p>

          <h3>Les QR codes</h3>
          <p>
            L'avis de TikTok mentionne explicitement les QR codes. Un QR code dans l'image peut
            déclencher l'inéligibilité à lui seul. Si ton contenu en contient un, c'est peut-être ça ton
            vrai problème — pas le repost.
          </p>

          <Callout>
            <strong>Message clé :</strong> avant d'accuser le « contenu non-original », vérifie d'abord
            l'état de ton propre contenu — <strong>qualité, watermarks, QR codes</strong>. Corriger l'un
            de ces points est souvent plus rapide et plus efficace que de pousser tes réglages de
            transformation plus haut.
          </Callout>
        </>
      ),
      en: (
        <>
          <p>
            When a post goes ineligible, the reflex is to assume "TikTok caught my repost." Often that's
            not it at all. TikTok's own ineligibility notice lists several reasons — and non-original is
            only one of them. Before you reach for a harder template, rule out the simpler causes.
          </p>

          <h3>Low-quality content</h3>
          <p>
            TikTok deprioritises content it judges low quality regardless of originality. Very short
            videos, static images, low resolution, heavy compression artefacts. If your source is already
            poor quality, no template fixes that — and the flag may have nothing to do with originality.
            Start from a clean, high-resolution source.
          </p>

          <h3>Logos / watermarks from other platforms</h3>
          <p>
            A watermark from another app — a TikTok logo on a re-uploaded video, a CapCut stamp, a Snap
            or other-platform mark — is treated as a strong non-original signal on its own. You can
            transform the video perfectly and still get flagged if a foreign watermark is sitting in the
            frame. Check every clip for stray logos before duplicating.
          </p>

          <h3>QR codes</h3>
          <p>
            TikTok's notice explicitly calls out QR codes. A QR code in-frame can trigger ineligibility
            by itself. If your content contains one, that may be your actual problem — not the repost.
          </p>

          <Callout>
            <strong>Key message:</strong> before blaming "non-original content", check the state of your
            own content first — <strong>quality, watermarks, QR codes</strong>. Fixing one of these is
            often faster and more effective than pushing your transformation settings higher.
          </Callout>
        </>
      ),
    },
  },
];

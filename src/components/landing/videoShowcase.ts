"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* ══════════════════════════════════════════════════════════════
 * Briques partagées des vidéos vitrine de la landing
 * (galerie d'outputs + sections fonctionnalités).
 *
 * Règle commune, non négociable pour la perf :
 *  - preload="none" + poster → zéro octet de vidéo avant l'écran
 *  - lecture déclenchée UNIQUEMENT par IntersectionObserver
 *  - pause dès la sortie du viewport
 *  - prefers-reduced-motion → poster seul, aucune lecture
 * ══════════════════════════════════════════════════════════════ */

/* Bucket public Supabase qui héberge les vidéos vitrine.
   Y déposer les MP4 (H.264, muet) et les posters, puis renseigner les
   constantes de contenu (OUTPUT_VIDEOS, FEATURE_SECTIONS). */
const SHOWCASE_BUCKET = "showcase";
const SHOWCASE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/${SHOWCASE_BUCKET}`;

/** Construit l'URL publique d'un fichier du bucket vitrine. */
export function showcaseUrl(file: string): string {
  return `${SHOWCASE_BASE}/${file}`;
}

/**
 * Passe à true la 1re fois que l'élément entre dans le viewport, et le reste.
 * Sert aux révélations au scroll (glissement, retournement des cartes).
 */
export function useInViewOnce<T extends HTMLElement>(rootMargin = "0px 0px -12% 0px", threshold = 0.15) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Filet : sans IntersectionObserver, on affiche plutôt que de tout cacher.
    if (typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold, rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin]);

  return { ref, shown };
}

/** true si l'utilisateur a demandé à réduire les animations. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * Créneau de lecture attribué par un `PlayBudget`. Sans budget, une vignette
 * joue dès qu'elle est visible ; avec, elle doit d'abord obtenir un créneau.
 */
export type PlayGate = {
  /** Demande un créneau. `retry` est rappelé si un créneau se libère plus tard. */
  acquire: (retry: () => void) => boolean;
  /** Rend le créneau détenu (ou annule la demande en attente). */
  release: () => void;
};

export type PlayBudget = { createGate: () => PlayGate };

/**
 * Plafonne le nombre de vidéos qui jouent en même temps. Indispensable dès
 * qu'un bandeau fait défiler des dizaines de vignettes : sans ça, tout ce qui
 * touche le viewport se met à décoder en parallèle.
 * Les vignettes recalées attendent leur tour et démarrent dès qu'une place
 * se libère — pas de sondage, tout passe par `release()`.
 */
export function usePlayBudget(max: number): PlayBudget {
  const active = useRef<Set<object>>(new Set());
  const waiting = useRef<Map<object, () => void>>(new Map());

  return useMemo(() => {
    const pump = () => {
      for (const [id, retry] of waiting.current) {
        if (active.current.size >= max) return;
        waiting.current.delete(id);
        active.current.add(id);
        retry();
      }
    };
    return {
      createGate(): PlayGate {
        const id = {};
        return {
          acquire(retry) {
            if (active.current.has(id)) return true;
            if (active.current.size < max) {
              active.current.add(id);
              return true;
            }
            waiting.current.set(id, retry);
            return false;
          },
          release() {
            const held = active.current.delete(id);
            waiting.current.delete(id);
            if (held) pump();
          },
        };
      },
    };
  }, [max]);
}

/**
 * Branche une <video> sur le viewport : elle ne charge et ne joue qu'une fois
 * visible, et se met en pause dès qu'elle sort. `playing` sert à masquer le
 * voile / la pastille de lecture posés par-dessus.
 * `gate` (optionnel) fait passer la lecture par un budget partagé.
 */
export function useLoopInView(reduced: boolean, threshold = 0.35, gate?: PlayGate) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      // Réglage activé en cours de route : on stoppe et on retombe sur le poster.
      el.pause();
      setPlaying(false);
      return;
    }
    // 1re lecture : c'est seulement ici que le fichier commence à être chargé.
    const start = () => { el.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (!gate || gate.acquire(start)) start();
        } else {
          el.pause();
          setPlaying(false);
          gate?.release();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => { io.disconnect(); gate?.release(); };
  }, [reduced, threshold, gate]);

  return { ref, playing };
}

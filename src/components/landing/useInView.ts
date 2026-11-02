"use client";

import { useEffect, useRef, useState } from "react";

/* Vrai tant que l'élément est (presque) à l'écran. Sert à couper les animations
   et les boucles de la landing hors champ : rien ne tourne pour rien.
   À coupler avec la classe `.anim-paused` (globals.css) sur le conteneur. */
export function useInView<T extends HTMLElement>(margin = "200px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return { ref, inView };
}

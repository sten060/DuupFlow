"use client";

import { useEffect, useRef } from "react";

interface Carousel3DProps {
  cards: { title: string; desc: string; gradient: string; tags: string[]; mockupHtml?: string }[];
  cardWidth?: number;
  cardAspectRatio?: number;
  borderRadius?: number;
  gap?: number;
  perspective?: number;
  maxRotation?: number;
  maxDepth?: number;
  friction?: number;
  backgroundColor?: string;
  style?: React.CSSProperties;
}

export default function Carousel3D({
  cards,
  cardWidth = 340,
  cardAspectRatio = 0.75,
  borderRadius = 12,
  gap = 24,
  perspective = 1800,
  maxRotation = 28,
  maxDepth = 140,
  friction = 0.9,
  backgroundColor = "transparent",
  style,
}: Carousel3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const cardsRoot = cardsRootRef.current;
    if (!container || !cardsRoot) return;

    const minScale = 0.92;
    const scaleRange = 0.1;
    const cardBlurIntensity = 2;

    let CARD_W = cardWidth;
    let STEP = CARD_W + gap;
    let TRACK = cards.length * STEP;
    let SCROLL_X = 0;
    let VW_HALF = container.clientWidth * 0.5;
    let vX = 0;
    let rafId: number | null = null;
    let lastTime = 0;
    let activeIndex = -1;

    // Create card elements
    cardsRoot.innerHTML = "";
    const fragment = document.createDocumentFragment();

    cards.forEach((card, i) => {
      const el = document.createElement("div");
      el.style.cssText = `
        position: absolute;
        top: 50%; left: 50%;
        width: ${cardWidth}px;
        aspect-ratio: ${cardAspectRatio};
        transform-style: preserve-3d;
        backface-visibility: hidden;
        will-change: transform, filter;
        transform-origin: 90% center;
        contain: layout paint;
        border-radius: ${borderRadius}px;
        overflow: hidden;
        background: ${card.gradient};
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
      `;

      // Card content — mockup (70%) + text (30%)
      el.innerHTML = `
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; position: relative; z-index: 2;">
          ${card.mockupHtml || ""}
        </div>
        <div style="padding: 16px 20px 20px; position: relative; z-index: 2; background: linear-gradient(0deg, rgba(0,0,0,0.4) 0%, transparent 100%);">
          <div style="font-size: 14px; font-weight: 600; color: white; margin-bottom: 4px;">${card.title}</div>
          <div style="font-size: 11px; color: rgba(255,255,255,0.55); line-height: 1.5; margin-bottom: 8px;">${card.desc}</div>
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            ${card.tags.map((t) => `<span style="font-size: 9px; padding: 3px 7px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); border-radius: 3px;">${t}</span>`).join("")}
          </div>
        </div>
      `;

      fragment.appendChild(el);
    });

    cardsRoot.appendChild(fragment);

    const items = Array.from(cardsRoot.children) as HTMLElement[];
    const positions = new Float32Array(items.length);

    function mod(n: number, m: number) {
      return ((n % m) + m) % m;
    }

    function updateTransforms() {
      const half = TRACK / 2;
      for (let i = 0; i < items.length; i++) {
        let pos = i * STEP - SCROLL_X;
        if (pos < -half) pos += TRACK;
        if (pos > half) pos -= TRACK;
        positions[i] = pos;

        const norm = Math.max(-1, Math.min(1, pos / VW_HALF));
        const absNorm = Math.abs(norm);
        const invNorm = 1 - absNorm;
        const ry = -norm * maxRotation;
        const tz = invNorm * maxDepth;
        const scale = minScale + invNorm * scaleRange;

        items[i].style.transform = `translate3d(${pos}px,-50%,${tz}px) rotateY(${ry}deg) scale(${scale})`;
        items[i].style.zIndex = String(1000 + Math.round(tz));

        const blur = absNorm < 0.3 ? 0 : cardBlurIntensity * Math.pow(absNorm, 1.1);
        items[i].style.filter = blur > 0.1 ? `blur(${blur.toFixed(1)}px)` : "none";
      }
    }

    function tick(t: number) {
      const dt = lastTime ? Math.min((t - lastTime) / 1000, 0.1) : 0;
      lastTime = t;
      if (Math.abs(vX) > 0.02) {
        SCROLL_X = mod(SCROLL_X + vX * dt, TRACK);
        vX *= Math.pow(friction, dt * 60);
        if (Math.abs(vX) < 0.02) vX = 0;
        updateTransforms();
      }
      rafId = requestAnimationFrame(tick);
    }

    // Entry animation — simple fade + slide up
    items.forEach((el, i) => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.6s ease";
      setTimeout(() => {
        el.style.opacity = "1";
      }, 100 + i * 60);
    });

    updateTransforms();
    rafId = requestAnimationFrame(tick);

    // Wheel handler
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      vX += delta * 0.6 * 20;
    };

    // Drag handlers
    let dragging = false;
    let lastX = 0;
    let lastDelta = 0;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastDelta = 0;
      container.setPointerCapture(e.pointerId);
      container.style.cursor = "grabbing";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      SCROLL_X = mod(SCROLL_X - dx, TRACK);
      lastDelta = dx / 0.016;
      lastX = e.clientX;
      updateTransforms();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      container.releasePointerCapture(e.pointerId);
      vX = -lastDelta;
      container.style.cursor = "grab";
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerUp);
    container.addEventListener("dragstart", (e) => e.preventDefault());

    const ro = new ResizeObserver(() => {
      VW_HALF = container.clientWidth * 0.5;
      updateTransforms();
    });
    ro.observe(container);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);
      ro.disconnect();
      cardsRoot.innerHTML = "";
    };
  }, [cards, cardWidth, cardAspectRatio, borderRadius, gap, perspective, maxRotation, maxDepth, friction]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: backgroundColor,
        overflow: "hidden",
        perspective: `${perspective}px`,
        overscrollBehavior: "none",
        userSelect: "none",
        cursor: "grab",
        touchAction: "none",
        ...style,
      }}
    >
      <div
        ref={cardsRootRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
          transformStyle: "preserve-3d",
        }}
      />
    </div>
  );
}

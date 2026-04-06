"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

const STEPS = [
  {
    num: "01",
    title: "Importe ton contenu",
    desc: "Glisse-d\u00e9pose ton image ou ta vid\u00e9o dans DuupFlow. JPG, PNG, WEBP, MP4, MOV, MKV \u2014 tous les formats sont accept\u00e9s, m\u00eame en lot.",
    tag: "Upload",
  },
  {
    num: "02",
    title: "Duplique en illimit\u00e9",
    desc: "Choisis le nombre de copies et les options (visuel, semi-visuel, m\u00e9tadonn\u00e9es). DuupFlow modifie chaque fichier pour qu\u2019il soit unique aux yeux des algorithmes de d\u00e9tection.",
    tag: "Duplication",
  },
  {
    num: "03",
    title: "T\u00e9l\u00e9charge et publie",
    desc: "Exporte tes contenus en ZIP ou un par un. Chaque fichier est pr\u00eat \u00e0 \u00eatre publi\u00e9 sur Instagram, TikTok, YouTube, Twitter/X ou n\u2019importe quelle plateforme.",
    tag: "Export",
  },
];

const SPEED = 5; // seconds per card

function CardShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    const tick = 16;
    const increment = (100 / (SPEED * 1000)) * tick;

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          setActiveIndex((i) => (i + 1) % STEPS.length);
          return 0;
        }
        return next;
      });
    }, tick);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeIndex, isMobile]);

  const handleClick = (index: number) => {
    if (isMobile) return;
    setActiveIndex(index);
    setProgress(0);
  };

  // ── Mobile: vertical stack ──
  if (isMobile) {
    return (
      <div className="flex flex-col gap-5">
        {STEPS.map((card, i) => (
          <div
            key={i}
            className="border border-white/[0.08] p-5"
            style={{ background: "rgba(8,12,35,0.6)" }}
          >
            <div className="text-3xl font-bold text-indigo-400/40 mb-3 tracking-tight">{card.num}</div>
            <h3 className="text-lg font-semibold text-white mb-2">{card.title}</h3>
            <p className="text-sm text-white/50 leading-relaxed mb-3">{card.desc}</p>
            <span className="text-xs text-indigo-400 font-medium">{card.tag}</span>
          </div>
        ))}
      </div>
    );
  }

  // ── Desktop: interactive expanding cards ──
  return (
    <div className="flex gap-0 w-full" style={{ height: "420px" }}>
      {STEPS.map((card, i) => {
        const isActive = i === activeIndex;
        return (
          <div
            key={i}
            onClick={() => handleClick(i)}
            className="relative cursor-pointer border border-white/[0.08] p-6 overflow-hidden"
            style={{
              background: "rgba(8,12,35,0.6)",
              flex: isActive ? 2.5 : 1,
              transition: "flex 0.5s ease-in-out",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Progress bar — left edge */}
            <div
              className="absolute bottom-0 left-0 w-[2px]"
              style={{ height: "100%", background: "rgba(255,255,255,0.06)" }}
            >
              {isActive && (
                <div
                  className="absolute bottom-0 left-0 w-full"
                  style={{
                    height: `${progress}%`,
                    background: "linear-gradient(to top, #6366F1, #818CF8)",
                    transition: "height 16ms linear",
                  }}
                />
              )}
            </div>

            {/* Number */}
            <div
              className="text-4xl font-bold tracking-tight mb-3"
              style={{
                color: isActive ? "rgba(129,140,248,0.6)" : "rgba(129,140,248,0.25)",
                transition: "color 0.3s",
              }}
            >
              {card.num}
            </div>

            {/* Title */}
            <h3
              className="text-lg font-semibold mb-3"
              style={{
                color: isActive ? "white" : "rgba(255,255,255,0.5)",
                transition: "color 0.3s",
              }}
            >
              {card.title}
            </h3>

            {/* Description + tag — only visible when active */}
            <div
              style={{
                opacity: isActive ? 1 : 0,
                maxHeight: isActive ? "300px" : "0px",
                overflow: "hidden",
                transition: "opacity 0.3s ease, max-height 0.4s ease",
                display: "flex",
                flexDirection: "column",
                flex: 1,
                justifyContent: "space-between",
              }}
            >
              <p className="text-sm text-white/60 leading-relaxed">{card.desc}</p>
              <span className="text-xs text-indigo-400 font-medium mt-4">{card.tag}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CommentCaMarche() {
  return (
    <div className="min-h-screen px-6 py-24">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-400 mb-3">
          Comment \u00e7a marche
        </p>
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-5 tracking-tight">
          DuupFlow s&apos;int\u00e8gre dans ton workflow{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent">
            en 3 \u00e9tapes.
          </span>
        </h1>
        <p className="text-white/45 text-lg mb-16 max-w-xl">
          Simple, rapide, sans courbe d&apos;apprentissage. Tu es op\u00e9rationnel en moins de 2 minutes.
        </p>

        {/* Card Showcase */}
        <CardShowcase />

        {/* Detail cards */}
        <div className="mt-24 grid md:grid-cols-3 gap-6">
          <div className="border border-indigo-500/20 bg-indigo-500/[0.04] p-6">
            <div className="text-2xl mb-4">\ud83d\uddbc\ufe0f</div>
            <h3 className="font-semibold text-white mb-2">Formats support\u00e9s</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              Images : JPG, PNG, WEBP, HEIC<br />
              Vid\u00e9os : MP4, MOV, MKV, AVI, WebM
            </p>
          </div>
          <div className="border border-sky-500/20 bg-sky-500/[0.04] p-6">
            <div className="text-2xl mb-4">\u26a1</div>
            <h3 className="font-semibold text-white mb-2">Traitement rapide</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              G\u00e9n\u00e8re des dizaines de copies en quelques secondes. Traitement local pour les images, cloud pour les vid\u00e9os.
            </p>
          </div>
          <div className="border border-emerald-500/20 bg-emerald-500/[0.04] p-6">
            <div className="text-2xl mb-4">\ud83d\udce6</div>
            <h3 className="font-semibold text-white mb-2">Export flexible</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              T\u00e9l\u00e9charge fichier par fichier ou tout d&apos;un coup en ZIP. Compatible avec tous les outils de scheduling.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 font-semibold text-white text-sm transition hover:opacity-90 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            Essayer DuupFlow gratuitement \u2192
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 px-8 py-4 font-semibold text-white/70 hover:text-white text-sm transition border border-white/15 hover:border-white/30 hover:bg-white/[0.04]"
          >
            Voir la d\u00e9mo
          </Link>
        </div>
      </div>
    </div>
  );
}

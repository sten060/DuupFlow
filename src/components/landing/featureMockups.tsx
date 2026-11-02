"use client";

import { BLUE, CTA_GRAD } from "@/components/landing/shell";
import { useEffect, useRef } from "react";
import { useLoopInView } from "@/components/landing/videoShowcase";

/* ══════════════════════════════════════════════════════════════
 * MOCKUPS ANIMÉS — ce que fait le produit, montré plutôt que décrit.
 * 100% CSS (keyframes duup-* dans globals.css), aucun média chargé,
 * et tout se fige proprement sous prefers-reduced-motion.
 * ══════════════════════════════════════════════════════════════ */

const CHROME_DOT = "h-2 w-2 rounded-full";

/* Barre de fenêtre commune aux deux grands mockups. */
function Chrome({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-black/[0.06] px-3.5 py-2.5">
      <span className={`${CHROME_DOT} bg-[#e5e8ef]`} />
      <span className={`${CHROME_DOT} bg-[#e5e8ef]`} />
      <span className={`${CHROME_DOT} bg-[#e5e8ef]`} />
      <span className="ml-1.5 text-[11px] font-semibold text-[#1a1a1a]">{title}</span>
      {badge && (
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#4686FE]/10 px-2 py-0.5 text-[9px] font-semibold" style={{ color: BLUE }}>
          <span className="duup-breathe h-1.5 w-1.5 rounded-full" style={{ background: BLUE }} />
          {badge}
        </span>
      )}
    </div>
  );
}

/* ─── ÉDITEUR IA ───
   Une seule conversation continue avec Claude, cycle de 14 s : le fil à gauche
   défile comme un vrai chat (chaque message s'ouvre et pousse les précédents vers
   le haut), l'aperçu à droite évolue en parallèle — vide → montage → vidéo finie.
     1) le user dépose sa réf + ses rushes ; 2) il écrit sa consigne et l'envoie ;
     3) Claude monte (barre + aperçu qui se construit) ; 4) « Ta vidéo est prête » ;
     5) le user demande 3 variantes ; 6) Claude les livre.
   Une « caméra » (duup-ae-cam) zoome sur le fil dès la saisie de la consigne et
   ne dézoome qu'une fois la vidéo sortie : l'aperçu se révèle dans le dézoom.
   Fenêtres écrites en dur dans globals.css (duup-ae-*), une seule horloge : tout
   reste aligné. La saisie se révèle au clip-path (jamais de retour à la ligne). */
const CLAUDE_MARK = "/claude-ai-logo-rounded-hd-free-png-1.webp";
export const CLAUDE_WORDMARK = "/Claude_AI_logo.svg.webp";
/* Dérivées optimisées des fichiers de /public (5,4 Mo → 76 Ko ; 55 Mo → 366 Ko). */
/* Éditeur IA : la réf, le rush brut (vidéo générée, sans montage) et le résultat
   « monté » = le même rush avec ses captions incrustées (360p, muet, ~180 Ko). */
const REF_VIDEO = "/ae-ref.jpg";
const FILE_RUSH = "/ae-raw.jpg";
const OUTPUT_VIDEO = "/ae-output.mp4";
const OUTPUT_POSTER = "/ae-output-poster.jpg";

/* Bulle de conversation. `mine` = message du user, aligné à droite. */
function Bubble({ mine, children, className }: { mine?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={`${className ?? ""} flex ${mine ? "justify-end" : "justify-start"}`}>
      <span
        className={`max-w-[86%] rounded-[12px] px-2.5 py-1.5 text-[11px] leading-snug ${mine ? "text-white" : "bg-[#f2f4f8] text-[#1a1a1a]"}`}
        style={mine ? { background: CTA_GRAD } : undefined}
      >
        {children}
      </span>
    </div>
  );
}

/* Un message du fil : il s'ouvre (hauteur 0 → contenu) et pousse le fil vers le haut. */
function Msg({ beat, children }: { beat: string; children: React.ReactNode }) {
  return (
    <div className={`${beat} duup-ae shrink-0 overflow-hidden`}>
      <div className="pt-1.5">{children}</div>
    </div>
  );
}

/* Réponse de Claude : petit avatar + bulle grise. */
function ClaudeSays({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-1.5">
      <img src={CLAUDE_MARK} alt="" className="h-4 w-4 shrink-0 rounded-[4px] object-contain" />
      <span className="max-w-[88%] rounded-[12px] rounded-bl-[4px] bg-[#f2f4f8] px-2.5 py-1.5 text-[11px] leading-snug text-[#1a1a1a]">{children}</span>
    </div>
  );
}

export function AiEditorMockup({ locale, reduced }: { locale: "fr" | "en"; reduced: boolean }) {
  const fr = locale === "fr";
  const { ref } = useLoopInView(reduced, 0.2);
  const ask1 = fr ? "Reproduis ma réf avec mes rushes" : "Recreate my ref with my footage";
  const ask2 = fr ? "Fais-en 3 variantes" : "Make 3 variants";
  const attachments = [
    { src: REF_VIDEO, tag: fr ? "réf" : "ref" },
    { src: FILE_RUSH },
    { audio: true }, // un son, en plus de la vidéo brute
  ];
  const variants = ["duup-ae-v1", "duup-ae-v2", "duup-ae-v3"];
  const hues = ["none", "hue-rotate(28deg) saturate(1.1)", "hue-rotate(-30deg) brightness(1.05)"];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[16px] bg-white shadow-[0_1px_3px_rgba(20,40,90,0.05),0_10px_24px_rgba(20,40,90,0.08),0_28px_56px_rgba(20,40,90,0.07)]">
      <div className="flex items-center gap-2 border-b border-black/[0.05] px-4 py-2.5">
        <span className="text-[11.5px] font-semibold text-[#1a1a1a]">{fr ? "Éditeur IA" : "AI Editor"}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#4686FE]/10 px-2 py-0.5 text-[9.5px] font-semibold" style={{ color: BLUE }}>
          <img src={CLAUDE_MARK} alt="" className="h-3 w-3 rounded-[3px] object-contain" />
          Claude
        </span>
      </div>

      <div className="duup-ae-stage duup-ae flex min-h-0 flex-1">
      {/* Caméra : zoom sur la conversation pendant la consigne et le montage,
          dézoom quand la vidéo sort (cadré sur le bas du fil, là où ça s'écrit). */}
      <div className="duup-ae-cam duup-ae flex min-h-0 w-full flex-1 gap-3 p-3.5" style={{ transformOrigin: "0% 100%" }}>
        {/* ── La conversation ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden"
            style={{ maskImage: "linear-gradient(to bottom, transparent 0, #000 22px)", WebkitMaskImage: "linear-gradient(to bottom, transparent 0, #000 22px)" }}
          >
            <Msg beat="duup-ae-m1">
              <div className="flex justify-end">
                <div className="flex gap-1.5 rounded-[12px] bg-[#eef2ff] p-1.5">
                  {attachments.map((a, i) => (
                    <span key={i} className="relative h-9 w-9 overflow-hidden rounded-[7px] bg-[#e3e8f2]">
                      {a.audio ? (
                        /* Fichier son : note de musique + mini forme d'onde */
                        <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-white" style={{ background: CTA_GRAD }}>
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V6l11-2v12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></svg>
                          <span className="flex items-end gap-[1.5px]">
                            {[4, 7, 5, 8, 3].map((h, j) => <span key={j} className="w-[2px] rounded-full bg-white/85" style={{ height: h }} />)}
                          </span>
                        </span>
                      ) : (
                        <img src={a.src} alt="" className="h-full w-full object-cover" />
                      )}
                      {a.tag && (
                        <span className="absolute inset-x-0 bottom-0 bg-black/55 text-center text-[7.5px] font-semibold leading-[11px] text-white">{a.tag}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </Msg>
            <Msg beat="duup-ae-m2"><Bubble mine>{ask1}</Bubble></Msg>
            <Msg beat="duup-ae-m3">
              <ClaudeSays>
                {fr ? "Je monte ta vidéo…" : "Editing your video…"}
                <span className="mt-1 block h-1 w-24 overflow-hidden rounded-full bg-[#e3e7ef]">
                  <span className="duup-ae-bar duup-ae block h-1 rounded-full" style={{ background: CTA_GRAD }} />
                </span>
              </ClaudeSays>
            </Msg>
            <Msg beat="duup-ae-m4"><ClaudeSays>{fr ? "Ta vidéo est prête ✨" : "Your video is ready ✨"}</ClaudeSays></Msg>
            <Msg beat="duup-ae-m5"><Bubble mine>{ask2}</Bubble></Msg>
            <Msg beat="duup-ae-m6">
              <ClaudeSays>
                {fr ? "Voilà tes 3 variantes 👇" : "Here are your 3 variants 👇"}
                <span className="mt-1.5 flex gap-1">
                  {variants.map((v, i) => (
                    <span key={v} className={`${v} duup-ae block h-[38px] w-[22px] overflow-hidden rounded-[5px] bg-[#e3e8f2]`}>
                      <img src={OUTPUT_POSTER} alt="" className="h-full w-full object-cover" style={{ filter: hues[i] }} />
                    </span>
                  ))}
                </span>
              </ClaudeSays>
            </Msg>
          </div>

          {/* Le champ de saisie : la consigne s'y écrit, puis part dans le fil */}
          <div className="mt-2 flex h-8 shrink-0 items-center gap-2 rounded-full bg-[#f2f4f8] pl-3 pr-1.5">
            <span className="relative h-4 min-w-0 flex-1 overflow-hidden text-[10.5px] leading-4">
              <span className="duup-ae-ph duup-ae absolute inset-0 truncate text-[#9aa0ad]">{fr ? "Écris à Claude…" : "Message Claude…"}</span>
              <span className="duup-ae-t1 duup-ae absolute inset-0 truncate whitespace-nowrap text-[#1a1a1a]">{ask1}</span>
              <span className="duup-ae-t2 duup-ae absolute inset-0 truncate whitespace-nowrap text-[#1a1a1a]">{ask2}</span>
            </span>
            <span className="duup-ae-send duup-ae flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: CTA_GRAD }}>
              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </span>
          </div>
        </div>

        {/* ── L'aperçu : vide → montage → vidéo finie ── */}
        <div className="relative aspect-[9/16] h-full shrink-0 overflow-hidden rounded-[11px] bg-[#f4f6fb] ring-1 ring-black/[0.05]">
          <div className="duup-ae-pv0 duup-ae absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-[#a3a9b6]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M10 9.5v5l4-2.5z" /></svg>
            <span className="text-[9.5px] font-medium">{fr ? "Aperçu" : "Preview"}</span>
          </div>
          <div className="duup-ae-pv1 duup-ae absolute inset-0 overflow-hidden" style={{ background: "linear-gradient(165deg,#dfe8ff 0%,#e9e0ff 100%)" }}>
            <span className="duup-ae-shimmer absolute inset-y-0 -left-1/2 w-1/2" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.65),transparent)" }} />
            <div className="absolute inset-x-2.5 bottom-3 space-y-1.5">
              <span className="block h-1.5 w-3/4 rounded-full bg-white/70" />
              <span className="block h-1.5 w-1/2 rounded-full bg-white/60" />
            </div>
            <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[9.5px] font-semibold text-[#4a4f5c]">{fr ? "Montage…" : "Editing…"}</span>
          </div>
          <div className="duup-ae-pv2 duup-ae absolute inset-0">
            <video
              ref={ref}
              src={OUTPUT_VIDEO}
              poster={OUTPUT_POSTER}
              preload="none"
              muted
              loop
              playsInline
              disablePictureInPicture
              aria-label={fr ? "Vidéo montée par l'éditeur IA" : "Video edited by the AI editor"}
              className="h-full w-full object-cover"
            />
            <span className="duup-ae-x3 duup-ae absolute right-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-bold shadow-sm" style={{ color: BLUE }}>×3</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

/* ─── DUPLICATION ───
   Une histoire en 3 plans, cycle de 14 s, une seule horloge (duup-dp-* dans
   globals.css) :
     A) le curseur dépose reel.mp4, règle 10 copies, clique « Générer » : les
        copies sortent de la source une à une, le compteur monte ;
     B) zoom sur l'original et une copie : même image, mais une fiche montre ce
        qui change dans le fichier (appareil, date, empreinte, poids) ;
     C) dézoom vers les comptes : chaque copie part, prête à reposter.
   Les plans s'enchaînent en zoom avant (A → B) puis en dézoom (B → C). */
const PLATFORM_ICONS = {
  tt: "/tik-tok%20copie.png",
  ig: "/instagram%20(1)%20copie.png",
  yt: "/youtube%20copie.png",
  x: "/twitter%20copie.png",
};
/* Micro-variations visibles des vignettes : même image, rendu à peine différent. */
const copyFilter = (i: number) => `saturate(${100 + (i % 4) * 3}%) brightness(${99 + (i % 3)}%) hue-rotate(${(i % 5) - 2}deg)`;

/* Vidéo de démo de la section Duplication (allégée : 360p, muette, ~260 Ko).
   Les grandes vignettes la jouent ; les petites (copies, comptes) affichent
   son image d'aperçu, pour ne pas décoder une dizaine de vidéos à la fois. */
const DUP_VIDEO = "/dup-demo.mp4";
const DUP_POSTER = "/dup-demo-poster.jpg";
function DupVideo({ style }: { style?: React.CSSProperties }) {
  return (
    <video src={DUP_VIDEO} poster={DUP_POSTER} autoPlay muted loop playsInline disablePictureInPicture aria-hidden
      className="h-full w-full object-cover" style={style} />
  );
}

export function DuplicationMockup({ locale }: { locale: "fr" | "en" }) {
  const fr = locale === "fr";
  // Le curseur vise les VRAIES positions de la zone de dépôt et du bouton
  // (mesurées, puis passées en variables CSS aux keyframes) : à n'importe
  // quelle largeur, il dépose et clique pile au centre.
  const planA = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const genRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const box = planA.current, drop = dropRef.current, gen = genRef.current;
    if (!box || !drop || !gen) return;
    const place = () => {
      const b = box.getBoundingClientRect();
      // getBoundingClientRect inclut le transform du plan (zoom) : on ramène à l'échelle 1.
      const k = box.offsetWidth ? b.width / box.offsetWidth : 1;
      const center = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return [(r.left + r.width / 2 - b.left) / k, (r.top + r.height / 2 - b.top) / k];
      };
      const [sx, sy] = center(drop);
      const [gx, gy] = center(gen);
      box.style.setProperty("--sx", `${sx}px`);
      box.style.setProperty("--sy", `${sy}px`);
      box.style.setProperty("--gx", `${gx}px`);
      box.style.setProperty("--gy", `${gy}px`);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);
  const rows = fr
    ? [
        ["Appareil", "iPhone 13", "iPhone 15"],
        ["Date", "12 oct.", "14 oct."],
        ["Empreinte", "#a3f9e1", "#7c21b4"],
        ["Poids", "8,4 Mo", "8,1 Mo"],
      ]
    : [
        ["Device", "iPhone 13", "iPhone 15"],
        ["Date", "Oct 12", "Oct 14"],
        ["Fingerprint", "#a3f9e1", "#7c21b4"],
        ["Size", "8.4 MB", "8.1 MB"],
      ];
  const accounts: { h: string; icon: keyof typeof PLATFORM_ICONS }[] = [
    { h: "@ma.marque", icon: "tt" },
    { h: "@ma.marque.fr", icon: "ig" },
    { h: "@ma.marque.shorts", icon: "yt" },
    { h: "@mamarque_x", icon: "x" },
  ];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_1px_3px_rgba(20,40,90,0.05),0_10px_24px_rgba(20,40,90,0.08),0_28px_56px_rgba(20,40,90,0.07)]">
      <Chrome title="Duplication" />

      <div className="duup-dp-stage duup-dp relative min-h-0 flex-1 overflow-hidden">
        {/* ── Plan A : dépôt, réglage, génération ── */}
        <div ref={planA} className="duup-dp-sA duup-dp absolute inset-0 flex gap-3 p-3.5" style={{ transformOrigin: "42% 38%" }}>
          {/* Source */}
          <div className="flex w-[22%] shrink-0 flex-col justify-center">
            <div ref={dropRef} className="relative aspect-[9/16] w-full overflow-hidden rounded-[10px]">
              <div className="duup-dp-drop duup-dp absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-[#c9d1e2] bg-[#f7f9fc] px-1 text-center text-[8.5px] font-medium leading-tight text-[#9aa0ad]">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
                {fr ? "Dépose ta vidéo" : "Drop your video"}
              </div>
              <div className="duup-dp-src duup-dp absolute inset-0 overflow-hidden rounded-[10px] ring-1 ring-black/[0.06]">
                <DupVideo />
                <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 py-px text-[7px] font-semibold text-white">1080p</span>
              </div>
            </div>
            <p className="mt-1.5 truncate text-center text-[9px] font-medium text-[#8a8a8a]">reel.mp4</p>
          </div>

          {/* Réglage + grille des copies */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-[#f4f6fb] px-2 py-1 text-[9.5px] font-medium text-[#605f5f] ring-1 ring-black/[0.04]">
                {fr ? "Copies" : "Copies"}
                <span className="relative block h-3 w-3.5 overflow-hidden text-center font-bold text-[#1a1a1a]">
                  <span className="duup-dp-count duup-dp absolute inset-x-0 top-0 flex flex-col leading-3">
                    {Array.from({ length: 10 }, (_, i) => <span key={i}>{i + 1}</span>)}
                  </span>
                </span>
              </span>
              <span ref={genRef} className="duup-dp-gen duup-dp rounded-full px-2.5 py-1 text-[9.5px] font-semibold text-white shadow-[0_6px_14px_rgba(90,90,240,0.30)]" style={{ background: CTA_GRAD }}>
                {fr ? "Générer" : "Generate"}
              </span>
              <span className="ml-auto flex items-center text-[9.5px] font-semibold tabular-nums" style={{ color: BLUE }}>
                <span className="relative block h-3 w-3.5 overflow-hidden text-right">
                  <span className="duup-dp-done duup-dp absolute inset-x-0 top-0 flex flex-col leading-3">
                    {Array.from({ length: 11 }, (_, i) => <span key={i}>{i}</span>)}
                  </span>
                </span>
                /10
              </span>
            </div>
            <div className="mt-2.5 grid min-h-0 flex-1 grid-cols-5 grid-rows-2 justify-items-center gap-1.5">
              {Array.from({ length: 10 }, (_, i) => (
                <div
                  key={i}
                  className={`duup-dp-c${i} duup-dp relative aspect-[9/16] h-full max-w-full overflow-hidden rounded-[6px] bg-[#eef1f7] ring-1 ring-black/[0.06]`}
                  style={{ ["--dx" as string]: `${-(i % 5 + 1.6) * 110}%`, ["--dy" as string]: `${i < 5 ? 25 : -80}%` } as React.CSSProperties}
                >
                  <img src={DUP_POSTER} alt="" className="h-full w-full object-cover" style={{ filter: copyFilter(i) }} />
                  <span className="absolute right-0.5 top-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full text-white shadow" style={{ background: CTA_GRAD }}>
                    <svg className="h-1.5 w-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="5"><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Le curseur : dépose la vidéo, puis clique sur Générer */}
          <span aria-hidden className="duup-dp-cursor duup-dp pointer-events-none absolute left-0 top-0 z-10">
            {/* La pointe de la flèche (5,3 dans le viewBox) tombe sur le point visé. */}
            <svg className="-ml-[5px] -mt-[3px] h-6 w-6 drop-shadow-[0_2px_3px_rgba(0,0,0,0.25)]" viewBox="0 0 24 24" fill="#1a1a1a" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round"><path d="M5 3l14 8-6.2 1.6L9.6 19z" /></svg>
          </span>
        </div>

        {/* ── Plan B : même image, fichier différent ── */}
        <div className="duup-dp-sB duup-dp absolute inset-0 flex items-center gap-3 p-3.5">
          <div className="flex h-full shrink-0 gap-2 py-5">
            {[fr ? "Original" : "Original", fr ? "Copie n°4" : "Copy #4"].map((label, i) => (
              <div key={label} className="flex h-full flex-col">
                <div className="relative aspect-[9/16] h-[calc(100%-16px)] overflow-hidden rounded-[9px] ring-1 ring-black/[0.06]">
                  <DupVideo style={i ? { filter: copyFilter(3) } : undefined} />
                </div>
                <p className={`mt-1 text-center text-[8.5px] font-semibold ${i ? "" : "text-[#8a8a8a]"}`} style={i ? { color: BLUE } : undefined}>{label}</p>
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold leading-snug text-[#1a1a1a]">{fr ? "Même image à l'œil…" : "Same image to the eye…"}</p>
            <p className="text-[10px] font-semibold leading-snug" style={{ color: BLUE }}>{fr ? "…fichier neuf pour la plateforme" : "…brand-new file to the platform"}</p>
            <div className="mt-2 overflow-hidden rounded-[9px] ring-1 ring-black/[0.06]">
              {rows.map(([k, a, b], i) => (
                <div key={k} className={`grid grid-cols-[0.9fr_1fr_1fr] items-center gap-1 px-2 py-[5px] text-[8.5px] ${i ? "border-t border-black/[0.05]" : ""}`}>
                  <span className="truncate font-medium text-[#8a8a8a]">{k}</span>
                  <span className="truncate text-[#605f5f]">{a}</span>
                  <span className={`duup-dp-r${i} duup-dp truncate rounded-[4px] px-1 font-semibold`} style={{ color: BLUE, background: "rgba(70,134,254,0.10)" }}>{b}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Plan C : les copies partent sur les comptes ── */}
        <div className="duup-dp-sC duup-dp absolute inset-0 flex flex-col justify-center gap-1 px-4 py-2.5 sm:gap-1.5 sm:py-3">
          <p className="mb-0.5 text-[10px] font-semibold text-[#1a1a1a]">{fr ? "Prêtes à reposter" : "Ready to repost"}</p>
          {accounts.map((a, i) => (
            <div key={a.h} className={`duup-dp-a${i} duup-dp ${i === 3 ? "hidden sm:flex" : "flex"} items-center gap-2 rounded-[10px] bg-[#f7f8fb] px-2 py-1 ring-1 ring-black/[0.04] sm:py-1.5`}>
              <span className="h-[26px] w-[15px] shrink-0 overflow-hidden rounded-[4px]">
                <img src={DUP_POSTER} alt="" className="h-full w-full object-cover" style={{ filter: copyFilter(i + 1) }} />
              </span>
              <img src={PLATFORM_ICONS[a.icon]} alt="" className="h-4 w-4 shrink-0 object-contain" />
              <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-[#1a1a1a]">{a.h}</span>
              <span className={`duup-dp-k${i} duup-dp flex items-center gap-1 rounded-full bg-[#4686FE]/10 px-1.5 py-0.5 text-[8.5px] font-semibold`} style={{ color: BLUE }}>
                <svg className="h-2 w-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6 9 17l-5-5" /></svg>
                {fr ? "prête" : "ready"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

/* ══════════════════════════════════════════════════════════════
 * « DUPLICATION ET VARIANTES » — cartes empilées (sous la section Éditeur IA).
 *
 * Message : DuupFlow DUPLIQUE (fichiers neufs, en masse) ET crée des
 * VARIANTES visibles (captions, sous-titres, Duplication IA, Éditeur IA).
 *
 * Mécanique : toutes les cartes sont posées dans une même pile. La carte
 * active occupe la place du premier plan (en bas), les autres se rangent
 * derrière, de plus en plus étroites. Changer de carte = chaque carte glisse
 * vers sa nouvelle place (top, marges) et se replie / se déplie (max-height)
 * en même temps : un roulement fluide, jamais un remplacement sec.
 * Rotation automatique quand la pile est à l'écran ; pause au survol ;
 * arrêt définitif au premier clic ; figée en prefers-reduced-motion.
 *
 * Démos : reproductions en HTML/CSS des vrais écrans du dashboard
 * (Duplication Simple, bloc Captions, résultats de la Duplication IA,
 * espace de l'Éditeur IA avec Claude intégré). Captions des vidéos : vraies
 * phrases en anglais, styles sobres (noir, blanc, gris). Préfixe CSS `vs-`.
 * ══════════════════════════════════════════════════════════════ */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { GradText, Label, SECTION_LEAD, SECTION_TITLE, SECTION_TITLE_STYLE } from "@/components/landing/shell";
import { useReducedMotion } from "@/components/landing/videoShowcase";
import { useInView } from "@/components/landing/useInView";

type L = "fr" | "en";
type Tx = Record<L, string>;

const INDIGO = "#6366F1";
const ROTATE_MS = 8000;
const SLOT = 58; // hauteur visible d'une carte rangée derrière (px)

const CSS = `
@keyframes vs-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
@keyframes vs-pop { 0% { opacity: 0; transform: scale(.85) } 100% { opacity: 1; transform: none } }
@keyframes vs-type { from { width: 0 } to { width: 100% } }
@keyframes vs-caret { 50% { opacity: 0 } }
@keyframes vs-bar { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes vs-drag { 0%, 30% { top: 60% } 55%, 100% { top: 13% } }
@keyframes vs-cursor { 0%, 20% { opacity: 0; top: 66%; left: 64% } 28% { opacity: 1; top: 63%; left: 57% } 55% { opacity: 1; top: 16%; left: 57% } 68% { opacity: 1; top: 16%; left: 57% } 78%, 100% { opacity: 0; top: 19%; left: 70% } }
@keyframes vs-snap { 0%, 51% { opacity: 0 } 55%, 68% { opacity: 1 } 76%, 100% { opacity: 0 } }
@keyframes vs-kara { 0%, 30% { color: #ffd84d } 34%, 100% { color: #fff } }
@keyframes vs-toggle { 0%, 55% { left: 2px } 62%, 100% { left: 14px } }
@keyframes vs-toggle-bg { 0%, 55% { background: #d7dbe3 } 62%, 100% { background: ${INDIGO} } }
@keyframes vs-slide { from { opacity: 0; transform: translateX(16px) } to { opacity: 1; transform: none } }
@keyframes vs-status { 0%, 99% { opacity: 1 } 100% { opacity: 0 } }
@keyframes vs-progress { from { transform: scaleX(0) } to { transform: scaleX(1) } }
.vs-freeze * { animation: none !important; transition: none !important }
`;

/* Animation d'entrée avec délai (s). */
const at = (s: number, name = "vs-in", dur = 0.45): React.CSSProperties => ({ animation: `${name} ${dur}s ${s}s cubic-bezier(.2,.8,.2,1) both` });

const SCENES = [
  "linear-gradient(165deg,#e9d5c8 0%,#c79c86 48%,#5d4337 100%)",
  "linear-gradient(165deg,#d9dde6 0%,#9aa6bb 48%,#454f63 100%)",
  "linear-gradient(165deg,#e6e1d6 0%,#b3a78f 48%,#5b5040 100%)",
  "linear-gradient(165deg,#dcd7e3 0%,#a49bb3 48%,#4d455c 100%)",
];

/* Vidéo verticale factice : une silhouette sur un fond de scène. */
function Clip({ w, scene = 0, className = "", children, style }: { w: number | string; scene?: number; className?: string; children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className={`relative shrink-0 overflow-hidden ${className}`} style={{ width: w, aspectRatio: "9 / 16", background: SCENES[scene % SCENES.length], ...style }}>
      <div className="absolute left-1/2 top-[33%] h-[15%] w-[26%] -translate-x-1/2 rounded-full bg-white/35" />
      <div className="absolute bottom-0 left-1/2 h-[37%] w-[66%] -translate-x-1/2 rounded-t-[999px] bg-white/25" />
      {children}
    </div>
  );
}

/* Styles de caption sobres : blanc, noir, gris, texte seul. */
const CAPS = {
  white: { background: "#fff", color: "#111", borderRadius: 3, padding: "2px 5px" },
  black: { background: "#111", color: "#fff", borderRadius: 3, padding: "2px 5px" },
  grey: { background: "rgba(38,38,38,.72)", color: "#fff", borderRadius: 999, padding: "2px 6px" },
  text: { color: "#fff", textShadow: "0 0 3px rgba(0,0,0,.9), 0 0 2px #000" },
} satisfies Record<string, React.CSSProperties>;
function Caption({ text, kind, top, size = 7 }: { text: string; kind: keyof typeof CAPS; top: string; size?: number }) {
  return (
    <div className="absolute left-1/2 w-max max-w-[86%] -translate-x-1/2 text-center font-semibold leading-tight" style={{ top, fontSize: size, ...CAPS[kind] }}>{text}</div>
  );
}

/* Cadre « écran d'app » : barre de titre façon dashboard. */
function AppFrame({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl bg-[#f6f7f9] ring-1 ring-black/[0.07]">
      <div className="flex shrink-0 items-center gap-2 border-b border-black/[0.06] bg-white px-3 py-2">
        <span className="flex gap-1" aria-hidden>{[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 rounded-full bg-black/[0.12]" />)}</span>
        <span className="ml-1 truncate text-[11px] font-semibold text-[#1a1a1a]">{title}</span>
        <span className="ml-auto">{right}</span>
      </div>
      <div className="relative min-h-0 flex-1 p-3">{children}</div>
    </div>
  );
}

const Check = ({ className = "h-2.5 w-2.5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
);

/* ── 1. Duplication (mode Simple) : 10 copies, 10 fichiers neufs ── */
function DemoDuplication({ l }: { l: L }) {
  const fr = l === "fr";
  const rows = fr
    ? [["Appareil", "iPhone 13", "iPhone 15 Pro"], ["Empreinte", "#a3f9e1", "#7c21b4"], ["Date", "12 oct.", "14 oct."]]
    : [["Device", "iPhone 13", "iPhone 15 Pro"], ["Fingerprint", "#a3f9e1", "#7c21b4"], ["Date", "Oct 12", "Oct 14"]];
  return (
    <AppFrame title={fr ? "Duplication Vidéos, Simple" : "Video Duplication, Simple"}>
      <div className="flex gap-3">
        <div className="w-[64px] shrink-0">
          <Clip w="100%" scene={0} className="rounded-lg ring-1 ring-black/10"><span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 text-[6.5px] font-semibold text-white">1080p</span></Clip>
          <p className="mt-1 truncate text-center text-[8.5px] text-[#8a8f99]">reel.mp4</p>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[9.5px] font-medium text-[#605f5f]">{fr ? "Nombre de copies" : "Number of copies"}</span>
            <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-[#1a1a1a] ring-1 ring-black/[0.08]">10</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(fr ? ["Léger", "Équilibré", "Fort"] : ["Light", "Balanced", "Strong"]).map((p, i) => (
              <span key={p} className="rounded-md px-1.5 py-1 text-[9px] font-semibold" style={i === 1 ? { background: "#eef0ff", color: "#3b3fb5", boxShadow: `inset 0 0 0 1px ${INDIGO}55` } : { background: "#fff", color: "#605f5f", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.06)" }}>
                {p}
              </span>
            ))}
          </div>
          <div className="relative overflow-hidden rounded-md text-center text-[9.5px] font-semibold text-white" style={{ background: "linear-gradient(180deg,#6366F1,#4F46E5)" }}>
            <span className="absolute inset-y-0 left-0 w-full origin-left bg-white/20" style={{ animation: "vs-bar 2.2s .4s ease-out both" }} />
            <span className="relative block py-1">{fr ? "Dupliquer les vidéos" : "Duplicate videos"}</span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[9.5px] font-semibold text-[#1a1a1a]" style={at(1.2)}>{fr ? "Vidéos générées" : "Generated videos"} <span className="font-normal text-[#8a8f99]">· 10</span></p>
      <div className="mt-1.5 grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="relative" style={at(1.3 + i * 0.12, "vs-pop", 0.35)}>
            <Clip w="100%" scene={0} className="rounded-[5px] ring-1 ring-black/10" style={{ filter: `saturate(${100 + (i % 4) * 4}%) brightness(${98 + (i % 3) * 2}%)` }} />
            <span className="absolute right-0.5 top-0.5 grid h-2.5 w-2.5 place-items-center rounded-full text-white" style={{ background: INDIGO }}><Check className="h-1.5 w-1.5" /></span>
          </div>
        ))}
      </div>

      {/* Comparaison d'une copie : l'identité du fichier change */}
      <div className="absolute right-3 top-3 w-[62%] rounded-lg bg-white p-2 shadow-[0_12px_28px_-12px_rgba(20,40,90,.45)] ring-1 ring-black/[0.08]" style={at(3, "vs-slide", 0.5)}>
        <p className="mb-1 flex items-center justify-between text-[8.5px] font-semibold text-[#1a1a1a]">{fr ? "Copie 4 vs original" : "Copy 4 vs original"}<span className="rounded-full bg-emerald-500/12 px-1.5 text-[7.5px] font-semibold text-emerald-700">{fr ? "Fichiers distincts" : "Distinct files"}</span></p>
        {rows.map(([k, a, b]) => (
          <div key={k} className="grid grid-cols-[0.9fr_1fr_1.1fr] gap-1 border-t border-black/[0.05] py-[3px] text-[8px]">
            <span className="text-[#8a8f99]">{k}</span><span className="text-[#605f5f]">{a}</span>
            <span className="rounded px-1 font-semibold" style={{ color: "#4686FE", background: "rgba(70,134,254,.1)" }}>{b}</span>
          </div>
        ))}
      </div>
    </AppFrame>
  );
}

/* ── 2. Captions et sous-titres (bloc du mode Simple) ── */
function Chip({ on, children }: { on?: boolean; children: React.ReactNode }) {
  return (
    <span className="rounded-md px-1.5 py-[3px] text-[8.5px] font-semibold" style={on ? { background: "#eef0ff", color: "#3b3fb5", boxShadow: `inset 0 0 0 1px ${INDIGO}66` } : { background: "#fff", color: "#605f5f", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.07)" }}>{children}</span>
  );
}
function DemoCaptions({ l }: { l: L }) {
  const fr = l === "fr";
  const words = ["it's", "so", "easy"];
  return (
    <AppFrame title="Captions · Beta">
      <div className="flex h-full gap-3">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <p className="mb-1 text-[8.5px] font-semibold text-[#1a1a1a]">{fr ? "Texte de la caption" : "Caption text"}</p>
            <div className="flex h-6 items-center rounded-md bg-white px-2 ring-1 ring-black/[0.08]">
              <span className="inline-block overflow-hidden whitespace-nowrap text-[9.5px] text-[#1a1a1a]" style={{ animation: "vs-type 1.4s .3s steps(25) both" }}>POV: you finally found it</span>
              <span className="ml-px h-3 w-px bg-[#1a1a1a]" style={{ animation: "vs-caret 1s steps(1) infinite" }} />
            </div>
          </div>
          <div>
            <p className="mb-1 text-[8.5px] font-semibold text-[#1a1a1a]">{fr ? "Affichage" : "Display"}</p>
            <div className="flex gap-1"><Chip on>{fr ? "Toute la vidéo" : "Whole video"}</Chip><Chip>{fr ? "Personnalisé" : "Custom"}</Chip></div>
          </div>
          <div>
            <p className="mb-1 text-[8.5px] font-semibold text-[#1a1a1a]">{fr ? "Police" : "Font"}</p>
            <div className="flex flex-wrap gap-1"><Chip on>{fr ? "Classique" : "Classic"}</Chip><Chip>Montserrat</Chip><Chip>Poppins</Chip></div>
          </div>
          <div>
            <p className="mb-1 text-[8.5px] font-semibold text-[#1a1a1a]">{fr ? "Fond" : "Background"}</p>
            <div className="flex flex-wrap gap-1"><Chip>{fr ? "Aucun" : "None"}</Chip><Chip on>{fr ? "Bandeau" : "Band"}</Chip><Chip>{fr ? "Bloc arrondi" : "Rounded"}</Chip></div>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 ring-1 ring-black/[0.06]">
            <span className="relative h-3.5 w-6 shrink-0 rounded-full" style={{ animation: "vs-toggle-bg 5s 1s both" }}>
              <span className="absolute top-[2px] h-2.5 w-2.5 rounded-full bg-white shadow" style={{ animation: "vs-toggle 5s 1s both" }} />
            </span>
            <span className="text-[8.5px] font-semibold text-[#1a1a1a]">{fr ? "Varier sur chaque copie" : "Vary on every copy"}</span>
          </div>
        </div>

        {/* Aperçu : la caption glissée à la souris, les sous-titres karaoké */}
        <div className="flex h-full shrink-0 flex-col">
          <p className="mb-1 text-[8.5px] font-semibold text-[#1a1a1a]">{fr ? "Aperçu" : "Preview"}</p>
          <Clip w="auto" scene={1} className="rounded-lg ring-1 ring-black/10" style={{ height: "calc(100% - 18px)" }}>
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-pink-500/90" style={{ animation: "vs-snap 6s 1.6s linear infinite both" }} />
            <div className="absolute left-0 right-0" style={{ animation: "vs-drag 6s 1.6s cubic-bezier(.65,0,.35,1) infinite both" }}>
              <div className="absolute left-1/2 w-max max-w-[86%] -translate-x-1/2 rounded-[3px] bg-white px-1.5 py-0.5 text-center text-[7.5px] font-semibold leading-tight text-[#111] ring-1 ring-pink-500/80">POV: you finally found it</div>
            </div>
            <svg viewBox="0 0 24 24" className="absolute h-4 w-4 drop-shadow" style={{ animation: "vs-cursor 6s 1.6s cubic-bezier(.65,0,.35,1) infinite both" }} aria-hidden>
              <path d="M5 3l14 7-6 2-2 6L5 3z" fill="#fff" stroke="#111" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            <div className="absolute bottom-[18%] left-1/2 flex -translate-x-1/2 gap-[3px] whitespace-nowrap text-[9px] font-extrabold uppercase text-white" style={{ WebkitTextStroke: "1.8px #000", paintOrder: "stroke fill" }}>
              {words.map((w, i) => <span key={i} style={{ animation: `vs-kara 2.4s steps(1) ${(i * 2.4) / words.length}s infinite` }}>{w}</span>)}
            </div>
          </Clip>
        </div>
      </div>
    </AppFrame>
  );
}

/* ── 3. Duplication IA (écran de résultats) ── */
function DemoAiDup({ l }: { l: L }) {
  const fr = l === "fr";
  const copies = [
    { cap: "Why does nobody talk about this?", kind: "white" as const, top: "17%", d: fr ? "Recadrage 3,2 %, couleurs plus chaudes, caption réécrite, typo classique" : "Crop 3.2%, warmer colours, rewritten caption, classic font" },
    { cap: "I wish I knew this sooner", kind: "black" as const, top: "14%", d: fr ? "Recadrage 5,1 %, vitesse ×0,98, bloc noir, sous-titres karaoké" : "Crop 5.1%, speed ×0.98, black block, karaoke subtitles" },
    { cap: "wait for the end", kind: "grey" as const, top: "19%", d: fr ? "Recadrage 4 %, couleurs plus froides, pilule grise, typo arrondie" : "Crop 4%, cooler colours, grey pill, rounded font" },
  ];
  return (
    <AppFrame
      title={fr ? "Duplication IA en 1 clic" : "1-click AI duplication"}
      right={<span className="rounded-md px-2 py-0.5 text-[8.5px] font-semibold text-white" style={{ background: "linear-gradient(180deg,#6366F1,#4F46E5)" }}>{fr ? "Tout télécharger (.zip)" : "Download all (.zip)"}</span>}
    >
      <p className="text-[12px] font-extrabold tracking-tight text-[#1a1a1a]">{fr ? "C'est prêt" : "Ready"} <span className="ml-1 rounded-full bg-fuchsia-500/10 px-1.5 py-0.5 align-middle text-[7px] font-bold uppercase tracking-wider text-fuchsia-600">Beta</span></p>
      <p className="mt-0.5 text-[8.5px] text-[#8a8f99]">{fr ? "3/3 copies prêtes · Variations" : "3/3 copies ready · Variations"}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {copies.map((c, i) => (
          <div key={i} className="overflow-hidden rounded-lg bg-white ring-1 ring-black/[0.07]" style={at(0.3 + i * 0.35, "vs-in", 0.5)}>
            <Clip w="100%" scene={i + 1} style={{ aspectRatio: "1 / 1" }}>
              <Caption text={c.cap} kind={c.kind} top={c.top} size={7} />
              {i === 1 && (
                <div className="absolute bottom-[14%] left-1/2 flex -translate-x-1/2 gap-[2px] whitespace-nowrap text-[7.5px] font-extrabold uppercase text-white" style={{ WebkitTextStroke: "1.5px #000", paintOrder: "stroke fill" }}>
                  <span>so</span><span style={{ color: "#ffd84d" }}>much</span><span>time</span>
                </div>
              )}
              {/* statut : « Montage… » puis la coche */}
              <span className="absolute left-1 top-1 rounded-full bg-black/55 px-1.5 py-[1px] text-[6.5px] font-semibold text-white" style={{ animation: `vs-status ${1.4 + i * 0.4}s both` }}>{fr ? "Montage…" : "Editing…"}</span>
              <span className="absolute right-1 top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-emerald-500 text-white" style={at(1.4 + i * 0.4, "vs-pop", 0.3)}><Check /></span>
            </Clip>
            <div className="p-1.5">
              <p className="flex items-center justify-between text-[8.5px] font-semibold text-[#1a1a1a]">{fr ? "Copie" : "Copy"} {i + 1}
                <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 text-[#8a8f99]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
              </p>
              <p className="mt-0.5 line-clamp-2 text-[7px] leading-snug text-[#8a8f99]">{c.d}</p>
            </div>
          </div>
        ))}
      </div>
    </AppFrame>
  );
}

/* ── 4. Éditeur IA (espace de travail + Claude intégré) ── */
function DemoEditor({ l }: { l: L }) {
  const fr = l === "fr";
  const tools = fr ? ["Regarde la référence", "Parcourt la matière", "Crée une variante"] : ["Looks at the reference", "Browses the footage", "Creates a variant"];
  return (
    <AppFrame title={fr ? "Éditeur IA" : "AI Editor"}>
      <div className="flex h-full gap-2.5">
        {/* Référence + matière */}
        <div className="w-[23%] shrink-0 space-y-2">
          <p className="text-[8px] font-semibold uppercase tracking-wider text-[#8a8f99]">{fr ? "Référence" : "Reference"}</p>
          <Clip w="100%" scene={3} className="rounded-md ring-1 ring-black/10" style={{ aspectRatio: "9 / 11" }}>
            <Caption text="the hook that went viral" kind="text" top="14%" size={6} />
          </Clip>
          <p className="text-[8px] font-semibold uppercase tracking-wider text-[#8a8f99]">{fr ? "Matière" : "Footage"}</p>
          {["rush_01.mov", "rush_02.mov", "broll.mp4"].map((f) => (
            <div key={f} className="flex items-center gap-1 rounded bg-white px-1 py-[3px] text-[7.5px] text-[#605f5f] ring-1 ring-black/[0.06]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /><span className="truncate">{f}</span>
            </div>
          ))}
        </div>

        {/* Variantes qui arrivent */}
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[8px] font-semibold uppercase tracking-wider text-[#8a8f99]">{fr ? "Variantes" : "Variants"}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[{ t: "3 things I stopped doing", k: "white" as const }, { t: "this is your sign", k: "black" as const }].map((v, i) => (
              <div key={i} style={at(2.6 + i * 0.6, "vs-pop", 0.4)}>
                <Clip w="100%" scene={i} className="rounded-md ring-1 ring-black/10">
                  <Caption text={v.t} kind={v.k} top="15%" size={6.5} />
                  <span className="absolute bottom-1 left-1 rounded-full bg-white/90 px-1.5 py-[1px] text-[6.5px] font-semibold text-emerald-700">✓ {fr ? "prête" : "ready"}</span>
                </Clip>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Claude intégré */}
        <div className="flex w-[40%] shrink-0 flex-col rounded-lg bg-white p-2 ring-1 ring-black/[0.07]">
          <p className="flex items-center gap-1 text-[8.5px] font-semibold text-[#1a1a1a]"><span className="grid h-3.5 w-3.5 place-items-center rounded-full text-[7px] font-bold text-white" style={{ background: "#D97757" }}>✳</span>{fr ? "Claude intégré" : "Built-in Claude"}</p>
          <div className="ml-auto mt-1.5 max-w-[92%] rounded-lg rounded-br-sm bg-[#f1f3f7] px-1.5 py-1 text-[7.5px] leading-snug text-[#1a1a1a]" style={at(0.3)}>
            {fr ? "Monte mes rushes comme ma référence, 2 variantes avec des hooks différents." : "Edit my footage like my reference, 2 variants with different hooks."}
          </div>
          <div className="mt-1.5 space-y-1">
            {tools.map((t, i) => (
              <div key={t} className="flex items-center gap-1 text-[7.5px] text-[#605f5f]" style={at(0.9 + i * 0.5)}>
                <span className="grid h-2.5 w-2.5 place-items-center rounded-full bg-emerald-500/15 text-emerald-600"><Check className="h-1.5 w-1.5" /></span>{t}
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[7.5px] leading-snug text-[#3a3f4b]" style={at(3.4)}>{fr ? "C'est prêt : 2 variantes, chacune avec son hook." : "Done: 2 variants, each with its own hook."}</p>
          <div className="mt-auto rounded-md bg-[#f6f7f9] px-1.5 py-1 text-[7.5px] text-[#8a8f99] ring-1 ring-black/[0.05]">{fr ? "Écris à Claude…" : "Message Claude…"}</div>
        </div>
      </div>
    </AppFrame>
  );
}

type Tab = {
  key: string;
  icon: React.ReactNode;
  color: string;
  label: Tx;
  title: Tx;
  body: Tx;
  points: Record<L, string[]>;
  why: Tx;
  Demo: (p: { l: L }) => React.ReactElement;
};

const ic = (d: React.ReactNode) => <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>;

/* Ordre = ordre de la pile, du fond vers l'avant. La carte au premier plan
   au chargement est la Duplication (le cœur du produit). */
const TABS: Tab[] = [
  {
    key: "editor", color: "#D97757",
    icon: ic(<path d="m12 3 1.9 4.8L18 9.5l-4.1 1.7L12 16l-1.9-4.8L6 9.5l4.1-1.7Z" />),
    label: { fr: "Éditeur IA", en: "AI Editor" },
    title: { fr: "Tes rushes deviennent des vidéos montées", en: "Your raw footage becomes finished videos" },
    body: { fr: "Donne une référence qui a marché et tes rushes : Claude monte la vidéo, puis la décline en variantes avec d'autres hooks.", en: "Give a reference that performed and your footage: Claude edits the video, then spins it into variants with other hooks." },
    points: { fr: ["Claude intégré, ou ton propre Claude", "Retouche à la main quand tu veux"], en: ["Built-in Claude, or your own Claude", "Retouch by hand whenever you want"] },
    why: { fr: "Du contenu neuf à partir de ce qui marche déjà, sans passer tes soirées à monter.", en: "New content from what already works, without spending your evenings editing." },
    Demo: DemoEditor,
  },
  {
    key: "aidup", color: "#C026D3",
    icon: ic(<path d="M12 3l1.8 4.9L19 9.7l-5.2 1.8L12 16.5l-1.8-5L5 9.7l5.2-1.8L12 3zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />),
    label: { fr: "Duplication IA en 1 clic", en: "1-click AI duplication" },
    title: { fr: "L'IA fabrique des variantes toutes différentes", en: "The AI builds variants that all look different" },
    body: { fr: "Dépose une vidéo, choisis le nombre de copies : l'IA réécrit la caption, change les sous-titres, le cadrage et les couleurs sur chacune.", en: "Drop a video, pick a number of copies: the AI rewrites the caption and changes subtitles, framing and colours on each one." },
    points: { fr: ["Caption réécrite, typo et forme différentes", "Jusqu'à 50 variantes par lancement"], en: ["Rewritten caption, different font and shape", "Up to 50 variants per run"] },
    why: { fr: "Les plateformes repèrent les copies identiques. Des variantes passent comme des posts différents.", en: "Platforms spot identical copies. Variants go through as different posts." },
    Demo: DemoAiDup,
  },
  {
    key: "captions", color: "#0EA5E9",
    icon: ic(<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M7 15h4M13 15h4M7 11h10" /></>),
    label: { fr: "Captions et sous-titres", en: "Captions and subtitles" },
    title: { fr: "Un texte et des sous-titres sur chaque copie", en: "Text and subtitles on every copy" },
    body: { fr: "Écris ta caption, place-la à la souris, ajoute les sous-titres de la voix dans un style viral, et fais-les varier d'une copie à l'autre.", en: "Write your caption, place it with the mouse, add voice subtitles in a viral style, and make them vary from copy to copy." },
    points: { fr: ["Karaoké, mot par mot, bandeau, classique", "Réglages par vidéo, enregistrés en templates"], en: ["Karaoke, word by word, band, classic", "Per-video settings, saved as templates"] },
    why: { fr: "Le texte à l'écran est ce qu'on voit en premier : le varier rend chaque post unique.", en: "On-screen text is what people see first: varying it makes each post unique." },
    Demo: DemoCaptions,
  },
  {
    key: "duplication", color: INDIGO,
    icon: ic(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>),
    label: { fr: "Duplication", en: "Duplication" },
    title: { fr: "Une vidéo, autant de fichiers neufs que tu veux", en: "One video, as many brand-new files as you want" },
    body: { fr: "Chaque copie a sa propre identité d'appareil, son empreinte et ses métadonnées, avec des retouches invisibles à l'œil.", en: "Every copy gets its own device identity, fingerprint and metadata, with retouches the eye can't see." },
    points: { fr: ["Jusqu'à 40 vidéos par lot", "4K reste 4K, jamais plus lourd que l'original"], en: ["Up to 40 videos per batch", "4K stays 4K, never heavier than the original"] },
    why: { fr: "La base de tout : reposter ton meilleur contenu sans qu'il soit reconnu comme un doublon.", en: "The foundation: repost your best content without it being recognised as a duplicate." },
    Demo: DemoDuplication,
  },
];

function useLocale(): L {
  const params = useParams();
  const l = Array.isArray(params?.locale) ? params?.locale[0] : params?.locale;
  return l === "en" ? "en" : "fr";
}

export default function VariantStack() {
  const l = useLocale();
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLElement>("0px");
  const N = TABS.length;
  const [active, setActive] = useState(N - 1);
  const [hold, setHold] = useState(false);
  const [touched, setTouched] = useState(false);
  // Nombre d'activations : relance les démos à chaque passage au premier plan.
  const [runs, setRuns] = useState(0);
  const frontRef = useRef<HTMLDivElement>(null);
  const [frontH, setFrontH] = useState(520);

  useEffect(() => {
    if (reduced || !inView || hold || touched) return;
    const id = window.setTimeout(() => { setActive((a) => (a + N - 1) % N); setRuns((r) => r + 1); }, ROTATE_MS);
    return () => window.clearTimeout(id);
  }, [active, reduced, inView, hold, touched, N]);

  // Hauteur (naturelle) de la carte au premier plan → hauteur de la pile.
  useLayoutEffect(() => {
    const el = frontRef.current;
    if (!el) return;
    const measure = () => setFrontH(el.scrollHeight);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [active]);

  const pick = (i: number) => { setTouched(true); if (i !== active) { setActive(i); setRuns((r) => r + 1); } };

  // Place de chaque carte : les inactives gardent leur ordre, l'active passe devant.
  const order = TABS.map((_, i) => i).filter((i) => i !== active).concat(active);
  const ease = "cubic-bezier(.22,.8,.24,1)";
  const dur = reduced ? "0s" : ".7s";

  return (
    <section ref={ref} className={`px-6 pb-20 pt-6 sm:pb-28 ${reduced ? "vs-freeze" : ""}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Label icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M4 12h16M4 17h10" /></svg>}>
            {l === "fr" ? "Duplication et variantes" : "Duplication and variants"}
          </Label>
          {/* Même gabarit que « Tous les modules, inclus » : titre sur une
              ligne, sous-titre sur deux (une longue, une courte). */}
          <h2 className={`mt-7 ${SECTION_TITLE}`} style={SECTION_TITLE_STYLE}>
            {l === "fr" ? <>Duplique, <GradText>puis varie.</GradText></> : <>Duplicate, <GradText>then vary.</GradText></>}
          </h2>
          <p className={`mx-auto mt-4 max-w-xl ${SECTION_LEAD}`}>
            {l === "fr"
              ? "Des fichiers neufs pour tous tes comptes, et des variantes visibles quand tu en as besoin."
              : "Brand-new files for every account, and visible variants whenever you need them."}
          </p>
        </div>

        <div
          className="relative mx-auto mt-12 max-w-[940px]"
          style={{ height: (N - 1) * SLOT + frontH, transition: `height ${dur} ${ease}` }}
          onMouseEnter={() => setHold(true)}
          onMouseLeave={() => setHold(false)}
          role="tablist"
          aria-label={l === "fr" ? "Fonctionnalités" : "Features"}
        >
          {TABS.map((t, i) => {
            const slot = order.indexOf(i);
            const isFront = i === active;
            const depth = N - 1 - slot; // 0 = premier plan
            const inset = `calc(${depth} * clamp(10px, 4.2%, 44px))`;
            const D = t.Demo;
            return (
              <div
                key={t.key}
                ref={isFront ? frontRef : undefined}
                className="absolute overflow-hidden rounded-[22px] bg-white ring-1 ring-black/[0.06]"
                style={{
                  top: slot * SLOT,
                  left: inset,
                  right: inset,
                  zIndex: slot + 1,
                  maxHeight: isFront ? 1400 : SLOT + 30,
                  boxShadow: isFront ? "0 -10px 30px -16px rgba(20,40,90,.22), 0 30px 60px -32px rgba(20,40,90,.30)" : "0 -6px 22px -14px rgba(20,40,90,.20)",
                  transition: `top ${dur} ${ease}, left ${dur} ${ease}, right ${dur} ${ease}, max-height ${dur} ${ease}, box-shadow ${dur} ${ease}`,
                }}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isFront}
                  onClick={() => pick(i)}
                  className={`flex w-full items-center gap-3 px-5 text-left transition-colors ${isFront ? "border-b border-black/[0.06] bg-[#fbfbfc]" : "bg-gradient-to-b from-[#fdfdfe] to-[#f5f6f9] hover:from-white"}`}
                  style={{ height: SLOT }}
                >
                  <span style={{ color: t.color }}>{t.icon}</span>
                  <span className="min-w-0 truncate text-[15px] font-medium tracking-[-0.01em] text-[#1a1a1a] sm:text-[16px]">{t.label[l]}</span>
                  {isFront && !reduced && !touched && (
                    <span className="ml-auto hidden h-1 w-20 overflow-hidden rounded-full bg-black/[0.06] sm:block" aria-hidden>
                      <span key={`${runs}-${hold}-${inView}`} className="block h-full origin-left rounded-full" style={{ background: INDIGO, animation: hold || !inView ? "none" : `vs-progress ${ROTATE_MS}ms linear both` }} />
                    </span>
                  )}
                  {!isFront && <span className="ml-auto hidden shrink-0 text-[12px] font-medium text-[#8a8f99] sm:inline">{l === "fr" ? "Voir" : "View"} →</span>}
                </button>

                <div
                  role="tabpanel"
                  aria-hidden={!isFront}
                  className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8"
                  style={{ opacity: isFront ? 1 : 0, transition: `opacity ${reduced ? "0s" : ".45s"} ease ${isFront ? ".15s" : "0s"}` }}
                >
                  <div className="min-w-0">
                    <h3 className="text-[22px] font-semibold leading-tight tracking-[-0.025em] text-[#1a1a1a] sm:text-[25px]">{t.title[l]}</h3>
                    <p className="mt-2.5 text-[15px] leading-relaxed text-[#605f5f]">{t.body[l]}</p>
                    <ul className="mt-5 space-y-2">
                      {t.points[l].map((p) => (
                        <li key={p} className="flex gap-2.5 text-[14px] leading-snug text-[#3a3f4b]">
                          <svg viewBox="0 0 24 24" className="mt-[2px] h-4 w-4 shrink-0" fill="none" stroke={t.color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
                          {p}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-5 rounded-xl px-3.5 py-3 text-[13px] leading-relaxed text-[#3a3f4b]" style={{ background: "linear-gradient(180deg,#f7f8fc,#f1f3f8)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.05)" }}>
                      <span className="mr-1 font-semibold text-[#1a1a1a]">{l === "fr" ? "Pourquoi c'est important :" : "Why it matters:"}</span>
                      {t.why[l]}
                    </div>
                  </div>
                  {/* Démo : remontée à chaque passage au premier plan (animations relancées). */}
                  <div className="h-[300px] min-w-0 overflow-hidden sm:h-[310px]">
                    <div className="h-[125%] w-[125%] origin-top-left scale-[0.8] sm:h-full sm:w-full sm:scale-100">
                      {isFront && <D key={runs} l={l} />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

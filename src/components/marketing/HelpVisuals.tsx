"use client";

// Visuels du centre d'aide (/docs) : de petits schémas en HTML/CSS, pas des
// captures d'écran (elles vieillissent à chaque retouche de l'interface).
// Règle : un visuel seulement quand il explique mieux qu'une phrase — un
// principe (1 vidéo → N copies), une comparaison (Invisible / Variations), un
// style (sous-titres), un réglage dans le temps (fenêtre de la caption) ou une
// échelle (score du Comparateur). Bloc `{ type: "visual", id }` dans
// helpCenterContent.ts ; un id inconnu n'affiche rien.

import type { Lang } from "./apiDocsContent";

const INK = "#1a1a1a";
const MUTED = "#605f5f";
const FAINT = "#8a8f99";

type Tx = Record<Lang, string>;
const tx = (t: Tx, lang: Lang) => t[lang];

/* Cadre « téléphone » 9:16 avec une fausse vidéo (dégradé doux). */
function Phone({ children, tone = 0, w = 112, label }: { children?: React.ReactNode; tone?: number; w?: number; label?: React.ReactNode }) {
  const bgs = [
    "linear-gradient(160deg,#c9d6ea 0%,#8fa3c4 45%,#4b5d7e 100%)",
    "linear-gradient(160deg,#e7d3c2 0%,#c49b80 50%,#6f5446 100%)",
    "linear-gradient(160deg,#cfe3d6 0%,#86ad98 50%,#3f5f50 100%)",
  ];
  return (
    <figure className="m-0 flex flex-col items-center gap-2">
      <div
        className="relative overflow-hidden rounded-[18px] ring-1 ring-black/10 shadow-[0_10px_24px_-14px_rgba(20,40,90,0.45)]"
        style={{ width: w, aspectRatio: "9 / 16", background: bgs[tone % bgs.length] }}
      >
        {/* silhouette : la « personne » de la vidéo */}
        <div className="absolute left-1/2 top-[38%] h-[16%] w-[26%] -translate-x-1/2 rounded-full bg-white/35" />
        <div className="absolute bottom-0 left-1/2 h-[34%] w-[62%] -translate-x-1/2 rounded-t-[999px] bg-white/25" />
        {children}
      </div>
      {label && <figcaption className="text-center text-[12.5px] font-medium leading-snug text-[#3a3f4b]">{label}</figcaption>}
    </figure>
  );
}

function Frame({ children, caption }: { children: React.ReactNode; caption?: string }) {
  return (
    <figure className="m-0 rounded-2xl bg-[#f6f7f9] p-5 ring-1 ring-black/[0.06] sm:p-6">
      {children}
      {caption && <figcaption className="mt-4 text-center text-[13px] leading-relaxed text-[#605f5f]">{caption}</figcaption>}
    </figure>
  );
}

function Chip({ children, on = true }: { children: React.ReactNode; on?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10.5px] font-semibold"
      style={on ? { background: "#e8eeff", color: "#2b3a67" } : { background: "#eceef2", color: FAINT }}
    >
      {children}
    </span>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 40 16" className="h-4 w-10 shrink-0 rotate-90 text-[#b8bfcc] sm:rotate-0" aria-hidden>
      <path d="M2 8h32M28 3l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── 1. Duplication : 1 vidéo → N copies, même image, empreinte différente ── */
function DupFingerprint({ lang }: { lang: Lang }) {
  const copies = [
    { dev: "iPhone 15 Pro", id: "a91f…", tone: 0 },
    { dev: "iPhone 14", id: "3c07…", tone: 0 },
    { dev: "iPhone 16", id: "e5b2…", tone: 0 },
  ];
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
      <Phone w={104} label={<>{tx({ fr: "Ta vidéo", en: "Your video" }, lang)}<br /><Chip on={false}>7d4e…</Chip></>} />
      <Arrow />
      <div className="flex gap-3">
        {copies.map((c, i) => (
          <Phone key={i} w={92} tone={c.tone} label={<>{tx({ fr: `Copie ${i + 1}`, en: `Copy ${i + 1}` }, lang)}<br /><Chip>{c.id}</Chip><br /><span className="text-[11px] text-[#8a8f99]">{c.dev}</span></>} />
        ))}
      </div>
    </div>
  );
}

/* ── 2. Duplication IA : Invisible vs Variations ── */
function Caption({ text, style }: { text: string; style: React.CSSProperties }) {
  return (
    <div className="absolute left-1/2 max-w-[86%] -translate-x-1/2 text-center font-semibold leading-tight" style={{ fontSize: 9, width: "max-content", ...style }}>
      {text}
    </div>
  );
}
function AiDupModes({ lang }: { lang: Lang }) {
  const orig = tx({ fr: "3 erreurs à éviter", en: "3 mistakes to avoid" }, lang);
  const v1 = tx({ fr: "Les 3 erreurs de tous", en: "Everyone's 3 mistakes" }, lang);
  const v2 = tx({ fr: "Évite ces 3 pièges", en: "Avoid these 3 traps" }, lang);
  const origStyle: React.CSSProperties = { top: "16%", background: "#fff", color: INK, padding: "3px 6px", borderRadius: 4 };
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="flex flex-col items-center gap-3">
        <p className="text-[13px] font-semibold text-[#1a1a1a]">Invisible</p>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <Phone key={i} w={92}><Caption text={orig} style={origStyle} /></Phone>
          ))}
        </div>
        <p className="max-w-[260px] text-center text-[12.5px] leading-snug text-[#605f5f]">
          {tx({ fr: "Les copies sont identiques à l'œil. Seule l'empreinte du fichier change.", en: "Copies look identical. Only the file fingerprint changes." }, lang)}
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <p className="text-[13px] font-semibold text-[#1a1a1a]">Variations</p>
        <div className="flex gap-2">
          <Phone w={92}><Caption text={orig} style={origStyle} /></Phone>
          <Phone w={92} tone={0}>
            <Caption text={v1} style={{ top: "14%", background: "#111", color: "#fff", padding: "3px 7px", borderRadius: 999 }} />
          </Phone>
          <Phone w={92} tone={0}>
            <Caption text={v2} style={{ top: "17%", background: "#ffd84d", color: INK, padding: "2px 5px", borderRadius: 0, fontFamily: "Georgia, serif" }} />
            <div className="absolute bottom-[24%] left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-extrabold uppercase text-white" style={{ WebkitTextStroke: "1.6px #000", paintOrder: "stroke fill" }}>
              {tx({ fr: "vraiment", en: "really" }, lang)}
            </div>
          </Phone>
        </div>
        <p className="max-w-[260px] text-center text-[12.5px] leading-snug text-[#605f5f]">
          {tx({ fr: "L'IA réécrit la caption et change son style, le cadrage et les sous-titres.", en: "The AI rewrites the caption and changes its style, framing and subtitles." }, lang)}
        </p>
      </div>
    </div>
  );
}

/* ── 3. Les 4 styles de sous-titres ── */
function SubtitleStyles({ lang }: { lang: Lang }) {
  const stroke = (px: number): React.CSSProperties => ({ WebkitTextStroke: `${px}px #000`, paintOrder: "stroke fill" });
  const items: { name: string; desc: Tx; el: React.ReactNode }[] = [
    {
      name: tx({ fr: "Karaoké", en: "Karaoke" }, lang),
      desc: { fr: "Le mot dit s'allume", en: "The spoken word lights up" },
      el: (
        <div className="absolute bottom-[26%] left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-extrabold uppercase text-white" style={stroke(2)}>
          {lang === "fr" ? <>c'est <span style={{ color: "#ffd84d" }}>simple</span></> : <>so <span style={{ color: "#ffd84d" }}>easy</span></>}
        </div>
      ),
    },
    {
      name: tx({ fr: "Mot par mot", en: "Word by word" }, lang),
      desc: { fr: "Un mot, très gros", en: "One huge word" },
      el: <div className="absolute bottom-[28%] left-1/2 -translate-x-1/2 text-[17px] font-extrabold uppercase text-white" style={stroke(2.6)}>{lang === "fr" ? "SIMPLE" : "EASY"}</div>,
    },
    {
      name: tx({ fr: "Bandeau TikTok", en: "TikTok banner" }, lang),
      desc: { fr: "Fond de couleur", en: "Colour background" },
      el: (
        <div className="absolute bottom-[27%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[5px] px-1.5 py-0.5 text-[8.5px] font-semibold text-white" style={{ background: "#ff3b6b" }}>
          {lang === "fr" ? "c'est vraiment simple" : "it's really easy"}
        </div>
      ),
    },
    {
      name: tx({ fr: "Classique", en: "Classic" }, lang),
      desc: { fr: "2 lignes, contour fin", en: "2 lines, thin outline" },
      el: (
        <div className="absolute bottom-[24%] left-1/2 w-[86%] -translate-x-1/2 text-center text-[8.5px] font-semibold leading-tight text-white" style={{ textShadow: "0 0 2px #000, 0 0 2px #000, 0 1px 2px #000" }}>
          {lang === "fr" ? "et franchement c'est vraiment simple à faire" : "and honestly it's really easy to do"}
        </div>
      ),
    },
  ];
  return (
    <div className="grid grid-cols-2 justify-items-center gap-5 sm:grid-cols-4">
      {items.map((it, i) => (
        <Phone key={i} w={104} tone={i % 3} label={<>{it.name}<br /><span className="text-[11.5px] font-normal text-[#8a8f99]">{tx(it.desc, lang)}</span></>}>
          {it.el}
        </Phone>
      ))}
    </div>
  );
}

/* ── 4. Quand la caption s'affiche ── */
function CaptionTiming({ lang }: { lang: Lang }) {
  const rows: { name: Tx; from: number; to: number }[] = [
    { name: { fr: "Toute la vidéo", en: "Whole video" }, from: 0, to: 100 },
    { name: { fr: "Au début", en: "At the start" }, from: 0, to: 20 },
    { name: { fr: "Au milieu", en: "In the middle" }, from: 40, to: 60 },
    { name: { fr: "À la fin", en: "At the end" }, from: 80, to: 100 },
    { name: { fr: "Personnalisé (ex. 4 s → 9 s)", en: "Custom (e.g. 4 s → 9 s)" }, from: 27, to: 60 },
  ];
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,130px)_1fr] items-center gap-3 sm:grid-cols-[190px_1fr]">
          <span className="text-[13px] font-medium text-[#3a3f4b]">{tx(r.name, lang)}</span>
          <div className="relative h-3 rounded-full bg-[#e3e6ec]">
            <div className="absolute inset-y-0 rounded-full" style={{ left: `${r.from}%`, width: `${r.to - r.from}%`, background: "linear-gradient(90deg,#6aa0ff,#4f7bff)" }} />
          </div>
        </div>
      ))}
      <div className="grid grid-cols-[minmax(0,130px)_1fr] gap-3 sm:grid-cols-[190px_1fr]">
        <span />
        <div className="flex justify-between text-[11px] text-[#8a8f99]"><span>0 s</span><span>{tx({ fr: "fin de la vidéo", en: "end of video" }, lang)}</span></div>
      </div>
    </div>
  );
}

/* ── 5. Éditeur IA : référence + matière → Claude → variantes ── */
function EditorFlow({ lang }: { lang: Lang }) {
  const Box = ({ title, sub, strong }: { title: string; sub: string; strong?: boolean }) => (
    <div
      className="w-full rounded-2xl px-4 py-3 text-center ring-1 sm:w-[170px]"
      style={strong ? { background: "linear-gradient(180deg,#eef3ff,#e2eaff)", boxShadow: "0 0 0 1px #c9d7ff" } : { background: "#fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.06)" }}
    >
      <p className="text-[14px] font-semibold" style={{ color: INK }}>{title}</p>
      <p className="mt-0.5 text-[12px] leading-snug" style={{ color: MUTED }}>{sub}</p>
    </div>
  );
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      <div className="flex w-full flex-col gap-2 sm:w-auto">
        <Box title={tx({ fr: "Référence", en: "Reference" }, lang)} sub={tx({ fr: "la vidéo dont tu veux le style", en: "the video whose style you want" }, lang)} />
        <Box title={tx({ fr: "Matière", en: "Material" }, lang)} sub={tx({ fr: "tes rushes, images, sons", en: "your footage, images, sounds" }, lang)} />
      </div>
      <Arrow />
      <Box strong title="Claude" sub={tx({ fr: "monte la vidéo selon ta demande", en: "edits the video as you ask" }, lang)} />
      <Arrow />
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => <Phone key={i} w={58} tone={i} />)}
      </div>
    </div>
  );
}

/* ── 6. Comparateur : lire le score ── */
function SimilarityScale({ lang }: { lang: Lang }) {
  const zones = [
    { from: 0, to: 45, color: "#22a06b", name: { fr: "Distincts", en: "Distinct" }, sub: { fr: "sûr à republier", en: "safe to repost" } },
    { from: 45, to: 75, color: "#e0a100", name: { fr: "Modéré", en: "Moderate" }, sub: { fr: "différence partielle", en: "partial difference" } },
    { from: 75, to: 100, color: "#e5484d", name: { fr: "Très similaires", en: "Very similar" }, sub: { fr: "risque de doublon", en: "duplicate risk" } },
  ];
  return (
    <div>
      <div className="flex h-3.5 overflow-hidden rounded-full">
        {zones.map((z, i) => <div key={i} style={{ width: `${z.to - z.from}%`, background: z.color }} />)}
      </div>
      <div className="relative mt-1 h-4 text-[11px] text-[#8a8f99]">
        {[0, 45, 75, 100].map((v) => (
          <span key={v} className="absolute -translate-x-1/2" style={{ left: `${v}%`, transform: v === 0 ? "none" : v === 100 ? "translateX(-100%)" : undefined }}>{v} %</span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {zones.map((z, i) => (
          <div key={i}>
            <p className="text-[13px] font-semibold" style={{ color: z.color }}>{tx(z.name, lang)}</p>
            <p className="text-[12px] text-[#605f5f]">{tx(z.sub, lang)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const VISUALS: Record<string, (p: { lang: Lang }) => React.ReactElement> = {
  "dup-fingerprint": DupFingerprint,
  "ai-dup-modes": AiDupModes,
  "subtitle-styles": SubtitleStyles,
  "caption-timing": CaptionTiming,
  "editor-flow": EditorFlow,
  "similarity-scale": SimilarityScale,
};

export function HelpVisual({ id, caption, lang }: { id: string; caption?: string; lang: Lang }) {
  const V = VISUALS[id];
  if (!V) return null;
  return (
    <Frame caption={caption}>
      <V lang={lang} />
    </Frame>
  );
}


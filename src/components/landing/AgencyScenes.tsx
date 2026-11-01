"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { CTA_GRAD } from "@/components/landing/shell";

/* ══════════════════════════════════════════════════════════════
 * SCÈNES « POUR LES AGENCES » — des mini-écrans du VRAI dashboard, avec un
 * curseur qui clique. Libellés repris de l'app (fr.json → dashboard.workspaces,
 * bouton Drive, outils MCP).
 *
 * Chaque scène joue une fois (keyframes md-* + délais inline) ; Bento.tsx la
 * remonte toutes les AGENCY_CYCLE_MS pour boucler.
 * Le curseur (SimCursor) MESURE la position réelle de ses cibles puis anime
 * son trajet via Web Animations : il clique pile sur les boutons à toute largeur.
 * Les boutons cliqués s'enfoncent au même instant (md-press, même délai).
 * ══════════════════════════════════════════════════════════════ */

type L = "fr" | "en";
const T = (l: L, fr: string, en: string) => (l === "en" ? en : fr);

const THUMB = "/variant-thumb.jpg";
const REF = "/mock-reference.jpg";
const RUSH = "/mock-rush.jpg";
const POSTER = "/mock-output-poster.jpg";
const DRIVE_LOGO = "/google-drive.svg";
const CLAUDE_MARK = "/claude-ai-logo-rounded-hd-free-png-1.webp";

const A = (name: string, delay: number, dur?: number, extra?: React.CSSProperties): React.CSSProperties => ({
  animationName: name,
  animationDelay: `${delay}s`,
  ...(dur ? { animationDuration: `${dur}s` } : {}),
  ...extra,
});

const Spinner = ({ color = "#7c5cff" }: { color?: string }) => (
  <span className="md-spin inline-block h-3 w-3 shrink-0 rounded-full border-2 border-current border-t-transparent" style={{ color }} />
);
const Check = ({ className = "h-2.5 w-2.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);

/* ─── Curseur simulé ─── */
type Step = { target: RefObject<HTMLElement>; t: number; click?: boolean };

function SimCursor({ box, steps, total }: { box: RefObject<HTMLElement>; steps: Step[]; total: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const b = box.current;
    if (!el || !b || typeof el.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const br = b.getBoundingClientRect();
    // Le décor peut être zoomé au survol (scale) : on ramène à l'échelle 1.
    const k = b.offsetWidth ? br.width / b.offsetWidth : 1;
    const pts = steps
      .map((s) => {
        const r = s.target.current?.getBoundingClientRect();
        return r ? { x: (r.left + r.width / 2 - br.left) / k, y: (r.top + r.height / 2 - br.top) / k, t: s.t, click: s.click } : null;
      })
      .filter((p): p is { x: number; y: number; t: number; click: boolean | undefined } => !!p);
    if (!pts.length) return;

    const ease = "cubic-bezier(0.45, 0, 0.25, 1)";
    const at = (x: number, y: number, s = 1) => `translate(${x}px, ${y}px) scale(${s})`;
    const frames: Keyframe[] = [];
    let last = 0;
    const push = (sec: number, f: Keyframe) => {
      const off = Math.min(1, Math.max(last, sec / total));
      last = off;
      frames.push({ ...f, offset: off, easing: ease });
    };
    const p0 = pts[0];
    push(0, { opacity: 0, transform: at(p0.x + 80, p0.y + 60) });
    push(Math.max(0, p0.t - 0.9), { opacity: 1, transform: at(p0.x + 80, p0.y + 60) });
    pts.forEach((p, i) => {
      if (i > 0) push(Math.max(pts[i - 1].t + 0.35, p.t - 0.7), { opacity: 1, transform: at(pts[i - 1].x, pts[i - 1].y) });
      push(p.t, { opacity: 1, transform: at(p.x, p.y) });
      if (p.click) {
        push(p.t + 0.1, { opacity: 1, transform: at(p.x, p.y, 0.8) });
        push(p.t + 0.25, { opacity: 1, transform: at(p.x, p.y) });
      }
    });
    const end = pts[pts.length - 1];
    push(end.t + 0.6, { opacity: 1, transform: at(end.x, end.y) });
    push(end.t + 0.9, { opacity: 0, transform: at(end.x, end.y) });
    push(total, { opacity: 0, transform: at(end.x, end.y) });
    const anim = el.animate(frames, { duration: total * 1000, fill: "forwards" });
    return () => anim.cancel();
  }, [box, steps, total]);

  return (
    <span ref={ref} aria-hidden className="pointer-events-none absolute left-0 top-0 z-40" style={{ opacity: 0 }}>
      {/* La pointe (5,3 dans le viewBox) tombe sur la cible. */}
      <svg className="-ml-[4px] -mt-[2.5px] h-5 w-5 drop-shadow-[0_2px_3px_rgba(0,0,0,0.25)]" viewBox="0 0 24 24" fill="#1a1a1a" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round"><path d="M5 3l14 8-6.2 1.6L9.6 19z" /></svg>
    </span>
  );
}

/* Fenêtre d'app : barre de titre + contenu. */
function AppFrame({ title, right, children, className = "" }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl bg-white/95 shadow-[0_10px_30px_rgba(30,40,120,0.12)] ring-1 ring-black/[0.06] ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-black/[0.05] px-3 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[#e5e8ef]" /><span className="h-1.5 w-1.5 rounded-full bg-[#e5e8ef]" /><span className="h-1.5 w-1.5 rounded-full bg-[#e5e8ef]" />
        <span className="ml-1 truncate text-[10.5px] font-semibold text-[#1a1a1a]">{title}</span>
        <span className="ml-auto">{right}</span>
      </div>
      {children}
    </div>
  );
}

const Avatar = ({ n, c, size = 18 }: { n: string; c: string; size?: number }) => (
  <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, background: c, fontSize: size * 0.45 }}>{n[0]}</span>
);

/* ══════════ 1 · Google Drive : importer → dupliquer → envoyer vers Drive ══════════ */
export function DriveScene({ l }: { l: L }) {
  const box = useRef<HTMLDivElement>(null);
  const importBtn = useRef<HTMLSpanElement>(null);
  const selectBtn = useRef<HTMLSpanElement>(null);
  const saveBtn = useRef<HTMLSpanElement>(null);
  const files = ["IMG_0831.MOV", "IMG_0832.MOV", "IMG_0840.MOV", "IMG_0847.MOV"];
  const imgs = [THUMB, RUSH, REF, POSTER];
  return (
    <div ref={box} className="relative w-full max-w-[560px]">
      <AppFrame
        title={T(l, "Duplication vidéo", "Video duplication")}
        right={<span className="flex items-center gap-1 rounded-full bg-[#f4f6fb] py-0.5 pl-0.5 pr-2 text-[9.5px] font-semibold text-[#1a1a1a] ring-1 ring-black/[0.05]"><Avatar n="Emma" c="#f472b6" size={14} />Emma</span>}
      >
        <div className="grid grid-cols-[0.9fr_1.1fr] gap-2.5 p-2.5">
          {/* Dépôt + import Drive */}
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#c9d1e2] bg-[#f8f9fc] px-2 py-4 text-center">
            <span className="text-[9.5px] text-[#8a8f99]">{T(l, "Glisse tes vidéos ici", "Drop your videos here")}</span>
            <span ref={importBtn} className="md-a inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#1a1a1a] shadow-[0_3px_10px_rgba(20,40,90,0.08)] ring-1 ring-black/[0.08]" style={A("md-press", 0.9, 0.35)}>
              <img src={DRIVE_LOGO} alt="" className="h-3.5 w-3.5" />{T(l, "Importer depuis Drive", "Import from Drive")}
            </span>
          </div>
          {/* Fichiers importés, duplication, envoi */}
          <div className="flex min-w-0 flex-col gap-1.5">
            {files.map((f, i) => (
              <div key={f} className="md-a flex items-center gap-1.5 rounded-md bg-[#f8f9fc] px-1.5 py-1 ring-1 ring-black/[0.04]" style={A("md-rise", 2.45 + i * 0.1)}>
                <span className="h-4 w-2.5 shrink-0 overflow-hidden rounded-[2px]"><img src={imgs[i]} alt="" className="h-full w-full object-cover" /></span>
                <span className="truncate font-mono text-[9px] text-[#1a1a1a]">{f}</span>
                <span className="ml-auto text-[8.5px] font-semibold text-[#7c5cff]">×10</span>
              </div>
            ))}
            <div className="md-a mt-0.5" style={A("md-rise", 2.9)}>
              <div className="mb-0.5 flex justify-between text-[8.5px] font-medium text-[#605f5f]">
                <span>{T(l, "Duplication…", "Duplicating…")}</span><span className="text-[#4f7bff]">40/40</span>
              </div>
              <span className="block h-1 overflow-hidden rounded-full bg-[#eef1f7]">
                <span className="md-a block h-full rounded-full" style={{ width: "100%", background: CTA_GRAD, ...A("md-fill", 3.0, 1.0, { animationTimingFunction: "ease-in-out" }) }} />
              </span>
            </div>
            <span ref={saveBtn} className="md-a inline-flex items-center justify-center gap-1.5 self-end rounded-lg px-2.5 py-1 text-[9.5px] font-semibold text-white" style={{ background: CTA_GRAD, ...A("md-pop", 4.0), animationName: "md-pop" }}>
              <span className="md-a inline-flex items-center gap-1.5" style={A("md-press", 4.7, 0.35)}>
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-white"><img src={DRIVE_LOGO} alt="" className="h-2.5 w-2.5" /></span>
                {T(l, "Envoyer vers Drive", "Send to Drive")}
              </span>
            </span>
          </div>
        </div>
      </AppFrame>

      {/* Sélecteur Google Drive (ouvert par le clic) */}
      <div className="md-a absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-[#1a1a1a]/10" style={{ opacity: 0, ...A("md-flash", 1.15, 1.35) }}>
        <div className="w-[72%] max-w-[340px] rounded-xl bg-white p-2.5 shadow-[0_18px_40px_rgba(20,30,80,0.25)] ring-1 ring-black/[0.06]">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#1a1a1a]"><img src={DRIVE_LOGO} alt="" className="h-3.5 w-3.5" />Google Drive <span className="font-normal text-[#8a8f99]">· Emma / {T(l, "brut", "raw")}</span></div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {imgs.map((src, i) => (
              <span key={i} className="relative block aspect-square overflow-hidden rounded-md">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <span className="md-a absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-white ring-1 ring-white" style={{ background: "#1a73e8", ...A("md-pop", 1.5 + i * 0.08) }}><Check className="h-2 w-2" /></span>
              </span>
            ))}
          </div>
          <div className="mt-2 flex justify-end">
            <span ref={selectBtn} className="md-a rounded-md bg-[#1a73e8] px-2.5 py-1 text-[9.5px] font-semibold text-white" style={A("md-press", 2.05, 0.3)}>{T(l, "Sélectionner (4)", "Select (4)")}</span>
          </div>
        </div>
      </div>

      {/* Confirmation */}
      <div className="md-a absolute inset-x-0 -bottom-3 z-20 flex justify-center" style={A("md-rise", 5.0)}>
        <span className="rounded-full bg-[#1a1a1a] px-3 py-1.5 text-[9.5px] font-medium text-white shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
          ✓ {T(l, "40 fichiers envoyés dans « Emma — DuupFlow »", "40 files sent to “Emma — DuupFlow”")}
        </span>
      </div>

      <SimCursor box={box} total={6} steps={[{ target: importBtn, t: 0.9, click: true }, { target: selectBtn, t: 2.05, click: true }, { target: saveBtn, t: 4.7, click: true }]} />
    </div>
  );
}

/* ══════════ 2 · Rôles — boucle continue (pas de remontage) ══════════
   Chaque membre et les créatrices auxquelles il a accès ; un halo passe de ligne
   en ligne (ag-spot, 3 lignes décalées d'1/3 de période). */
const TEAM = [
  { n: "Toi", en: "You", role: "Manager", c: "linear-gradient(135deg,#4f7bff 0%,#6d28d9 100%)", access: [0, 1, 2] },
  { n: "Lucas", en: "Lucas", role: "VA", c: "linear-gradient(135deg,#06b6d4 0%,#2563eb 100%)", access: [0] },
  { n: "Sarah", en: "Sarah", role: "VA", c: "linear-gradient(135deg,#f97316 0%,#e11d48 100%)", access: [1] },
];
const TEAM_CREATORS = [
  { n: "Emma", c: "#f472b6", photo: "/creators/creator-1.jpg" },
  { n: "Lina", c: "#818cf8", photo: "/creators/creator-2.jpg" },
  { n: "Jade", c: "#38bdf8", photo: "/creators/creator-3.jpg" },
];

/* Fil d'activité : N messages qui se relaient en fondu, en boucle continue
   (ag-tick, délais décalés ; la période = N × `step` secondes). */
function Ticker({ items, step = 3 }: { items: React.ReactNode[]; step?: number }) {
  const period = items.length * step;
  return (
    <span className="relative block h-5 overflow-hidden">
      {items.map((it, i) => (
        <span key={i} className="ag-tick absolute inset-0 flex items-center gap-1.5 whitespace-nowrap"
          style={{ animationDuration: `${period}s`, animationDelay: `${i * step - period}s`, ["--ag-n" as string]: items.length } as React.CSSProperties}>
          {it}
        </span>
      ))}
    </span>
  );
}

export function RolesScene({ l }: { l: L }) {
  const scope = [T(l, "Tous les créateurs", "All creators"), T(l, "Emma uniquement", "Emma only"), T(l, "Lina uniquement", "Lina only")];
  return (
    /* Sans cadre ni blocs : les membres posés sur la carte, séparés par des filets.
       Une fine barre bleue s'allume à gauche de chaque ligne, tour à tour. */
    <div className="w-full max-w-[290px]">
      <div className="divide-y divide-[#4f7bff]/10">
        {TEAM.map((m, i) => (
          <div key={m.n} className="relative flex items-center gap-2.5 overflow-hidden py-2.5 pl-3">
            <span className="ag-spot absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full" style={{ background: CTA_GRAD, animationDelay: `${i * 2}s` }} />
            {/* Reflet qui balaie la ligne active (même horloge que la barre) */}
            <span className="ag-sweep pointer-events-none absolute inset-y-0 left-0 w-1/2" style={{ background: "linear-gradient(90deg,transparent,rgba(79,123,255,0.10),transparent)", animationDelay: `${i * 2}s` }} />
            <span className="relative">
              <span className="block rounded-full shadow-[0_4px_12px_rgba(40,40,140,0.28)]"><Avatar n={m.n} c={m.c} size={26} /></span>
              {/* En ligne */}
              <span className="absolute -bottom-px -right-px h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white">
                <span className="ag-ping absolute inset-0 rounded-full bg-emerald-400" style={{ animationDelay: `${i * 0.7}s` }} />
              </span>
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[12px] font-semibold text-[#1a1a1a]">{l === "en" ? m.en : m.n}</span>
                <span
                  className={`rounded-full px-1.5 py-px text-[8.5px] font-semibold ${m.role === "Manager" ? "text-white" : "bg-[#4f7bff]/10 text-[#4f7bff]"}`}
                  style={m.role === "Manager" ? { background: CTA_GRAD } : undefined}
                >
                  {m.role}
                </span>
              </span>
              <span className="block truncate text-[9.5px] text-[#8a8f99]">{scope[i]}</span>
            </span>
            <span className="ml-auto flex -space-x-1">
              {TEAM_CREATORS.map((c, j) => {
                const ok = m.access.includes(j);
                return (
                  <span key={c.n} className="relative" title={c.n}>
                    <span className={`block h-[22px] w-[22px] overflow-hidden rounded-full ring-2 ring-white ${ok ? "" : "opacity-30 grayscale"}`}>
                      <img src={c.photo} alt="" className="h-full w-full object-cover" style={{ objectPosition: "50% 30%" }} />
                    </span>
                    {/* Accès : anneau bleu quand la ligne s'allume */}
                    {ok && <span className="ag-spot pointer-events-none absolute -inset-[2px] rounded-full ring-2 ring-[#4f7bff] shadow-[0_0_10px_rgba(79,123,255,0.45)]" style={{ animationDelay: `${i * 2}s` }} />}
                    {!ok && (
                      <svg className="absolute inset-0 m-auto h-2.5 w-2.5 text-[#605f5f]" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z" /></svg>
                    )}
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </div>
      {/* Activité de l'équipe, en continu */}
      <div className="mt-1.5 border-t border-[#4f7bff]/10 pl-3 pt-2 text-[9.5px] text-[#605f5f]">
        <Ticker items={[
          <><Avatar n="Lucas" c="linear-gradient(135deg,#06b6d4 0%,#2563eb 100%)" size={13} /><b className="font-semibold text-[#1a1a1a]">Lucas</b> {T(l, "a dupliqué 12 vidéos · Emma", "duplicated 12 videos · Emma")}</>,
          <><Avatar n="Sarah" c="linear-gradient(135deg,#f97316 0%,#e11d48 100%)" size={13} /><b className="font-semibold text-[#1a1a1a]">Sarah</b> {T(l, "a envoyé 30 copies vers Drive", "sent 30 copies to Drive")}</>,
          <><Avatar n="Toi" c="linear-gradient(135deg,#4f7bff 0%,#6d28d9 100%)" size={13} /><b className="font-semibold text-[#1a1a1a]">{T(l, "Toi", "You")}</b> {T(l, "as assigné Lucas à Emma", "assigned Lucas to Emma")}</>,
        ]} />
      </div>
    </div>
  );
}

/* ══════════ 3 · 15 espaces — profils qui défilent ══════════
   Pas de cadre : une colonne de profils de créatrices qui entre par le bas et
   sort par le haut, en boucle continue (liste doublée, translateY -50 %).
   Chaque profil montre son état réel : Drive connecté ou non, brief prêt ou non.
   `photo` : visages générés par IA (public/creators/) ; sans photo, pastille à
   l'initiale. */
type Profile = { n: string; c: string; photo?: string; drive: boolean; brief: boolean };
const PROFILES: Profile[] = [
  { n: "Emma", c: "#f472b6", photo: "/creators/creator-1.jpg", drive: true, brief: true },
  { n: "Lina", c: "#818cf8", photo: "/creators/creator-2.jpg", drive: true, brief: false },
  { n: "Jade", c: "#38bdf8", photo: "/creators/creator-3.jpg", drive: false, brief: true },
  { n: "Mia", c: "#34d399", photo: "/creators/creator-4.jpg", drive: true, brief: true },
  { n: "Léa", c: "#fbbf24", photo: "/creators/creator-5.jpg", drive: false, brief: false },
  { n: "Zoé", c: "#fb7185", photo: "/creators/creator-6.jpg", drive: true, brief: true },
];

function ProfileRow({ p, l }: { p: Profile; l: L }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      {p.photo ? (
        <img src={p.photo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-white shadow-[0_4px_10px_rgba(20,40,90,0.12)]" style={{ objectPosition: "50% 30%" }} />
      ) : (
        <span className="ring-2 ring-white rounded-full shadow-[0_4px_10px_rgba(20,40,90,0.12)]"><Avatar n={p.n} c={p.c} size={32} /></span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold text-[#1a1a1a]">{p.n}</span>
        <span className="mt-0.5 flex flex-wrap gap-1">
          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[8.5px] font-semibold ${p.drive ? "bg-emerald-50 text-emerald-700" : "bg-[#f1f3f8] text-[#8a8f99]"}`}>
            <img src={DRIVE_LOGO} alt="" className={`h-2.5 w-2.5 ${p.drive ? "" : "opacity-40 grayscale"}`} />
            {p.drive ? T(l, "Drive connecté", "Drive connected") : T(l, "Drive non connecté", "Drive not connected")}
          </span>
          <span className={`inline-flex items-center rounded-full px-1.5 py-px text-[8.5px] font-semibold ${p.brief ? "bg-[#4f7bff]/10 text-[#4f7bff]" : "bg-amber-50 text-amber-700"}`}>
            {p.brief ? T(l, "Brief prêt", "Brief ready") : T(l, "Brief à écrire", "Brief to write")}
          </span>
        </span>
      </span>
    </div>
  );
}

export function SpacesScene({ l }: { l: L }) {
  const loop = [...PROFILES, ...PROFILES];
  return (
    <div
      className="h-[190px] w-full max-w-[260px] overflow-hidden"
      style={{ maskImage: "linear-gradient(180deg,transparent,#000 22%,#000 78%,transparent)", WebkitMaskImage: "linear-gradient(180deg,transparent,#000 22%,#000 78%,transparent)" }}
    >
      <div className="ag-scroll-up">
        {loop.map((p, i) => <ProfileRow key={i} p={p} l={l} />)}
      </div>
    </div>
  );
}

/* ══════════ 4 · Claude : la demande, l'outil DuupFlow, la réponse ══════════ */
export function ClaudeScene({ l }: { l: L }) {
  const box = useRef<HTMLDivElement>(null);
  const send = useRef<HTMLSpanElement>(null);
  const ask = T(l, "Duplique les 4 vidéos d'Emma, 10 copies chacune.", "Duplicate Emma's 4 videos, 10 copies each.");
  return (
    <div ref={box} className="relative w-full max-w-[520px]">
      <AppFrame
        title="Claude"
        right={<span className="flex items-center gap-1 rounded-full bg-[#fbeee8] px-1.5 py-0.5 text-[8.5px] font-semibold text-[#c2410c]">DuupFlow · {T(l, "connecté", "connected")}</span>}
      >
        <div className="flex h-[132px] flex-col justify-end gap-1.5 bg-[#faf9f7] px-3 pb-2 pt-2">
          <div className="flex justify-end">
            <span className="md-a max-w-[80%] rounded-2xl rounded-br-md bg-[#efece6] px-3 py-1.5 text-[10.5px] leading-snug text-[#1a1a1a]" style={A("md-rise", 2.15)}>{ask}</span>
          </div>
          {/* Appel d'outil DuupFlow (vrai nom d'outil MCP) */}
          <div className="md-a flex items-center gap-1.5" style={A("md-rise", 2.6)}>
            <img src={CLAUDE_MARK} alt="" className="h-4 w-4 shrink-0 rounded object-contain" />
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 font-mono text-[9px] text-[#605f5f] ring-1 ring-black/[0.06]">
              <span className="relative inline-flex h-3 w-3">
                <span className="md-a absolute inset-0" style={A("md-out", 3.7, 0.2)}><Spinner color="#c2410c" /></span>
                <span className="md-a absolute inset-0 text-emerald-600" style={A("md-pop", 3.8)}><Check className="h-3 w-3" /></span>
              </span>
              duupflow · duplicate_videos
            </span>
          </div>
          <div className="md-a pl-[22px]" style={A("md-rise", 4.0)}>
            <span className="inline-block max-w-[90%] text-[10.5px] leading-snug text-[#1a1a1a]">
              ✓ {T(l, "Fait. 40 copies prêtes dans l'espace d'Emma.", "Done. 40 copies ready in Emma's workspace.")}
            </span>
          </div>
        </div>
        {/* Zone de saisie : la demande se tape, puis part */}
        <div className="flex items-center gap-2 border-t border-black/[0.05] bg-white px-2.5 py-1.5">
          <span className="relative h-4 min-w-0 flex-1 overflow-hidden text-[10.5px] leading-4">
            <span className="md-a absolute inset-0 truncate text-[#a0a6b4]" style={A("md-out", 0.35, 0.15)}>{T(l, "Écris à Claude…", "Message Claude…")}</span>
            <span className="md-a absolute inset-0" style={{ opacity: 0, ...A("md-flash", 0.35, 1.8) }}>
              <span className="md-a md-type block truncate whitespace-nowrap text-[#1a1a1a]" style={A("md-type", 0.4, 1.3)}>{ask}</span>
            </span>
            <span className="md-a absolute inset-0 truncate text-[#a0a6b4]" style={A("md-pop", 2.2)}>{T(l, "Écris à Claude…", "Message Claude…")}</span>
          </span>
          <span ref={send} className="md-a flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#c2410c] text-white" style={A("md-press", 1.95, 0.3)}>
            <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </span>
        </div>
      </AppFrame>
      <SimCursor box={box} total={6} steps={[{ target: send, t: 1.95, click: true }]} />
    </div>
  );
}

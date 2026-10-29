"use client";

/**
 * Dashboard d'accueil : activité de l'équipe.
 *
 *   ┌──────────────────────────────┬──────────────────────────────┐
 *   │ Duplications vidéo (courbe)  │ Vidéos éditées (courbe)      │
 *   ├──────────────────────────────┼──────────────────────────────┤
 *   │ Dernières duplications       │ Temps de montage économisé   │
 *   └──────────────────────────────┴──────────────────────────────┘
 *
 * Chaque courbe a ses propres filtres (créateur + période). Le temps économisé
 * suit les filtres de la courbe « Vidéos éditées ». Données :
 * /api/dashboard/activity (src/app/api/dashboard/activity/route.ts).
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";

type Range = "today" | "7d" | "30d";
type Metric = "duplications" | "edits";
type Workspace = { id: string; name: string; color: string };
type Bucket = { t: string; v: number };
type Series = { buckets: Bucket[]; total: number; workspaces: Workspace[] };
type LogItem = {
  id: string;
  at: string;
  type: "video" | "image";
  qty: number;
  who: { isMe: boolean; name: string | null };
  creator: Workspace | null;
  label: string | null;
  origin: string | null;
};

/** Estimation du montage manuel évité par vidéo produite avec l'Éditeur IA. */
const MINUTES_SAVED_PER_EDIT = 15;

const CARD = "dash-card rounded-2xl";

function tzOffset() {
  return new Date().getTimezoneOffset();
}

function useSeries(metric: Metric, range: Range, ws: string) {
  const [state, setState] = useState<{ data: Series | null; loading: boolean; error: boolean }>({
    data: null,
    loading: true,
    error: false,
  });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: false }));
    const qs = new URLSearchParams({ metric, range, ws, tz: String(tzOffset()) });
    fetch(`/api/dashboard/activity?${qs}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: Series) => alive && setState({ data: d, loading: false, error: false }))
      .catch(() => alive && setState((s) => ({ ...s, loading: false, error: true })));
    return () => {
      alive = false;
    };
  }, [metric, range, ws]);
  return state;
}

/* ───────────────────────── Filtres ───────────────────────── */

function RangeTabs({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const { t } = useTranslation();
  const opts: { k: Range; label: string }[] = [
    { k: "today", label: t("dashboard.home.rangeToday") },
    { k: "7d", label: t("dashboard.home.range7d") },
    { k: "30d", label: t("dashboard.home.range30d") },
  ];
  return (
    <div className="inline-flex rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-2)] p-0.5">
      {opts.map((o) => (
        <button
          key={o.k}
          type="button"
          onClick={() => onChange(o.k)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            value === o.k
              ? "bg-[var(--app-surface)] text-[var(--app-text)] shadow-sm"
              : "text-[var(--app-text-faint)] hover:text-[var(--app-text-muted)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CreatorSelect({ value, onChange, workspaces }: { value: string; onChange: (v: string) => void; workspaces: Workspace[] }) {
  const { t } = useTranslation();
  if (workspaces.length === 0) return null;
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-2)] py-1 pl-2.5 pr-7 text-xs font-medium text-[var(--app-text-muted)] outline-none"
      >
        <option value="all">{t("dashboard.home.allCreators")}</option>
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      {/* Flèche maison : celle du navigateur collait au bord. */}
      <svg viewBox="0 0 16 16" className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--app-text-faint)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6l4 4 4-4" />
      </svg>
    </div>
  );
}

/* ───────────────────────── Courbe ───────────────────────── */

/** Borne haute « ronde » de l'axe Y. */
function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * p;
}

/** Courbe monotone (Fritsch–Carlson) : lisse, sans jamais passer sous zéro. */
function monotonePath(pts: { x: number; y: number }[]) {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    m.push((pts[i + 1].y - pts[i].y) / (dx[i] || 1));
  }
  const tg: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) tg.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  tg.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { tg[i] = 0; tg[i + 1] = 0; continue; }
    const a = tg[i] / m[i], b = tg[i + 1] / m[i], h = a * a + b * b;
    if (h > 9) { const s = 3 / Math.sqrt(h); tg[i] = s * a * m[i]; tg[i + 1] = s * b * m[i]; }
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i].x + h},${pts[i].y + tg[i] * h} ${pts[i + 1].x - h},${pts[i + 1].y - tg[i + 1] * h} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

function ActivityChart({ buckets, range, color, unit, empty, startHref }: { buckets: Bucket[]; range: Range; color: string; unit: string; empty: boolean; startHref: string }) {
  const { t, locale } = useTranslation();
  const boxRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const H = 200;
  const PAD = { l: 34, r: 12, t: 12, b: 26 };

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const loc = locale === "en" ? "en-US" : "fr-FR";
  const fmtTick = useMemo(() => {
    if (range === "today") return (d: Date) => `${d.getHours()}h`;
    if (range === "7d") return (d: Date) => d.toLocaleDateString(loc, { weekday: "short" }).replace(".", "");
    return (d: Date) => d.toLocaleDateString(loc, { day: "numeric", month: "short" }).replace(".", "");
  }, [range, loc]);
  const fmtTip = (d: Date) =>
    range === "today"
      ? `${d.getHours()}h – ${d.getHours() + 1}h`
      : d.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" });

  const max = niceMax(Math.max(0, ...buckets.map((b) => b.v)));
  const iw = Math.max(0, w - PAD.l - PAD.r);
  const ih = H - PAD.t - PAD.b;
  const n = buckets.length;
  const x = (i: number) => PAD.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const pts = buckets.map((b, i) => ({ x: x(i), y: y(b.v) }));
  const line = monotonePath(pts);
  const area = n > 1 ? `${line} L${x(n - 1)},${PAD.t + ih} L${x(0)},${PAD.t + ih} Z` : "";

  // Étiquettes de l'axe X : toutes sur 7 j, une sur ~5 sinon.
  const every = n <= 8 ? 1 : Math.ceil(n / 6);
  const gradId = useMemo(() => `g${Math.random().toString(36).slice(2, 8)}`, []);

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (n === 0) return;
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const rel = e.clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round((rel / rect.width) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div ref={boxRef} className="relative w-full" style={{ height: H }}>
      {w > 0 && (
        <svg width={w} height={H} className="block overflow-visible">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.22 }} />
              <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {/* Grille discrète : 0, moitié, max */}
          {[0, max / 2, max].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={w - PAD.r} y1={y(v)} y2={y(v)} style={{ stroke: "var(--app-border)" }} strokeDasharray={v === 0 ? undefined : "3 4"} />
              <text x={PAD.l - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} style={{ fill: "var(--app-text-faint)" }}>
                {Number.isInteger(v) ? v : v.toFixed(1)}
              </text>
            </g>
          ))}
          {buckets.map((b, i) =>
            (i % every === 0 && n - 1 - i >= Math.ceil(every / 2)) || i === n - 1 ? (
              <text key={b.t} x={x(i)} y={H - 6} textAnchor={i === 0 && n > 1 ? "start" : i === n - 1 && n > 1 ? "end" : "middle"} fontSize={11} style={{ fill: "var(--app-text-faint)" }}>
                {fmtTick(new Date(b.t))}
              </text>
            ) : null,
          )}
          {area && <path d={area} fill={`url(#${gradId})`} />}
          {n > 1 && <path d={line} fill="none" style={{ stroke: color }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {n === 1 && <circle cx={pts[0].x} cy={pts[0].y} r={4} style={{ fill: color }} />}
          {hover !== null && pts[hover] && (
            <g pointerEvents="none">
              <line x1={pts[hover].x} x2={pts[hover].x} y1={PAD.t} y2={PAD.t + ih} style={{ stroke: "var(--app-border-strong)" }} />
              <circle cx={pts[hover].x} cy={pts[hover].y} r={5} style={{ fill: color, stroke: "var(--app-bg-2)" }} strokeWidth={2} />
            </g>
          )}
          <rect
            x={PAD.l}
            y={PAD.t}
            width={iw}
            height={ih}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
      )}
      {hover !== null && buckets[hover] && w > 0 && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-2)] px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(pts[hover].x, 70), w - 70), top: 0 }}
        >
          <div className="text-[var(--app-text-faint)] first-letter:uppercase">{fmtTip(new Date(buckets[hover].t))}</div>
          <div className="font-semibold text-[var(--app-text)]">
            {buckets[hover].v} {unit}
          </div>
        </div>
      )}
      {empty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-6">
          <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg-2)] px-5 py-4 text-center shadow-sm">
            <p className="text-sm font-medium text-[var(--app-text)]">{t("dashboard.home.emptyCta")}</p>
            <Link
              href={startHref}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, var(--app-accent), var(--app-accent-2))" }}
            >
              {t("dashboard.home.startBtn")}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ChartCard({
  metric,
  title,
  startHref,
  color,
  unit,
  range,
  setRange,
  ws,
  setWs,
  onTotal,
}: {
  metric: Metric;
  title: string;
  startHref: string;
  color: string;
  unit: string;
  range: Range;
  setRange: (r: Range) => void;
  ws: string;
  setWs: (v: string) => void;
  onTotal?: (total: number | null) => void;
}) {
  const { t, locale } = useTranslation();
  const { data, loading, error } = useSeries(metric, range, ws);
  useEffect(() => { onTotal?.(data ? data.total : null); }, [data, onTotal]);
  const totalLabel = range === "today" ? t("dashboard.home.totalToday") : range === "30d" ? t("dashboard.home.total30d") : t("dashboard.home.total7d");
  const nf = new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR");

  return (
    <section className={`${CARD} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            <h2 className="text-sm font-semibold text-[var(--app-text)]">{title}</h2>
          </div>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-[var(--app-text)] tabular-nums">
              {data ? nf.format(data.total) : "—"}
            </span>
            <span className="text-xs text-[var(--app-text-faint)]">{totalLabel}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CreatorSelect value={ws} onChange={setWs} workspaces={data?.workspaces ?? []} />
          <RangeTabs value={range} onChange={setRange} />
        </div>
      </div>
      <div className={`mt-4 transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}>
        {error ? (
          <div className="flex h-[200px] items-center justify-center text-xs text-[var(--app-text-faint)]">{t("dashboard.home.statsError")}</div>
        ) : data ? (
          <ActivityChart buckets={data.buckets} range={range} color={color} unit={unit} empty={!loading && data.total === 0} startHref={startHref} />
        ) : (
          <div className="flex h-[200px] items-center justify-center text-xs text-[var(--app-text-faint)]">{t("dashboard.home.statsLoading")}</div>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── Temps économisé ───────────────────────── */

function TimeSavedCard({ edits, range }: { edits: number | null; range: Range }) {
  const { t } = useTranslation();
  const minutes = (edits ?? 0) * MINUTES_SAVED_PER_EDIT;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const value = edits === null ? "—" : h > 0 ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
  const totalLabel = range === "today" ? t("dashboard.home.totalToday") : range === "30d" ? t("dashboard.home.total30d") : t("dashboard.home.total7d");
  return (
    <section className={`${CARD} flex items-center gap-4 px-5 py-4`}>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "color-mix(in srgb, var(--chart-edit) 14%, transparent)", color: "var(--chart-edit)" }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2.5M9 2h6" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--app-text-faint)]">
          {t("dashboard.home.timeSavedTitle")} · {totalLabel}
        </p>
        <p className="text-xl font-semibold tracking-tight text-[var(--app-text)] tabular-nums">{value}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--app-text-faint)]">
          {t("dashboard.home.timeSavedHint", { n: edits ?? 0, min: MINUTES_SAVED_PER_EDIT })}
        </p>
      </div>
    </section>
  );
}

/* ───────────────────────── Journal ───────────────────────── */

function ago(iso: string, t: (k: string, p?: Record<string, string | number>) => string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return t("dashboard.home.agoNow");
  if (s < 3600) return t("dashboard.home.agoMin", { n: Math.floor(s / 60) });
  if (s < 86400) return t("dashboard.home.agoHour", { n: Math.floor(s / 3600) });
  return t("dashboard.home.agoDay", { n: Math.floor(s / 86400) });
}

function RecentLogs() {
  const { t } = useTranslation();
  const [items, setItems] = useState<LogItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/dashboard/activity?metric=logs&tz=${tzOffset()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { items: LogItem[] }) => alive && setItems(d.items.slice(0, 3))) // vue d'ensemble : les 3 dernières
      .catch(() => alive && setError(true));
    return () => { alive = false; };
  }, []);

  return (
    <section className={`${CARD} p-5`}>
      <h2 className="text-sm font-semibold text-[var(--app-text)]">{t("dashboard.home.logsTitle")}</h2>
      {error ? (
        <p className="mt-4 text-xs text-[var(--app-text-faint)]">{t("dashboard.home.statsError")}</p>
      ) : items === null ? (
        <p className="mt-4 text-xs text-[var(--app-text-faint)]">{t("dashboard.home.statsLoading")}</p>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--app-border)] px-4 py-6 text-center text-xs text-[var(--app-text-faint)]">
          {t("dashboard.home.logsEmpty")}
          <div className="mt-3 flex justify-center gap-2">
            <Link href="/dashboard/videos" className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 font-medium text-[var(--app-text-muted)] hover:bg-[var(--app-surface-2)]">
              {t("dashboard.home.moduleVideos")}
            </Link>
            <Link href="/dashboard/images" className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 font-medium text-[var(--app-text-muted)] hover:bg-[var(--app-surface-2)]">
              {t("dashboard.home.moduleImages")}
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--app-border)]">
          {items.map((it) => {
            const name = it.who.isMe ? t("dashboard.home.logsYou") : it.who.name || t("dashboard.home.logsGuest");
            const isVideo = it.type === "video";
            const what = isVideo
              ? it.qty > 1 ? t("dashboard.home.logsVideoMany", { n: it.qty }) : t("dashboard.home.logsVideoOne")
              : it.qty > 1 ? t("dashboard.home.logsImageMany", { n: it.qty }) : t("dashboard.home.logsImageOne");
            const via = it.origin === "api" ? t("dashboard.home.logsViaApi") : it.origin === "mcp" ? t("dashboard.home.logsViaMcp") : null;
            return (
              <li key={it.id} className="flex items-center gap-3 py-2.5">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={
                    it.who.isMe
                      ? { background: "linear-gradient(135deg, var(--app-accent), var(--app-accent-2))", color: "#fff" }
                      : { background: "var(--app-surface-2)", color: "var(--app-text-muted)", border: "1px solid var(--app-border)" }
                  }
                >
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--app-text)]">
                    <span className="font-medium">{name}</span>
                    <span className="text-[var(--app-text-faint)]"> · </span>
                    <span className="text-[var(--app-text-muted)]">{what}</span>
                    {via && <span className="text-[var(--app-text-faint)]"> {via}</span>}
                  </p>
                  {(it.label || it.creator) && (
                    <p className="mt-0.5 flex items-center gap-2 truncate text-xs text-[var(--app-text-faint)]">
                      {it.creator && (
                        <span className="inline-flex shrink-0 items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: it.creator.color }} />
                          {it.creator.name}
                        </span>
                      )}
                      {it.label && <span className="truncate">{it.label}</span>}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={
                      isVideo
                        ? { background: "color-mix(in srgb, var(--chart-dup) 14%, transparent)", color: "var(--chart-dup)" }
                        : { background: "rgba(192,38,211,0.12)", color: "#C026D3" }
                    }
                  >
                    {isVideo ? t("dashboard.home.tagVideo") : t("dashboard.home.tagImage")}
                  </span>
                  <span className="text-[11px] text-[var(--app-text-faint)]">{ago(it.at, t)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ───────────────────────── Aller plus loin ───────────────────────── */

function GoFurther() {
  const { t } = useTranslation();
  const links = [
    {
      href: "/dashboard/developers",
      title: t("dashboard.home.goApiTitle"),
      desc: t("dashboard.home.goApiDesc"),
      color: "var(--chart-dup)",
      icon: <path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13.5 6l-3 12" />,
    },
    {
      href: "/dashboard/workspaces",
      title: t("dashboard.home.goCreatorsTitle"),
      desc: t("dashboard.home.goCreatorsDesc"),
      color: "var(--chart-edit)",
      icon: (
        <>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.2a3 3 0 0 1 0 5.6M18.5 19a5 5 0 0 0-2.6-4.4" />
        </>
      ),
    },
  ];
  return (
    <section>
      <p className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text-faint)]">
        {t("dashboard.home.goFurther")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="dash-btn group !items-start !gap-3 !rounded-xl !p-3.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: `color-mix(in srgb, ${l.color} 14%, transparent)`, color: l.color }}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {l.icon}
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--app-text)]">
                {l.title}
                <span aria-hidden className="text-[var(--app-text-faint)] transition group-hover:translate-x-0.5">→</span>
              </span>
              <span className="mt-0.5 block text-xs font-normal leading-snug text-[var(--app-text-faint)]">{l.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Assemblage ───────────────────────── */

export default function ActivityDashboard() {
  const { t } = useTranslation();
  const [dupRange, setDupRange] = useState<Range>("7d");
  const [dupWs, setDupWs] = useState("all");
  const [editRange, setEditRange] = useState<Range>("7d");
  const [editWs, setEditWs] = useState("all");
  const [editsTotal, setEditsTotal] = useState<number | null>(null);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        metric="duplications"
        startHref="/dashboard/videos/simple"
        title={t("dashboard.home.statsDupTitle")}
        color="var(--chart-dup)"
        unit={t("dashboard.home.unitDup")}
        range={dupRange}
        setRange={setDupRange}
        ws={dupWs}
        setWs={setDupWs}
      />
      <ChartCard
        metric="edits"
        startHref="/dashboard/ai-editor"
        title={t("dashboard.home.statsEditTitle")}
        color="var(--chart-edit)"
        unit={t("dashboard.home.unitEdit")}
        range={editRange}
        setRange={setEditRange}
        ws={editWs}
        setWs={setEditWs}
        onTotal={setEditsTotal}
      />
      <div className="order-last lg:order-none">
        <RecentLogs />
      </div>
      <div className="flex flex-col gap-4 self-start">
        <TimeSavedCard edits={editsTotal} range={editRange} />
        <GoFurther />
      </div>
    </div>
  );
}

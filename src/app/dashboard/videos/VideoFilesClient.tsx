"use client";

// Rendus de la duplication (Simple / Avancé) — même interface que les
// variantes de l'Éditeur IA : grille de vignettes 9:16 (taille réglable),
// lecture au survol, commandes en surimpression (sélection, télécharger,
// supprimer), nom au survol, et un panneau latéral avec le lecteur au clic.
// La barre au-dessus agit sur la sélection, ou sur tout si rien n'est coché.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { clearVideosSimpleAction, clearVideosAdvancedAction, deleteVideoFilesAction } from "./actions";
import { useTranslation } from "@/lib/i18n/context";
import DriveSaveButton from "../components/DriveSaveButton";
import SendToEditorButton from "../components/SendToEditorButton";
import { useCreatorSwitch } from "../components/WorkspaceSwitcher";
import { listOutVideosSimple, listOutVideosAdvanced } from "./actions";

type Channel = "simple" | "advanced";

function fileNameFromUrl(u: string) {
  return decodeURIComponent(u.split("/").pop()!.split("?")[0]);
}

const GLASS: React.CSSProperties = { background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" };
const TILE_KEY = "duup_dup_tuile";
const BRAND_BTN: React.CSSProperties = { background: "linear-gradient(180deg,#6366F1,#4F46E5 60%,#4338CA)", boxShadow: "0 6px 16px -8px rgba(79,70,229,0.85), inset 0 1px 0 rgba(255,255,255,0.32)" };

export default function VideoFilesClient({
  initialFiles,
  channel,
}: {
  initialFiles: string[];
  channel: Channel;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [files, setFiles] = useState<string[]>(initialFiles);
  const [clearing, setClearing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [tile, setTile] = useState(168);

  useEffect(() => {
    let v = NaN;
    try { v = parseInt(localStorage.getItem(TILE_KEY) || "", 10); } catch { /* stockage indisponible */ }
    if (Number.isFinite(v)) setTile(Math.min(420, Math.max(110, v)));
  }, []);
  const setTileSize = (v: number) => {
    setTile(v);
    try { localStorage.setItem(TILE_KEY, String(v)); } catch { /* sans effet */ }
  };

  // Changement de créateur : ses vidéos à lui (toutes en vue admin), sans recharger la page.
  useCreatorSwitch(() => {
    void (channel === "simple" ? listOutVideosSimple() : listOutVideosAdvanced())
      .then((list) => { setFiles(list); setSelected(new Set()); })
      .catch(() => {});
  });

  // Sync displayed list when server component re-fetches (after duplication or clear)
  useEffect(() => {
    if (!clearing) setFiles(initialFiles);
  }, [initialFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClear() {
    if (clearing) return;
    setClearing(true);
    setFiles([]); // optimistic: hide list immediately
    setSelected(new Set());
    try {
      if (channel === "simple") await clearVideosSimpleAction();
      else await clearVideosAdvancedAction();
    } catch {}
    setClearing(false);
    router.refresh(); // sync server state (in case Supabase still had files)
  }

  async function removeFiles(urls: string[]) {
    if (!urls.length) return;
    const gone = new Set(urls);
    setFiles((f) => f.filter((u) => !gone.has(u))); // optimiste
    setSelected((s) => new Set([...s].filter((u) => !gone.has(u))));
    if (open && gone.has(open)) setOpen(null);
    await deleteVideoFilesAction(channel, urls.map(fileNameFromUrl)).catch(() => null);
    router.refresh();
  }

  const toggleOne = (url: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(url)) next.delete(url); else next.add(url);
    return next;
  });
  const allSelected = files.length > 0 && selected.size === files.length;
  const toggleAll = () => setSelected((prev) => (prev.size === files.length ? new Set() : new Set(files)));

  const scope = selected.size > 0 ? files.filter((u) => selected.has(u)) : files;
  const selectedNames = files.filter((u) => selected.has(u)).map(fileNameFromUrl);
  const selectionHref = selectedNames.length > 0
    ? `/api/out/zip?scope=videos&channel=${channel}&files=${encodeURIComponent(selectedNames.join(","))}`
    : null;

  return (
    <section className="duup-glass overflow-hidden rounded-2xl">
      {/* En-tête : titre + nombre, curseur de taille des vignettes */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--app-border)] px-5 py-4">
        <div className="text-[15px] font-bold text-[var(--app-text)]">
          {t("dashboard.videos.generatedVideos", { channel })}
          {files.length > 0 && <span className="text-[var(--app-text-faint)]"> · {files.length}</span>}
        </div>
        {files.length > 0 && (
          <input type="range" min={110} max={420} step={10} value={tile}
            onChange={(e) => setTileSize(Number(e.target.value))}
            aria-label={t("dashboard.aiEditor.ws.tileSize")} title={t("dashboard.aiEditor.ws.tileSize")}
            className="hidden h-1.5 w-32 cursor-pointer appearance-none rounded-full accent-indigo-500 sm:block"
            style={{ background: "var(--app-border-strong)" }} />
        )}
      </div>

      {/* Barre de sélection groupée */}
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--app-border)] px-5 py-2.5">
          <label className="mr-1 flex cursor-pointer select-none items-center gap-2 text-[12.5px] font-medium text-[var(--app-text-muted)]">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 cursor-pointer rounded-md accent-indigo-500" />
            {selected.size > 0 ? t("dashboard.aiEditor.ws.nSelected", { n: selected.size }) : t("dashboard.aiEditor.ws.selectAll")}
          </label>
          {selectionHref && (
            <a href={selectionHref} className="duup-btn rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--app-text)]">
              {t("common.downloadSelection", { count: String(selected.size) })}
            </a>
          )}
          {selected.size > 0 && (
            <button type="button" onClick={() => void removeFiles([...selected])} className="duup-btn rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-500">
              {t("dashboard.videos.deleteSelection", { count: String(selected.size) })}
            </button>
          )}
          <DriveSaveButton files={scope.map((u) => ({ url: u, name: fileNameFromUrl(u) }))} />
          <SendToEditorButton files={scope.map((u) => ({ url: u, name: fileNameFromUrl(u) }))} isSelection={selected.size > 0} disabled={clearing} />
          <span className="flex-1" />
          <button type="button" onClick={handleClear} disabled={clearing}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--app-text-muted)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-50">
            {clearing ? t("dashboard.videos.clearing") : t("dashboard.videos.clearVideos", { channel })}
          </button>
          <a href={`/api/out/zip?scope=videos&channel=${channel}`} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition" style={BRAND_BTN}>
            {t("dashboard.videos.downloadAllZip")}
          </a>
        </div>
      )}

      <div className="p-5">
        {files.length === 0 ? (
          <p className="text-sm text-[var(--app-text-muted)]">{t("dashboard.videos.noVideosYet")}</p>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tile}px, 1fr))` }}>
            {files.map((u) => {
              const n = fileNameFromUrl(u);
              const isSel = selected.has(u);
              return (
                <div key={u}
                  onMouseEnter={() => setHover(u)}
                  onMouseLeave={() => setHover((h) => (h === u ? null : h))}
                  className={`group relative overflow-hidden rounded-lg border bg-[var(--app-surface)] transition hover:shadow-lg ${isSel ? "border-indigo-500 ring-2 ring-indigo-500/60" : "border-[var(--app-border)] hover:border-indigo-400/50"}`}>
                  <button type="button" onClick={() => setOpen(u)} className="relative block aspect-[9/16] w-full bg-black">
                    {/* Vignette = 1re image de la vidéo ; au survol, lecture en
                        boucle. En sortant, le <video> lu est démonté : lecture
                        et téléchargement s'arrêtent d'un coup. */}
                    {hover === u ? (
                      <video src={u} autoPlay muted loop playsInline preload="auto" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <video src={`${u}#t=0.1`} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/45 opacity-0 transition group-hover:opacity-100" />
                  </button>

                  {/* Sélection : carré arrondi en haut à gauche (reste visible une fois coché). */}
                  <button type="button" aria-pressed={isSel} title={t("dashboard.aiEditor.ws.select")}
                    onClick={(e) => { e.stopPropagation(); toggleOne(u); }}
                    className={`absolute left-2 top-2 z-20 grid h-7 w-7 place-items-center rounded-lg border-2 transition ${isSel ? "border-white bg-indigo-500 text-white opacity-100" : "border-white/85 bg-black/25 text-transparent opacity-0 group-hover:opacity-100"}`}
                    style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  </button>

                  {/* Télécharger / supprimer : pastilles rondes en haut à droite. */}
                  <div className="absolute right-2 top-2 z-20 flex flex-col gap-2 opacity-0 transition group-hover:opacity-100">
                    <a href={u} download={n} onClick={(e) => e.stopPropagation()}
                      title={t("dashboard.aiEditor.ws.downloadTitle")} aria-label={t("dashboard.aiEditor.ws.downloadTitle")}
                      className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-black/70" style={GLASS}>
                      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
                    </a>
                    <button type="button" onClick={(e) => { e.stopPropagation(); void removeFiles([u]); }}
                      title={t("dashboard.aiEditor.ws.deleteTitle")} aria-label={t("dashboard.aiEditor.ws.deleteTitle")}
                      className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-red-500/80" style={GLASS}>
                      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /><path d="M9 7V4h6v3" /></svg>
                    </button>
                  </div>

                  {/* Le nom, au survol seulement. */}
                  <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 opacity-0 transition group-hover:opacity-100">
                    <span className="block truncate rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-white" style={GLASS}>{n}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Panneau latéral : le lecteur + télécharger / supprimer. Rendu dans
          <body> (portail) : le verre dépoli de la carte (backdrop-filter)
          capturerait sinon le positionnement « fixed » dans la carte. */}
      {open && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onClick={() => setOpen(null)} />
          <aside className="fixed right-0 top-0 z-[85] flex h-full w-[440px] max-w-[92%] flex-col border-l border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--app-border)] px-4 py-4">
              <div className="truncate text-[14.5px] font-bold text-[var(--app-text)]">{fileNameFromUrl(open)}</div>
              <button type="button" onClick={() => setOpen(null)} aria-label="Fermer" className="text-xl leading-none text-[var(--app-text-muted)] hover:text-[var(--app-text)]">✕</button>
            </div>
            <div className="flex flex-1 flex-col gap-4 overflow-auto px-4 py-4">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={open} controls autoPlay playsInline className="mx-auto max-h-[460px] w-auto rounded-xl bg-black" style={{ aspectRatio: "9 / 16" }} />
              <div className="grid grid-cols-2 gap-2">
                <a href={open} download={fileNameFromUrl(open)} className="rounded-xl px-3 py-2.5 text-center text-[13px] font-semibold text-white" style={BRAND_BTN}>
                  {t("dashboard.aiEditor.ws.downloadTitle")}
                </a>
                <button type="button" onClick={() => void removeFiles([open])} className="duup-btn rounded-xl px-3 py-2.5 text-[13px] font-semibold text-rose-500">
                  {t("dashboard.aiEditor.ws.deleteTitle")}
                </button>
              </div>
            </div>
          </aside>
        </>,
        document.body,
      )}
    </section>
  );
}

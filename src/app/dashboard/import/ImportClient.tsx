"use client";

// Importateur de compte — UI complète :
//   1. coller le lien du compte + fenêtre → lancer le scan
//   2. poll du scan → grille classée des meilleures vidéos
//   3. cocher → télécharger (voie 2) → poll → résultats
//
// Aucune logique métier ici : tout passe par /api/account/*. Les types viennent
// de lib/account/types (sans import Node → sûrs côté client).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDrivePicker } from "../components/useDrivePicker";
import { putHandoff } from "@/lib/account/handoff";
import { clearScrape, loadScrape, remainingMs, saveScrape } from "@/lib/account/persist";
import { parseAccountUrl } from "@/lib/account/types";
import { scrapeCostCents, formatTokens } from "@/lib/tokens";
import type {
  AccountDownloadSnapshot,
  AccountScanSnapshot,
  ScoredVideo,
} from "@/lib/account/types";

const WINDOWS = [
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 90, label: "90 jours" },
  { days: 365, label: "1 an" },
];

// Combien de vidéos l'utilisateur veut récupérer. Choix OBLIGATOIRE : il définit
// la pré-sélection et plafonne le téléchargement (chaque vidéo TikTok = 1 run
// Apify facturé). N'influence PAS le coût du scan — c'est la fenêtre qui le pilote.
const COUNTS = [1, 2, 3, 5, 10];

// 92_100_000 → "92,1 M"
function fmtCount(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "").replace(".", ",")} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".0", "").replace(".", ",")} k`;
  return String(n);
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
  return data as T;
}

export default function ImportClient() {
  const [url, setUrl] = useState("");
  const [windowDays, setWindowDays] = useState(30);
  const [topCount, setTopCount] = useState(2);
  const [showAll, setShowAll] = useState(false);

  const [scan, setScan] = useState<AccountScanSnapshot | null>(null);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [download, setDownload] = useState<AccountDownloadSnapshot | null>(null);
  const [downloadErr, setDownloadErr] = useState<string | null>(null);

  // Choix simple/avancé avant l'envoi vers la duplication.
  const [askDuplicate, setAskDuplicate] = useState(false);
  // Déroulé d'une action "récupérer + envoyer" : l'utilisateur ne clique plus
  // sur « Télécharger » — le téléchargement est déclenché par la destination.
  const [action, setAction] = useState<{
    phase: "downloading" | "sending" | "done" | "error";
    target: "drive" | "duplication";
    message: string;
  } | null>(null);
  const { saveToDrive, configured: driveReady } = useDrivePicker();
  // Fraîcheur du scrape restauré (compte à rebours avant expiration à 1 h).
  const [expiresInMin, setExpiresInMin] = useState<number | null>(null);

  // Solde de tokens (affiché en haut à droite), rafraîchi après chaque débit.
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const refreshBalance = useCallback(async () => {
    try {
      const r = await fetch("/api/tokens", { cache: "no-store" });
      if (r.ok) setBalanceCents((await r.json()).balanceCents ?? 0);
    } catch { /* transitoire */ }
  }, []);
  useEffect(() => { void refreshBalance(); }, [refreshBalance]);

  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dlPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Suivi d'un scan en cours ────────────────────────────────────────────────
  // Extrait pour être réutilisé À LA FOIS au lancement ET à la reconnexion après
  // une actualisation : le scan tourne côté serveur, on ne fait que le suivre.
  const startPolling = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/account/scan/${jobId}`);
        // 404 = le job n'existe plus (serveur redémarré / purgé après 1 h) : on
        // arrête proprement plutôt que de poller dans le vide indéfiniment.
        if (res.status === 404) {
          if (pollRef.current) clearInterval(pollRef.current);
          clearScrape();
          setScan(null);
          setScanErr("Le scan précédent n'est plus disponible (session expirée). Relance-le.");
          return;
        }
        const s = (await res.json()) as AccountScanSnapshot;
        setScan(s);
        if (s.status === "ready" || s.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          void refreshBalance(); // un scan raté/vide se rembourse → le solde bouge
          if (s.status === "error") setScanErr(s.error || "Scan échoué");
          if (s.status === "ready") {
            // Pré-sélection automatique des N meilleures : l'user a déjà dit ce
            // qu'il voulait, il n'a plus qu'à choisir la destination.
            setSelected(new Set(s.videos.slice(0, s.topCount).map((v) => v.id)));
          }
        }
      } catch {
        /* transitoire — on retentera au prochain tick */
      }
    }, 2500);
  }, [refreshBalance]);

  // ── Restauration au montage (scan en cours OU abouti, < 1 h) ─────────────────
  // Actualiser/quitter ne perd plus le scan : le jobId est persisté DÈS le
  // lancement, on s'y raccroche ici. Au-delà d'1 h, le job serveur est purgé.
  useEffect(() => {
    const saved = loadScrape();
    if (!saved) return;
    setScan(saved.scan);
    setUrl(saved.scan.target.profileUrl);
    setWindowDays(saved.scan.windowDays);
    setTopCount(saved.scan.topCount);
    if (saved.scan.status === "scraping") {
      // Scan encore en cours côté serveur → on se raccroche au même job.
      startPolling(saved.scan.jobId);
    } else {
      // Scan abouti → on restaure vidéos + sélection + téléchargements.
      setSelected(new Set(saved.selected));
      setDownload(saved.download);
      setExpiresInMin(Math.ceil(remainingMs(saved.savedAt) / 60000));
    }
  }, [startPolling]);

  // Persiste dès que le scan est LANCÉ (scraping → survit à un refresh) et à
  // chaque évolution utile ensuite (prêt, sélection, téléchargements).
  useEffect(() => {
    if (scan?.status === "scraping" || scan?.status === "ready") {
      saveScrape(scan, Array.from(selected), download);
    }
  }, [scan, selected, download]);

  const clearPolls = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (dlPollRef.current) clearInterval(dlPollRef.current);
  }, []);
  useEffect(() => () => clearPolls(), [clearPolls]);

  // Prix annoncé AVANT le clic — calculé avec la même fonction que le serveur,
  // donc jamais d'écart entre ce qui est affiché et ce qui est débité.
  // La plateforme se déduit du lien collé (Instagram par défaut).
  const priceCents = scrapeCostCents({
    windowDays,
    count: topCount,
    platform: parseAccountUrl(url)?.platform ?? "instagram",
  });

  const scanning = scan?.status === "scraping";
  const ready = scan?.status === "ready";
  // Une action est en cours (téléchargement ou envoi) → on verrouille les boutons.
  const busy = action?.phase === "downloading" || action?.phase === "sending";

  // ── Lancer un scan ──────────────────────────────────────────────────────────
  const startScan = useCallback(async () => {
    if (!url.trim() || scanning) return;
    clearPolls();
    setScanErr(null);
    setDownload(null);
    setDownloadErr(null);
    setSelected(new Set());
    setShowAll(false);
    setExpiresInMin(null);
    clearScrape(); // un nouveau scan remplace le précédent
    try {
      const snap = await postJSON<AccountScanSnapshot>("/api/account/scan", {
        url: url.trim(),
        windowDays,
        topCount,
      });
      setScan(snap);            // persisté (status "scraping") → survit à un refresh
      void refreshBalance();    // le scan vient d'être débité
      startPolling(snap.jobId); // suit le job jusqu'à ready/error
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Scan impossible";
      // 402 → solde insuffisant : on oriente vers la recharge plutôt que de
      // laisser un message d'erreur brut.
      setScanErr(
        /insuffisant/i.test(msg)
          ? `${msg} — il te faut ${formatTokens(priceCents)} tokens pour ce scan. Recharge depuis Plan & token.`
          : msg,
      );
    }
  }, [url, windowDays, topCount, scanning, clearPolls, priceCents, refreshBalance, startPolling]);

  // ── Sélection ───────────────────────────────────────────────────────────────
  // L'utilisateur peut ajuster son choix, mais jamais dépasser le nombre demandé
  // (le serveur applique le même plafond — c'est lui qui protège le coût).
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        if (scan && next.size >= scan.topCount) return prev; // plafond atteint
        next.add(id);
      }
      return next;
    });
  }, [scan]);

  const resetToTop = useCallback(() => {
    if (!scan) return;
    setSelected(new Set(scan.videos.slice(0, scan.topCount).map((v) => v.id)));
  }, [scan]);

  // ── Télécharger la sélection (voie 2) ────────────────────────────────────────
  // Récupère les vidéos cochées et REND la main seulement quand elles sont
  // toutes sur le serveur — les deux destinations enchaînent dessus.
  const downloadSelected = useCallback(async (): Promise<
    { url: string; name: string }[]
  > => {
    if (!scan || selected.size === 0) return [];
    const snap = await postJSON<AccountDownloadSnapshot>("/api/account/download", {
      scanJobId: scan.jobId,
      ids: Array.from(selected),
    });
    setDownload(snap);

    // Poll jusqu'à `done` (pas d'setInterval : on veut pouvoir attendre le résultat).
    let cur = snap;
    while (!cur.done) {
      await new Promise((r) => setTimeout(r, 2500));
      try {
        const res = await fetch(`/api/account/download/${snap.jobId}`);
        cur = (await res.json()) as AccountDownloadSnapshot;
        setDownload(cur);
      } catch {
        /* transitoire — on retente au tour suivant */
      }
    }

    const ok = cur.results.filter((r) => r.ok && r.uploadedId);
    if (ok.length === 0) throw new Error("Aucune vidéo n'a pu être récupérée");
    return ok.map((r) => ({
      url: `/api/studio/media/${r.uploadedId}`,
      name: r.name || "video.mp4",
    }));
  }, [scan, selected]);

  // ── Destination 1 : duplication vidéos ──────────────────────────────────────
  // Télécharge d'abord, PUIS bascule. L'utilisateur voit un message d'attente
  // explicite lui demandant de ne pas quitter la page pendant le transfert.
  const sendToDuplication = useCallback(
    async (mode: "simple" | "advanced") => {
      setAskDuplicate(false);
      setDownloadErr(null);
      setAction({
        phase: "downloading",
        target: "duplication",
        message: "Téléchargement de tes vidéos… ne quitte pas la page, tu seras redirigé juste après.",
      });
      try {
        const files = await downloadSelected();
        setAction({
          phase: "sending",
          target: "duplication",
          message: "Vidéos prêtes — redirection vers la duplication…",
        });
        putHandoff(files);
        router.push(`/dashboard/videos/${mode}`);
      } catch (e) {
        setAction({
          phase: "error",
          target: "duplication",
          message: e instanceof Error ? e.message : "Transfert impossible",
        });
      }
    },
    [downloadSelected, router]
  );

  // ── Destination 2 : Google Drive ────────────────────────────────────────────
  // Même principe : téléchargement, puis envoi, puis message de confirmation.
  const sendToDrive = useCallback(async () => {
    setDownloadErr(null);
    setAction({
      phase: "downloading",
      target: "drive",
      message: "Téléchargement de tes vidéos…",
    });
    try {
      const files = await downloadSelected();
      setAction({ phase: "sending", target: "drive", message: "Envoi vers Google Drive…" });
      const res = await saveToDrive(files, (done, total) =>
        setAction({
          phase: "sending",
          target: "drive",
          message: `Envoi vers Google Drive… ${done}/${total}`,
        })
      );
      // Dossier non choisi → l'utilisateur a annulé le sélecteur Drive.
      if (!res.folderName && res.ok === 0 && res.failed === 0) {
        setAction(null);
        return;
      }
      setAction({
        phase: res.failed > 0 ? "error" : "done",
        target: "drive",
        message:
          res.failed > 0
            ? `${res.ok} envoyée(s), ${res.failed} en échec vers « ${res.folderName} »`
            : `✓ ${res.ok} vidéo(s) envoyée(s) dans « ${res.folderName} » sur ton Drive`,
      });
    } catch (e) {
      setAction({
        phase: "error",
        target: "drive",
        message: e instanceof Error ? e.message : "Envoi vers Drive impossible",
      });
    }
  }, [downloadSelected, saveToDrive]);

  return (
    <div className="relative max-w-6xl mx-auto space-y-6">
      {/* En-tête + solde de tokens */}
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-white">Importer depuis un compte</h1>
          <p className="text-[15px] leading-relaxed text-white/85">
            Colle le lien de ton compte Instagram ou TikTok. On repère tes vidéos qui
            performent le mieux — tu choisis lesquelles récupérer.
          </p>
        </div>
        <a
          href="/dashboard/abonnement"
          title="Voir mon solde et recharger"
          className="shrink-0 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-right transition"
        >
          <div className="text-lg font-semibold text-white leading-none">
            {balanceCents === null ? "—" : formatTokens(balanceCents)}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-white/45 mt-1">tokens</div>
        </a>
      </header>

      {/* Barre de saisie */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && startScan()}
          placeholder="https://instagram.com/toncompte  ·  https://tiktok.com/@toncompte  ·  @pseudo"
          className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/30 outline-none focus:border-violet-400/60"
        />
        <select
          value={topCount}
          onChange={(e) => setTopCount(Number(e.target.value))}
          title="Combien de vidéos récupérer"
          className="rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none focus:border-violet-400/60"
        >
          {COUNTS.map((n) => (
            <option key={n} value={n} className="bg-neutral-900">
              {n === 1 ? "la meilleure" : `les ${n} meilleures`}
            </option>
          ))}
        </select>
        <select
          value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value))}
          title="Sur quelle période chercher"
          className="rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white outline-none focus:border-violet-400/60"
        >
          {WINDOWS.map((w) => (
            <option key={w.days} value={w.days} className="bg-neutral-900">
              sur {w.label}
            </option>
          ))}
        </select>
        <button
          onClick={startScan}
          disabled={!url.trim() || scanning}
          className="rounded-xl px-6 py-3 font-medium bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {scanning ? "Analyse…" : "Analyser"}
        </button>
      </div>

      {/* Prix annoncé avant le clic — un seul débit, téléchargement inclus. */}
      {!scanning && (
        <p className="-mt-3 text-sm text-white/55">
          Ce scan coûtera{" "}
          <span className="text-white font-medium">{formatTokens(priceCents)} tokens</span>{" "}
          — téléchargement des {topCount} vidéo{topCount > 1 ? "s" : ""} inclus. Rien n'est
          débité si le compte est inaccessible.
        </p>
      )}

      {/* Scrape restauré depuis la dernière visite */}
      {expiresInMin !== null && ready && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
          <span className="text-white/70">
            Scrape précédent de <span className="text-white">@{scan?.target.handle}</span> restauré —
            expire dans {expiresInMin} min.
          </span>
          <button
            onClick={() => {
              clearScrape();
              setScan(null);
              setDownload(null);
              setSelected(new Set());
              setExpiresInMin(null);
            }}
            className="ml-auto text-xs rounded-lg px-3 py-1.5 bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"
          >
            Effacer
          </button>
        </div>
      )}

      {/* Erreur de scan */}
      {scanErr && (
        (() => {
          // Panne d'infrastructure → carte SUPPORT + bouton Telegram. Aucun
          // détail technique n'est jamais montré (message serveur déjà générique).
          if (scan?.errorKind === "platform") {
            return (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4 space-y-3">
                <div className="text-sm text-red-100">
                  <span className="font-medium">Le scan a échoué.</span> Un souci technique nous a
                  empêchés de récupérer les vidéos. Aucun token ne t'a été débité.
                </div>
                <div className="text-[13px] text-white/60">
                  Contacte le support, on règle ça rapidement.
                </div>
                <a
                  href="https://t.me/DuupFlow_Support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-[#229ED9] hover:bg-[#1b8ec3] text-white transition"
                >
                  {/* logo Telegram */}
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M21.94 4.66a1.2 1.2 0 0 0-1.63-1.06L2.9 10.3c-1.1.43-1.09 2 .02 2.4l4.37 1.53 1.7 5.16c.2.63 1 .82 1.48.35l2.4-2.36 4.5 3.3c.6.45 1.47.12 1.63-.63l3-15.4-.06.01Z" />
                  </svg>
                  Contacter le support
                </a>
              </div>
            );
          }

          // "Aucun reel sur la période" = BÉNIN, actionnable (élargir la fenêtre)
          // → ambre. Autres erreurs user (privé, restreint…) → rouge. Solde
          // remboursé dans les deux cas.
          const benign = /aucun reel|élargis la fenêtre/i.test(scanErr);
          return (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                benign
                  ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
                  : "border-red-500/30 bg-red-500/10 text-red-200"
              }`}
            >
              {benign && <span className="mr-1">ℹ️</span>}
              {scanErr}
              {benign && <span className="block text-amber-200/60 text-xs mt-1">Aucun token débité.</span>}
            </div>
          );
        })()
      )}

      {/* État scan en cours */}
      {scanning && (
        <div className="flex items-center gap-3 text-white/70 text-sm">
          <span className="h-4 w-4 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
          Scrape du compte @{scan?.target.handle} en cours… (30 s à 2 min)
        </div>
      )}

      {/* Résultats */}
      {ready && scan && (
        <section className="space-y-4">
          {/* Avertissement heuristique : contenu récent probablement age-restreint */}
          {scan.notice && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              <span className="mt-0.5">⚠️</span>
              <span>{scan.notice}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/70">
              <span className="text-white font-medium">{scan.topCount}</span> meilleure
              {scan.topCount > 1 ? "s" : ""} vidéo{scan.topCount > 1 ? "s" : ""} sur {scan.windowDays} j
              <span className="text-white/40"> · {scan.videos.length} analysées au total</span>
            </p>
            <div className="flex items-center gap-2">
              <button onClick={resetToTop} className="text-xs rounded-lg px-3 py-1.5 bg-white/5 border border-white/10 text-white/80 hover:bg-white/10">
                Rétablir le top {scan.topCount}
              </button>
              {scan.videos.length > scan.topCount && (
                <button
                  onClick={() => setShowAll((s) => !s)}
                  className="text-xs rounded-lg px-3 py-1.5 bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"
                >
                  {showAll ? "Voir moins" : `Voir les ${scan.videos.length} vidéos`}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {(showAll ? scan.videos : scan.videos.slice(0, scan.topCount)).map((v) => (
              <VideoCard key={v.id} v={v} selected={selected.has(v.id)} onToggle={() => toggle(v.id)} />
            ))}
          </div>

          {showAll && (
            <p className="text-xs text-white/40">
              Tu peux échanger une vidéo contre une autre, mais pas en sélectionner plus de{" "}
              {scan.topCount} (le nombre choisi au départ).
            </p>
          )}

          {scan.videos.length === 0 && (
            <p className="text-white/50 text-sm">Aucune vidéo trouvée sur cette période.</p>
          )}
        </section>
      )}

      {/* Barre d'action téléchargement (collée en bas quand sélection) */}
      {ready && selected.size > 0 && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-neutral-900/90 backdrop-blur px-5 py-4 shadow-xl">
          <span className="text-sm text-white/80">
            {selected.size}/{scan.topCount} vidéo{scan.topCount > 1 ? "s" : ""} prête
            {selected.size > 1 ? "s" : ""} — choisis la destination
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAskDuplicate(true)}
              disabled={busy}
              className="rounded-xl px-5 py-2.5 font-medium bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-40 transition"
            >
              Envoyer vers duplication
            </button>
            {driveReady && (
              <button
                onClick={sendToDrive}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-medium bg-white/10 hover:bg-white/20 text-white/90 disabled:opacity-40 transition"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/app/icons8-google-drive-96.png" alt="" className="h-4 w-4" />
                Envoyer vers Drive
              </button>
            )}
          </div>
        </div>
      )}

      {/* Déroulé de l'action en cours / confirmation */}
      {action && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-3 ${
            action.phase === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : action.phase === "done"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-violet-400/30 bg-violet-500/10 text-violet-100"
          }`}
        >
          {busy && (
            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin" />
          )}
          <span>{action.message}</span>
          {busy && download && download.total > 0 && (
            <span className="ml-auto text-white/50">
              {download.results.length}/{download.total}
            </span>
          )}
          {!busy && (
            <button
              onClick={() => setAction(null)}
              className="ml-auto text-xs opacity-70 hover:opacity-100"
            >
              Fermer
            </button>
          )}
        </div>
      )}

      {downloadErr && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {downloadErr}
        </div>
      )}

      {/* Résultats de téléchargement */}
      {download && download.done && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-2">
          <h2 className="text-white font-medium">
            Téléchargement terminé — {download.results.filter((r) => r.ok).length}/{download.total} réussi(s)
          </h2>
          <ul className="text-sm divide-y divide-white/5">
            {download.results.map((r) => (
              <li key={r.sourceId} className="py-2 flex items-center justify-between gap-3">
                <span className={r.ok ? "text-white/80" : "text-red-300"}>
                  {r.ok ? `✓ ${r.name} · ${r.durationLabel} · ${r.sizeMo} Mo` : `✕ ${r.error}`}
                </span>
                {r.ok && (
                  <a
                    href={`/api/studio/media/${r.uploadedId}`}
                    download={r.name}
                    className="text-xs rounded-lg px-3 py-1.5 bg-violet-500/20 border border-violet-400/30 text-violet-200 hover:bg-violet-500/30"
                  >
                    Télécharger le fichier
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Choix du module de duplication avant bascule */}
      {askDuplicate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(6,9,24,0.86)", backdropFilter: "blur(10px)" }}
          onClick={() => setAskDuplicate(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{
              background: "rgba(10,12,32,0.98)",
              border: "1px solid rgba(139,92,246,0.30)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(139,92,246,0.12)",
            }}
          >
            {/* En-tête */}
            <div className="px-7 pt-7 pb-5" style={{ background: "linear-gradient(160deg, rgba(139,92,246,0.14), transparent 72%)" }}>
              <span className="inline-block text-[10px] font-bold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full mb-4"
                style={{ background: "rgba(139,92,246,0.14)", color: "#C4B5FD", border: "1px solid rgba(139,92,246,0.3)" }}>
                ♻️ Duplication
              </span>
              <h3 className="text-[22px] leading-tight font-semibold tracking-tight text-white">
                Comment veux-tu dupliquer&nbsp;?
              </h3>
              <p className="text-[13px] text-white/55 mt-2 leading-relaxed">
                Tes <span className="text-white/80 font-medium">{selected.size} vidéo{selected.size > 1 ? "s" : ""}</span> seront
                téléchargées puis déposées seules dans le module — tu es redirigé juste après.
              </p>
            </div>

            {/* Deux choix, cartes riches */}
            <div className="px-7 pb-6 pt-1 space-y-3">
              {[
                {
                  mode: "simple" as const, icon: "⚡", title: "Vidéo simple",
                  sub: "Duplication rapide en quelques clics",
                  tags: ["Packs prêts à l'emploi", "Recommandé"],
                },
                {
                  mode: "advanced" as const, icon: "🎛️", title: "Vidéo avancé",
                  sub: "Contrôle total, réglage par réglage",
                  tags: ["Curseurs manuels", "Expert"],
                },
              ].map((o) => (
                <button
                  key={o.mode}
                  onClick={() => sendToDuplication(o.mode)}
                  className="group w-full text-left rounded-xl border px-4 py-3.5 flex items-center gap-4 transition"
                  style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.6)"; e.currentTarget.style.background = "rgba(139,92,246,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                >
                  <span className="h-11 w-11 shrink-0 rounded-xl grid place-items-center text-xl"
                    style={{ background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.26)" }}>
                    {o.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold text-white">{o.title}</span>
                    <span className="block text-[13px] text-white/50 leading-snug">{o.sub}</span>
                    <span className="flex flex-wrap gap-1.5 mt-1.5">
                      {o.tags.map((tag) => (
                        <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md text-violet-200/80"
                          style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.20)" }}>
                          {tag}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="text-white/25 group-hover:text-violet-300 transition text-lg">→</span>
                </button>
              ))}

              <button
                onClick={() => setAskDuplicate(false)}
                className="w-full text-center text-[13px] text-white/40 hover:text-white/75 pt-1.5 transition"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Carte vidéo ────────────────────────────────────────────────────────────────
function VideoCard({ v, selected, onToggle }: { v: ScoredVideo; selected: boolean; onToggle: () => void }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <button
      onClick={onToggle}
      className={`group text-left rounded-xl overflow-hidden border transition ${
        selected ? "border-violet-400 ring-2 ring-violet-400/40" : "border-white/10 hover:border-white/25"
      }`}
    >
      <div className="relative aspect-[9/16] bg-neutral-800">
        {v.thumbnailUrl && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/account/thumb?u=${encodeURIComponent(v.thumbnailUrl)}`}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImgOk(false)}
          />
        ) : (
          <div className="h-full w-full grid place-items-center text-white/20 text-xs">aperçu indispo</div>
        )}
        {/* Badge rang + score */}
        <div className="absolute top-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
          #{v.rank}
        </div>
        <div className="absolute top-2 right-2 rounded-md bg-violet-500/90 px-2 py-0.5 text-[11px] font-semibold text-white">
          {v.score}
        </div>
        {/* Case de sélection */}
        <div className={`absolute bottom-2 right-2 h-6 w-6 rounded-md grid place-items-center border ${
          selected ? "bg-violet-500 border-violet-400 text-white" : "bg-black/40 border-white/40 text-transparent"
        }`}>
          ✓
        </div>
      </div>
      <div className="p-2.5 space-y-1 bg-white/[.03]">
        <div className="flex items-center gap-3 text-[13px] text-white/85">
          <span title="vues">▶ {fmtCount(v.views)}</span>
          <span title="likes">♥ {fmtCount(v.likes)}</span>
          {v.engagementRate !== null && (
            <span className="ml-auto text-white/50" title="taux d'engagement">
              {(v.engagementRate * 100).toFixed(1)}%
            </span>
          )}
        </div>
        {v.caption && <p className="text-[11px] text-white/40 line-clamp-1">{v.caption}</p>}
      </div>
    </button>
  );
}

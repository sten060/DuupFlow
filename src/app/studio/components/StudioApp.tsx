"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_VARIANTS,
  INITIAL_CREDITS,
  MAX_RAW_VIDEOS,
} from "@/lib/mock-data";
import type {
  StudioJobSnapshot,
  StudioReel,
  StudioReference,
  UploadedVideo,
  ViralRecipe,
} from "@/lib/studio/types";
import Topbar from "./Topbar";
import ReferencesSection from "./ReferencesSection";
import RawVideosSection, { type PendingUpload } from "./RawVideosSection";
import VariantsSection from "./VariantsSection";
import ReelCard, { LoadingTile } from "./ReelCard";
import PreviewModal from "./PreviewModal";
import Toast from "./Toast";

// ─────────────────────────────────────────────────────────────────────────────
// StudioApp — générateur de reels avec upload + pipeline ffmpeg RÉELS (local).
// Upload → POST /api/studio/upload (probe + détection de format)
// Générer → POST /api/studio/generate puis polling du job : les vraies
// variantes encodées apparaissent au fur et à mesure.
// Encore mock : références, crédits, publication.
// ─────────────────────────────────────────────────────────────────────────────
export default function StudioApp() {
  // ── Config (panneau gauche) ────────────────────────────────────────────────
  const [references, setReferences] = useState<StudioReference[]>([]);
  const [rawVideos, setRawVideos] = useState<UploadedVideo[]>([]);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [variants, setVariants] = useState(DEFAULT_VARIANTS);

  // ── Génération / résultats (zone droite) ───────────────────────────────────
  const [reels, setReels] = useState<StudioReel[]>([]);
  const [generating, setGenerating] = useState(false);
  const [plannedTotal, setPlannedTotal] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [credits, setCredits] = useState(INITIAL_CREDITS);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [previewReel, setPreviewReel] = useState<StudioReel | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const uid = useRef(0); // ids uniques pour les chips d'upload en cours
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nettoyage des timers si on quitte la page en pleine génération.
  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 3000);
  };

  // ── Références RÉELLES : analyse serveur (yt-dlp/fichier + vision LLM) ──────
  // On ajoute une chip "analyse…", puis POST /api/studio/reference met à jour
  // son statut (recette prête ou erreur). La recette servira à la génération.
  //
  // `send` fabrique la requête (URL en JSON, ou fichier en multipart).
  const trackReference = (
    title: string,
    url: string,
    send: (signal: AbortSignal) => Promise<Response>
  ) => {
    uid.current += 1;
    const id = `ref-${uid.current}`;
    setReferences((r) => [...r, { id, url, status: "analyzing", title }]);

    void (async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 230_000);
      try {
        const res = await send(ctrl.signal);
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? `Erreur ${res.status}`);
        const recipe = data.recipe as ViralRecipe;
        setReferences((r) =>
          r.map((x) => (x.id === id ? { ...x, status: "ready", recipe } : x))
        );
        showToast(`Référence analysée — style : ${recipe.hookStyle}`.slice(0, 90));
      } catch (e) {
        const msg =
          e instanceof DOMException && e.name === "AbortError"
            ? "délai dépassé"
            : e instanceof Error
              ? e.message
              : "erreur inconnue";
        setReferences((r) =>
          r.map((x) => (x.id === id ? { ...x, status: "error", error: msg } : x))
        );
        showToast(`Référence non lue — ${msg}`);
      } finally {
        clearTimeout(timer);
      }
    })();
  };

  // A) Par URL (yt-dlp + cookies navigateur côté serveur).
  const addReference = (url: string) => {
    let title = url.slice(0, 28);
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "").split(".")[0];
      const tail = (u.pathname.replace(/\/$/, "").split("/").pop() || "").slice(-6);
      title = `${host}.com/…${tail}`;
    } catch {
      /* URL non standard → on garde le début brut */
    }
    trackReference(title, url, (signal) =>
      fetch("/api/studio/reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal,
      })
    );
  };

  // B) Par fichier déposé (le reel déjà téléchargé) — increvable.
  const addReferenceFile = (file: File) => {
    trackReference(file.name, file.name, (signal) => {
      const body = new FormData();
      body.append("file", file);
      return fetch("/api/studio/reference", { method: "POST", body, signal });
    });
  };

  const removeReference = (id: string) =>
    setReferences((r) => r.filter((x) => x.id !== id));

  // ── Upload réel des vidéos brutes ──────────────────────────────────────────
  const handleFiles = (files: File[]) => {
    const room = MAX_RAW_VIDEOS - rawVideos.length - pendingUploads.length;
    const selected = files.slice(0, Math.max(0, room));
    if (files.length > selected.length) {
      showToast(`Maximum ${MAX_RAW_VIDEOS} vidéos — certaines ont été ignorées`);
    }

    for (const file of selected) {
      uid.current += 1;
      const tempId = `pending-${uid.current}`;
      setPendingUploads((p) => [...p, { tempId, name: file.name }]);

      // Uploads lancés en parallèle ; chaque chip "Analyse…" se résout seule.
      void (async () => {
        // Garde-fou : une requête bloquée (ex. serveur qui recompile pendant
        // l'upload) doit devenir une erreur claire, jamais un spinner infini.
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 90_000);
        try {
          const body = new FormData();
          body.append("file", file);
          const res = await fetch("/api/studio/upload", {
            method: "POST",
            body,
            signal: ctrl.signal,
          });
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error ?? `Erreur ${res.status}`);
          }
          const video: UploadedVideo = await res.json();
          setRawVideos((v) =>
            v.length >= MAX_RAW_VIDEOS ? v : [...v, video]
          );
        } catch (e) {
          const msg =
            e instanceof DOMException && e.name === "AbortError"
              ? "délai dépassé (recharge la page et réessaie)"
              : e instanceof Error
                ? e.message
                : "erreur inconnue";
          showToast(`Échec de l'upload de ${file.name} — ${msg}`);
        } finally {
          clearTimeout(timer);
          setPendingUploads((p) => p.filter((x) => x.tempId !== tempId));
        }
      })();
    }
  };

  // Retrait côté client uniquement — le fichier reste dans .studio-local.
  // TODO: brancher un vrai DELETE (nettoyage disque/storage).
  const removeRawVideo = (id: string) =>
    setRawVideos((videos) => videos.filter((v) => v.id !== id));

  // Note libre par contenu (l'IA l'interprète pour assembler le reel).
  const setRawVideoNote = (id: string, note: string) =>
    setRawVideos((videos) =>
      videos.map((v) => (v.id === id ? { ...v, note } : v))
    );

  // ── Génération réelle : POST /generate puis polling du job ────────────────
  const handleGenerate = async () => {
    if (generating || rawVideos.length === 0) return;

    // Garde-fou : une recette SANS mesures de montage (layout) vient d'une
    // analyse d'ancienne version — générer avec donnerait un placement au
    // hasard. On bloque et on demande de re-analyser la référence.
    const stale = references.filter(
      (r) => r.status === "ready" && r.recipe && !r.recipe.layout
    );
    if (stale.length > 0) {
      showToast(
        `Référence "${stale[0].title}" analysée par une ancienne version — supprime-la (✕) et re-colle-la avant de générer`
      );
      return;
    }

    setGenerating(true);
    setReels([]);
    setJobId(null);
    setPlannedTotal(variants); // 1 reel × N variantes (les contenus sont assemblés)

    // Recettes des références PRÊTES → le LLM reproduit leur style.
    const recipes = references
      .filter((r) => r.status === "ready" && r.recipe)
      .map((r) => r.recipe as ViralRecipe);

    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assets: rawVideos,
          variantCount: variants,
          recipes,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Erreur ${res.status}`);
      }
      const { jobId: id, total } = (await res.json()) as {
        jobId: string;
        total: number;
      };
      setJobId(id);
      setPlannedTotal(total);

      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/studio/generate/${id}`, {
            cache: "no-store",
          });
          if (!r.ok) return; // erreur transitoire → on retentera au tick suivant
          const job = (await r.json()) as StudioJobSnapshot;
          setReels(job.reels);
          if (job.done) {
            if (pollTimer.current) clearInterval(pollTimer.current);
            setGenerating(false);
            // TODO: brancher la vraie consommation de crédits (backend)
            setCredits((c) => Math.max(0, c - job.reels.length));
            if (job.error) showToast(`Génération interrompue : ${job.error}`);
            else if (job.failed > 0)
              showToast(`${job.failed} variante(s) ont échoué — ${job.reels.length} générée(s)`);
          }
        } catch {
          /* réseau local instable → tick suivant */
        }
      }, 800);
    } catch (e) {
      setGenerating(false);
      showToast(
        `Impossible de lancer la génération — ${e instanceof Error ? e.message : "erreur inconnue"}`
      );
    }
  };

  // ── Téléchargements réels ──────────────────────────────────────────────────
  const downloadReel = (reel: StudioReel) => {
    const a = document.createElement("a");
    a.href = reel.url;
    a.download = reel.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast(`Téléchargement de ${reel.fileName}…`);
  };
  const downloadAll = () => {
    if (!jobId || reels.length === 0) return;
    window.location.assign(`/api/studio/zip/${jobId}`);
    showToast(`Préparation du .zip (${reels.length} reels)…`);
  };
  const publishReel = (reel: StudioReel) => {
    // TODO: brancher la publication multi-comptes (API Instagram/TikTok)
    showToast(`Publication de ${reel.variantLabel} — bientôt disponible`);
  };

  const canGenerate =
    rawVideos.length > 0 && pendingUploads.length === 0 && !generating;
  const loadingTiles = generating
    ? Math.max(0, plannedTotal - reels.length)
    : 0;
  const hasResults = reels.length > 0 || generating;

  return (
    <div
      className="fixed inset-0 flex flex-col text-[#eef0fb]"
      style={{ background: "#07071a" }}
    >
      {/* Halo radial violet en haut */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 500px at 60% -5%, rgba(109,94,252,.18), transparent 70%)",
        }}
      />

      <Topbar credits={credits} />

      {/* Corps 2 zones — vertical sur mobile, côte à côte dès lg */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* ── GAUCHE : panneau config ── */}
        <aside className="flex shrink-0 flex-col border-b border-[#232350] bg-[#0c0c22]/70 lg:w-[320px] lg:border-b-0 lg:border-r">
          <div className="space-y-9 p-5 lg:flex-1 lg:overflow-y-auto">
            <ReferencesSection
              references={references}
              onAdd={addReference}
              onAddFile={addReferenceFile}
              onRemove={removeReference}
            />
            <RawVideosSection
              videos={rawVideos}
              pending={pendingUploads}
              onFiles={handleFiles}
              onRemove={removeRawVideo}
              onNote={setRawVideoNote}
            />
            <VariantsSection variants={variants} onChange={setVariants} />
          </div>

          {/* Bas fixe : bouton Générer */}
          <div className="border-t border-[#232350] p-4">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full rounded-xl py-3.5 text-[15px] font-medium text-white transition-transform enabled:hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg,#6d5efc,#4ec5ff)",
                boxShadow: "0 8px 32px rgba(109,94,252,.4)",
              }}
            >
              ✦{" "}
              {generating
                ? "Génération en cours…"
                : pendingUploads.length > 0
                  ? "Analyse des vidéos…"
                  : "Générer les reels"}
            </button>
          </div>
        </aside>

        {/* ── DROITE : résultats ── */}
        <main className="flex min-h-0 flex-1 flex-col lg:overflow-y-auto">
          {/* Header résultats */}
          <div className="flex items-center justify-between border-b border-[#232350] px-5 py-5 sm:px-8">
            <h1 className="text-lg font-medium" aria-live="polite">
              {generating
                ? `${reels.length} / ${plannedTotal} reels générés`
                : reels.length > 0
                  ? `${reels.length} reels générés`
                  : "Résultats"}
            </h1>
            <button
              type="button"
              onClick={downloadAll}
              disabled={reels.length === 0 || !jobId}
              className="rounded-xl border border-[#2e2e60] bg-[#12122e] px-4 py-2 text-sm text-[#b3aaff] transition-colors enabled:hover:border-[#6d5efc] enabled:hover:text-[#eef0fb] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ⬇ Tout télécharger (.zip)
            </button>
          </div>

          {/* Contenu */}
          {hasResults ? (
            <div className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-3 sm:p-8 xl:grid-cols-4 2xl:grid-cols-5">
              {reels.map((reel) => (
                <ReelCard
                  key={reel.id}
                  reel={reel}
                  onPreview={setPreviewReel}
                  onDownload={downloadReel}
                  onPublish={publishReel}
                />
              ))}
              {Array.from({ length: loadingTiles }, (_, i) => (
                <LoadingTile key={`loading-${i}`} />
              ))}
            </div>
          ) : (
            /* État vide */
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
              <span
                aria-hidden
                className="bg-clip-text text-6xl font-light text-transparent"
                style={{
                  backgroundImage: "linear-gradient(135deg,#6d5efc,#4ec5ff)",
                }}
              >
                ∞
              </span>
              <p className="text-xl text-[#eef0fb]">
                Tes reels apparaîtront ici
              </p>
              <p className="text-[15px] text-[#9a9ac6]">
                Configure tes réglages à gauche, puis lance la génération.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Modal aperçu */}
      {previewReel && (
        <PreviewModal
          reel={previewReel}
          onClose={() => setPreviewReel(null)}
          onDownload={downloadReel}
          onPublish={publishReel}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}

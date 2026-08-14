"use client";

import { useRef, useState, DragEvent } from "react";
import { probeFile } from "./probeActions";
import { compareVisual } from "./actions";
import {
  technicalScore,
  unifiedScore,
  STRUCTURAL_FIELDS,
  VISUAL_WEIGHT,
  TECHNICAL_WEIGHT,
  type TechnicalResult,
} from "./technicalScore";
import { useTranslation } from "@/lib/i18n/context";
import DriveImportButton from "../components/DriveImportButton";
import DocsDrawer from "../components/DocsDrawer";
import { buildComparatorDocs } from "../components/docs-content";

type ProbeResult = Record<string, any> | null;
type VisualBreakdown = Awaited<ReturnType<typeof compareVisual>>;

/* Détail de l'analyse d'image : clé technique → poids dans le volet visuel.
   Les quatre dernières sont calculées et affichées mais NE PÈSENT PAS dans le
   score (poids 0) — elles servent de contexte, pas de note. */
const VISUAL_ALGOS: { key: string; weight: number }[] = [
  { key: "ssim", weight: 22 },
  { key: "mse", weight: 20 },
  { key: "spatial", weight: 14 },
  { key: "luma", weight: 12 },
  { key: "color", weight: 10 },
  { key: "proj", weight: 6 },
  { key: "colorMom", weight: 6 },
  { key: "chroma", weight: 5 },
  { key: "gradient", weight: 5 },
  { key: "phash", weight: 0 },
  { key: "dhash", weight: 0 },
  { key: "edgeOr", weight: 0 },
  { key: "texture", weight: 0 },
  { key: "ahash", weight: 0 },
];

export default function SimilarityClient() {
  const { t } = useTranslation();
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [probe1, setProbe1] = useState<ProbeResult>(null);
  const [probe2, setProbe2] = useState<ProbeResult>(null);
  const [visual, setVisual] = useState<VisualBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);

  function reset() {
    setProbe1(null);
    setProbe2(null);
    setVisual(null);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  function makeDrop(setter: (f: File | null) => void) {
    return (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setter(e.dataTransfer.files?.[0] ?? null);
      reset();
    };
  }

  async function handleCompare() {
    if (!file1 || !file2) return;
    setLoading(true);
    setError(null);
    reset();

    try {
      // Upload files sequentially (not in parallel) to avoid ECONNRESET
      // on large files. Send full files — MOV moov atom can be at the end.
      const fd1 = new FormData();
      fd1.append("file", file1);
      fd1.append("realSize", String(file1.size));
      const r1 = await probeFile(fd1);

      const fd2 = new FormData();
      fd2.append("file", file2);
      fd2.append("realSize", String(file2.size));
      const r2 = await probeFile(fd2);

      if ("error" in r1) { setError(t("cmp.file1Error", { error: r1.error })); return; }
      if ("error" in r2) { setError(t("cmp.file2Error", { error: r2.error })); return; }

      setProbe1(r1);
      setProbe2(r2);

      // Volet visuel — les vignettes sont extraites côté serveur par la sonde.
      // Absentes (fichier illisible en image), le score se rabat sur le volet
      // technique plutôt que d'inventer une valeur neutre.
      if (r1.frames?.length && r2.frames?.length) {
        setVisual(await compareVisual(r1.frames, r2.frames));
      }
    } catch (e: any) {
      setError(e?.message || t("cmp.genericError"));
    } finally {
      setLoading(false);
    }
  }

  // Get all unique keys from both tag objects
  const tags1 = probe1?.format?.tags ?? {};
  const tags2 = probe2?.format?.tags ?? {};
  const allTagKeys = [...new Set([...Object.keys(tags1), ...Object.keys(tags2)])];

  // Format-level fields to compare
  const formatFields = ["format_name", "duration", "size", "bit_rate", "format_long_name", "nb_streams", "start_time", "probe_score"];

  // Stream helpers
  const streams1 = probe1?.streams as Record<string, any>[] | undefined;
  const streams2 = probe2?.streams as Record<string, any>[] | undefined;
  const videoStream1 = streams1?.find((s) => s.codec_type === "video");
  const videoStream2 = streams2?.find((s) => s.codec_type === "video");
  const audioStream1 = streams1?.find((s) => s.codec_type === "audio");
  const audioStream2 = streams2?.find((s) => s.codec_type === "audio");

  const videoFields = ["codec_name", "width", "height", "pix_fmt", "bit_rate", "avg_frame_rate", "duration"];
  const audioFields = ["codec_name", "sample_rate", "channels", "bit_rate"];

  // ── Score UNIQUE ──────────────────────────────────────────────────────────
  // Un seul chiffre affiché. Les deux volets (image / technique) restent
  // visibles juste en dessous pour expliquer d'où il vient, mais ne sont
  // jamais présentés comme deux notes concurrentes.
  const technical: TechnicalResult | null =
    probe1 && probe2 ? technicalScore(probe1, probe2, file1?.name, file2?.name) : null;
  const visualScore = visual && !("error" in visual) ? visual.visual : null;
  const score = probe1 && probe2 ? unifiedScore(visualScore, technical?.score ?? null) : null;

  // Similarité par champ, pour annoter les tableaux (ex. « ~99 % » sur deux
  // tailles qui ne diffèrent que de quelques octets).
  const fieldSim = new Map(technical?.fields.map((f) => [f.key, f]) ?? []);

  function similarityColor(s: number) {
    if (s >= 75) return "text-red-400";
    if (s >= 45) return "text-yellow-400";
    return "text-emerald-400";
  }

  function similarityLabel(s: number) {
    if (s >= 75) return t("dashboard.similarity.verySimilar");
    if (s >= 45) return t("dashboard.similarity.moderateSimilarity");
    return t("dashboard.similarity.distinctFiles");
  }

  function similarityBg(s: number) {
    if (s >= 75) return "border-red-500/20 bg-red-500/[0.06]";
    if (s >= 45) return "border-yellow-500/20 bg-yellow-500/[0.06]";
    return "border-emerald-500/20 bg-emerald-500/[0.06]";
  }

  /** Rend une ligne de tableau, en signalant les champs exclus du score. */
  function fieldRow(scope: string, key: string, v1: string, v2: string) {
    const fullKey = `${scope}.${key}`;
    const structural = STRUCTURAL_FIELDS.has(fullKey);
    const diff = v1 !== v2;
    const sim = fieldSim.get(fullKey)?.similarity;
    return (
      <tr key={key} className="border-b border-[var(--app-border)]">
        <td className="py-1.5 pr-4 font-mono text-[var(--app-text-muted)] whitespace-nowrap">
          {key}
          {structural && (
            <span className="ml-2 font-sans text-[10px] uppercase tracking-wide text-[var(--app-text-faint)]">
              {t("dashboard.similarity.notCounted")}
            </span>
          )}
          {!structural && diff && typeof sim === "number" && sim > 0 && sim < 100 && (
            <span className="ml-2 font-sans text-[10px] text-[var(--app-text-faint)]">~{sim}%</span>
          )}
        </td>
        <td className={`py-1.5 pr-4 font-mono break-all ${diff ? "text-emerald-300" : "text-[var(--app-text)]"}`}>{v1}</td>
        <td className={`py-1.5 font-mono break-all ${diff ? "text-emerald-300" : "text-[var(--app-text)]"}`}>{v2}</td>
      </tr>
    );
  }

  function tableHead(firstCol: string) {
    return (
      <thead>
        <tr className="border-b border-[var(--app-border)]">
          <th className="text-left py-2 pr-4 text-[var(--app-text-muted)] font-medium">{firstCol}</th>
          <th className="text-left py-2 pr-4 text-[var(--app-text-muted)] font-medium">{t("dashboard.similarity.file1Column")}</th>
          <th className="text-left py-2 text-[var(--app-text-muted)] font-medium">{t("dashboard.similarity.file2Column")}</th>
        </tr>
      </thead>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t("dashboard.similarity.title")}</h1>
          <p className="text-sm text-[var(--app-text-muted)]">{t("dashboard.similarity.subtitle")}</p>
        </div>
        <DocsDrawer docs={buildComparatorDocs(t)} />
      </div>
      <div className="h-px bg-[var(--app-surface-2)]" />
      {/* File inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-[var(--app-text-muted)]">{t("dashboard.similarity.file1")}</label>
            <DriveImportButton compact single disabled={loading} onError={setError}
              onFiles={(fs) => { if (fs[0]) { setFile1(fs[0]); reset(); } }} />
          </div>
          <div
            data-tour-id="sim-file1-dropzone"
            onClick={() => ref1.current?.click()}
            onDragOver={handleDragOver}
            onDrop={makeDrop(setFile1)}
            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 cursor-pointer hover:border-emerald-400/30 transition text-sm text-[var(--app-text-muted)]"
          >
            {file1 ? file1.name : t("dashboard.similarity.clickOrDrop")}
            <input ref={ref1} type="file" className="hidden" accept="video/*,image/*"
              onChange={(e) => { setFile1(e.target.files?.[0] ?? null); reset(); }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-[var(--app-text-muted)]">{t("dashboard.similarity.file2")}</label>
            <DriveImportButton compact single disabled={loading} onError={setError}
              onFiles={(fs) => { if (fs[0]) { setFile2(fs[0]); reset(); } }} />
          </div>
          <div
            data-tour-id="sim-file2-dropzone"
            onClick={() => ref2.current?.click()}
            onDragOver={handleDragOver}
            onDrop={makeDrop(setFile2)}
            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 cursor-pointer hover:border-emerald-400/30 transition text-sm text-[var(--app-text-muted)]"
          >
            {file2 ? file2.name : t("dashboard.similarity.clickOrDrop")}
            <input ref={ref2} type="file" className="hidden" accept="video/*,image/*"
              onChange={(e) => { setFile2(e.target.files?.[0] ?? null); reset(); }} />
          </div>
        </div>
      </div>

      <button
        onClick={handleCompare}
        data-tour-id="sim-submit"
        disabled={loading || !file1 || !file2}
        className={[
          "inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
          loading || !file1 || !file2
            ? "bg-[var(--app-surface-2)] text-[var(--app-text-muted)] cursor-not-allowed"
            : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-[0_4px_20px_rgba(16,185,129,.35)]",
        ].join(" ")}
      >
        {loading ? t("dashboard.similarity.analyzing") : t("dashboard.similarity.compareButton")}
      </button>

      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      {/* Results side by side */}
      {probe1 && probe2 && (
        <div className="space-y-4">
          {/* ── Score unique ── */}
          {score !== null && (
            <div className={`rounded-xl border px-4 py-3 ${similarityBg(score)}`}>
              <div className="flex items-center gap-3">
                <span className={`text-3xl font-bold ${similarityColor(score)}`}>{score}%</span>
                <div>
                  <span className={`text-sm font-semibold ${similarityColor(score)}`}>{similarityLabel(score)}</span>
                  <p className="text-xs text-[var(--app-text-muted)]">
                    {visualScore !== null && technical
                      ? t("dashboard.similarity.scoreParts", {
                          visual: String(Math.round(visualScore)),
                          visualWeight: String(Math.round(VISUAL_WEIGHT * 100)),
                          technical: String(Math.round(technical.score)),
                          technicalWeight: String(Math.round(TECHNICAL_WEIGHT * 100)),
                        })
                      : visualScore === null
                        ? t("dashboard.similarity.visualUnavailable")
                        : t("dashboard.similarity.technicalUnavailable")}
                  </p>
                  {technical && (
                    <p className="text-xs text-[var(--app-text-faint)] mt-0.5">
                      {t("dashboard.similarity.identicalFields", {
                        matches: String(technical.identicalCount),
                        total: String(technical.scoredCount),
                      })}
                    </p>
                  )}
                </div>
              </div>
              {visual && !("error" in visual) && visual.breakdown.mirrored && (
                <p className="mt-2 text-xs font-medium text-amber-400">{t("dashboard.similarity.mirrorDetected")}</p>
              )}
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--app-text-faint)]">
                {t("dashboard.similarity.structuralNote")}
              </p>
            </div>
          )}

          {/* ── Détail de l'analyse d'image ── */}
          {visual && !("error" in visual) && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--app-text)] mb-2">{t("dashboard.similarity.visualSection")}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--app-border)]">
                      <th className="text-left py-2 pr-4 text-[var(--app-text-muted)] font-medium">{t("dashboard.similarity.algoColumn")}</th>
                      <th className="text-left py-2 pr-4 text-[var(--app-text-muted)] font-medium">{t("dashboard.similarity.weightColumn")}</th>
                      <th className="text-left py-2 text-[var(--app-text-muted)] font-medium">{t("dashboard.similarity.scoreColumn")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {VISUAL_ALGOS.map(({ key, weight }) => {
                      const v = (visual.breakdown as Record<string, any>)[key] as number;
                      return (
                        <tr key={key} className="border-b border-[var(--app-border)]">
                          <td className="py-1.5 pr-4 text-[var(--app-text-muted)]">
                            {t(`dashboard.similarity.algo.${key}`)}
                            {weight === 0 && (
                              <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--app-text-faint)]">
                                {t("dashboard.similarity.notCounted")}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 pr-4 font-mono text-[var(--app-text-faint)]">{weight > 0 ? `${weight}%` : "—"}</td>
                          <td className={`py-1.5 font-mono ${v < 100 ? "text-emerald-300" : "text-[var(--app-text)]"}`}>{v}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {visual && "error" in visual && (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-4 py-2 text-xs text-amber-400">
              {t("dashboard.similarity.visualError", { error: visual.error })}
            </p>
          )}

          <div className="h-px bg-[var(--app-surface-2)]" />

          {/* Format info */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--app-text)] mb-2">{t("dashboard.similarity.formatSection")}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                {tableHead(t("dashboard.similarity.fieldColumn"))}
                <tbody>
                  {formatFields.map((key) =>
                    fieldRow("format", key, String(probe1.format?.[key] ?? "—"), String(probe2.format?.[key] ?? "—")),
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="h-px bg-[var(--app-surface-2)]" />

          {/* Tags comparison */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--app-text)] mb-2">{t("dashboard.similarity.tagsSection")}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                {tableHead(t("dashboard.similarity.tagColumn"))}
                <tbody>
                  {allTagKeys.sort().map((key) =>
                    fieldRow("tag", key, String(tags1[key] ?? "—"), String(tags2[key] ?? "—")),
                  )}
                  {allTagKeys.length === 0 && (
                    <tr><td colSpan={3} className="py-3 text-[var(--app-text-faint)] text-center">{t("dashboard.similarity.noTagsFound")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Video stream comparison */}
          {(videoStream1 || videoStream2) && (
            <>
              <div className="h-px bg-[var(--app-surface-2)]" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--app-text)] mb-2">{t("dashboard.similarity.videoStreamSection")}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    {tableHead(t("dashboard.similarity.fieldColumn"))}
                    <tbody>
                      {videoFields.map((key) =>
                        fieldRow("video", key, String(videoStream1?.[key] ?? "—"), String(videoStream2?.[key] ?? "—")),
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Audio stream comparison */}
          {(audioStream1 || audioStream2) && (
            <>
              <div className="h-px bg-[var(--app-surface-2)]" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--app-text)] mb-2">{t("dashboard.similarity.audioStreamSection")}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    {tableHead(t("dashboard.similarity.fieldColumn"))}
                    <tbody>
                      {audioFields.map((key) =>
                        fieldRow("audio", key, String(audioStream1?.[key] ?? "—"), String(audioStream2?.[key] ?? "—")),
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

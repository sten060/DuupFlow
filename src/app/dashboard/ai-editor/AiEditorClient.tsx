"use client";

// Module « Éditeur IA » — Reproduis ce qui marche.
// Flow : Connexion à ton Claude (OAuth, étape 0) → Référence → Matière → workspace.
// Modèle « pur ton Claude » : l'utilisateur branche son propre Claude via le
// connecteur MCP (OAuth, sans clé). Il pilote le montage depuis SA conversation ;
// les variantes créées (outil create_variant) remontent ici en direct (poll).

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReferenceAnalysis } from "@/lib/ai-editor/analyze";
import { useTranslation } from "@/lib/i18n/context";
import DriveSaveButton from "../components/DriveSaveButton";

const BRAND = "linear-gradient(135deg,#6366F1,#38BDF8)";

// Rend une chaîne i18n contenant des segments **gras** en <b> (le t() ne renvoie
// que du texte) → préserve la mise en forme des paragraphes traduits.
function Rich({ text }: { text: string }) {
  return <>{text.split("**").map((p, i) => (i % 2 === 1 ? <b key={i} className="text-[var(--app-text)]">{p}</b> : p))}</>;
}

function fmtDur(s: number) {
  if (!s || s <= 0) return "—";
  const m = Math.floor(s / 60), sec = Math.round(s % 60);
  return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}s`;
}

/* ============ petits helpers UI ============ */
function StepPill({ n, label, state, onClick }: { n: number; label: string; state: "todo" | "active" | "done"; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition hover:brightness-110"
      style={{
        borderColor: state === "active" ? "rgba(99,102,241,.5)" : "var(--app-border)",
        background: "var(--app-surface)",
        color: state === "todo" ? "var(--app-text-faint)" : "var(--app-text)",
      }}
    >
      <span
        className="grid h-5 w-5 place-items-center rounded-full text-[12px]"
        style={
          state === "done"
            ? { background: "rgba(16,185,129,.18)", color: "#10b981" }
            : state === "active"
            ? { background: "#6366F1", color: "#fff" }
            : { background: "var(--app-surface-2)", color: "var(--app-text-muted)" }
        }
      >
        {state === "done" ? "✓" : n}
      </span>
      {label}
    </button>
  );
}

function PrimaryBtn({ children, onClick, disabled, full }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; full?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition ${full ? "w-full" : ""} ${disabled ? "opacity-45 cursor-not-allowed" : "hover:brightness-110"}`}
      style={{ background: BRAND }}
    >
      {children}
    </button>
  );
}
function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-[var(--app-border-strong)] px-4 py-2.5 text-sm font-medium text-[var(--app-text)] transition hover:bg-[var(--app-surface-2)]"
    >
      {children}
    </button>
  );
}

type Material = {
  id: string;                 // id client
  serverId?: string;          // id dans le store (une fois uploadé)
  name: string;
  file?: File;
  url?: string;               // aperçu local (object URL)
  thumb?: string | null;      // vignette serveur (après analyse / restauration)
  desc: string;
  kind: "video" | "image" | "audio";
  uploading?: boolean;
  err?: string;
};
const uid = () => Math.random().toString(36).slice(2, 9);

type VariantItem = { id: string; label?: string; poster: string | null };

/* ============ Page ============ */
export default function AiEditorClient() {
  const { t } = useTranslation();
  // Parcours : Connexion (étape 0) → Référence → Matière → workspace.
  const [step, setStep] = useState<"connect" | "ref" | "material" | "editor">("connect");
  // A-t-on VRAIMENT connecté Claude ? (≠ « passé l'étape ») — sert à ne pas afficher
  // la connexion comme validée quand le user a cliqué « plus tard ».
  const [connected, setConnected] = useState(false);

  // Référence
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refUrl, setRefUrl] = useState("");
  const refInput = useRef<HTMLInputElement | null>(null);
  const refChangeInput = useRef<HTMLInputElement | null>(null); // changer la réf depuis le workspace
  const [analysis, setAnalysis] = useState<ReferenceAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null);
  const [refSource, setRefSource] = useState<{ type: "file" | "url"; label: string } | null>(null);

  // Matière
  const [materials, setMaterials] = useState<Material[]>([]);
  const matInput = useRef<HTMLInputElement | null>(null);
  const [matDragOver, setMatDragOver] = useState(false); // glisser-déposer matière
  const [refDragOver, setRefDragOver] = useState(false); // glisser-déposer référence
  const [editCtx, setEditCtx] = useState<string | null>(null); // id local de la matière dont on édite le contexte

  // Projet persistant (créé à l'analyse de la réf ; restauré au chargement)
  const [projectId, setProjectId] = useState<string | null>(null);

  // Éditeur — pur « ton Claude » : les variantes créées via le connecteur MCP
  // (par le Claude du user) remontent ici en direct.
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [drawer, setDrawer] = useState<{ open: boolean; variantId?: string; label?: string }>({ open: false });
  // Sélection multiple des variantes (téléchargement groupé / envoi Drive).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const analyzeRef = useCallback(async (input: { file?: File; url?: string; replacePid?: string }) => {
    setAnalyzing(true); setAnalyzeErr(null); setAnalysis(null);
    try {
      let res: Response;
      if (input.file) {
        const fd = new FormData();
        fd.append("file", input.file);
        if (input.replacePid) fd.append("projectId", input.replacePid); // remplace la réf, garde la matière
        res = await fetch("/api/ai-editor/analyze", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/ai-editor/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: input.url, projectId: input.replacePid }),
        });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Erreur ${res.status}`);
      setAnalysis(json.analysis as ReferenceAnalysis);
      setProjectId(json.projectId ?? null);
      if (!input.replacePid) setMaterials([]); // nouvelle réf = nouveau projet ; remplacement = on garde la matière
    } catch (e) {
      setAnalyzeErr((e as Error)?.message || t("dashboard.aiEditor.ws.errAnalyze"));
    } finally {
      setAnalyzing(false);
    }
  }, [t]);
  // Changer la référence depuis le workspace (garde la matière + les variantes).
  const onRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!f || !projectId) return;
    setRefFile(f); setRefSource({ type: "file", label: f.name });
    void analyzeRef({ file: f, replacePid: projectId });
  };
  const addRef = (f?: File) => { if (f) { setRefFile(f); setRefUrl(""); setRefSource({ type: "file", label: f.name }); void analyzeRef({ file: f }); } };
  const onRefPick = (e: React.ChangeEvent<HTMLInputElement>) => addRef(e.target.files?.[0] ?? undefined);
  const analyzeUrl = () => {
    const u = refUrl.trim();
    if (u.length < 7) return;
    setRefFile(null);
    setRefSource({ type: "url", label: u });
    void analyzeRef({ url: u });
  };
  const resetRef = () => { setRefFile(null); setRefUrl(""); setRefSource(null); setAnalysis(null); setAnalyzeErr(null); };
  const retryRef = () => { if (refSource?.type === "file" && refFile) void analyzeRef({ file: refFile }); else if (refSource?.type === "url") void analyzeRef({ url: refSource.label }); };

  // Restauration : au chargement, recharge le dernier projet du user (persistance).
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ai-editor/project");
        if (!res.ok) return;
        const { project } = await res.json();
        if (!project) return;
        setProjectId(project.id);
        if (project.reference) {
          setRefSource({ type: project.reference.source, label: project.reference.label });
          setAnalysis(project.reference.analysis as ReferenceAnalysis);
          // Le projet est prêt (réf analysée) → on RESTE dans le workspace après un
          // rechargement de page (sinon on retombait sur l'étape « Référence »).
          setStep("editor");
        }
        if (Array.isArray(project.materials) && project.materials.length) {
          setMaterials(project.materials.map((m: { id: string; name: string; kind: "video" | "image" | "audio"; desc?: string; analysis?: { thumb?: string | null } }) => ({
            id: uid(), serverId: m.id, name: m.name, thumb: m.analysis?.thumb ?? null, desc: m.desc ?? "", kind: m.kind,
          })));
        }
        if (Array.isArray(project.variants)) setVariants(project.variants);
      } catch { /* pas de projet — départ à neuf */ }
    })();
  }, []);

  const uploadMaterial = useCallback(async (localId: string, file: File, desc: string, pid: string) => {
    try {
      const fd = new FormData();
      fd.append("projectId", pid);
      fd.append("file", file);
      fd.append("desc", desc);
      const res = await fetch("/api/ai-editor/material", { method: "POST", body: fd });
      const json = await res.json();
      setMaterials((m) => m.map((x) => x.id === localId
        ? (res.ok
            ? { ...x, serverId: json.material.id, thumb: json.material.analysis?.thumb ?? x.thumb ?? null, uploading: false }
            : { ...x, uploading: false, err: json?.error || t("dashboard.aiEditor.ws.errUpload") })
        : x));
    } catch (e) {
      setMaterials((m) => m.map((x) => x.id === localId ? { ...x, uploading: false, err: (e as Error)?.message || t("dashboard.aiEditor.ws.errUpload") } : x));
    }
  }, [t]);

  const addMaterials = useCallback((files: FileList | File[]) => {
    const pid = projectId;
    const arr = Array.from(files);
    const news: Material[] = arr.map((file) => ({
      id: uid(), name: file.name, file, url: URL.createObjectURL(file), desc: "",
      kind: file.type.startsWith("image") ? ("image" as const) : file.type.startsWith("audio") ? ("audio" as const) : ("video" as const),
      uploading: !!pid, err: pid ? undefined : t("dashboard.aiEditor.ws.errRefFirst"),
    }));
    setMaterials((prev) => [...prev, ...news]);
    if (pid) news.forEach((n) => void uploadMaterial(n.id, n.file as File, "", pid));
  }, [projectId, uploadMaterial, t]);
  const onMatPick = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) addMaterials(e.target.files); e.currentTarget.value = ""; };
  const setDesc = (id: string, desc: string) => setMaterials((m) => m.map((x) => (x.id === id ? { ...x, desc } : x)));
  const saveDesc = (mat: Material) => {
    if (!projectId || !mat.serverId) return;
    void fetch("/api/ai-editor/material", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, materialId: mat.serverId, desc: mat.desc }) });
  };
  const removeMat = (id: string) => {
    setMaterials((m) => {
      const mat = m.find((x) => x.id === id);
      if (mat?.serverId && projectId) {
        void fetch("/api/ai-editor/material", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, materialId: mat.serverId }) });
      }
      return m.filter((x) => x.id !== id);
    });
  };

  // Supprime une variante (fichier serveur + carte). Confirmation : c'est
  // irréversible, mais une variante se régénère en redemandant à ton Claude.
  const removeVariant = (id: string) => {
    if (!projectId) return;
    if (!window.confirm(t("dashboard.aiEditor.ws.confirmDelete"))) return;
    setVariants((vs) => vs.filter((v) => v.id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    setDrawer((d) => (d.variantId === id ? { open: false } : d));
    void fetch("/api/ai-editor/variant", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, id }) });
  };

  // Sélection groupée. selIds = ids sélectionnés ENCORE présents (le poll peut retirer
  // des variantes). Téléchargement = archive zip serveur ; Drive = via DriveSaveButton.
  const selIds = variants.filter((v) => selected.has(v.id)).map((v) => v.id);
  const toggleAll = () => setSelected((s) => (selIds.length === variants.length ? new Set() : new Set(variants.map((v) => v.id))));
  const downloadSelectedZip = () => {
    if (!projectId || !selIds.length) return;
    const a = document.createElement("a");
    a.href = `/api/ai-editor/variant/zip?projectId=${encodeURIComponent(projectId)}&ids=${selIds.join(",")}`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const goEditor = () => { setStep("editor"); void refreshProject(); };

  // Onboarding connexion : on arrive sur l'écran de connexion. Si le user l'a
  // déjà fait (mémorisé), on saute directement à la référence.
  useEffect(() => {
    try {
      if (localStorage.getItem("duupflow_aieditor_connected") === "1") {
        setConnected(true);
        setStep((s) => (s === "connect" ? "ref" : s));
      }
    } catch { /* localStorage indispo */ }
  }, []);
  const markConnected = () => {
    try { localStorage.setItem("duupflow_aieditor_connected", "1"); } catch { /* noop */ }
    setConnected(true);
    setStep("ref");
  };

  // Rafraîchit les variantes depuis le serveur (créées par le Claude du user via MCP).
  const refreshProject = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-editor/project");
      if (!res.ok) return;
      const { project } = await res.json();
      if (project) { setProjectId(project.id); setVariants(project.variants ?? []); }
    } catch { /* ignore */ }
  }, []);

  // Poll live pendant qu'on est dans le workspace : les variantes créées par le
  // Claude du user (via le connecteur MCP) apparaissent au fur et à mesure.
  useEffect(() => {
    if (step !== "editor") return;
    const t = setInterval(refreshProject, 5000);
    return () => clearInterval(t);
  }, [step, refreshProject]);

  const variantUrl = (id: string, dl = false) => `/api/ai-editor/variant?projectId=${projectId}&id=${id}${dl ? "&dl=1" : ""}`;
  // URL du connecteur MCP — résolue côté client seulement (évite le mismatch
  // d'hydratation : le serveur ne connaît pas window.location.origin).
  const [mcpUrl, setMcpUrl] = useState("/api/ai-editor/mcp");
  useEffect(() => { setMcpUrl(`${window.location.origin}/api/ai-editor/mcp`); }, []);

  const refReady = !!refSource;
  const stepState = (s: "connect" | "ref" | "material" | "editor") => {
    const order = { connect: 1, ref: 2, material: 3, editor: 4 };
    // Connexion : « validée » (✓) UNIQUEMENT si Claude est réellement connecté, pas
    // si le user a juste cliqué « plus tard » et avancé.
    if (s === "connect") return connected ? "done" : step === "connect" ? "active" : "todo";
    return order[s] < order[step] ? "done" : order[s] === order[step] ? "active" : "todo";
  };

  return (
    <main className="relative flex h-full flex-col">
      {/* Input matière — persistant (utilisé à l'étape 2 ET dans le workspace) */}
      <input ref={matInput} type="file" accept="video/*,image/*,audio/*" multiple hidden onChange={onMatPick} />
      {/* Input « changer la référence » — utilisé depuis le workspace */}
      <input ref={refChangeInput} type="file" accept="video/*" hidden onChange={onRefChange} />

      {/* Header */}
      {step !== "editor" && (
        <header className="shrink-0 px-6 pt-6">
          <div className="text-[12px] font-semibold uppercase tracking-[.14em] text-indigo-400">{t("dashboard.aiEditor.eyebrow")}</div>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[var(--app-text)]">{t("dashboard.aiEditor.title")}</h1>
          <div className="mt-5 flex flex-wrap gap-2">
            <StepPill n={1} label={t("dashboard.aiEditor.stepConnect")} state={stepState("connect")} onClick={() => setStep("connect")} />
            <StepPill n={2} label={t("dashboard.aiEditor.stepRef")} state={stepState("ref")} onClick={() => setStep("ref")} />
            <StepPill n={3} label={t("dashboard.aiEditor.stepMaterial")} state={stepState("material")} onClick={() => refReady && setStep("material")} />
          </div>
        </header>
      )}

      {/* ============ ÉTAPE 0 · CONNEXION À CLAUDE — split plein écran ============ */}
      {step === "connect" && (
        <section className="mt-5 grid flex-1 border-t border-[var(--app-border)] lg:grid-cols-[minmax(360px,520px)_1fr]">
          {/* ── Action (gauche) ── */}
          <div
            className="flex flex-col justify-center border-b border-[var(--app-border)] p-8 sm:p-10 lg:border-b-0 lg:border-r"
            style={{ background: "rgba(217,119,87,0.05)" }}
          >
            <div className="mb-6 flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/claude-color.svg" alt="Claude" className="h-7 w-7" />
              </span>
              <div>
                <div className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "#D97757" }}>{t("dashboard.aiEditor.connect.eyebrow")}</div>
                <h2 className="text-2xl font-extrabold tracking-tight text-[var(--app-text)]">{t("dashboard.aiEditor.connect.heading")}</h2>
              </div>
            </div>

            <p className="mb-7 text-sm leading-relaxed text-[var(--app-text-muted)]">
              <Rich text={t("dashboard.aiEditor.connect.intro")} />
            </p>

            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-faint)]">{t("dashboard.aiEditor.connect.connectorLabel")}</div>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] py-2 pl-3 pr-2">
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-[var(--app-text)]">{mcpUrl}</span>
              <CopyBtn text={mcpUrl} />
            </div>

            <div className="mt-8">
              <PrimaryBtn full onClick={markConnected}>{t("dashboard.aiEditor.connect.cta")}</PrimaryBtn>
            </div>
            <button onClick={() => setStep("ref")} className="mt-3 self-start text-[12px] text-[var(--app-text-faint)] underline hover:text-[var(--app-text-muted)]">
              {t("dashboard.aiEditor.connect.later")}
            </button>
            <p className="mt-6 text-[12px] leading-relaxed text-[var(--app-text-faint)]">
              {t("dashboard.aiEditor.connect.worksNote")}
            </p>
          </div>

          {/* ── Guide 3 étapes (droite) ── */}
          <aside className="flex flex-col justify-center gap-10 p-8 sm:p-14">
            <div className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-wider" style={{ color: "#D97757" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/claude-color.svg" alt="" className="h-4 w-4" />
              {t("dashboard.aiEditor.connect.guideTitle")}
            </div>

            {[
              { t: t("dashboard.aiEditor.connect.g1t"), d: t("dashboard.aiEditor.connect.g1d") },
              { t: t("dashboard.aiEditor.connect.g2t"), d: t("dashboard.aiEditor.connect.g2d") },
              { t: t("dashboard.aiEditor.connect.g3t"), d: t("dashboard.aiEditor.connect.g3d") },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[15px] font-bold text-white" style={{ background: "#D97757" }}>{i + 1}</span>
                <div>
                  <div className="text-[18px] font-bold text-[var(--app-text)]">{s.t}</div>
                  <p className="mt-2.5 max-w-2xl text-[15px] leading-loose text-[var(--app-text-muted)]"><Rich text={s.d} /></p>
                </div>
              </div>
            ))}
          </aside>
        </section>
      )}

      {/* ============ ÉTAPE 1 · RÉFÉRENCE — split plein écran, bords collés ============ */}
      {step === "ref" && (
        <section className="mt-5 grid flex-1 border-t border-[var(--app-border)] lg:grid-cols-[minmax(340px,480px)_1fr]">
          {/* ── Zone upload (gauche, bord collé) ── */}
          <div
            className="flex flex-col justify-center border-b border-[var(--app-border)] p-8 sm:p-10 lg:border-b-0 lg:border-r"
            style={{ background: "rgba(99,102,241,0.045)" }}
          >
            <p className="mb-9 text-sm leading-relaxed text-[var(--app-text-muted)]">
              <Rich text={t("dashboard.aiEditor.ref.intro")} />
            </p>

            <input ref={refInput} type="file" accept="video/*" hidden onChange={onRefPick} />
            {!refSource ? (
              <>
                <div
                  onClick={() => refInput.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); if (!refDragOver) setRefDragOver(true); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setRefDragOver(false); }}
                  onDrop={(e) => { e.preventDefault(); setRefDragOver(false); addRef(e.dataTransfer.files?.[0]); }}
                  className={`cursor-pointer rounded-xl border border-dashed p-8 text-center transition ${refDragOver ? "border-indigo-400 bg-indigo-400/10" : "border-[var(--app-border-strong)] bg-[var(--app-surface)] hover:border-indigo-400/50"}`}
                >
                  <div className="text-base font-semibold text-[var(--app-text)]">{refDragOver ? t("dashboard.aiEditor.ref.dropActive") : t("dashboard.aiEditor.ref.dropTitle")}</div>
                  <div className="mt-1 text-[13px] text-[var(--app-text-faint)]">{t("dashboard.aiEditor.ref.dropHint")}</div>
                </div>
                <div className="my-6 text-center text-[12px] tracking-wider text-[var(--app-text-faint)]">{t("dashboard.aiEditor.ref.or")}</div>
                <div className="flex gap-2.5">
                  <input
                    value={refUrl}
                    onChange={(e) => setRefUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") analyzeUrl(); }}
                    placeholder={t("dashboard.aiEditor.ref.urlPlaceholder")}
                    className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2.5 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-faint)]"
                  />
                  <button
                    type="button"
                    onClick={analyzeUrl}
                    disabled={refUrl.trim().length < 7}
                    className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition ${refUrl.trim().length < 7 ? "opacity-45 cursor-not-allowed" : "hover:brightness-110"}`}
                    style={{ background: BRAND }}
                  >
                    {t("dashboard.aiEditor.ref.analyze")}
                  </button>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-[var(--app-text-faint)]">{t("dashboard.aiEditor.ref.publicNote")}</p>
              </>
            ) : (
              <div className="flex gap-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3.5">
                <div className="h-[104px] w-[76px] shrink-0 overflow-hidden rounded-xl" style={{ background: "linear-gradient(160deg,#2a2340,#123040)" }}>
                  {analysis?.keyframes?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={analysis.keyframes[0].dataUri} alt="cover" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-white/80">▶</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-[var(--app-text)]">
                    <span className="max-w-[220px] truncate">{refSource?.type === "url" ? "🔗 " : ""}{refSource?.label}</span>
                    {analyzing ? (
                      <span className="rounded-full bg-indigo-400/15 px-2 py-0.5 text-[11px] font-bold text-indigo-300">{t("dashboard.aiEditor.ref.analyzing")}</span>
                    ) : analysis ? (
                      <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-bold text-emerald-400">{t("dashboard.aiEditor.ref.analyzed")}</span>
                    ) : analyzeErr ? (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-bold text-amber-400">{t("dashboard.aiEditor.ref.redo")}</span>
                    ) : null}
                  </div>
                  {analyzing && (
                    <div className="mt-1.5 text-[12.5px] text-[var(--app-text-muted)]">{t("dashboard.aiEditor.ref.extracting")}</div>
                  )}
                  {analysis && (
                    <div className="mt-1.5 space-y-1 text-[12.5px] text-[var(--app-text-muted)]">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <span>⏱ {fmtDur(analysis.durationSec)}</span>
                        <span>🎞 {t("dashboard.aiEditor.ref.keyframes", { n: analysis.keyframes.length })}</span>
                        <span>✂️ {t(analysis.pacing.cutCount > 1 ? "dashboard.aiEditor.ref.cutsMany" : "dashboard.aiEditor.ref.cutsOne", { n: analysis.pacing.cutCount })}{analysis.pacing.avgCutSec ? ` · ~${analysis.pacing.avgCutSec}s` : ""}</span>
                        <span>{analysis.width}×{analysis.height}</span>
                      </div>
                      {analysis.transcript ? (
                        <div className="text-[var(--app-text-faint)]">{t("dashboard.aiEditor.ref.hook", { text: (analysis.hookText || analysis.transcript.fullText).slice(0, 60) })}</div>
                      ) : (
                        <div className="text-[var(--app-text-faint)]">{t("dashboard.aiEditor.ref.noTranscript")}</div>
                      )}
                    </div>
                  )}
                  {analyzeErr && !analyzing && (
                    <div className="mt-1.5 text-[12.5px] text-amber-400/90">{analyzeErr}</div>
                  )}
                  <div className="mt-2 flex gap-3">
                    <button onClick={resetRef} className="text-[12px] text-[var(--app-text-faint)] underline hover:text-[var(--app-text-muted)]">{t("dashboard.aiEditor.ref.change")}</button>
                    {analyzeErr && !analyzing && (
                      <button onClick={retryRef} className="text-[12px] text-indigo-400 underline">{t("dashboard.aiEditor.ref.retry")}</button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-9">
              <PrimaryBtn onClick={() => setStep("material")} disabled={!refReady}>{t("dashboard.aiEditor.ref.continue")}</PrimaryBtn>
            </div>
          </div>

          {/* ── Guide (droite) — prend tout l&apos;espace, plat, bords collés ── */}
          <aside className="flex flex-col justify-center gap-11 p-8 sm:p-14">
            <div className="text-[12px] font-bold uppercase tracking-wider text-indigo-400">{t("dashboard.aiEditor.ref.guideHeading")}</div>

            <div className="flex items-start gap-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[15px] font-bold text-white" style={{ background: BRAND }}>1</span>
              <div>
                <div className="text-[18px] font-bold text-[var(--app-text)]">{t("dashboard.aiEditor.ref.way1t")}</div>
                <p className="mt-3 max-w-2xl text-[15px] leading-loose text-[var(--app-text-muted)]">
                  <Rich text={t("dashboard.aiEditor.ref.way1d")} />
                </p>
              </div>
            </div>

            <div className="h-px bg-[var(--app-border)]" />

            <div className="flex items-start gap-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[15px] font-bold text-white" style={{ background: "linear-gradient(135deg,#38BDF8,#6366F1)" }}>2</span>
              <div>
                <div className="text-[18px] font-bold text-[var(--app-text)]">{t("dashboard.aiEditor.ref.way2t")}</div>
                <p className="mt-3 max-w-2xl text-[15px] leading-loose text-[var(--app-text-muted)]">
                  <Rich text={t("dashboard.aiEditor.ref.way2d")} />
                </p>
              </div>
            </div>

            <p className="text-[13px] text-[var(--app-text-faint)]">{t("dashboard.aiEditor.ref.bothNote")}</p>
          </aside>
        </section>
      )}

      {/* ============ ÉTAPE 2 · MATIÈRE ============ */}
      {step === "material" && (
        <section
          className="max-w-4xl px-6 pt-2 pb-10"
          onDragOver={(e) => { e.preventDefault(); if (!matDragOver) setMatDragOver(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setMatDragOver(false); }}
          onDrop={(e) => { e.preventDefault(); setMatDragOver(false); if (e.dataTransfer.files?.length) addMaterials(e.dataTransfer.files); }}
        >
          <p className="mb-6 max-w-[64ch] text-sm text-[var(--app-text-muted)]">
            <Rich text={t("dashboard.aiEditor.material.intro")} />
          </p>

          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
            {materials.map((m) => (
              <div key={m.id} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
                <div className="flex gap-3">
                  <div className="relative h-[70px] w-[52px] shrink-0 overflow-hidden rounded-lg" style={{ background: "linear-gradient(160deg,#2a2340,#123040)" }}>
                    {m.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.thumb} alt={m.name} className="h-full w-full object-cover" />
                    ) : m.url && m.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
                    ) : m.url ? (
                      <video src={m.url} muted className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-[13px] text-white/70">{m.kind === "image" ? "🖼️" : m.kind === "audio" ? "🎵" : "🎬"}</div>
                    )}
                    {m.uploading && <div className="absolute inset-0 grid place-items-center bg-black/45 text-[10px] font-semibold text-white">⏳</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-[var(--app-text)]">{m.name}</div>
                    <div className="mt-0.5 text-[11px] text-[var(--app-text-faint)]">
                      {m.err ? <span className="text-amber-400">{m.err}</span> : m.uploading ? t("dashboard.aiEditor.material.uploading") : m.serverId ? t("dashboard.aiEditor.material.saved") : m.kind === "image" ? t("dashboard.aiEditor.material.kindImage") : m.kind === "audio" ? t("dashboard.aiEditor.material.kindAudio") : t("dashboard.aiEditor.material.kindVideo")}
                    </div>
                    <button onClick={() => removeMat(m.id)} className="mt-1 text-[11px] text-[var(--app-text-faint)] underline hover:text-red-400/80">{t("dashboard.aiEditor.material.remove")}</button>
                  </div>
                </div>
                <textarea
                  value={m.desc}
                  onChange={(e) => setDesc(m.id, e.target.value)}
                  onBlur={() => saveDesc(m)}
                  placeholder={t("dashboard.aiEditor.material.descPlaceholder")}
                  rows={2}
                  className="mt-3 min-h-[52px] w-full resize-none rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-2)] px-2.5 py-2 text-[12.5px] text-[var(--app-text)] placeholder:text-[var(--app-text-faint)]"
                />
              </div>
            ))}
            <button
              onClick={() => matInput.current?.click()}
              className={`grid min-h-[150px] place-items-center rounded-2xl border border-dashed text-[13px] transition ${matDragOver ? "border-indigo-400 bg-indigo-400/10 text-[var(--app-text)]" : "border-[var(--app-border-strong)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:border-indigo-400/50"}`}
            >
              <div className="text-center">
                <div className="font-medium">{matDragOver ? t("dashboard.aiEditor.material.dropHere") : t("dashboard.aiEditor.material.addFile")}</div>
                <div className="mt-1 text-[11px] text-[var(--app-text-faint)]">{t("dashboard.aiEditor.material.dragOrClick")}</div>
              </div>
            </button>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <GhostBtn onClick={() => setStep("ref")}>{t("dashboard.aiEditor.material.back")}</GhostBtn>
            <PrimaryBtn onClick={goEditor} disabled={materials.length === 0}>{t("dashboard.aiEditor.material.open")}</PrimaryBtn>
          </div>
        </section>
      )}

      {/* ============ ÉTAPE 3 · WORKSPACE (génération intégrée, 0 connexion) ============ */}
      {step === "editor" && (
        <section className="m-6 grid min-h-0 flex-1 gap-0 overflow-hidden rounded-2xl border border-[var(--app-border)]" style={{ gridTemplateColumns: "290px 1fr", gridTemplateRows: "minmax(0, 1fr)" }}>
          {/* Rail contexte */}
          <aside className="flex min-h-0 flex-col border-r border-[var(--app-border)] bg-[var(--app-surface)]">
            <div className="shrink-0 border-b border-[var(--app-border)] px-4 py-4">
              <div className="flex items-center gap-2.5 text-[14px] font-bold text-[var(--app-text)]">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/claude-color.svg" alt="Claude" className="h-4 w-4" />
                </span>
                {t("dashboard.aiEditor.ws.pilotedBy")}
              </div>
              <div className="mt-0.5 pl-[30px] text-[11.5px] text-[var(--app-text-faint)]">{t("dashboard.aiEditor.ws.ready")}</div>
            </div>
            <div className="shrink-0 border-b border-[var(--app-border)] px-4 py-4">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--app-text-faint)]">{t("dashboard.aiEditor.ws.refReceived")}</div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => refChangeInput.current?.click()}
                    disabled={analyzing}
                    title={t("dashboard.aiEditor.ws.changeTitle")}
                    className={`rounded-md border border-[var(--app-border-strong)] px-2 py-0.5 text-[11px] font-semibold transition ${analyzing ? "cursor-wait text-[var(--app-text-faint)]" : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"}`}
                  >
                    {analyzing ? t("dashboard.aiEditor.ws.analyzing") : t("dashboard.aiEditor.ws.change")}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-[60px] w-[44px] shrink-0 overflow-hidden rounded-lg" style={{ background: "linear-gradient(160deg,#2a2340,#123040)" }}>
                  {analysis?.keyframes?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={analysis.keyframes[0].dataUri} alt="ref" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[13px] text-white/80">▶</div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-[var(--app-text)]">{refSource?.label ?? t("dashboard.aiEditor.ws.refFallback")}</div>
                  <div className="mt-0.5 text-[11.5px] text-[var(--app-text-faint)]">
                    {analysis
                      ? t("dashboard.aiEditor.ws.refStats", { n: analysis.keyframes.length, c: analysis.pacing.cutCount, transcript: analysis.transcript ? t("dashboard.aiEditor.ws.transcribed") : "" })
                      : t("dashboard.aiEditor.ref.analyzed")}
                  </div>
                </div>
              </div>
              {analysis?.hookText && (
                <div className="mt-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-2)] px-2.5 py-2 text-[11.5px] text-[var(--app-text-muted)]">
                  {t("dashboard.aiEditor.ws.hook", { text: analysis.hookText.slice(0, 90) })}
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--app-text-faint)]">{t("dashboard.aiEditor.ws.material", { n: materials.length, s: materials.length > 1 ? "s" : "" })}</div>
                <button
                  onClick={() => matInput.current?.click()}
                  title={t("dashboard.aiEditor.ws.addTitle")}
                  className="rounded-md border border-[var(--app-border-strong)] px-2 py-0.5 text-[11px] font-semibold text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"
                >
                  {t("dashboard.aiEditor.ws.add")}
                </button>
              </div>
              {materials.map((m) => (
                <div key={m.id} className="group py-1.5">
                  <div className="flex items-center gap-2.5 text-[12.5px] text-[var(--app-text-muted)]">
                    <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-md text-[12px]" style={{ background: "var(--app-surface-2)" }}>{m.kind === "image" ? "🖼️" : m.kind === "audio" ? "🎵" : "🎬"}</span>
                    <span className="flex-1 truncate">{m.name}</span>
                    <button onClick={() => setEditCtx(editCtx === m.id ? null : m.id)} title={t("dashboard.aiEditor.ws.editCtxTitle")} className={`shrink-0 transition ${editCtx === m.id ? "text-indigo-400" : "text-[var(--app-text-faint)] opacity-0 hover:text-[var(--app-text)] group-hover:opacity-100"}`}>✎</button>
                    <button onClick={() => removeMat(m.id)} title={t("dashboard.aiEditor.ws.removeTitle")} className="shrink-0 text-[var(--app-text-faint)] opacity-0 transition hover:text-red-400/80 group-hover:opacity-100">✕</button>
                  </div>
                  {editCtx === m.id ? (
                    <textarea
                      autoFocus
                      value={m.desc}
                      onChange={(e) => setDesc(m.id, e.target.value)}
                      onBlur={() => { saveDesc(m); setEditCtx(null); }}
                      placeholder={t("dashboard.aiEditor.ws.ctxPlaceholder")}
                      rows={2}
                      className="ml-[34px] mt-1.5 block w-[calc(100%-34px)] resize-none rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-2)] px-2 py-1.5 text-[11.5px] text-[var(--app-text)] placeholder:text-[var(--app-text-faint)]"
                    />
                  ) : m.desc?.trim() ? (
                    <button onClick={() => setEditCtx(m.id)} title={t("dashboard.aiEditor.ws.editCtx")} className="ml-[34px] mt-0.5 block max-w-[calc(100%-34px)] truncate text-left text-[11px] text-[var(--app-text-faint)] hover:text-[var(--app-text-muted)]">« {m.desc.trim()} »</button>
                  ) : (
                    <button onClick={() => setEditCtx(m.id)} title={t("dashboard.aiEditor.ws.addCtxTitle")} className="ml-[34px] mt-0.5 block text-left text-[11px] italic text-[var(--app-text-faint)] opacity-0 transition hover:text-[var(--app-text-muted)] group-hover:opacity-100">{t("dashboard.aiEditor.ws.addCtx")}</button>
                  )}
                </div>
              ))}
              {materials.length === 0 && (
                <p className="py-1 text-[12px] text-[var(--app-text-faint)]">{t("dashboard.aiEditor.ws.noFiles")}</p>
              )}
            </div>
            <div className="mx-3.5 mb-4 mt-auto flex shrink-0 items-start gap-2.5 rounded-xl border p-3 text-[12.5px] text-[var(--app-text)]"
                 style={{ background: "rgba(217,119,87,.09)", borderColor: "rgba(217,119,87,.3)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/claude-color.svg" alt="" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <Rich text={t("dashboard.aiEditor.ws.railCta")} />{" "}
                <button onClick={() => setStep("connect")} className="font-semibold text-[var(--app-text)] underline underline-offset-2 hover:opacity-80">{t("dashboard.aiEditor.ws.reconnect")}</button>
              </span>
            </div>
          </aside>

          {/* Workspace résultats */}
          <div className="flex min-h-0 flex-col bg-[var(--app-bg-2)]">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--app-border)] px-6 py-4">
              <div>
                <div className="text-[15px] font-bold text-[var(--app-text)]">{t("dashboard.aiEditor.ws.variants")} {variants.length > 0 && <span className="text-[var(--app-text-faint)]">· {variants.length}</span>}</div>
                <div className="text-[12.5px] text-[var(--app-text-faint)]">{t("dashboard.aiEditor.ws.createdLive")}</div>
              </div>
              <button onClick={() => window.location.reload()} title={t("dashboard.aiEditor.ws.refreshTitle")} className="shrink-0 rounded-lg border border-[var(--app-border-strong)] px-3 py-2.5 text-[13px] font-medium text-[var(--app-text)] transition hover:bg-[var(--app-surface-2)]">{t("dashboard.aiEditor.ws.refresh")}</button>
            </div>

            {/* Barre de sélection groupée : tout sélectionner + télécharger (zip) / Drive */}
            {variants.length > 0 && (
              <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--app-border)] px-6 py-2.5">
                <label className="flex cursor-pointer select-none items-center gap-2 text-[12.5px] font-medium text-[var(--app-text-muted)]">
                  <input type="checkbox" checked={selIds.length === variants.length && variants.length > 0} onChange={toggleAll} className="h-4 w-4 cursor-pointer rounded accent-indigo-500" />
                  {selIds.length > 0 ? t("dashboard.aiEditor.ws.nSelected", { n: selIds.length }) : t("dashboard.aiEditor.ws.selectAll")}
                </label>
                {selIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button onClick={downloadSelectedZip} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110" style={{ background: BRAND }}>
                      ⬇ {t("dashboard.aiEditor.ws.downloadSelected", { n: selIds.length })}
                    </button>
                    <DriveSaveButton files={variants.filter((v) => selected.has(v.id)).map((v, i) => ({ url: variantUrl(v.id, true), name: `${(v.label || `variante-${i + 1}`).replace(/[^\w\-. À-ÿ]/g, "").trim() || `variante-${i + 1}`}.mp4` }))} />
                    <button onClick={() => setSelected(new Set())} className="text-[12px] text-[var(--app-text-faint)] underline hover:text-[var(--app-text-muted)]">{t("dashboard.aiEditor.ws.clearSel")}</button>
                  </div>
                )}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            {variants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface)] p-10 text-center">
                <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/claude-color.svg" alt="Claude" className="h-8 w-8" />
                </span>
                <div className="text-[15px] font-bold text-[var(--app-text)]">{t("dashboard.aiEditor.ws.emptyTitle")}</div>
                <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[var(--app-text-muted)]">
                  <Rich text={t("dashboard.aiEditor.ws.emptyDesc")} />
                </p>
                <button onClick={() => setStep("connect")} className="mt-4 text-[12px] text-[var(--app-text-faint)] underline hover:text-[var(--app-text-muted)]">
                  {t("dashboard.aiEditor.ws.notConnected")}
                </button>
              </div>
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))" }}>
                {variants.map((v, i) => (
                  <div key={v.id} className={`group relative overflow-hidden rounded-2xl border bg-[var(--app-surface)] transition hover:shadow-lg ${selected.has(v.id) ? "border-indigo-500 ring-2 ring-indigo-500/60" : "border-[var(--app-border)] hover:border-indigo-400/50"}`}>
                    {/* Case de sélection (au-dessus de la vignette, ne déclenche pas le drawer) */}
                    <label onClick={(e) => e.stopPropagation()} className={`absolute left-2 top-2 z-20 cursor-pointer transition ${selected.has(v.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} title={t("dashboard.aiEditor.ws.select")}>
                      <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggleSelect(v.id)} className="h-5 w-5 cursor-pointer rounded accent-indigo-500" style={{ boxShadow: "0 0 0 2px rgba(0,0,0,.35)" }} />
                    </label>
                    <button onClick={() => setDrawer({ open: true, variantId: v.id, label: v.label })} className="relative block aspect-[9/16] w-full">
                      {v.poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.poster} alt={v.label || `variante ${i + 1}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-[12px] text-[var(--app-text-faint)]" style={{ background: "linear-gradient(160deg,#241f3a,#123040)" }}>🎬</div>
                      )}
                      <span className="absolute inset-0 grid place-items-center bg-black/0 text-3xl text-white/0 transition group-hover:bg-black/30 group-hover:text-white/90">▶</span>
                    </button>
                    <div className="flex items-center justify-between gap-2 px-2.5 py-2.5">
                      <span className="truncate text-[12.5px] font-semibold text-[var(--app-text)]">{v.label || t("dashboard.aiEditor.ws.variantFallback", { n: i + 1 })}</span>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <a href={variantUrl(v.id, true)} className="text-[12px] text-indigo-400 hover:text-indigo-300" title={t("dashboard.aiEditor.ws.downloadTitle")}>⬇</a>
                        <button onClick={() => removeVariant(v.id)} className="text-[12px] text-[var(--app-text-faint)] transition hover:text-red-400" title={t("dashboard.aiEditor.ws.deleteTitle")}>🗑</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {variants.length > 0 && (
              <div className="mt-6 space-y-1.5 text-center text-[12px] text-[var(--app-text-faint)]">
                <p className="flex items-center justify-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/claude-color.svg" alt="" className="h-3.5 w-3.5" />
                  <span><Rich text={t("dashboard.aiEditor.ws.footerCredit")} /></span>
                </p>
                <p><Rich text={t("dashboard.aiEditor.ws.footerTemp")} /></p>
              </div>
            )}
            </div>
          </div>
        </section>
      )}

      {/* Drawer édition manuelle */}
      {drawer.open && (
        <>
          <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onClick={() => setDrawer((d) => ({ ...d, open: false }))} />
          <aside className="fixed right-0 top-0 z-[85] flex h-full w-[440px] max-w-[92%] flex-col border-l border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-4">
              <div className="truncate text-[14.5px] font-bold text-[var(--app-text)]">{drawer.label || t("dashboard.aiEditor.drawer.variantFallback")}</div>
              <button onClick={() => setDrawer({ open: false })} className="text-xl leading-none text-[var(--app-text-muted)] hover:text-[var(--app-text)]">✕</button>
            </div>
            <div className="flex flex-1 flex-col gap-4 overflow-auto px-4 py-4">
              {drawer.variantId && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={variantUrl(drawer.variantId)} controls playsInline className="mx-auto max-h-[420px] w-auto rounded-xl bg-black" style={{ aspectRatio: "9 / 16" }} />
              )}
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg-2)] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-faint)]">{t("dashboard.aiEditor.drawer.manualEdit")} <span className="ml-1 rounded-full border border-[var(--app-border-strong)] px-1.5 py-0.5 text-[9px] normal-case text-[var(--app-text-faint)]">{t("dashboard.aiEditor.drawer.soon")}</span></div>
                <div className="grid grid-cols-2 gap-2 opacity-55">
                  {[["✍️", t("dashboard.aiEditor.drawer.toolHook")], ["💬", t("dashboard.aiEditor.drawer.toolCaptions")], ["✂️", t("dashboard.aiEditor.drawer.toolCut")], ["⏩", t("dashboard.aiEditor.drawer.toolSpeed")], ["🔍", t("dashboard.aiEditor.drawer.toolReframe")], ["🎞️", t("dashboard.aiEditor.drawer.toolOrder")]].map(([ic, l]) => (
                    <div key={l} className="flex items-center gap-2 rounded-lg border border-[var(--app-border)] px-2.5 py-2 text-[12px] text-[var(--app-text)]">
                      <span>{ic}</span>{l}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-[var(--app-text-faint)]">{t("dashboard.aiEditor.drawer.note")}</p>
              </div>
            </div>
            <div className="mt-auto flex gap-2.5 border-t border-[var(--app-border)] px-4 py-3.5">
              {drawer.variantId && (
                <button onClick={() => removeVariant(drawer.variantId!)} title={t("dashboard.aiEditor.drawer.deleteTitle")} className="shrink-0 rounded-lg border border-red-500/40 px-3.5 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10">🗑</button>
              )}
              <button onClick={() => setDrawer({ open: false })} className="flex-1 rounded-lg border border-[var(--app-border-strong)] px-4 py-2.5 text-sm font-medium text-[var(--app-text)] hover:bg-[var(--app-surface-2)]">{t("dashboard.aiEditor.drawer.close")}</button>
              {drawer.variantId && (
                <a href={variantUrl(drawer.variantId, true)} className="flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white hover:brightness-110" style={{ background: BRAND }}>{t("dashboard.aiEditor.drawer.download")}</a>
              )}
            </div>
          </aside>
        </>
      )}
    </main>
  );
}

/* ---- sous-composants ---- */
function CopyBtn({ text }: { text?: string }) {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  const copy = () => {
    if (text) navigator.clipboard?.writeText(text).catch(() => {});
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };
  return (
    <button
      onClick={copy}
      className="shrink-0 rounded-lg border border-[var(--app-border-strong)] px-3 py-2 text-[13px] font-medium text-[var(--app-text)] hover:bg-[var(--app-surface-2)]"
    >
      {done ? t("dashboard.aiEditor.copied") : t("dashboard.aiEditor.copy")}
    </button>
  );
}

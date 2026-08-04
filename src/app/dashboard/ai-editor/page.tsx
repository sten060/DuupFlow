"use client";

// Module « Éditeur IA » — Reproduis ce qui marche.
// Flow : Connexion à ton Claude (OAuth, étape 0) → Référence → Matière → workspace.
// Modèle « pur ton Claude » : l'utilisateur branche son propre Claude via le
// connecteur MCP (OAuth, sans clé). Il pilote le montage depuis SA conversation ;
// les variantes créées (outil create_variant) remontent ici en direct (poll).

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReferenceAnalysis } from "@/lib/ai-editor/analyze";

const BRAND = "linear-gradient(135deg,#6366F1,#38BDF8)";

function fmtDur(s: number) {
  if (!s || s <= 0) return "—";
  const m = Math.floor(s / 60), sec = Math.round(s % 60);
  return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}s`;
}

/* ============ petits helpers UI ============ */
function StepPill({ n, label, state }: { n: number; label: string; state: "todo" | "active" | "done" }) {
  return (
    <div
      className="inline-flex items-center gap-2.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition"
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
    </div>
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
export default function AiEditorPage() {
  // Parcours : Connexion (étape 0) → Référence → Matière → workspace.
  const [step, setStep] = useState<"connect" | "ref" | "material" | "editor">("connect");

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
  const [reanalyzing, setReanalyzing] = useState(false); // ré-analyse du profil (débloque un profil figé)

  // Projet persistant (créé à l'analyse de la réf ; restauré au chargement)
  const [projectId, setProjectId] = useState<string | null>(null);

  // Éditeur — pur « ton Claude » : les variantes créées via le connecteur MCP
  // (par le Claude du user) remontent ici en direct.
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [drawer, setDrawer] = useState<{ open: boolean; variantId?: string; label?: string }>({ open: false });

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
      setAnalyzeErr((e as Error)?.message || "Analyse échouée");
    } finally {
      setAnalyzing(false);
    }
  }, []);
  // Changer la référence depuis le workspace (garde la matière + les variantes).
  const onRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!f || !projectId) return;
    setRefFile(f); setRefSource({ type: "file", label: f.name });
    void analyzeRef({ file: f, replacePid: projectId });
  };
  // Ré-analyse le profil de la référence DÉJÀ stockée (sans ré-upload) → régénère
  // avec le code courant (ex. couche compréhension Gemini). Débloque un profil figé.
  const reanalyzeRef = async () => {
    if (!projectId || reanalyzing) return;
    setReanalyzing(true);
    try {
      const res = await fetch("/api/ai-editor/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, reanalyze: true }),
      });
      const json = await res.json();
      if (res.ok && json.analysis) setAnalysis(json.analysis as ReferenceAnalysis);
    } catch { /* silencieux */ } finally { setReanalyzing(false); }
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
            : { ...x, uploading: false, err: json?.error || "Upload échoué" })
        : x));
    } catch (e) {
      setMaterials((m) => m.map((x) => x.id === localId ? { ...x, uploading: false, err: (e as Error)?.message || "Upload échoué" } : x));
    }
  }, []);

  const addMaterials = useCallback((files: FileList | File[]) => {
    const pid = projectId;
    const arr = Array.from(files);
    const news: Material[] = arr.map((file) => ({
      id: uid(), name: file.name, file, url: URL.createObjectURL(file), desc: "",
      kind: file.type.startsWith("image") ? ("image" as const) : file.type.startsWith("audio") ? ("audio" as const) : ("video" as const),
      uploading: !!pid, err: pid ? undefined : "Analyse la référence d'abord",
    }));
    setMaterials((prev) => [...prev, ...news]);
    if (pid) news.forEach((n) => void uploadMaterial(n.id, n.file as File, "", pid));
  }, [projectId, uploadMaterial]);
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
    if (!window.confirm("Supprimer cette variante ? Télécharge-la d'abord si tu veux la garder.")) return;
    setVariants((vs) => vs.filter((v) => v.id !== id));
    setDrawer((d) => (d.variantId === id ? { open: false } : d));
    void fetch("/api/ai-editor/variant", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, id }) });
  };

  const goEditor = () => { setStep("editor"); void refreshProject(); };

  // Onboarding connexion : on arrive sur l'écran de connexion. Si le user l'a
  // déjà fait (mémorisé), on saute directement à la référence.
  useEffect(() => {
    try {
      if (localStorage.getItem("duupflow_aieditor_connected") === "1") {
        setStep((s) => (s === "connect" ? "ref" : s));
      }
    } catch { /* localStorage indispo */ }
  }, []);
  const markConnected = () => {
    try { localStorage.setItem("duupflow_aieditor_connected", "1"); } catch { /* noop */ }
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
          <div className="text-[12px] font-semibold uppercase tracking-[.14em] text-indigo-400">Éditeur IA · Reproduis ce qui marche</div>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[var(--app-text)]">Ta version de ce qui a cartonné</h1>
          <div className="mt-5 flex flex-wrap gap-2">
            <StepPill n={1} label="Connexion" state={stepState("connect")} />
            <StepPill n={2} label="Référence" state={stepState("ref")} />
            <StepPill n={3} label="Ta matière" state={stepState("material")} />
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
                <div className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "#D97757" }}>Étape 1 · Connexion</div>
                <h2 className="text-2xl font-extrabold tracking-tight text-[var(--app-text)]">Connecte ton Claude</h2>
              </div>
            </div>

            <p className="mb-7 text-sm leading-relaxed text-[var(--app-text-muted)]">
              Tu piloteras le montage depuis <b className="text-[var(--app-text)]">ton propre Claude</b>. Une seule fois :
              colle l&apos;adresse ci-dessous dans Claude, puis clique <b className="text-[var(--app-text)]">Autoriser</b>. Aucun mot de passe, aucune clé.
            </p>

            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-faint)]">Adresse du connecteur</div>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] py-2 pl-3 pr-2">
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-[var(--app-text)]">{mcpUrl}</span>
              <CopyBtn text={mcpUrl} />
            </div>

            <div className="mt-8">
              <PrimaryBtn full onClick={markConnected}>J&apos;ai connecté mon Claude → Continuer</PrimaryBtn>
            </div>
            <button onClick={() => setStep("ref")} className="mt-3 self-start text-[12px] text-[var(--app-text-faint)] underline hover:text-[var(--app-text-muted)]">
              Je le ferai plus tard →
            </button>
            <p className="mt-6 text-[12px] leading-relaxed text-[var(--app-text-faint)]">
              Marche sur claude.ai, Claude Desktop et mobile — même en plan gratuit.
            </p>
          </div>

          {/* ── Guide 3 étapes (droite) ── */}
          <aside className="flex flex-col justify-center gap-10 p-8 sm:p-14">
            <div className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-wider" style={{ color: "#D97757" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/claude-color.svg" alt="" className="h-4 w-4" />
              Connecter à Claude — 3 étapes
            </div>

            {[
              { t: "Copie l'adresse", d: <>Clique <b className="text-[var(--app-text)]">Copier</b> à gauche — l&apos;adresse du connecteur est dans ton presse-papier.</> },
              { t: "Ajoute-la dans Claude", d: <>Dans Claude : <b className="text-[var(--app-text)]">Réglages → Connecteurs → Ajouter un connecteur personnalisé</b>, et colle l&apos;adresse.</> },
              { t: "Autorise", d: <>Clique <b className="text-[var(--app-text)]">Connecter</b> puis <b className="text-[var(--app-text)]">Autoriser</b> (tu verras l&apos;écran DuupFlow). C&apos;est branché — définitivement.</> },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[15px] font-bold text-white" style={{ background: "#D97757" }}>{i + 1}</span>
                <div>
                  <div className="text-[18px] font-bold text-[var(--app-text)]">{s.t}</div>
                  <p className="mt-2.5 max-w-2xl text-[15px] leading-loose text-[var(--app-text-muted)]">{s.d}</p>
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
              Ajoute <b className="text-[var(--app-text)]">la vidéo qui a performé</b> — la tienne ou celle d&apos;un concurrent. L&apos;IA en analysera la{" "}
              <b className="text-[var(--app-text)]">structure</b>, jamais son contenu.
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
                  <div className="text-base font-semibold text-[var(--app-text)]">{refDragOver ? "Dépose pour analyser" : "Glisse-dépose la vidéo de référence"}</div>
                  <div className="mt-1 text-[13px] text-[var(--app-text-faint)]">MP4, MOV — glisser-déposer ou cliquer · ou colle un lien ci-dessous</div>
                </div>
                <div className="my-6 text-center text-[12px] tracking-wider text-[var(--app-text-faint)]">— OU —</div>
                <div className="flex gap-2.5">
                  <input
                    value={refUrl}
                    onChange={(e) => setRefUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") analyzeUrl(); }}
                    placeholder="https://tiktok.com/@… ou lien Instagram / YouTube"
                    className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2.5 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-faint)]"
                  />
                  <button
                    type="button"
                    onClick={analyzeUrl}
                    disabled={refUrl.trim().length < 7}
                    className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition ${refUrl.trim().length < 7 ? "opacity-45 cursor-not-allowed" : "hover:brightness-110"}`}
                    style={{ background: BRAND }}
                  >
                    Analyser
                  </button>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-[var(--app-text-faint)]">TikTok / YouTube publics fonctionnent direct ; Instagram peut nécessiter d&apos;être connecté.</p>
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
                      <span className="rounded-full bg-indigo-400/15 px-2 py-0.5 text-[11px] font-bold text-indigo-300">⏳ analyse…</span>
                    ) : analysis ? (
                      <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-bold text-emerald-400">✓ structure analysée</span>
                    ) : analyzeErr ? (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-bold text-amber-400">⚠ analyse à refaire</span>
                    ) : null}
                  </div>
                  {analyzing && (
                    <div className="mt-1.5 text-[12.5px] text-[var(--app-text-muted)]">Extraction des images clés, du rythme et de la transcription…</div>
                  )}
                  {analysis && (
                    <div className="mt-1.5 space-y-1 text-[12.5px] text-[var(--app-text-muted)]">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <span>⏱ {fmtDur(analysis.durationSec)}</span>
                        <span>🎞 {analysis.keyframes.length} images clés</span>
                        <span>✂️ {analysis.pacing.cutCount} coupe{analysis.pacing.cutCount > 1 ? "s" : ""}{analysis.pacing.avgCutSec ? ` · ~${analysis.pacing.avgCutSec}s` : ""}</span>
                        <span>{analysis.width}×{analysis.height}</span>
                      </div>
                      {analysis.transcript ? (
                        <div className="text-[var(--app-text-faint)]">🎙 Hook : « {(analysis.hookText || analysis.transcript.fullText).slice(0, 60)}… »</div>
                      ) : (
                        <div className="text-[var(--app-text-faint)]">🎙 Pas de transcription — analyse visuelle</div>
                      )}
                    </div>
                  )}
                  {analyzeErr && !analyzing && (
                    <div className="mt-1.5 text-[12.5px] text-amber-400/90">{analyzeErr}</div>
                  )}
                  <div className="mt-2 flex gap-3">
                    <button onClick={resetRef} className="text-[12px] text-[var(--app-text-faint)] underline hover:text-[var(--app-text-muted)]">Changer</button>
                    {analyzeErr && !analyzing && (
                      <button onClick={retryRef} className="text-[12px] text-indigo-400 underline">Relancer l&apos;analyse</button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-9">
              <PrimaryBtn onClick={() => setStep("material")} disabled={!refReady}>Continuer → Ma matière</PrimaryBtn>
            </div>
          </div>

          {/* ── Guide (droite) — prend tout l&apos;espace, plat, bords collés ── */}
          <aside className="flex flex-col justify-center gap-11 p-8 sm:p-14">
            <div className="text-[12px] font-bold uppercase tracking-wider text-indigo-400">Comment ça marche — 2 façons d&apos;ajouter une référence</div>

            <div className="flex items-start gap-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[15px] font-bold text-white" style={{ background: BRAND }}>1</span>
              <div>
                <div className="text-[18px] font-bold text-[var(--app-text)]">Ta propre vidéo</div>
                <p className="mt-3 max-w-2xl text-[15px] leading-loose text-[var(--app-text-muted)]">
                  Ajoute une vidéo <b className="text-[var(--app-text)]">à toi</b>, déjà montée et prête. L&apos;IA l&apos;analyse (hook, rythme, structure).
                  À l&apos;étape suivante, tu ajoutes <b className="text-[var(--app-text)]">les mêmes fichiers</b> qui ont servi à la créer → l&apos;IA génère des <b className="text-[var(--app-text)]">variantes de ta vidéo</b>.
                </p>
              </div>
            </div>

            <div className="h-px bg-[var(--app-border)]" />

            <div className="flex items-start gap-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[15px] font-bold text-white" style={{ background: "linear-gradient(135deg,#38BDF8,#6366F1)" }}>2</span>
              <div>
                <div className="text-[18px] font-bold text-[var(--app-text)]">Une vidéo de concurrent</div>
                <p className="mt-3 max-w-2xl text-[15px] leading-loose text-[var(--app-text-muted)]">
                  Ajoute la vidéo d&apos;un <b className="text-[var(--app-text)]">concurrent</b> qui a cartonné. L&apos;IA analyse sa <b className="text-[var(--app-text)]">structure</b> (pas son contenu).
                  À l&apos;étape suivante, tu ajoutes <b className="text-[var(--app-text)]">tes propres fichiers</b> → l&apos;IA reproduit ce qui marche avec <b className="text-[var(--app-text)]">ta matière</b>, en plusieurs variantes.
                </p>
              </div>
            </div>

            <p className="text-[13px] text-[var(--app-text-faint)]">Dans les deux cas, c&apos;est le même geste : une réf + tes fichiers → des variantes.</p>
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
            Ajoute <b className="text-[var(--app-text)]">ta matière première</b> : tes rushes, images, plans produit… <b className="text-[var(--app-text)]">Glisse-dépose</b> tes fichiers ici (ou clique). Pour chacun, écris une{" "}
            <b className="text-[var(--app-text)]">description</b> — c&apos;est le contexte que l&apos;IA utilisera pour bien placer chaque élément.
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
                      {m.err ? <span className="text-amber-400">{m.err}</span> : m.uploading ? "Upload & analyse…" : m.serverId ? "✓ enregistré" : m.kind === "image" ? "Image" : m.kind === "audio" ? "Audio" : "Vidéo"}
                    </div>
                    <button onClick={() => removeMat(m.id)} className="mt-1 text-[11px] text-[var(--app-text-faint)] underline hover:text-red-400/80">Retirer</button>
                  </div>
                </div>
                <textarea
                  value={m.desc}
                  onChange={(e) => setDesc(m.id, e.target.value)}
                  onBlur={() => saveDesc(m)}
                  placeholder="Décris ce fichier pour l'IA…"
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
                <div className="font-medium">{matDragOver ? "Dépose tes fichiers ici" : "+ Ajouter un fichier"}</div>
                <div className="mt-1 text-[11px] text-[var(--app-text-faint)]">glisser-déposer ou cliquer</div>
              </div>
            </button>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <GhostBtn onClick={() => setStep("ref")}>← Retour</GhostBtn>
            <PrimaryBtn onClick={goEditor} disabled={materials.length === 0}>Ouvrir l&apos;éditeur →</PrimaryBtn>
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
                Piloté par ton Claude
              </div>
              <div className="mt-0.5 pl-[30px] text-[11.5px] text-[var(--app-text-faint)]">référence + matière prêtes</div>
            </div>
            <div className="shrink-0 border-b border-[var(--app-border)] px-4 py-4">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--app-text-faint)]">Référence reçue</div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => void reanalyzeRef()}
                    disabled={analyzing || reanalyzing}
                    title="Régénère le profil de la référence (sans ré-upload) — utile pour appliquer les dernières améliorations d'analyse (ex. lecture des captions)"
                    className={`rounded-md border border-[var(--app-border-strong)] px-2 py-0.5 text-[11px] font-semibold transition ${reanalyzing ? "cursor-wait text-[var(--app-text-faint)]" : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"}`}
                  >
                    {reanalyzing ? "⏳ ré-analyse…" : "↻ Réanalyser"}
                  </button>
                  <button
                    onClick={() => refChangeInput.current?.click()}
                    disabled={analyzing || reanalyzing}
                    title="Remplacer la vidéo de référence (ta matière est conservée)"
                    className={`rounded-md border border-[var(--app-border-strong)] px-2 py-0.5 text-[11px] font-semibold transition ${analyzing ? "cursor-wait text-[var(--app-text-faint)]" : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"}`}
                  >
                    {analyzing ? "⏳ analyse…" : "Changer"}
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
                  <div className="truncate text-[13px] font-semibold text-[var(--app-text)]">{refSource?.label ?? "référence"}</div>
                  <div className="mt-0.5 text-[11.5px] text-[var(--app-text-faint)]">
                    {analysis ? `✓ ${analysis.keyframes.length} images · ${analysis.pacing.cutCount} coupes${analysis.transcript ? " · transcrit" : ""}` : "structure analysée"}
                  </div>
                </div>
              </div>
              {analysis?.hookText && (
                <div className="mt-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-2)] px-2.5 py-2 text-[11.5px] text-[var(--app-text-muted)]">
                  🎙 <span className="text-[var(--app-text-faint)]">Hook :</span> « {analysis.hookText.slice(0, 90)} »
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--app-text-faint)]">Ta matière · {materials.length} fichier{materials.length > 1 ? "s" : ""}</div>
                <button
                  onClick={() => matInput.current?.click()}
                  title="Ajouter de la matière"
                  className="rounded-md border border-[var(--app-border-strong)] px-2 py-0.5 text-[11px] font-semibold text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"
                >
                  + Ajouter
                </button>
              </div>
              {materials.map((m) => (
                <div key={m.id} className="group flex items-center gap-2.5 py-1.5 text-[12.5px] text-[var(--app-text-muted)]">
                  <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-md text-[12px]" style={{ background: "var(--app-surface-2)" }}>{m.kind === "image" ? "🖼️" : m.kind === "audio" ? "🎵" : "🎬"}</span>
                  <span className="flex-1 truncate">{m.name}</span>
                  <button onClick={() => removeMat(m.id)} title="Retirer" className="shrink-0 text-[var(--app-text-faint)] opacity-0 transition hover:text-red-400/80 group-hover:opacity-100">✕</button>
                </div>
              ))}
              {materials.length === 0 && (
                <p className="py-1 text-[12px] text-[var(--app-text-faint)]">Aucun fichier — ajoute de la matière à reproduire.</p>
              )}
            </div>
            <div className="mx-3.5 mb-4 mt-auto flex shrink-0 items-start gap-2.5 rounded-xl border p-3 text-[12.5px] text-[var(--app-text)]"
                 style={{ background: "rgba(217,119,87,.09)", borderColor: "rgba(217,119,87,.3)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/claude-color.svg" alt="" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Demande à <b>ton Claude</b> de reproduire ta référence — les variantes apparaissent ici <b>en direct</b>.</span>
            </div>
          </aside>

          {/* Workspace résultats */}
          <div className="flex min-h-0 flex-col bg-[var(--app-bg-2)]">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--app-border)] px-6 py-4">
              <div>
                <div className="text-[15px] font-bold text-[var(--app-text)]">Variantes {variants.length > 0 && <span className="text-[var(--app-text-faint)]">· {variants.length}</span>}</div>
                <div className="text-[12.5px] text-[var(--app-text-faint)]">Créées par ton Claude · apparaissent ici en direct</div>
              </div>
              <button onClick={() => void refreshProject()} title="Recharge la liste depuis le serveur. (La liste se met déjà à jour toute seule tant que cet onglet est ouvert ; ce bouton force un rafraîchissement immédiat.)" className="shrink-0 rounded-lg border border-[var(--app-border-strong)] px-3 py-2.5 text-[13px] font-medium text-[var(--app-text)] transition hover:bg-[var(--app-surface-2)]">↻ Rafraîchir</button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            {variants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface)] p-10 text-center">
                <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/claude-color.svg" alt="Claude" className="h-8 w-8" />
                </span>
                <div className="text-[15px] font-bold text-[var(--app-text)]">Passe la main à ton Claude</div>
                <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[var(--app-text-muted)]">
                  Dans <b className="text-[var(--app-text)]">ton Claude</b>, demande-lui de reproduire ta référence avec ta matière.
                  Les variantes qu&apos;il crée s&apos;affichent ici <b>automatiquement</b>.
                </p>
                <button onClick={() => setStep("connect")} className="mt-4 text-[12px] text-[var(--app-text-faint)] underline hover:text-[var(--app-text-muted)]">
                  Pas encore connecté ? → Voir la connexion
                </button>
              </div>
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))" }}>
                {variants.map((v, i) => (
                  <div key={v.id} className="group overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] transition hover:border-indigo-400/50 hover:shadow-lg">
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
                      <span className="truncate text-[12.5px] font-semibold text-[var(--app-text)]">{v.label || `Variante ${i + 1}`}</span>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <a href={variantUrl(v.id, true)} className="text-[12px] text-indigo-400 hover:text-indigo-300" title="Télécharger">⬇</a>
                        <button onClick={() => removeVariant(v.id)} className="text-[12px] text-[var(--app-text-faint)] transition hover:text-red-400" title="Supprimer">🗑</button>
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
                  Créées par <b className="text-[var(--app-text-muted)]">ton Claude</b>. Clique une variante pour la regarder ou la télécharger.
                </p>
                <p>⏳ Les variantes sont temporaires — <b className="text-[var(--app-text-muted)]">télécharge</b> celles à garder ; les autres sont supprimées automatiquement.</p>
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
              <div className="truncate text-[14.5px] font-bold text-[var(--app-text)]">{drawer.label || "Variante"}</div>
              <button onClick={() => setDrawer({ open: false })} className="text-xl leading-none text-[var(--app-text-muted)] hover:text-[var(--app-text)]">✕</button>
            </div>
            <div className="flex flex-1 flex-col gap-4 overflow-auto px-4 py-4">
              {drawer.variantId && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={variantUrl(drawer.variantId)} controls playsInline className="mx-auto max-h-[420px] w-auto rounded-xl bg-black" style={{ aspectRatio: "9 / 16" }} />
              )}
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg-2)] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-faint)]">Édition manuelle <span className="ml-1 rounded-full border border-[var(--app-border-strong)] px-1.5 py-0.5 text-[9px] normal-case text-[var(--app-text-faint)]">Bientôt</span></div>
                <div className="grid grid-cols-2 gap-2 opacity-55">
                  {[["✍️", "Hook / texte"], ["💬", "Captions"], ["✂️", "Couper"], ["⏩", "Vitesse"], ["🔍", "Reframe"], ["🎞️", "Ordre des plans"]].map(([ic, l]) => (
                    <div key={l} className="flex items-center gap-2 rounded-lg border border-[var(--app-border)] px-2.5 py-2 text-[12px] text-[var(--app-text)]">
                      <span>{ic}</span>{l}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-[var(--app-text-faint)]">Pour l&apos;instant, ajuste en redemandant à ton Claude.</p>
              </div>
            </div>
            <div className="mt-auto flex gap-2.5 border-t border-[var(--app-border)] px-4 py-3.5">
              {drawer.variantId && (
                <button onClick={() => removeVariant(drawer.variantId!)} title="Supprimer cette variante" className="shrink-0 rounded-lg border border-red-500/40 px-3.5 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10">🗑</button>
              )}
              <button onClick={() => setDrawer({ open: false })} className="flex-1 rounded-lg border border-[var(--app-border-strong)] px-4 py-2.5 text-sm font-medium text-[var(--app-text)] hover:bg-[var(--app-surface-2)]">Fermer</button>
              {drawer.variantId && (
                <a href={variantUrl(drawer.variantId, true)} className="flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white hover:brightness-110" style={{ background: BRAND }}>⬇ Télécharger</a>
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
      {done ? "Copié ✓" : "Copier"}
    </button>
  );
}

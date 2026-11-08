"use client";

// Claude INTÉGRÉ de l'Éditeur IA : le user discute avec Claude directement dans
// DuupFlow, sans connecter son propre Claude. Le serveur (/api/ai-editor/chat)
// fait tourner Claude avec les outils du MCP ; ce panneau affiche la
// conversation en direct et prévient l'éditeur à chaque étape pour qu'il
// rafraîchisse variantes et matière.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { formatTokens } from "@/lib/tokens";

// images = adresses des vignettes jointes au message (messages du user seulement).
type Line = { role: "user" | "assistant"; text: string; images?: string[] } | { role: "action"; tool: string };
const imageUrl = (id: string) => `/api/ai-editor/chat/attachments/${id}`;

/** Image jointe en cours d'envoi : aperçu local + progression de l'upload. */
type Attachment = { key: string; preview: string; progress: number; id?: string; failed?: boolean };
const MAX_IMAGES = 6;

/** Réduit l'image avant l'envoi (1568 px max, JPEG) : ce que Claude lit au mieux,
 *  et moins de tokens d'entrée — donc un message moins cher pour le user. */
async function shrinkImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1568 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.85));
}

/** Upload avec progression (fetch ne la donne pas). */
function uploadImage(blob: Blob, onProgress: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/ai-editor/chat/attachments");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      try {
        const d = JSON.parse(xhr.responseText);
        if (xhr.status < 300 && d.id) resolve(d.id); else reject(new Error(d.error || "upload"));
      } catch { reject(new Error("upload")); }
    };
    xhr.onerror = () => reject(new Error("upload"));
    const fd = new FormData();
    fd.append("file", blob, "image.jpg");
    xhr.send(fd);
  });
}

// Dictée vocale du navigateur (Chrome, Edge, Safari). Absente → pas de bouton micro.
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
function speechCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
type Allowance = { includedCents: number; includedLeftCents: number; balanceCents: number; canSend: boolean };

/** Pastille « tokens dispo » (volume inclus + solde) — descend en direct à
 *  chaque appel à Claude : le serveur débite et renvoie le solde après chaque
 *  aller-retour, le chiffre défile jusqu'à la nouvelle valeur. */
function TokenPill({ allowance, label }: { allowance: Allowance; label: string }) {
  const target = allowance.includedLeftCents + allowance.balanceCents;
  const [shown, setShown] = useState(target);
  const [flash, setFlash] = useState(false);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    setFlash(target < start);
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 700);
      const v = start + (target - start) * (1 - Math.pow(1 - k, 3));
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
      else { from.current = target; setTimeout(() => setFlash(false), 400); }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return (
    <span
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold tabular-nums transition-colors ${flash ? "border-[var(--cc-accent)] text-[var(--cc-accent)]" : "border-[var(--cc-border)] text-[var(--cc-muted)]"}`}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
      </svg>
      {formatTokens(Math.max(0, Math.round(shown)))}
    </span>
  );
}

/** Le markdown que Claude écrit le plus : gras, `code`, titres, listes à puces et numérotées. */
function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <b key={i} className="font-semibold">{p.slice(2, -2)}</b>
    : p.startsWith("`") && p.endsWith("`") && p.length > 1 ? <code key={i} className="rounded px-1 py-0.5 font-mono text-[0.85em]" style={{ background: "var(--cc-hover)" }}>{p.slice(1, -1)}</code>
    : p,
  );
}

function Formatted({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(<Tag key={`l${blocks.length}`} className={`my-2 space-y-1.5 pl-6 ${list.ordered ? "list-decimal" : "list-disc"}`}>{list.items.map((li, i) => <li key={i} className="pl-1">{inline(li)}</li>)}</Tag>);
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-•*]\s+(.*)$/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || num) {
      const ordered = !!num;
      if (list && list.ordered !== ordered) flush();
      (list ??= { ordered, items: [] }).items.push((bullet ?? num)![1]);
      continue;
    }
    flush();
    const h = /^#{1,4}\s+(.*)$/.exec(line);
    if (h) blocks.push(<p key={`h${blocks.length}`} className="mb-1 mt-3 font-semibold">{inline(h[1])}</p>);
    else if (line.trim()) blocks.push(<p key={`p${blocks.length}`} className="my-2 first:mt-0">{inline(line)}</p>);
  }
  flush();
  return <>{blocks}</>;
}

/** L'étoile Claude (terracotta) — tourne pendant que Claude travaille, comme sur claude.ai. */
function Spark({ busy, size = 20 }: { busy?: boolean; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/claude-color.svg" alt="" width={size} height={size} className={busy ? "cc-spark-busy" : undefined} />;
}

export default function BuiltinChat({ onActivity, visible = true }: { onActivity: () => void; visible?: boolean }) {
  const { t, locale } = useTranslation();
  const [lines, setLines] = useState<Line[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(""); // texte de Claude en train de s'écrire
  const [error, setError] = useState<{ text: string; tokens?: boolean; plan?: boolean } | null>(null);
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [long, setLong] = useState(false); // conversation longue → suggérer d'en ouvrir une nouvelle
  const [stopping, setStopping] = useState(false); // « Arrêter » cliqué, le serveur boucle le tour
  const [stopped, setStopped] = useState<{ cancelled: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Erreurs du serveur : un code → texte traduit ; sinon le message reçu.
  const errText = (d: { code?: string; error?: string }) => {
    if (d.code) { const k = `dashboard.aiEditor.chat.err.${d.code}`; const s = t(k); if (s !== k) return s; }
    return d.error ?? t("dashboard.aiEditor.chat.error");
  };
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activity = useRef(onActivity);
  activity.current = onActivity;

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/ai-editor/chat", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) { setLines([]); setError({ text: errText(d), plan: d.code === "PLAN" }); return false; }
      setLines(((d.lines ?? []) as Line[]).map((l) => ("images" in l && l.images ? { ...l, images: l.images.map(imageUrl) } : l)));
      if (d.allowance) setAllowance(d.allowance);
      setLong(!!d.long);
      return !!d.running;
    } catch {
      setLines((l) => l ?? []);
      return false;
    }
  }, [t]);

  // Au chargement : la conversation du projet. Si un tour tourne encore côté
  // serveur (onglet rouvert), on la relit jusqu'à ce qu'il soit fini.
  useEffect(() => {
    let stop = false;
    void (async () => {
      let running = await load();
      if (running) setBusy(true);
      while (running && !stop) {
        await new Promise((r) => setTimeout(r, 3000));
        running = await load();
        activity.current();
      }
      if (!stop) { setBusy(false); setStopping(false); }
    })();
    return () => { stop = true; };
  }, [load]);

  // Toujours voir le bas de la conversation (dernier message, erreur comprise).
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [lines, live, error]);

  // Bulle d'aide + cloche masquées tant que ce chat est affiché (cf. globals.css).
  // (sur mobile, seulement quand l'onglet « Claude » est affiché)
  useEffect(() => {
    if (!visible) return;
    document.documentElement.classList.add("duup-hide-floating");
    return () => document.documentElement.classList.remove("duup-hide-floating");
  }, [visible]);

  // La zone de saisie grandit avec le texte (comme sur claude.ai).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }, [draft]);

  /* ── Images jointes ── */
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploading = attachments.some((a) => !a.id && !a.failed);

  function addImages(files: FileList | File[] | null) {
    const imgs = Array.from(files ?? []).filter((f) => /^image\/(png|jpe?g|webp)$/.test(f.type));
    if (!imgs.length) return;
    const room = MAX_IMAGES - attachments.length;
    if (room <= 0) { setError({ text: t("dashboard.aiEditor.chat.tooManyImages", { n: MAX_IMAGES }) }); return; }
    for (const f of imgs.slice(0, room)) {
      const key = Math.random().toString(36).slice(2);
      setAttachments((a) => [...a, { key, preview: URL.createObjectURL(f), progress: 0 }]);
      const patch = (p: Partial<Attachment>) => setAttachments((a) => a.map((x) => (x.key === key ? { ...x, ...p } : x)));
      void shrinkImage(f)
        .then((blob) => uploadImage(blob, (progress) => patch({ progress })))
        .then((id) => patch({ id, progress: 100 }))
        .catch(() => patch({ failed: true }));
    }
  }
  const removeAttachment = (key: string) => setAttachments((a) => {
    const gone = a.find((x) => x.key === key);
    if (gone) URL.revokeObjectURL(gone.preview);
    return a.filter((x) => x.key !== key);
  });

  /* ── Dictée vocale ── */
  const [listening, setListening] = useState(false);
  const [canDictate, setCanDictate] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const baseRef = useRef("");
  useEffect(() => { setCanDictate(!!speechCtor()); }, []);
  useEffect(() => () => recRef.current?.stop(), []);
  function toggleDictation() {
    if (listening) { recRef.current?.stop(); return; }
    const Ctor = speechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = locale === "en" ? "en-US" : "fr-FR";
    rec.continuous = true;
    rec.interimResults = true;
    baseRef.current = draft ? `${draft.trimEnd()} ` : "";
    rec.onresult = (e) => {
      let finalTxt = "", interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalTxt += r[0].transcript; else interim += r[0].transcript;
      }
      if (finalTxt) baseRef.current += finalTxt.trim() + " ";
      setDraft(baseRef.current + interim);
    };
    rec.onend = () => { setListening(false); recRef.current = null; setDraft((d) => d.trimEnd()); };
    rec.onerror = () => { setListening(false); recRef.current = null; };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  async function send() {
    const text = draft.trim();
    const ready = attachments.filter((a) => a.id);
    if ((!text && !ready.length) || busy || uploading) return;
    recRef.current?.stop();
    setDraft("");
    setAttachments([]);
    setError(null);
    setStopped(null);
    setBusy(true);
    setLines((l) => [...(l ?? []), { role: "user", text, images: ready.length ? ready.map((a) => a.preview) : undefined }]);
    let pending = "";
    const commit = () => {
      if (!pending.trim()) return;
      const txt = pending;
      setLines((l) => [...(l ?? []), { role: "assistant", text: txt }]);
      pending = "";
      setLive("");
    };
    try {
      const res = await fetch("/api/ai-editor/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, images: ready.map((a) => a.id) }) });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        setError({ text: errText(d), tokens: d.code === "TOKENS", plan: d.code === "PLAN" });
        if (d.allowance) setAllowance(d.allowance);
        // Message refusé (pas envoyé à Claude) : on le retire de la conversation
        // et on le rend à la zone de saisie, pour le renvoyer après recharge.
        setLines((l) => (l ?? []).slice(0, -1));
        setDraft(text);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const raw = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (!raw.startsWith("data: ")) continue;
          const e = JSON.parse(raw.slice(6)) as { type: string; text?: string; tool?: string; error?: string; code?: string; long?: boolean; cancelled?: number; allowance?: Allowance | null };
          if (e.type === "text" && e.text) { pending += e.text; setLive(pending); }
          else if (e.type === "action" && e.tool) { commit(); setLines((l) => [...(l ?? []), { role: "action", tool: e.tool! }]); }
          else if (e.type === "round") activity.current();
          else if (e.type === "error") setError({ text: errText(e), tokens: e.code === "TOKENS" || e.code === "TOKENS_MIDWAY" });
          else if (e.type === "context") setLong(!!e.long);
          else if (e.type === "stopped") setStopped({ cancelled: e.cancelled ?? 0 });
          else if ((e.type === "done" || e.type === "allowance") && e.allowance) setAllowance(e.allowance);
        }
      }
      commit();
    } catch {
      // Connexion coupée : le tour continue côté serveur, on relit la conversation.
      await load();
    } finally {
      setLive("");
      setBusy(false);
      setStopping(false);
      activity.current();
    }
  }

  // Arrête Claude en plein travail : sa réponse est coupée, les étapes
  // suivantes ne partent pas et les variantes lancées pendant ce tour sont
  // annulées. Le flux (ou la relecture) se termine tout seul ensuite.
  async function stop() {
    if (!busy || stopping) return;
    setStopping(true);
    const r = await fetch("/api/ai-editor/chat/stop", { method: "POST" }).catch(() => null);
    if (!r?.ok) setStopping(false);
  }

  async function reset() {
    if (busy) return;
    const r = await fetch("/api/ai-editor/chat", { method: "DELETE" }).catch(() => null);
    if (r?.ok) { setLines([]); setError(null); setLong(false); }
  }

  const toolLabel = (tool: string) => {
    const k = `dashboard.aiEditor.chat.tool.${tool}`;
    const s = t(k);
    return s === k ? t("dashboard.aiEditor.chat.tool.other") : s;
  };

  // Les actions consécutives sont regroupées dans un seul encart, comme les
  // appels d'outils sur claude.ai.
  type Group = { kind: "user" | "assistant"; text: string; images?: string[] } | { kind: "actions"; tools: string[] };
  const groups: Group[] = [];
  for (const l of lines ?? []) {
    const last = groups[groups.length - 1];
    if (l.role === "action") {
      if (last?.kind === "actions") last.tools.push(l.tool);
      else groups.push({ kind: "actions", tools: [l.tool] });
    } else groups.push({ kind: l.role, text: l.text, images: l.images });
  }
  const lastIsActions = groups[groups.length - 1]?.kind === "actions";

  return (
    <aside data-tour-id="ai-chat" className="claude-chat flex min-h-0 flex-col border-l border-[var(--cc-border)]">
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Spark size={18} />
          <span className="truncate text-[14px] font-semibold">{t("dashboard.aiEditor.chat.title")}</span>
        </div>
        {!!lines?.length && (
          <button
            onClick={reset}
            disabled={busy}
            title={t("dashboard.aiEditor.chat.new")}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] text-[var(--cc-muted)] transition hover:bg-[var(--cc-hover)] hover:text-[var(--cc-text)] disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            {t("dashboard.aiEditor.chat.new")}
          </button>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2">
        {lines === null ? (
          <div className="space-y-3 pt-4">{[0, 1].map((i) => <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: "var(--cc-hover)" }} />)}</div>
        ) : lines.length === 0 && !busy ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 pb-6 text-center">
            <Spark size={34} />
            <p className="cc-serif text-[26px] leading-tight text-[var(--cc-text)]">{t("dashboard.aiEditor.chat.emptyTitle")}</p>
            <p className="max-w-[300px] text-[13px] leading-relaxed text-[var(--cc-faint)]">{t("dashboard.aiEditor.chat.emptyLead")}</p>
            <div className="flex w-full flex-col gap-2">
              {(["ex1", "ex2", "ex3"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setDraft(t(`dashboard.aiEditor.chat.${k}`))}
                  className="rounded-xl border border-[var(--cc-border)] px-3.5 py-2.5 text-left text-[13px] text-[var(--cc-muted)] transition hover:bg-[var(--cc-hover)] hover:text-[var(--cc-text)]"
                >
                  {t(`dashboard.aiEditor.chat.${k}`)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((g, i) =>
              g.kind === "user" ? (
                <div key={i} className="flex flex-col items-end gap-1.5">
                  {!!g.images?.length && (
                    <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
                      {g.images.map((src, j) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <a key={j} href={src} target="_blank" rel="noreferrer"><img src={src} alt="" className="h-20 w-20 rounded-xl border border-[var(--cc-border)] object-cover" /></a>
                      ))}
                    </div>
                  )}
                  {g.text && <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed" style={{ background: "var(--cc-user)" }}>{g.text}</div>}
                </div>
              ) : g.kind === "actions" ? (
                <div key={i} className="rounded-xl border border-[var(--cc-border)] px-3.5 py-2.5">
                  {g.tools.map((tool, j) => {
                    const running = busy && !live && lastIsActions && i === groups.length - 1 && j === g.tools.length - 1;
                    return (
                      <div key={j} className="flex items-center gap-2.5 py-1 text-[12.5px] text-[var(--cc-muted)]">
                        {running ? (
                          <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[var(--cc-border)] border-t-[var(--cc-accent)] animate-spin" />
                        ) : (
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[var(--cc-faint)]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        )}
                        <span className="truncate">{toolLabel(tool)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div key={i} className="cc-serif text-[15px] leading-[1.65] text-[var(--cc-text)]"><Formatted text={g.text} /></div>
              ),
            )}
            {live && <div className="cc-serif text-[15px] leading-[1.65] text-[var(--cc-text)]"><Formatted text={live} /></div>}
            {busy && !live && !lastIsActions && (
              <div className="flex items-center gap-2 text-[12.5px] text-[var(--cc-faint)]" aria-live="polite">
                <Spark busy size={18} />{t(stopping ? "dashboard.aiEditor.chat.stopping" : "dashboard.aiEditor.chat.thinking")}
              </div>
            )}
            {stopped && !busy && (
              <div className="flex items-center gap-2 text-[12.5px] text-[var(--cc-faint)]" aria-live="polite">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                {stopped.cancelled > 0 ? t("dashboard.aiEditor.chat.stoppedRenders", { n: stopped.cancelled }) : t("dashboard.aiEditor.chat.stopped")}
              </div>
            )}
            {!busy && groups.length > 0 && groups[groups.length - 1].kind === "assistant" && <Spark size={22} />}
          </div>
        )}
        {error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-500">
            {error.text}
            {(error.tokens || error.plan) && <> <Link href="/dashboard/abonnement" className="font-semibold underline">{error.plan ? t("dashboard.aiEditor.chat.seePlans") : t("dashboard.aiEditor.chat.buyTokens")}</Link></>}
          </p>
        )}
      </div>

      <div className="shrink-0 px-4 pb-3 pt-1">
        {long && !busy && (
          <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-[var(--cc-border)] px-3 py-2 text-[12px] leading-snug text-[var(--cc-muted)]" style={{ background: "var(--cc-hover)" }}>
            <span className="flex-1">{t("dashboard.aiEditor.chat.longHint")}</span>
            <button type="button" onClick={reset} className="shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-semibold text-white transition hover:brightness-110" style={{ background: "var(--cc-accent)" }}>
              {t("dashboard.aiEditor.chat.new")}
            </button>
          </div>
        )}
        <div
          onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragOver(true); } }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addImages(e.dataTransfer.files); }}
          className={`rounded-2xl border bg-[var(--cc-input)] px-3.5 pb-2.5 pt-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition focus-within:border-[var(--cc-faint)] ${dragOver ? "border-[var(--cc-accent)] ring-2 ring-[var(--cc-accent)]/30" : "border-[var(--cc-border)]"}`}
        >
          {/* Images jointes : vignettes + progression de l'envoi */}
          {!!attachments.length && (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <div key={a.key} className="group relative h-14 w-14 overflow-hidden rounded-xl border border-[var(--cc-border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.preview} alt="" className="h-full w-full object-cover" />
                  {(!a.id || a.failed) && (
                    <span className={`absolute inset-0 grid place-items-center text-[13px] font-bold text-white ${a.failed ? "bg-red-600/70" : "bg-black/45"}`}>
                      {a.failed ? "!" : `${a.progress}%`}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.key)}
                    aria-label={t("dashboard.aiEditor.chat.removeImage")}
                    className="absolute right-0.5 top-0.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                  >
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M2 2l6 6M8 2l-6 6" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); addImages(e.clipboardData.files); } }}
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder={t("dashboard.aiEditor.chat.placeholder")}
            rows={1}
            maxLength={4000}
            className="block max-h-48 min-h-[24px] w-full resize-none bg-transparent text-[14.5px] leading-6 text-[var(--cc-text)] outline-none placeholder:text-[var(--cc-faint)]"
          />
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => { addImages(e.target.files); e.target.value = ""; }} />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                title={t("dashboard.aiEditor.chat.addImage")}
                aria-label={t("dashboard.aiEditor.chat.addImage")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--cc-muted)] transition hover:bg-[var(--cc-hover)] hover:text-[var(--cc-text)]"
              >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
              {allowance && (
                <TokenPill
                  allowance={allowance}
                  label={t("dashboard.aiEditor.chat.tokensTitle", { included: formatTokens(allowance.includedLeftCents), balance: formatTokens(allowance.balanceCents) })}
                />
              )}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
            {canDictate && (
              <button
                type="button"
                onClick={toggleDictation}
                title={listening ? t("dashboard.aiEditor.chat.stopDictation") : t("dashboard.aiEditor.chat.dictate")}
                aria-label={listening ? t("dashboard.aiEditor.chat.stopDictation") : t("dashboard.aiEditor.chat.dictate")}
                aria-pressed={listening}
                className={`grid h-8 w-8 place-items-center rounded-lg transition ${listening ? "animate-pulse bg-red-500 text-white" : "text-[var(--cc-muted)] hover:bg-[var(--cc-hover)] hover:text-[var(--cc-text)]"}`}
              >
                <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
              </button>
            )}
            {busy ? (
            <button
              onClick={() => void stop()}
              disabled={stopping}
              title={t("dashboard.aiEditor.chat.stop")}
              aria-label={t("dashboard.aiEditor.chat.stop")}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--cc-text)] text-[var(--cc-input)] transition hover:opacity-85 disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2.5" /></svg>
            </button>
            ) : (
            <button
              onClick={() => void send()}
              disabled={busy || uploading || (!draft.trim() && !attachments.some((a) => a.id))}
              aria-label={t("dashboard.aiEditor.chat.send")}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white transition hover:brightness-110 disabled:opacity-40"
              style={{ background: "var(--cc-accent)" }}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
            </button>
            )}
            </span>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--cc-faint)]">{t("dashboard.aiEditor.chat.disclaimer")}</p>
      </div>
    </aside>
  );
}

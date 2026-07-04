"use client";

// Developer / API-keys screen. Pro-only key management; non-Pro users see an
// in-page upgrade gate. Fully bilingual via the dashboard.developers namespace.

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { createKeyAction, deleteKeyAction } from "./actions";
import DocsDrawer from "../components/DocsDrawer";
import { buildApiDocs } from "../components/docs-content";

// Local type (structurally matches lib/api-keys ApiKeyRow) so this client file
// never imports the service-role module — belt-and-suspenders, not a fix.
type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  last4: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function DevelopersClient({ isPro, initialKeys }: { isPro: boolean; initialKeys: ApiKeyRow[] }) {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("https://duupflow.com");
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    setError(null);
    setFreshKey(null);
    try {
      const { key } = await createKeyAction(name);
      setFreshKey(key);
      setName("");
      // Optimistic: prepend a display row (server revalidates the real list).
      setKeys((prev) => [
        {
          id: `tmp_${Date.now()}`,
          name: name.trim() || "API key",
          key_prefix: key.slice(0, 14),
          last4: key.slice(-4),
          created_at: new Date().toISOString(),
          last_used_at: null,
          revoked_at: null,
        },
        ...prev,
      ]);
    } catch (e: any) {
      setError(e?.message || t("dashboard.developers.errCreate"));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(keyId: string) {
    if (!confirm(t("dashboard.developers.confirmDelete"))) return;
    try {
      await deleteKeyAction(keyId);
      // Hard delete → the key is gone for good; remove it from the list entirely.
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch (e: any) {
      setError(e?.message || t("dashboard.developers.errDelete"));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t("dashboard.developers.title")}</h1>
          <p className="text-sm text-white/50 mt-1">
            {t("dashboard.developers.subtitle")}
          </p>
        </div>
        <DocsDrawer docs={buildApiDocs(t)} />
      </header>

      <div className="h-px bg-white/[0.06]" />

      {!isPro ? (
        <>
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] p-6">
          <h2 className="text-base font-bold text-white/90">{t("dashboard.developers.proOnlyTitle")}</h2>
          <p className="text-sm text-white/60 mt-1.5">
            {t("dashboard.developers.proOnlyDesc")}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href="/dashboard/abonnement?upgrade=1"
              className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-indigo-500 to-sky-500 text-white hover:shadow-[0_4px_20px_rgba(99,102,241,.35)] transition"
            >
              {t("dashboard.developers.proOnlyCta")}
            </a>
          </div>

          {/* Big "request a demo" CTA — let unsure users book a personalized demo
              before paying. */}
          <button
            type="button"
            onClick={() => setShowDemo(true)}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-4 text-base font-bold text-white transition hover:opacity-90"
            style={{ background: "rgba(56,189,248,0.10)", border: "1.5px solid rgba(56,189,248,0.35)" }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-sky-300" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
            {t("dashboard.developers.demoCta")}
          </button>
        </div>

        {/* Demo modal */}
        {showDemo && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
            onClick={() => setShowDemo(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl p-6 space-y-4"
              style={{ background: "#0b0e1a", border: "1px solid rgba(255,255,255,0.10)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg font-semibold text-white">{t("dashboard.developers.demoTitle")}</h2>
                <button
                  type="button"
                  onClick={() => setShowDemo(false)}
                  className="text-white/40 hover:text-white/80 transition shrink-0"
                  aria-label={t("dashboard.developers.demoClose")}
                >
                  <svg viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">{t("dashboard.developers.demoDesc")}</p>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <a
                  href="https://t.me/DuupFlow_Support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M21.9 4.3 2.8 11.6c-1 .4-1 1.4-.2 1.6l4.9 1.5 1.9 5.7c.2.6.4.7 1 .4l2.7-2 5 3.7c.5.3 1 .1 1.1-.5l3-14.5c.2-.9-.4-1.3-1.3-1.2z" />
                  </svg>
                  {t("dashboard.developers.demoTelegram")}
                </a>
                <button
                  type="button"
                  onClick={() => setShowDemo(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold bg-white/10 hover:bg-white/20 text-white/85 transition"
                >
                  {t("dashboard.developers.demoClose")}
                </button>
              </div>
            </div>
          </div>
        )}
        </>
      ) : (
        <>
          {/* Create */}
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
            <h2 className="text-sm font-semibold text-white/90">{t("dashboard.developers.createTitle")}</h2>
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("dashboard.developers.namePlaceholder")}
                maxLength={60}
                className="flex-1 min-w-[220px] rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/90 placeholder:text-white/30"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-indigo-500 to-sky-500 text-white hover:shadow-[0_4px_20px_rgba(99,102,241,.35)] transition disabled:opacity-50"
              >
                {creating ? t("dashboard.developers.creating") : t("dashboard.developers.createBtn")}
              </button>
            </div>

            {/* One-time reveal */}
            {freshKey && (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3 space-y-2">
                <p className="text-xs text-emerald-300 font-semibold">
                  {t("dashboard.developers.revealWarn")}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-black/40 px-3 py-2 text-xs text-white/90 font-mono break-all">{freshKey}</code>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(freshKey); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition"
                  >
                    {copied ? t("dashboard.developers.copied") : t("dashboard.developers.copy")}
                  </button>
                </div>
              </div>
            )}

            {error && <div className="text-sm rounded-lg px-4 py-2 bg-red-900/40 text-red-300">{error}</div>}
          </section>

          {/* Keys list */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-white/80">{t("dashboard.developers.keysTitle")}</h2>
            {keys.length === 0 ? (
              <p className="text-sm text-white/40">{t("dashboard.developers.noKeys")}</p>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5">
                {keys.map((k) => (
                  <div key={k.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/85 truncate">{k.name}</p>
                      <p className="text-xs text-white/40 font-mono">{k.key_prefix}…{k.last4}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-white/40">{t("dashboard.developers.createdOn", { date: fmtDate(k.created_at) })}</p>
                      <p className="text-[11px] text-white/30">
                        {k.last_used_at ? t("dashboard.developers.usedOn", { date: fmtDate(k.last_used_at) }) : t("dashboard.developers.neverUsed")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(k.id)}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 transition"
                    >
                      {t("dashboard.developers.deleteBtn")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Quick test */}
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
            <h2 className="text-sm font-semibold text-white/90">{t("dashboard.developers.testTitle")}</h2>
            <p className="text-xs text-white/50">{t("dashboard.developers.testDesc")} <code className="text-white/70">/api/v1/me</code></p>
            <code className="block rounded-lg bg-black/40 px-3 py-2 text-xs text-white/90 font-mono break-all">
              curl -H &quot;Authorization: Bearer dflw_live_…&quot; {origin}/api/v1/me
            </code>
          </section>

          {/* API reference */}
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-white/90">{t("dashboard.developers.docsTitle")}</h2>
              <p className="text-xs text-white/50 mt-1">
                {t("dashboard.developers.docsBaseLabel")} <code className="text-white/70">{origin}/api/v1</code> ·{" "}
                {t("dashboard.developers.docsAuthLabel")}{" "}
                <code className="text-white/70">Authorization: Bearer dflw_live_…</code> · {t("dashboard.developers.docsLimit")}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/40 text-left">
                    <th className="py-1.5 pr-3 font-medium">{t("dashboard.developers.thMethod")}</th>
                    <th className="py-1.5 pr-3 font-medium">{t("dashboard.developers.thEndpoint")}</th>
                    <th className="py-1.5 font-medium">{t("dashboard.developers.thDesc")}</th>
                  </tr>
                </thead>
                <tbody className="text-white/70 divide-y divide-white/5">
                  {[
                    ["GET", "/me", t("dashboard.developers.descMe")],
                    ["POST", "/images/duplicate", t("dashboard.developers.descImages")],
                    ["POST", "/compress", t("dashboard.developers.descCompress")],
                    ["POST", "/ai-detection", t("dashboard.developers.descAiDetection")],
                    ["POST", "/videos/duplicate", t("dashboard.developers.descVideos")],
                    ["GET", "/jobs/:id", t("dashboard.developers.descJobs")],
                  ].map(([m, p, d]) => (
                    <tr key={p}>
                      <td className="py-1.5 pr-3 font-mono text-emerald-300/80">{m}</td>
                      <td className="py-1.5 pr-3 font-mono text-white/85">{p}</td>
                      <td className="py-1.5 text-white/55">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-white/70">{t("dashboard.developers.exImagesTitle")}</p>
              <code className="block rounded-lg bg-black/40 px-3 py-2 text-[11px] text-white/90 font-mono break-all whitespace-pre-wrap">
{`curl -X POST ${origin}/api/v1/images/duplicate \\
  -H "Authorization: Bearer dflw_live_…" \\
  -F "file=@photo.jpg" -F "count=3" -o copies.zip`}
              </code>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-white/70">{t("dashboard.developers.exCompressTitle")}</p>
              <code className="block rounded-lg bg-black/40 px-3 py-2 text-[11px] text-white/90 font-mono break-all whitespace-pre-wrap">
{`curl -X POST ${origin}/api/v1/compress \\
  -H "Authorization: Bearer dflw_live_…" \\
  -F "file=@photo.jpg" -F "level=strong" -o compressed.jpg`}
              </code>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-white/70">{t("dashboard.developers.exVideoTitle")}</p>
              <p className="text-[11px] text-white/45">{t("dashboard.developers.exVideoSteps")}</p>
              <code className="block rounded-lg bg-black/40 px-3 py-2 text-[11px] text-white/90 font-mono break-all whitespace-pre-wrap">
{`# 1) start
curl -X POST ${origin}/api/v1/videos/duplicate \\
  -H "Authorization: Bearer dflw_live_…" \\
  -F "file=@clip.mp4" -F "count=3"
# → { "job_id": "…", "status": "queued" }

# 2) poll
curl -H "Authorization: Bearer dflw_live_…" \\
  ${origin}/api/v1/jobs/JOB_ID
# → { "status": "completed", "result": { "files": [{ "url": "…" }] } }`}
              </code>
            </div>

            <p className="text-[11px] text-white/40">
              {t("dashboard.developers.paramsNote")}
            </p>
          </section>
        </>
      )}
    </div>
  );
}

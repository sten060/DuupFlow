"use client";

// Developer / API-keys screen. FR strings are inline for now (i18n namespace to
// be added later). Pro-only: non-Pro users see an upgrade prompt.

import { useEffect, useState } from "react";
import { createKeyAction, revokeKeyAction } from "./actions";

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
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("https://duupflow.com");

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
      setError(e?.message || "Erreur lors de la création de la clé.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    if (!confirm("Révoquer cette clé ? Les intégrations qui l'utilisent cesseront de fonctionner immédiatement.")) return;
    try {
      await revokeKeyAction(keyId);
      setKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, revoked_at: new Date().toISOString() } : k)));
    } catch (e: any) {
      setError(e?.message || "Erreur lors de la révocation.");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">API DuupFlow — Développeurs</h1>
        <p className="text-sm text-white/50 mt-1">
          Gère tes clés API pour automatiser DuupFlow (Make, n8n, scripts…). Une clé débloque tous les endpoints.
        </p>
      </header>

      <div className="h-px bg-white/[0.06]" />

      {!isPro ? (
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] p-6">
          <h2 className="text-base font-bold text-white/90">Réservé au plan Pro</h2>
          <p className="text-sm text-white/60 mt-1.5">
            L'API DuupFlow est incluse dans le plan Pro. Passe au Pro pour générer une clé et automatiser tes duplications.
          </p>
          <a
            href="/dashboard/abonnement"
            className="mt-4 inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-indigo-500 to-sky-500 text-white hover:shadow-[0_4px_20px_rgba(99,102,241,.35)] transition"
          >
            Passer au plan Pro
          </a>
        </div>
      ) : (
        <>
          {/* Create */}
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
            <h2 className="text-sm font-semibold text-white/90">Créer une clé</h2>
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom (ex. Make, script perso…)"
                maxLength={60}
                className="flex-1 min-w-[220px] rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/90 placeholder:text-white/30"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-indigo-500 to-sky-500 text-white hover:shadow-[0_4px_20px_rgba(99,102,241,.35)] transition disabled:opacity-50"
              >
                {creating ? "Création…" : "Générer une clé"}
              </button>
            </div>

            {/* One-time reveal */}
            {freshKey && (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3 space-y-2">
                <p className="text-xs text-emerald-300 font-semibold">
                  Copie ta clé maintenant — elle ne sera plus jamais affichée.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-black/40 px-3 py-2 text-xs text-white/90 font-mono break-all">{freshKey}</code>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(freshKey); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition"
                  >
                    {copied ? "Copié ✔" : "Copier"}
                  </button>
                </div>
              </div>
            )}

            {error && <div className="text-sm rounded-lg px-4 py-2 bg-red-900/40 text-red-300">{error}</div>}
          </section>

          {/* Keys list */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-white/80">Tes clés</h2>
            {keys.length === 0 ? (
              <p className="text-sm text-white/40">Aucune clé pour le moment.</p>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5">
                {keys.map((k) => (
                  <div key={k.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/85 truncate">{k.name}</p>
                      <p className="text-xs text-white/40 font-mono">{k.key_prefix}…{k.last4}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-white/40">Créée {fmtDate(k.created_at)}</p>
                      <p className="text-[11px] text-white/30">
                        {k.last_used_at ? `Utilisée ${fmtDate(k.last_used_at)}` : "Jamais utilisée"}
                      </p>
                    </div>
                    {k.revoked_at ? (
                      <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded bg-white/10 text-white/40 border border-white/15">Révoquée</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRevoke(k.id)}
                        className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 transition"
                      >
                        Révoquer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Quick test */}
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
            <h2 className="text-sm font-semibold text-white/90">Tester ta clé</h2>
            <p className="text-xs text-white/50">Vérifie que ta clé fonctionne avec l'endpoint <code className="text-white/70">/api/v1/me</code> :</p>
            <code className="block rounded-lg bg-black/40 px-3 py-2 text-xs text-white/90 font-mono break-all">
              curl -H &quot;Authorization: Bearer dflw_live_…&quot; {origin}/api/v1/me
            </code>
          </section>

          {/* API reference */}
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-white/90">Documentation de l'API</h2>
              <p className="text-xs text-white/50 mt-1">
                Base : <code className="text-white/70">{origin}/api/v1</code> · Auth : en-tête{" "}
                <code className="text-white/70">Authorization: Bearer dflw_live_…</code> · Limite : <b>60 requêtes/min</b> par clé.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/40 text-left">
                    <th className="py-1.5 pr-3 font-medium">Méthode</th>
                    <th className="py-1.5 pr-3 font-medium">Endpoint</th>
                    <th className="py-1.5 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="text-white/70 divide-y divide-white/5">
                  {[
                    ["GET", "/me", "Infos du compte (test de clé)"],
                    ["POST", "/images/duplicate", "Dupliquer une image (1 → image, N → zip)"],
                    ["POST", "/compress", "Compresser une image"],
                    ["POST", "/ai-detection", "Masquer la signature IA d'une image"],
                    ["POST", "/videos/duplicate", "Dupliquer une vidéo (asynchrone → job)"],
                    ["GET", "/jobs/:id", "Suivre un job async + récupérer les résultats"],
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
              <p className="text-xs font-semibold text-white/70">Dupliquer une image (3 copies)</p>
              <code className="block rounded-lg bg-black/40 px-3 py-2 text-[11px] text-white/90 font-mono break-all whitespace-pre-wrap">
{`curl -X POST ${origin}/api/v1/images/duplicate \\
  -H "Authorization: Bearer dflw_live_…" \\
  -F "file=@photo.jpg" -F "count=3" -o copies.zip`}
              </code>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-white/70">Compresser une image</p>
              <code className="block rounded-lg bg-black/40 px-3 py-2 text-[11px] text-white/90 font-mono break-all whitespace-pre-wrap">
{`curl -X POST ${origin}/api/v1/compress \\
  -H "Authorization: Bearer dflw_live_…" \\
  -F "file=@photo.jpg" -F "level=strong" -o compressed.jpg`}
              </code>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-white/70">Dupliquer une vidéo (async → polling)</p>
              <p className="text-[11px] text-white/45">1. Lancer le job → renvoie un <code className="text-white/70">job_id</code>. 2. Poller <code className="text-white/70">/jobs/:id</code> jusqu'à <code className="text-white/70">status: "completed"</code> → URLs de téléchargement (valables 16h).</p>
              <code className="block rounded-lg bg-black/40 px-3 py-2 text-[11px] text-white/90 font-mono break-all whitespace-pre-wrap">
{`# 1) lancer
curl -X POST ${origin}/api/v1/videos/duplicate \\
  -H "Authorization: Bearer dflw_live_…" \\
  -F "file=@clip.mp4" -F "count=3"
# → { "job_id": "…", "status": "queued" }

# 2) suivre
curl -H "Authorization: Bearer dflw_live_…" \\
  ${origin}/api/v1/jobs/JOB_ID
# → { "status": "completed", "result": { "files": [{ "url": "…" }] } }`}
              </code>
            </div>

            <p className="text-[11px] text-white/40">
              Paramètres images : <code className="text-white/60">count, fundamentals, semi, visuals, reverse, iphone_meta, country</code>.
              Vidéo : <code className="text-white/60">count (1-10), packs, country, iphone_meta</code> · durée max 59 s · fichier ≤ 150 Mo.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

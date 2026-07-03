"use client";

// Personalized-demo request form. Linked from the Solo/Pro pricing cards
// ("Démo personnalisée"). Posts to /api/support/contact — the same channel as
// the support form — so the request lands in Supabase + hello@duupflow.com.

import { useEffect, useState } from "react";
import Link from "@/components/LocaleLink";
import { useTranslation } from "@/lib/i18n/context";

const G = "bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent";
const INPUT =
  "w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-indigo-500/40 transition";
const INPUT_STYLE = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" };

export default function DemoRequestPage() {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("plan");
      if (p === "solo" || p === "pro") setPlan(p);
    } catch {}
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim() || !prenom.trim() || !email.trim() || !message.trim()) {
      setError(t("demoRequest.errorRequired"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: `${prenom.trim()} ${nom.trim()} — ${email.trim()}`,
          subject: `Demande de démo personnalisée${plan ? ` (${plan})` : ""}`,
          message: message.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setSent(true);
      } else {
        setError(data.error || t("demoRequest.errorGeneric"));
      }
    } catch {
      setError(t("demoRequest.errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: "linear-gradient(135deg, #060918 0%, #0D0B2E 50%, #060C1F 100%)" }}
    >
      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/[0.07]">
        <Link href="/" className="text-xl font-extrabold tracking-tight">
          <span style={{ color: "#818CF8" }}>Duup</span>
          <span className="text-white/55">Flow</span>
        </Link>
        <Link
          href="/pricing"
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
        >
          {t("nav.tarifs")}
        </Link>
      </header>

      <div className="relative z-10 max-w-xl mx-auto px-6 py-14">
        <Link href="/pricing" className="text-sm text-white/40 hover:text-white/70 transition">
          ← {t("demoRequest.backHome")}
        </Link>

        <h1 className="mt-6 text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          {t("demoRequest.title").split(" ").slice(0, -1).join(" ")}{" "}
          <span className={G}>{t("demoRequest.title").split(" ").slice(-1)}</span>
        </h1>
        <p className="mt-3 text-white/55 text-sm leading-relaxed">{t("demoRequest.subtitle")}</p>

        <div
          className="mt-8 rounded-2xl p-6"
          style={{ background: "rgba(10,14,40,0.60)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {sent ? (
            <div className="text-center py-6">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.30)" }}>
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">{t("demoRequest.successTitle")}</h2>
              <p className="mt-1.5 text-sm text-white/55">{t("demoRequest.successDesc")}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/45 mb-1.5">{t("demoRequest.firstNameLabel")}</label>
                  <input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder={t("demoRequest.firstNamePlaceholder")} className={INPUT} style={INPUT_STYLE} />
                </div>
                <div>
                  <label className="block text-xs text-white/45 mb-1.5">{t("demoRequest.nameLabel")}</label>
                  <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t("demoRequest.namePlaceholder")} className={INPUT} style={INPUT_STYLE} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/45 mb-1.5">{t("demoRequest.emailLabel")}</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("demoRequest.emailPlaceholder")} className={INPUT} style={INPUT_STYLE} />
              </div>
              <div>
                <label className="block text-xs text-white/45 mb-1.5">{t("demoRequest.messageLabel")}</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("demoRequest.messagePlaceholder")} rows={5} className={`${INPUT} resize-none`} style={INPUT_STYLE} />
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/[0.08] border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl py-3.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
              >
                {loading ? t("demoRequest.sending") : t("demoRequest.submit")}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 px-8 py-8 border-t border-white/[0.06] text-center">
        <p className="text-xs text-white/25">{t("footer.copyright", { year: new Date().getFullYear().toString() })}</p>
      </footer>
    </div>
  );
}

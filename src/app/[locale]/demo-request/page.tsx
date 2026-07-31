"use client";

// Page contact / demande de démo — design clair "Lunera", branding DuupFlow.
// Le formulaire poste vers /api/support/contact (Supabase + hello@duupflow.com).

import { useEffect, useState } from "react";
import Link from "@/components/LocaleLink";
import { useTranslation } from "@/lib/i18n/context";
import { NavPill, Footer, SmoothScroll, Label, BLUE, CTA_GRAD } from "@/components/landing/shell";

const INPUT =
  "w-full rounded-xl border border-black/10 bg-[#f6f7f9] px-4 py-3 text-sm text-[#1a1a1a] placeholder-[#9aa2b2] outline-none transition focus:border-[#4f7bff]/50 focus:ring-2 focus:ring-[#4f7bff]/15";

const REQUEST_TYPES = ["Démo", "Partenariat", "Affiliation", "Support", "Autre"];

const FAQS: [string, string][] = [
  ["Comment DuupFlow évite-t-il les doublons ?", "Chaque copie reçoit des métadonnées uniques (appareil, date, encodeur), une signature visuelle sous le seuil de perception et une empreinte binaire propre. Ton montage, ton audio et ton cadrage restent identiques."],
  ["Est-ce que la qualité baisse ?", "Non. Résolution et bitrate d'origine conservés : une 1080p reste 1080p, une 4K reste 4K. Aucune perte visible à l'œil."],
  ["Ça marche sur quelles plateformes ?", "Toutes. DuupFlow prépare les fichiers, tu postes où tu veux : TikTok, Instagram, YouTube, X, Reddit, Threads…"],
  ["Puis-je l'utiliser pour une agence / plusieurs comptes ?", "Oui, c'est même l'usage principal. Une vidéo devient des dizaines de variantes uniques à répartir sur tous tes comptes."],
  ["Combien de temps pour être opérationnel ?", "Quelques minutes : tu importes ta vidéo, tu choisis le nombre de variantes, tu exportes. Compte ~3 min pour 20 variantes."],
];

export default function DemoRequestPage() {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sujet, setSujet] = useState(REQUEST_TYPES[0]);
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
          subject: `${sujet}${plan ? ` (${plan})` : ""}`,
          message: message.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) setSent(true);
      else setError(data.error || t("demoRequest.errorGeneric"));
    } catch {
      setError(t("demoRequest.errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  const INFOS = [
    {
      title: "Écris-nous",
      desc: "Une réponse sous 24h ouvrées, en général bien avant.",
      value: "hello@duupflow.com",
      href: "mailto:hello@duupflow.com",
      external: false,
      icon: <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm0 1 8 6 8-6" />,
    },
    {
      title: "Support technique",
      desc: "Un souci sur tes duplications ? On t'aide vite sur Telegram.",
      value: "@DuupFlow_Support",
      href: "https://t.me/DuupFlow_Support",
      external: true,
      icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    },
  ];

  return (
    <div className="lunera min-h-screen bg-white text-[#1a1a1a]">
      <SmoothScroll />
      <NavPill />

      <section className="relative overflow-hidden px-6 pb-24 pt-36 sm:pt-44">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[520px]"
          style={{ background: "radial-gradient(60% 100% at 50% 0%, rgba(99,102,241,0.10), transparent 70%)" }} />

        <div className="relative mx-auto max-w-6xl">
          <div className="text-center">
            <Label>Contact</Label>
            <h1 className="mx-auto mt-6 max-w-2xl font-semibold tracking-[-0.03em] text-[#1a1a1a]"
              style={{ fontSize: "clamp(32px, 4.6vw, 54px)", lineHeight: 1.06 }}>
              Une question ? On adore aider.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-[17px] leading-relaxed text-[#3a3f4b] sm:text-[18px]">
              Écris-nous à tout moment — on te répond en un jour ouvré maximum.
            </p>
          </div>

          <div className="mt-14 grid items-start gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
            {/* Infos de contact */}
            <div className="space-y-4">
              {INFOS.map((it) => (
                <Link key={it.title} href={it.href}
                  {...(it.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group flex items-start gap-4 rounded-[24px] bg-white p-6 ring-1 ring-black/[0.06] shadow-[0_14px_40px_rgba(20,40,90,0.06)] transition hover:shadow-[0_20px_50px_rgba(20,40,90,0.10)]">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: CTA_GRAD }}>
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{it.icon}</svg>
                  </span>
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#1a1a1a]">{it.title}</h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-[#605f5f]">{it.desc}</p>
                    <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: BLUE }}>
                      {it.value}
                      <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Formulaire */}
            <div className="rounded-[28px] bg-white p-7 ring-1 ring-black/[0.06] shadow-[0_24px_70px_rgba(20,40,90,0.10)] sm:p-9">
              {sent ? (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
                    <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
                  </div>
                  <h2 className="text-lg font-semibold text-[#1a1a1a]">{t("demoRequest.successTitle")}</h2>
                  <p className="mt-1.5 text-sm text-[#605f5f]">{t("demoRequest.successDesc")}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-[#1a1a1a]">Type de demande</label>
                    <div className="flex flex-wrap gap-2">
                      {REQUEST_TYPES.map((ty) => {
                        const active = sujet === ty;
                        return (
                          <button key={ty} type="button" onClick={() => setSujet(ty)}
                            className={`rounded-full px-4 py-2 text-[13px] font-medium ring-1 transition ${active ? "text-white ring-transparent" : "bg-[#f6f7f9] text-[#1a1a1a] ring-black/10 hover:bg-[#eef0f4]"}`}
                            style={active ? { background: CTA_GRAD } : undefined}>
                            {ty}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-[#1a1a1a]">{t("demoRequest.firstNameLabel")}</label>
                      <input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder={t("demoRequest.firstNamePlaceholder")} className={INPUT} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-[#1a1a1a]">{t("demoRequest.nameLabel")}</label>
                      <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t("demoRequest.namePlaceholder")} className={INPUT} />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-[#1a1a1a]">{t("demoRequest.emailLabel")}</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("demoRequest.emailPlaceholder")} className={INPUT} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-[#1a1a1a]">{t("demoRequest.messageLabel")}</label>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("demoRequest.messagePlaceholder")} rows={5} className={`${INPUT} resize-none`} />
                  </div>

                  {error && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-500">{error}</p>
                  )}

                  <button type="submit" disabled={loading}
                    className="w-full rounded-full py-3.5 text-sm font-medium text-white shadow-[0_12px_34px_rgba(90,90,240,0.38)] transition hover:opacity-90 disabled:opacity-50"
                    style={{ background: CTA_GRAD }}>
                    {loading ? t("demoRequest.sending") : t("demoRequest.submit")}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-24">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div className="lg:pt-4">
            <Label>FAQ</Label>
            <h2 className="mt-6 font-semibold tracking-[-0.03em] text-[#1a1a1a]" style={{ fontSize: "clamp(30px, 4vw, 46px)", lineHeight: 1.05 }}>
              Tes questions,<br className="hidden sm:block" /> nos réponses.
            </h2>
            <p className="mt-5 max-w-sm text-[16px] leading-relaxed text-[#605f5f]">
              Tu ne trouves pas ta réponse ? Écris-nous via le formulaire ci-dessus.
            </p>
          </div>
          <div className="rounded-[28px] bg-[#f4f5f8] p-3 sm:p-4">
            <div className="space-y-3">
              {FAQS.map(([q, a], i) => (
                <div key={i} className="group overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.06] transition-shadow hover:ring-2 hover:ring-[#4f7bff]">
                  <div className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left">
                    <span className="text-[16px] font-medium text-[#1a1a1a]">{q}</span>
                    <span className="shrink-0 text-xl leading-none text-[#8a8a8a] transition-transform duration-300 group-hover:rotate-45">+</span>
                  </div>
                  <div className="max-h-0 overflow-hidden transition-[max-height] duration-[350ms] ease group-hover:max-h-[320px]">
                    <p className="px-6 pb-6 text-[15px] leading-relaxed text-[#605f5f]">{a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

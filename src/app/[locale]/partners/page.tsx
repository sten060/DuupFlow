"use client";

// Page "Programme partenaire / affiliation" — design clair "Lunera", branding
// DuupFlow actuel. Le formulaire poste vers /api/support/contact (Supabase +
// hello@duupflow.com), inchangé.

import Link from "@/components/LocaleLink";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { NavPill, Footer, SmoothScroll, Label, BLUE, CTA_GRAD, Brand } from "@/components/landing/shell";

const INPUT =
  "w-full rounded-xl border border-black/10 bg-[#f6f7f9] px-4 py-3 text-sm text-[#1a1a1a] placeholder-[#9aa2b2] outline-none transition focus:border-[#4f7bff]/50 focus:ring-2 focus:ring-[#4f7bff]/15";

export default function PartenairePage() {
  const { t, locale } = useTranslation();
  const en = locale === "en";
  const [form, setForm] = useState({ nom: "", prenom: "", email: "", agence: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Reuse the support channel: saved in Supabase + emailed to hello@duupflow.com.
      const res = await fetch("/api/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: `${form.prenom.trim()} ${form.nom.trim()} — ${form.email.trim()}`,
          subject: `Demande partenaire / affiliation${form.agence.trim() ? ` — ${form.agence.trim()}` : ""}`,
          message: `Agence : ${form.agence.trim() || "—"}\n\n${form.message.trim() || "(aucun message)"}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || t("partenaire.errorGeneric"));
      }
    } catch {
      setError(t("partenaire.errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lunera min-h-screen bg-white text-[#1a1a1a]">
      <SmoothScroll />
      <NavPill />

      <section className="relative overflow-hidden px-6 pb-24 pt-36 sm:pt-44">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[520px]"
          style={{ background: "radial-gradient(60% 100% at 50% 0%, rgba(99,102,241,0.10), transparent 70%)" }} />

        <div className="relative mx-auto max-w-5xl">
          <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-[#8a8a8a] transition hover:text-[#1a1a1a]">
            {t("partenaire.backToHome")}
          </Link>

          <div className="text-center">
            <Label>{en ? "Affiliate" : "Affiliation"}</Label>
            <h1 className="mx-auto mt-6 max-w-3xl font-semibold tracking-[-0.03em] text-[#1a1a1a]"
              style={{ fontSize: "clamp(32px, 4.6vw, 54px)", lineHeight: 1.06 }}>
              {t("partenaire.title")} <Brand />
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-[#3a3f4b] sm:text-[18px]">
              {t("partenaire.subtitle")}
            </p>
          </div>

          {/* Two cards */}
          <div className="mt-14 grid items-stretch gap-6 md:grid-cols-2">
            {/* Card 1 — Already a partner */}
            <Link
              href="/affiliate-login"
              className="group flex flex-col items-center justify-center rounded-[28px] bg-white p-10 text-center ring-1 ring-black/[0.06] shadow-[0_14px_40px_rgba(20,40,90,0.06)] transition hover:shadow-[0_20px_50px_rgba(20,40,90,0.10)]"
            >
              <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-white" style={{ background: CTA_GRAD }}>
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25V9m-3 0h13.5A1.5 1.5 0 0120.25 10.5v9A1.5 1.5 0 0118.75 21H5.25a1.5 1.5 0 01-1.5-1.5v-9A1.5 1.5 0 015.25 9z" />
                </svg>
              </span>
              <h2 className="text-[20px] font-semibold text-[#1a1a1a] transition group-hover:opacity-80">
                {t("partenaire.alreadyPartner")}
              </h2>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#605f5f]">
                {t("partenaire.alreadyPartnerDesc")}
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: BLUE }}>
                {en ? "Access my dashboard" : "Accéder à mon espace"}
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </Link>

            {/* Card 2 — Become a partner */}
            <div className="rounded-[28px] bg-white p-8 ring-1 ring-black/[0.06] shadow-[0_14px_40px_rgba(20,40,90,0.06)] sm:p-9">
              <div className="mb-6 flex flex-col items-center text-center">
                <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-white" style={{ background: CTA_GRAD }}>
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </span>
                <h2 className="text-[20px] font-semibold text-[#1a1a1a]">{t("partenaire.becomePartner")}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#605f5f]">
                  {t("partenaire.becomePartnerDesc")}
                </p>
              </div>

              {submitted ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                  <p className="font-medium text-emerald-700">
                    {t("partenaire.successMessage")}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input name="nom" placeholder={t("partenaire.nomPlaceholder")} required value={form.nom} onChange={handleChange} className={INPUT} />
                    <input name="prenom" placeholder={t("partenaire.prenomPlaceholder")} required value={form.prenom} onChange={handleChange} className={INPUT} />
                  </div>
                  <input name="email" type="email" placeholder={t("partenaire.emailPlaceholder")} required value={form.email} onChange={handleChange} className={INPUT} />
                  <input name="agence" placeholder={t("partenaire.agencePlaceholder")} required value={form.agence} onChange={handleChange} className={INPUT} />
                  <textarea name="message" placeholder={t("partenaire.messagePlaceholder")} rows={4} value={form.message} onChange={handleChange} className={`${INPUT} resize-none`} />
                  {error && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-500">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-full py-3.5 text-sm font-medium text-white shadow-[0_12px_34px_rgba(90,90,240,0.38)] transition hover:opacity-90 disabled:opacity-50"
                    style={{ background: CTA_GRAD }}
                  >
                    {loading ? t("partenaire.submitting") : t("partenaire.submitButton")}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

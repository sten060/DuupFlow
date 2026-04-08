"use client";

import Link from "next/link";
import Header from "@/components/Header";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n/context";

export default function PartenairePage() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ nom: "", prenom: "", email: "", agence: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Simulate sending — replace with actual server action / API call later
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen text-white tech-grid">
      <Header />

      <div className="pt-40 pb-20 px-6 max-w-5xl mx-auto">
        {/* Back link */}
        <Link href="/" className="text-sm text-white/40 hover:text-white/70 transition mb-8 inline-block">
          {t("partenaire.backToHome")}
        </Link>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
          {t("partenaire.title")}{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent">
            {t("partenaire.titleHighlight")}
          </span>
        </h1>
        <p className="text-white/50 mb-12 max-w-2xl">
          {t("partenaire.subtitle")}
        </p>

        {/* Two cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Card 1 — Already a partner */}
          <Link
            href="/affiliate-login"
            className="group rounded-2xl border border-white/[0.08] p-8 hover:border-indigo-500/40 transition-all flex flex-col items-center justify-center text-center"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-5">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-indigo-400">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25V9m-3 0h13.5A1.5 1.5 0 0120.25 10.5v9A1.5 1.5 0 0118.75 21H5.25a1.5 1.5 0 01-1.5-1.5v-9A1.5 1.5 0 015.25 9z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2 group-hover:text-indigo-300 transition">
              {t("partenaire.alreadyPartner")}
            </h2>
            <p className="text-sm text-white/40">
              {t("partenaire.alreadyPartnerDesc")}
            </p>
          </Link>

          {/* Card 2 — Become a partner */}
          <div
            className="rounded-2xl border border-white/[0.08] p-8"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-sky-500/10 flex items-center justify-center mb-5">
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-sky-400">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">{t("partenaire.becomePartner")}</h2>
              <p className="text-sm text-white/40">
                {t("partenaire.becomePartnerDesc")}
              </p>
            </div>

            {submitted ? (
              <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6 text-center">
                <p className="text-green-400 font-medium">
                  {t("partenaire.successMessage")}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input
                    name="nom"
                    placeholder={t("partenaire.nomPlaceholder")}
                    required
                    value={form.nom}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-500/50 transition"
                  />
                  <input
                    name="prenom"
                    placeholder={t("partenaire.prenomPlaceholder")}
                    required
                    value={form.prenom}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-500/50 transition"
                  />
                </div>
                <input
                  name="email"
                  type="email"
                  placeholder={t("partenaire.emailPlaceholder")}
                  required
                  value={form.email}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-500/50 transition"
                />
                <input
                  name="agence"
                  placeholder={t("partenaire.agencePlaceholder")}
                  required
                  value={form.agence}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-500/50 transition"
                />
                <textarea
                  name="message"
                  placeholder={t("partenaire.messagePlaceholder")}
                  rows={4}
                  value={form.message}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-500/50 transition resize-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
                >
                  {loading ? t("partenaire.submitting") : t("partenaire.submitButton")}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/LocaleLink";
import { useTranslation } from "@/lib/i18n/context";
import { Brand } from "@/components/landing/shell";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function LoginPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when a sign-in attempt (magic link or Google) matches no existing
  // account — the user must register instead. Also raised via ?error=no_account
  // (the Google callback redirect).
  const [noAccount, setNoAccount] = useState(urlError === "no_account");

  async function handleGoogle() {
    // flow=login → the callback rejects a brand-new OAuth user (no account).
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?flow=login` },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNoAccount(false);
    // Login mode → the server sets shouldCreateUser:false, so a missing account
    // comes back as { code: "no_account" } instead of silently signing up.
    const res = await fetch("/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        mode: "login",
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.code === "no_account") setNoAccount(true);
    else if (!res.ok) setError(data.error || "Une erreur est survenue. Réessaie.");
    else setSent(true);
    setLoading(false);
  }

  return (
    <div className="lunera min-h-screen flex flex-col items-center justify-between px-4 py-10 bg-white text-[#1a1a1a]">
      {/* Texture claire + halo indigo */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage: "radial-gradient(rgba(99,102,241,0.05) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 80%)",
        }}
      />

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5">
        <img src="/logo-mark.png" alt="" className="h-8 w-8 object-contain" />
        <Brand className="text-xl font-bold tracking-tight text-[#1a1a1a]" />
      </Link>

      {/* Card */}
      <div className="w-full max-w-sm">
        {sent ? (
          /* ── Email sent state ── */
          <div className="text-center space-y-5">
            <div
              className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(79,123,255,0.10)", border: "1px solid rgba(79,123,255,0.22)" }}
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="#4f7bff" strokeWidth="1.8">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1a1a1a] mb-1">{t("login.checkEmail")}</h2>
              <p className="text-[#605f5f] text-sm">
                {t("login.linkSent")}{" "}
                <span className="text-[#1a1a1a] font-medium">{email}</span>
              </p>
            </div>
            <p className="text-[#9aa2b2] text-xs">{t("login.expiresIn")}</p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="text-sm text-[#605f5f] hover:text-[#1a1a1a] transition"
            >
              {t("login.useOtherAddress")}
            </button>
          </div>
        ) : (
          <>
            {urlError === "compte_affilie" && (
              <div className="rounded-xl px-4 py-4 mb-6 text-sm space-y-1 bg-amber-50 border border-amber-200">
                <p className="font-semibold text-amber-700">{t("login.affiliateError")}</p>
                <p className="text-amber-700/80 text-xs leading-relaxed">
                  {t("login.affiliateErrorDesc")}
                </p>
                <Link
                  href="/pricing#plans"
                  className="inline-block mt-2 text-xs font-semibold text-amber-700 hover:text-amber-800 transition underline underline-offset-2"
                >
                  {t("login.createAccount")}
                </Link>
              </div>
            )}

            {noAccount && (
              <div className="rounded-xl px-4 py-4 mb-6 text-sm space-y-1 bg-amber-50 border border-amber-200">
                <p className="font-semibold text-amber-700">{t("login.noAccountTitle")}</p>
                <p className="text-amber-700/80 text-xs leading-relaxed">{t("login.noAccountDesc")}</p>
                <Link
                  href="/pricing#plans"
                  className="inline-block mt-2 text-xs font-semibold text-amber-700 hover:text-amber-800 transition underline underline-offset-2"
                >
                  {t("login.createAccount")}
                </Link>
              </div>
            )}

            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-[#1a1a1a] mb-1.5">{t("login.title")}</h1>
              <p className="text-[#605f5f] text-sm">{t("login.subtitle")}</p>
            </div>

            {/* Google */}
            <button
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-[#1a1a1a] transition border border-black/10 hover:bg-black/[0.03] mb-5"
            >
              <GoogleIcon />
              {t("login.googleButton")}
            </button>

            {/* OR divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-black/10" />
              <span className="text-xs text-[#9aa2b2] uppercase tracking-wider">{t("login.or")}</span>
              <div className="flex-1 h-px bg-black/10" />
            </div>

            {/* Email form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1a1a1a] mb-1.5">{t("login.emailLabel")}</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("login.emailPlaceholder")}
                  className="w-full rounded-xl px-4 py-3 text-sm text-[#1a1a1a] placeholder-[#9aa2b2] outline-none transition bg-[#f6f7f9] border border-black/10 focus:border-[#4f7bff]/50 focus:ring-2 focus:ring-[#4f7bff]/15"
                />
              </div>

              {error && (
                <div className="rounded-lg px-4 py-2.5 text-xs bg-red-50 border border-red-200 text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full py-3 text-sm font-medium text-white shadow-[0_10px_28px_rgba(90,90,240,0.35)] transition-opacity disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#4f7bff 0%,#7c5cff 100%)" }}
              >
                {loading ? t("login.submitting") : t("login.submitButton")}
              </button>
            </form>

            <p className="text-center text-sm text-[#605f5f] mt-6">
              {t("login.noAccount")}{" "}
              <Link href="/pricing#plans" className="font-medium text-[#4f7bff] hover:opacity-80 transition">
                {t("login.startNow")}
              </Link>
            </p>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-4 text-xs text-[#9aa2b2]">
        <Link href="/legal" className="hover:text-[#1a1a1a] transition">{t("common.mentionsLegales")}</Link>
        <span>·</span>
        <Link href="/legal/privacy" className="hover:text-[#1a1a1a] transition">{t("common.confidentialite")}</Link>
      </div>
    </div>
  );
}

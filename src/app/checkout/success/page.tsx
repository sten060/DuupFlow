"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/context";

type Status = "checking" | "waiting" | "ready" | "unauthenticated" | "error";

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>("checking");
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let attempts = 0;
    const MAX_ATTEMPTS = 24; // 24 × 1.5s = 36s max
    const sessionId = searchParams.get("session_id");
    let stripeConfirmed = false;

    async function checkAndRedirect() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setStatus("unauthenticated");
        return;
      }

      setStatus("waiting");

      // Vérification directe via Stripe si on a un session_id.
      if (sessionId) {
        try {
          const res = await fetch("/api/stripe/verify-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          const data = await res.json();

          if (res.ok && data.paid) {
            stripeConfirmed = true;
            setStatus("ready");
            // Ne pas rediriger tout de suite — le polling confirme que la DB est à jour.
          } else {
            // Garder l'info de debug visible pour diagnostiquer
            const reason = data.error ?? data.payment_status ?? `HTTP ${res.status}`;
            setDebugInfo(`verify-session: ${reason}`);
            console.error("[success] verify-session failed:", data);
          }
        } catch (err) {
          setDebugInfo(`verify-session fetch error: ${err}`);
        }
      }

      async function poll() {
        attempts++;
        const { data: profile } = await supabase
          .from("profiles")
          .select("has_paid, is_guest")
          .eq("id", user!.id)
          .single();

        const hasAccess = profile?.has_paid === true || profile?.is_guest === true;

        if (hasAccess) {
          setStatus("ready");
          window.location.href = "/dashboard";
          return;
        }

        if (attempts < MAX_ATTEMPTS) {
          setTimeout(poll, 1500);
        } else {
          if (stripeConfirmed) {
            window.location.href = "/dashboard";
          } else {
            setStatus("error");
          }
        }
      }

      poll();
    }

    checkAndRedirect();
  }, []);

  return (
    <div className="w-full max-w-md text-center relative">
      {status === "unauthenticated" ? (
        <>
          <div
            className="mx-auto mb-8 h-20 w-20 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(16,185,129,0.12)",
              border: "1px solid rgba(16,185,129,0.35)",
              boxShadow: "0 0 50px rgba(16,185,129,0.20)",
            }}
          >
            <svg viewBox="0 0 24 24" className="h-9 w-9 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
            {t("checkout.successTitle")}
          </h1>
          <p className="text-white/50 text-sm mb-8 leading-relaxed">
            {t("checkout.loginToAccess")}
          </p>
          <Link
            href="/login"
            className="inline-block w-full rounded-xl py-3.5 text-sm font-bold text-white text-center transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            {t("checkout.loginButton")}
          </Link>
        </>
      ) : status === "error" ? (
        <>
          <div
            className="mx-auto mb-8 h-20 w-20 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.35)",
            }}
          >
            <svg viewBox="0 0 24 24" className="h-9 w-9 text-red-400" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-3">
            {t("checkout.activationPending")}
          </h1>
          <p className="text-white/50 text-sm mb-2 leading-relaxed">
            {t("checkout.activationPendingDesc")}
          </p>
          {debugInfo && (
            <p className="text-red-400/70 text-xs mb-6 font-mono bg-red-950/30 rounded px-3 py-2">
              {debugInfo}
            </p>
          )}
          <p className="text-white/30 text-xs mb-6">
            {t("checkout.copyAndContact")}
          </p>
          <button
            onClick={() => { window.location.reload(); }}
            className="inline-block w-full rounded-xl py-3.5 text-sm font-bold text-white text-center transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            {t("checkout.retry")}
          </button>
        </>
      ) : (
        <>
          <div
            className="mx-auto mb-8 h-20 w-20 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(16,185,129,0.12)",
              border: "1px solid rgba(16,185,129,0.35)",
              boxShadow: "0 0 50px rgba(16,185,129,0.20)",
            }}
          >
            <svg viewBox="0 0 24 24" className="h-9 w-9 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
            {t("checkout.successTitle")}
          </h1>
          <p className="text-white/50 text-sm mb-8 leading-relaxed">
            {t("checkout.successSubtitle")}
          </p>

          <button
            onClick={() => { window.location.href = "/dashboard"; }}
            className="inline-block w-full rounded-xl py-3.5 text-sm font-bold text-white text-center transition hover:opacity-90 mb-4"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            {t("checkout.goToDashboard")}
          </button>

          <p className="text-xs text-white/25">
            {status === "ready"
              ? t("checkout.redirectionInProgress")
              : t("checkout.activationInProgress")}
          </p>
        </>
      )}
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        background: "linear-gradient(135deg, #060918 0%, #0D0B2E 50%, #060C1F 100%)",
      }}
    >
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <Suspense fallback={null}>
        <CheckoutSuccessContent />
      </Suspense>
    </main>
  );
}

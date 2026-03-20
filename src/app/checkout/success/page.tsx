"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "waiting" | "ready" | "unauthenticated";

function CheckoutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const supabase = createClient();
    let attempts = 0;
    const MAX_ATTEMPTS = 20; // 20 × 1.5s = 30s max
    const sessionId = searchParams.get("session_id");

    async function checkAndRedirect() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setStatus("unauthenticated");
        return;
      }

      setStatus("waiting");

      // Vérification directe via Stripe si on a un session_id (fiable, sans dépendre du webhook)
      if (sessionId) {
        try {
          const res = await fetch("/api/stripe/verify-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.paid) {
              setStatus("ready");
              router.push("/dashboard");
              return;
            }
          }
        } catch {
          // Continuer avec le polling si la vérification directe échoue
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
          router.push("/dashboard");
          return;
        }

        if (attempts < MAX_ATTEMPTS) {
          setTimeout(poll, 1500);
        } else {
          // Webhook timed out — vérification directe une dernière fois avant d'abandonner
          if (sessionId) {
            try {
              const res = await fetch("/api/stripe/verify-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId }),
              });
              if (res.ok) {
                const data = await res.json();
                if (data.paid) {
                  setStatus("ready");
                  router.push("/dashboard");
                  return;
                }
              }
            } catch {
              // Ignorer
            }
          }
          router.push("/dashboard");
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
            Paiement confirmé 🎉
          </h1>
          <p className="text-white/50 text-sm mb-8 leading-relaxed">
            Connecte-toi pour accéder à ton abonnement DuupFlow Pro.
          </p>
          <Link
            href="/login"
            className="inline-block w-full rounded-xl py-3.5 text-sm font-bold text-white text-center transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            Se connecter →
          </Link>
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
            Paiement confirmé 🎉
          </h1>
          <p className="text-white/50 text-sm mb-8 leading-relaxed">
            Ton abonnement DuupFlow Pro est actif. Tous les modules sont maintenant accessibles.
          </p>

          <Link
            href="/dashboard"
            className="inline-block w-full rounded-xl py-3.5 text-sm font-bold text-white text-center transition hover:opacity-90 mb-4"
            style={{ background: "linear-gradient(135deg,#6366F1,#38BDF8)" }}
          >
            Accéder au dashboard →
          </Link>

          <p className="text-xs text-white/25">
            {status === "ready"
              ? "Redirection en cours…"
              : "Activation de ton accès en cours…"}
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

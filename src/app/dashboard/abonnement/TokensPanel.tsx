"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TOPUP_PACKS,
  MIN_TOPUP_CENTS,
  formatTokens,
  formatEur,
  packBonusCents,
} from "@/lib/tokens";
import { useTranslation } from "@/lib/i18n/context";

type LedgerEntry = {
  id: string;
  delta_cents: number;
  reason: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ApiState = {
  plan: string | null;
  balanceCents: number;
  ledger: LedgerEntry[];
};

/**
 * Tokens section — extracted from the former /dashboard/tokens page so it can
 * live inside the unified "Plan & token" module (/dashboard/abonnement).
 * Self-contained: fetches /api/tokens and reads the ?topup=success|cancel flag
 * that Stripe appends on return (success_url now points to this page).
 */
export default function TokensPanel() {
  const { t, locale } = useTranslation();
  const [state, setState] = useState<ApiState | null>(null);
  const [loading, setLoading] = useState(true);
  const [topupBusy, setTopupBusy] = useState(false);
  const [customEur, setCustomEur] = useState<number>(MIN_TOPUP_CENTS / 100);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/tokens", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setState(j);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const topup = url.searchParams.get("topup");
      if (topup === "success") setFlash(t("dashboard.tokens.flashSuccess"));
      if (topup === "cancel") setFlash(t("dashboard.tokens.flashCancel"));
      if (topup) {
        url.searchParams.delete("topup");
        window.history.replaceState({}, "", url.toString());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  async function handlePackTopup(packId: string) {
    setErr(null);
    setTopupBusy(true);
    try {
      const res = await fetch("/api/stripe/topup-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const j = await res.json();
      if (!res.ok || !j.url) throw new Error(j?.error || `HTTP ${res.status}`);
      window.location.href = j.url;
    } catch (e: any) {
      setErr(e?.message || "Topup failed");
      setTopupBusy(false);
    }
  }

  async function handleCustomTopup() {
    const priceCents = Math.round(customEur * 100);
    if (priceCents < MIN_TOPUP_CENTS) return;
    setErr(null);
    setTopupBusy(true);
    try {
      const res = await fetch("/api/stripe/topup-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceCents }),
      });
      const j = await res.json();
      if (!res.ok || !j.url) throw new Error(j?.error || `HTTP ${res.status}`);
      window.location.href = j.url;
    } catch (e: any) {
      setErr(e?.message || "Topup failed");
      setTopupBusy(false);
    }
  }

  const balanceCents = state?.balanceCents ?? 0;
  const dateLocale = locale === "en" ? "en-US" : "fr-FR";

  return (
    <section className="mt-2">
      {/* Section header */}
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight">
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            {t("dashboard.tokens.heading")}
          </span>
        </h2>
        <p className="text-sm text-white/40 mt-1">
          {t("dashboard.tokens.subtitle")}
        </p>
      </div>

      {flash && (
        <div className="mb-5 rounded-lg border border-emerald-400/30 bg-emerald-500/[0.06] px-4 py-2.5 text-sm text-emerald-200">
          {flash}
        </div>
      )}
      {err && (
        <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/[0.08] px-4 py-2.5 text-sm text-red-300">
          {err}
        </div>
      )}

      {/* Balance card */}
      <div
        className="mb-6 rounded-2xl p-6 flex items-baseline gap-3"
        style={{ background: "rgba(10,14,40,0.55)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <p className="text-5xl font-bold text-white">
          {loading ? "—" : formatTokens(balanceCents)}
        </p>
        <span className="text-base text-white/50">tokens</span>
        <span className="ml-auto text-xs text-white/35">{t("dashboard.tokens.available")}</span>
      </div>

      {/* Topup packs */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-white/85 mb-3">{t("dashboard.tokens.buyTitle")}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TOPUP_PACKS.map((pack) => {
            const tokens = formatTokens(pack.creditCents, 0);
            const bonusCents = packBonusCents(pack);
            const bonusTokens = bonusCents > 0 ? formatTokens(bonusCents, 0) : null;
            return (
              <button
                key={pack.id}
                type="button"
                disabled={topupBusy}
                onClick={() => handlePackTopup(pack.id)}
                className={[
                  "relative rounded-xl p-4 text-left transition border disabled:opacity-50",
                  pack.highlight
                    ? "bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border-emerald-400/30 hover:border-emerald-400/55"
                    : "bg-white/[0.03] border-white/[0.06] hover:border-white/15",
                ].join(" ")}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                  {pack.label}
                </p>
                <p className="mt-1 text-xl font-bold text-white">
                  {tokens} tokens
                </p>
                {bonusTokens && (
                  <p className="mt-0.5 text-[11px] font-medium text-emerald-300">
                    {t("dashboard.tokens.bonusOffered", { n: bonusTokens })}
                  </p>
                )}
                <p className="mt-2 text-xs text-white/55">{formatEur(pack.priceCents)}</p>
              </button>
            );
          })}
        </div>

        {/* Custom amount */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-white/55 mb-1.5">
            {t("dashboard.tokens.customLabel", { min: formatEur(MIN_TOPUP_CENTS) })}
          </label>
          <div className="flex gap-2 max-w-md">
            <div className="relative flex-1">
              <input
                type="number"
                min={MIN_TOPUP_CENTS / 100}
                step={1}
                value={customEur}
                onChange={(e) => setCustomEur(Math.max(MIN_TOPUP_CENTS / 100, Number(e.target.value)))}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 pr-10 text-sm text-white outline-none focus:border-emerald-400/40"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">€</span>
            </div>
            <button
              type="button"
              disabled={topupBusy || customEur * 100 < MIN_TOPUP_CENTS}
              onClick={handleCustomTopup}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-white disabled:opacity-50 hover:shadow-[0_4px_20px_rgba(16,185,129,.30)] transition"
            >
              {t("dashboard.tokens.pay")}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-white/40">
            {t("dashboard.tokens.approx", { n: formatTokens(customEur * 100, 1).replace(/\.0$/, "") })}
          </p>
        </div>
      </div>

      {/* History — collapsible */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <button
          type="button"
          onClick={() => setHistoryOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition rounded-xl"
        >
          <span className="text-sm font-semibold text-white/85">
            {t("dashboard.tokens.historyTitle")}
            {state?.ledger?.length ? (
              <span className="ml-2 text-xs text-white/40 font-normal">
                ({state.ledger.length})
              </span>
            ) : null}
          </span>
          <svg
            viewBox="0 0 12 12"
            className={`h-3 w-3 text-white/45 transition-transform ${historyOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        </button>

        {historyOpen && (
          <div className="border-t border-white/[0.05] px-4 py-3">
            {loading ? (
              <p className="text-xs text-white/40">{t("dashboard.tokens.loading")}</p>
            ) : !state || state.ledger.length === 0 ? (
              <p className="text-xs text-white/40">{t("dashboard.tokens.noTx")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-white/45 border-b border-white/[0.06]">
                      <th className="font-medium pb-2 pr-4">{t("dashboard.tokens.colDate")}</th>
                      <th className="font-medium pb-2 pr-4">{t("dashboard.tokens.colReason")}</th>
                      <th className="font-medium pb-2 pr-4 text-right">{t("dashboard.tokens.colTokens")}</th>
                      <th className="font-medium pb-2 text-right">{t("dashboard.tokens.colEur")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.ledger.map((row) => {
                      const positive = row.delta_cents >= 0;
                      return (
                        <tr key={row.id} className="border-b border-white/[0.04] last:border-0">
                          <td className="py-2 pr-4 text-white/55 whitespace-nowrap">
                            {new Date(row.created_at).toLocaleString(dateLocale, {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-2 pr-4 text-white/75">{row.reason}</td>
                          <td className={`py-2 pr-4 text-right font-medium ${positive ? "text-emerald-300" : "text-red-300"}`}>
                            {positive ? "+" : ""}
                            {formatTokens(row.delta_cents)}
                          </td>
                          <td className={`py-2 text-right font-mono ${positive ? "text-emerald-300/85" : "text-red-300/85"}`}>
                            {positive ? "+" : ""}
                            {formatEur(row.delta_cents)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

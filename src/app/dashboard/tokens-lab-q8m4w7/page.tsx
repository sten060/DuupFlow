"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TOPUP_PACKS,
  MIN_TOPUP_CENTS,
  formatTokens,
  formatEur,
  packBonusCents,
} from "@/lib/tokens";

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

export default function TokensLabPage() {
  const [state, setState] = useState<ApiState | null>(null);
  const [loading, setLoading] = useState(true);
  const [topupBusy, setTopupBusy] = useState(false);
  const [adjBusy, setAdjBusy] = useState(false);
  const [customEur, setCustomEur] = useState<number>(MIN_TOPUP_CENTS / 100);
  const [adjustEur, setAdjustEur] = useState<number>(5);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const isDev = process.env.NODE_ENV !== "production";

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/tokens-lab-q8m4w7", { cache: "no-store" });
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
      if (topup === "success") setFlash("Paiement reçu — solde mis à jour dans quelques secondes.");
      if (topup === "cancel") setFlash("Paiement annulé.");
      if (topup) {
        url.searchParams.delete("topup");
        window.history.replaceState({}, "", url.toString());
      }
    }
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

  async function handleAdminAdjust(deltaCents: number) {
    setErr(null);
    setAdjBusy(true);
    try {
      const res = await fetch("/api/tokens-lab-q8m4w7/admin-adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deltaCents, reason: "admin_adjust" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Adjust failed");
    } finally {
      setAdjBusy(false);
    }
  }

  const balanceCents = state?.balanceCents ?? 0;
  const plan = state?.plan ?? "solo";

  return (
    <div className="p-8 w-full max-w-4xl">
      {/* Header — minimal */}
      <div className="mb-8">
        <p className="text-xs font-medium text-white/30 tracking-[0.14em] uppercase mb-2">
          Lab interne — Admin
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Tokens IA
          </span>
        </h1>
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

      {/* Balance — minimal, no euro display */}
      <div className="mb-8 flex items-baseline gap-3">
        <p className="text-5xl font-bold text-white">
          {loading ? "—" : formatTokens(balanceCents)}
        </p>
        <span className="text-base text-white/50">tokens</span>
        <span className="ml-auto text-xs text-white/35 uppercase tracking-wider">
          Plan : <span className="text-white/65 font-medium">{plan}</span>
        </span>
      </div>

      <div className="h-px bg-white/[0.06] mb-8" />

      {/* Topup packs */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-white/85 mb-3">Acheter des tokens</h2>

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
                    +{bonusTokens} offerts
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
            Montant libre (min {formatEur(MIN_TOPUP_CENTS)})
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
              Payer
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-white/40">
            ≈ {formatTokens(customEur * 100, 1).replace(/\.0$/, "")} tokens
          </p>
        </div>
      </div>

      {/* Dev adjust (gated) */}
      {isDev && (
        <div className="mb-6 rounded-xl border border-amber-400/20 bg-amber-500/[0.04] p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/15 border border-amber-400/30 rounded px-1.5 py-0.5">
              DEV
            </span>
            <h2 className="text-sm font-semibold text-white/85">Ajustement manuel (test)</h2>
          </div>
          <div className="flex gap-2 items-center mb-2">
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={adjustEur}
              onChange={(e) => setAdjustEur(Number(e.target.value))}
              className="w-24 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white outline-none focus:border-amber-400/40"
            />
            <span className="text-xs text-white/45">€</span>
            <span className="text-xs text-white/30 ml-2">
              ≈ {formatTokens(adjustEur * 100, 1).replace(/\.0$/, "")} tokens
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={adjBusy || adjustEur <= 0}
              onClick={() => handleAdminAdjust(Math.round(adjustEur * 100))}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/25 transition disabled:opacity-50"
            >
              + Créditer
            </button>
            <button
              type="button"
              disabled={adjBusy || adjustEur <= 0}
              onClick={() => handleAdminAdjust(-Math.round(adjustEur * 100))}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-red-500/15 border border-red-400/30 text-red-200 hover:bg-red-500/25 transition disabled:opacity-50"
            >
              − Débiter
            </button>
          </div>
        </div>
      )}

      {/* History — collapsible */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <button
          type="button"
          onClick={() => setHistoryOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition rounded-xl"
        >
          <span className="text-sm font-semibold text-white/85">
            Historique
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
              <p className="text-xs text-white/40">Chargement…</p>
            ) : !state || state.ledger.length === 0 ? (
              <p className="text-xs text-white/40">Aucune transaction pour le moment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-white/45 border-b border-white/[0.06]">
                      <th className="font-medium pb-2 pr-4">Date</th>
                      <th className="font-medium pb-2 pr-4">Raison</th>
                      <th className="font-medium pb-2 pr-4 text-right">Δ tokens</th>
                      <th className="font-medium pb-2 text-right">Δ €</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.ledger.map((row) => {
                      const positive = row.delta_cents >= 0;
                      return (
                        <tr key={row.id} className="border-b border-white/[0.04] last:border-0">
                          <td className="py-2 pr-4 text-white/55 whitespace-nowrap">
                            {new Date(row.created_at).toLocaleString("fr-FR", {
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
    </div>
  );
}

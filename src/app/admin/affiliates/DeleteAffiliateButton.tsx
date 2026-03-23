"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteAffiliateButton({ code, name }: { code: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const res = await fetch("/api/admin/affiliate/delete", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ code }),
    });
    setLoading(false);
    if (res.ok) {
      setConfirming(false);
      router.refresh();
    } else {
      const data = await res.json();
      alert("Erreur : " + (data.error ?? "inconnue"));
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/50">Supprimer {name} ?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-[10px] font-semibold px-2.5 py-1 rounded-lg transition"
          style={{
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.30)",
            color: "#F87171",
          }}
        >
          {loading ? "…" : "Confirmer"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-[10px] font-semibold px-2.5 py-1 rounded-lg transition"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "rgba(255,255,255,0.35)",
          }}
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-[10px] font-semibold px-2.5 py-1 rounded-lg transition"
      style={{
        background: "rgba(239,68,68,0.06)",
        border: "1px solid rgba(239,68,68,0.15)",
        color: "rgba(248,113,113,0.60)",
      }}
    >
      Supprimer
    </button>
  );
}

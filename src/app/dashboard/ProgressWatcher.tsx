"use client";
import React from "react";

type Props = { userId?: string; jobId?: string };

export default function ProgressWatcher({ userId, jobId }: Props) {
  const [p, setP]   = React.useState<number | null>(null);
  const [msg, setMsg] = React.useState("");

  React.useEffect(() => {
    if (!userId || !jobId) return; // OK: on ne sort pas AVANT le hook

    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`/out/${userId}/__progress_${jobId}.json?ts=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) {                // fichier supprimé => terminé
          if (alive) setP(100);
          return;
        }
        const j = await res.json();
        if (!alive) return;
        setP(j.percent ?? 0);
        setMsg(j.msg ?? "");
        setTimeout(tick, 300);        // poll rapide
      } catch {
        if (alive) setTimeout(tick, 700);
      }
    };

    tick();
    return () => { alive = false; };
  }, [userId, jobId]);

  // rendu
  if (!userId || !jobId) return null;
  if (p === null) return null;

  return (
    <div className="mt-6">
      <div className="h-2 w-full rounded bg-white/10 overflow-hidden">
        <div
          className="h-2 bg-indigo-500 transition-[width] duration-200"
          style={{ width: `${Math.max(0, Math.min(100, p))}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-white/70">
        {p >= 100 ? "Terminé ✅" : msg || `Progression… ${p}%`}
      </p>
    </div>
  );
}
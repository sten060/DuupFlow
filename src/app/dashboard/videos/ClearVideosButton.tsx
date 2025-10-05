"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export default function ClearVideosButton() {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await fetch("/api/out/clear?scope=videos", { method: "POST" });
          router.refresh();
        })
      }
      disabled={pending}
      className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-60"
    >
      {pending ? "Nettoyage…" : "Vider les vidéos"}
    </button>
  );
}
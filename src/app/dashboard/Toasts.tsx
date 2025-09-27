"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function Toasts() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ok = sp.get("ok");
  const err = sp.get("err");

  // on nettoie l'URL après affichage
  useEffect(() => {
    if (!ok && !err) return;
    const t = setTimeout(() => {
      router.replace(pathname); // supprime les query params
    }, 3500);
    return () => clearTimeout(t);
  }, [ok, err, pathname, router]);

  if (!ok && !err) return null;

  const isErr = Boolean(err);
  const msg = isErr ? decodeURIComponent(err as string) : "Fichiers générés avec succès.";

  return (
    <div className={`mb-4 rounded-md border px-3 py-2 text-sm
                    ${isErr
                      ? "border-red-500/30 bg-red-500/10 text-red-100"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"}`}>
      {msg}
    </div>
  );
}

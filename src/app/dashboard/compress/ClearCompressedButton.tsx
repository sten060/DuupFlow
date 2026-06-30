"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { clearCompressed } from "./actions";

export default function ClearCompressedButton({ onCleared }: { onCleared?: () => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await clearCompressed();
          onCleared?.();
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white/80 transition disabled:opacity-50"
    >
      {busy ? t("compress.clearing") : t("compress.clear")}
    </button>
  );
}

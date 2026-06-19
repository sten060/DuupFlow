"use client";

import { useTransition } from "react";
import { useTranslation } from "@/lib/i18n/context";

type Props = {
  onCleared?: () => void;
};

export default function ClearImagesButton({ onCleared }: Props) {
  const { t } = useTranslation();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await fetch("/api/out/clear?scope=images", { method: "POST" });
          onCleared?.();
        })
      }
      disabled={pending}
      className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-60"
    >
      {pending ? t("img.clearing") : t("img.clearImages")}
    </button>
  );
}

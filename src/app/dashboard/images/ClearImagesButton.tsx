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
      className="rounded-lg border border-[var(--app-border-strong)] px-4 py-2 text-sm text-[var(--app-text)] hover:bg-[var(--app-surface-2)] disabled:opacity-60"
    >
      {pending ? t("img.clearing") : t("img.clearImages")}
    </button>
  );
}

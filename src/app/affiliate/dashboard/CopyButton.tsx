"use client";

import { useState } from "react";
import { CTA_GRAD } from "@/components/landing/shell";

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="shrink-0 rounded-full px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
      style={
        copied
          ? { background: "#059669", boxShadow: "0 6px 16px rgba(5,150,105,0.25)" }
          : { background: CTA_GRAD, boxShadow: "0 6px 16px rgba(90,90,240,0.25)" }
      }
    >
      {copied ? "Copié ✓" : "Copier"}
    </button>
  );
}

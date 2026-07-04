"use client";

// Copy-to-clipboard code block for blog articles. Header with a label + a
// "Copier" button that flips to "Copié ✔" briefly. Used for the Claude Code
// prompt readers paste to reproduce the automation.

import { useState } from "react";

export default function CopyBlock({
  code,
  label = "Prompt Claude Code",
}: {
  code: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="not-prose relative rounded-xl border border-white/10 bg-black/40 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/[0.08] bg-white/[0.02]">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-indigo-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {label}
        </span>
        <button
          type="button"
          onClick={() => {
            try { navigator.clipboard.writeText(code); } catch {}
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          style={{ background: copied ? "rgba(16,185,129,0.90)" : "linear-gradient(135deg,#6366F1,#38BDF8)" }}
        >
          {copied ? "Copié ✔" : "Copier"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[12.5px] leading-relaxed text-white/80 whitespace-pre-wrap font-mono">{code}</pre>
    </div>
  );
}

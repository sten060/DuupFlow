"use client";

import type { ReactNode } from "react";

// Topbar du studio : logo ∞ dégradé, nom du projet, actions (export/télécharger)
// et pastille crédits.
export default function Topbar({
  credits,
  projectName = "sans titre",
  actions,
}: {
  credits: number;
  projectName?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[#232350] px-5 sm:px-7">
      {/* Logo + projet */}
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-lg font-medium text-white"
          style={{ background: "linear-gradient(135deg,#6d5efc,#4ec5ff)" }}
        >
          ∞
        </span>
        <span className="text-lg font-medium text-[#eef0fb]">DuupFlow</span>
        <span className="hidden text-[#3f3f66] sm:inline">/</span>
        <span className="hidden truncate text-[15px] text-[#9a9ac6] sm:inline">
          {projectName}
        </span>
      </div>

      {/* Actions + crédits */}
      <div className="flex items-center gap-3">
        {actions}
        <div className="flex items-center gap-1.5 rounded-full border border-[#2e2e60] bg-[#12122e] px-4 py-1.5 text-sm text-[#eef0fb]">
          <span aria-hidden className="text-[#6d5efc]">
            ✦
          </span>
          {credits} crédits
        </div>
      </div>
    </header>
  );
}

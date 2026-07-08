"use client";

// Topbar du studio : logo ∞ dégradé, nom du projet, pastille crédits (live).
export default function Topbar({ credits }: { credits: number }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#232350] px-5 sm:px-7">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-[9px] text-lg font-medium text-white"
          style={{ background: "linear-gradient(135deg,#6d5efc,#4ec5ff)" }}
        >
          ∞
        </span>
        <span className="text-lg font-medium text-[#eef0fb]">DuupFlow</span>
      </div>

      {/* Nom du projet */}
      {/* TODO: brancher — nom de projet éditable + persistance (Supabase) */}
      <div className="hidden text-[15px] sm:block">
        <span className="text-[#9a9ac6]">Projet </span>
        <span className="text-[#eef0fb]">sans titre</span>
      </div>

      {/* Crédits */}
      {/* TODO: brancher — solde de crédits réel de l'utilisateur */}
      <div className="flex items-center gap-1.5 rounded-full border border-[#2e2e60] bg-[#12122e] px-4 py-1.5 text-sm text-[#eef0fb]">
        <span aria-hidden className="text-[#6d5efc]">
          ✦
        </span>
        {credits} crédits
      </div>
    </header>
  );
}

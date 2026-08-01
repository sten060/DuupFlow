// ToggleChip.tsx
"use client";
import React from "react";

type ToggleChipProps = {
  name: string;
  label: string;
  hint?: string;
  value?: string;
  /** permet d'avoir la case cochée par défaut */
  defaultChecked?: boolean;
  /** couleur d'accent pour l'état coché */
  accent?: "indigo" | "pink";
};

const accentStyles = {
  indigo: "peer-checked:border-indigo-400/30 peer-checked:bg-indigo-500/10",
  pink: "peer-checked:border-fuchsia-400/30 peer-checked:bg-fuchsia-500/10",
};

export default function ToggleChip({
  name,
  label,
  hint,
  value = "1",
  defaultChecked = false,
  accent = "indigo",
}: ToggleChipProps) {
  return (
    <label className="block">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <div className={`select-none rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 transition-all ${accentStyles[accent]}`}>
        <div className="font-medium text-sm text-[var(--app-text)]">{label}</div>
        {hint && <div className="text-xs text-[var(--app-text-faint)] mt-0.5">{hint}</div>}
      </div>
    </label>
  );
}
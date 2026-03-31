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
};

export default function ToggleChip({
  name,
  label,
  hint,
  value = "1",
  defaultChecked = false,
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
      <div className="select-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 transition-all
                      peer-checked:border-indigo-400/30 peer-checked:bg-indigo-500/10">
        <div className="font-medium text-sm text-white/85">{label}</div>
        {hint && <div className="text-xs text-white/45 mt-0.5">{hint}</div>}
      </div>
    </label>
  );
}
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
      <div className="select-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition
                      peer-checked:border-indigo-500/40 peer-checked:bg-indigo-500/10">
        <div className="font-medium">{label}</div>
        {hint && <div className="text-sm text-white/70">{hint}</div>}
      </div>
    </label>
  );
}
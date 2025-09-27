"use client";

import React from "react";
import clsx from "clsx";

type Props = {
  name: string;
  value: string;
  label: React.ReactNode;
  defaultChecked?: boolean;
  hint?: string;
};

export default function ToggleChip({ name, value, label, defaultChecked, hint }: Props) {
  const id = React.useId();
  return (
    <div className="group">
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className={clsx(
          "inline-flex items-center gap-2 rounded-lg border px-3 py-2",
          "cursor-pointer select-none transition-all",
          // état normal
          "border-white/10 bg-white/5 text-white/80",
          // focus
          "focus:outline-none focus:ring-2 focus:ring-indigo-400/40",
          // hover
          "hover:border-white/20 hover:bg-white/10",
          // état checked via peer
          "peer-checked:border-indigo-400/40 peer-checked:bg-indigo-500/10",
          "peer-checked:shadow-[0_0_0_1px_theme(colors.indigo.400/0.4),0_0_20px_0_theme(colors.indigo.500/0.3)]",
          "peer-checked:text-white"
        )}
        title={typeof hint === "string" ? hint : undefined}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white/40 peer-checked:bg-indigo-400" />
        <span className="text-sm">{label}</span>
      </label>
      {hint && typeof hint === "string" && (
        <p className="mt-1 pl-1 text-xs text-white/40">{hint}</p>
      )}
    </div>
  );
}
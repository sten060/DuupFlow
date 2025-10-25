"use client";
import { cn } from "../../lib/cn";
import React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  title?: React.ReactNode; // ✅ titre facultatif (texte ou JSX)
  children?: React.ReactNode;
};

export default function Card({ className, title, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "glass p-6 border border-gradient rounded-xl bg-white/5 backdrop-blur-sm transition",
        className
      )}
      {...props}
    >
      {title && (
        <div className="mb-3 text-sm font-medium text-white/90 flex items-center gap-2">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
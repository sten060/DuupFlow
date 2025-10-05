"use client";
import { cn } from "../../lib/cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "soft";
  size?: "sm" | "md" | "lg";
};

export default function Button({ variant="primary", size="md", className, ...props }: Props) {
  const sizes = {
    sm: "px-3 py-1.5 text-sm rounded-xl",
    md: "px-4 py-2 text-sm rounded-xl",
    lg: "px-5 py-3 text-base rounded-2xl"
  }[size];

  const variants = {
    primary: "bg-gradient-to-r from-brand-indigo to-brand-fuchsia text-white hover:opacity-90 transition",
    ghost: "bg-transparent text-white/80 hover:bg-white/5 border border-white/10",
    soft: "bg-white/[0.06] text-white hover:bg-white/[0.1] border border-white/10"
  }[variant];

  return <button className={cn("font-medium active:scale-95", sizes, variants, className)} {...props} />;
}
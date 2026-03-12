// src/components/Logo.tsx
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`font-extrabold tracking-tight ${className}`}>
      <span className="bg-clip-text text-transparent"
        style={{ backgroundImage: "linear-gradient(90deg, var(--duup-indigo), var(--duup-fuchsia))" }}>
        Duup
      </span>
      <span className="text-white/80">Flow</span>
    </div>
  );
}
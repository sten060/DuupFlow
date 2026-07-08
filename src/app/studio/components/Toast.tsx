"use client";

// Toast minimal pour le feedback des stubs (téléchargement, publication…).
export default function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-[#2e2e60] bg-[#181838] px-5 py-2.5 text-sm text-[#eef0fb] shadow-[0_8px_30px_rgba(0,0,0,.5)]"
    >
      {message}
    </div>
  );
}

// /src/app/dashboard/layout.tsx
import "@/app/globals.css";
import Sidebar from "./sidebar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden text-white" style={{ background: "#0D0B2E" }}>
      {/* ── Colonne gauche : brand + nav (toujours visible) ── */}
      <div
        className="w-56 shrink-0 flex flex-col overflow-y-auto"
        style={{
          background: "rgba(255,255,255,0.022)",
          borderRight: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Brand */}
        <div className="px-5 pt-6 pb-4 shrink-0">
          <span className="text-lg font-extrabold tracking-tight" style={{ color: "#818CF8" }}>Duup</span>
          <span className="text-white/50 text-lg font-extrabold tracking-tight">Flow</span>
        </div>
        <div className="mx-4 mb-3 shrink-0" style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />

        {/* Nav */}
        <Sidebar />
      </div>

      {/* ── Contenu principal scrollable ── */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

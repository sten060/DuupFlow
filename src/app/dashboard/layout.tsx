import "@/app/globals.css";
import Sidebar from "./sidebar";
import GlobalVideoProgress from "./videos/GlobalVideoProgress";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-screen overflow-hidden text-white"
      style={{ background: "#060918" }}
    >
      {/* Subtle background grid */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Sidebar */}
      <div
        className="w-56 shrink-0 flex flex-col overflow-y-auto relative z-10"
        style={{
          background: "rgba(8,12,35,0.97)",
          borderRight: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Brand */}
        <div className="px-5 pt-6 pb-5 shrink-0">
          <span className="text-lg font-extrabold tracking-tight" style={{ color: "#818CF8" }}>Duup</span>
          <span className="text-lg font-extrabold tracking-tight text-white/45">Flow</span>
        </div>
        <div
          className="mx-4 mb-3 shrink-0"
          style={{ height: "1px", background: "rgba(255,255,255,0.07)" }}
        />
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto relative z-10">
        {children}
      </div>

      {/* Persistent job progress overlay — survives page navigation */}
      <GlobalVideoProgress />
    </div>
  );
}

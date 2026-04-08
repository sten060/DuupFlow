import "@/app/globals.css";
import Sidebar from "./sidebar";
import GlobalVideoProgress from "./videos/GlobalVideoProgress";
import ChatBot from "./components/ChatBot";
import DashboardLangSwitch from "./components/DashboardLangSwitch";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-screen overflow-hidden text-white"
      style={{ background: "#050816" }}
    >
      {/* Sidebar */}
      <div
        className="w-56 shrink-0 flex flex-col overflow-y-auto relative z-10"
        style={{
          background: "rgba(8,12,30,0.95)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Brand + Lang */}
        <div className="px-5 pt-6 pb-5 shrink-0 flex items-center justify-between">
          <div>
            <span className="text-lg font-extrabold tracking-tight" style={{ color: "#818CF8" }}>Duup</span>
            <span className="text-lg font-extrabold tracking-tight text-white/45">Flow</span>
          </div>
          <DashboardLangSwitch />
        </div>
        <div
          className="mx-4 mb-3 shrink-0"
          style={{ height: "1px", background: "rgba(255,255,255,0.07)" }}
        />
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto relative">
        {children}
      </div>

      {/* Persistent job progress overlay — survives page navigation */}
      <GlobalVideoProgress />
      <ChatBot />
    </div>
  );
}

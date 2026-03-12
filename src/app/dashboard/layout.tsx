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
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      {/* brand row */}
      <div className="px-8 pt-6 pb-2">
        <div className="inline-flex items-center gap-1">
          <span className="text-xl md:text-2xl font-extrabold tracking-tight" style={{ color: "#818CF8" }}>Duup</span>
          <span className="text-white/60 text-xl md:text-2xl font-extrabold tracking-tight">Flow</span>
        </div>
      </div>

      {/* main rail + content */}
      <div className="flex gap-6 px-6 md:px-8 pb-10">
        <Sidebar />
        <main className="flex-1 pt-2">{children}</main>
      </div>
    </div>
  );
}

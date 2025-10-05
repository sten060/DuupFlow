import type { ReactNode } from "react";
import Sidebar from "./sidebar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-6">
        <aside className="card p-0">
          <Sidebar />
        </aside>
        <section className="space-y-6">{children}</section>
      </div>
    </div>
  );
}
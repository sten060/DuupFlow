// src/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import Sidebar from "./sidebar";
import { getSession } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // 1) session côté serveur
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-6">
        {/* Colonne gauche : sidebar */}
        <aside className="card p-0">
          <Sidebar />
        </aside>

        {/* Colonne droite : contenu */}
        <section className="space-y-6">
          {/* ICI l’email */}
          <UserHeader />
          {children}
        </section>
      </div>
    </div>
  );
}
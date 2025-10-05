// src/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import Sidebar from "./sidebar";
import { getSession } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ⚠️ NE PAS mettre "use client" ici : ce composant doit rester serveur
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // 1) On récupère la session côté serveur
  const session = await getSession();

  // 2) Si pas connecté -> on envoie vers /login
  if (!session) redirect("/login");

  // 3) Sinon on rend le layout habituel
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
// src/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import Sidebar from "./sidebar";
import { getSession } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import UserHeader from "./UserHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // 1) Récupérer la session côté serveur
  const session = await getSession();

  // 2) Si pas connecté → redirection vers /login
  if (!session) redirect("/login");

  // 3) Layout du dashboard
  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-8">

        {/* 🟣 Colonne gauche : sidebar + user info */}
        <aside className="card p-0">
          <Sidebar />
          <UserHeader /> {/* Affichage de l’email ici */}
        </aside>

        {/* 🟢 Colonne droite : contenu du dashboard */}
        <section className="space-y-6">{children}</section>
      </div>
    </div>
  );
}
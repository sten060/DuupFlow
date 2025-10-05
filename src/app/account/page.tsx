// src/app/account/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  // ⚠️ La fonction serveur est maintenant async → on l'attend
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    // Optionnel : log côté serveur
    console.error("[account] getUser error:", error.message);
  }

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Mon compte</h1>
      <p className="mt-2 text-sm text-gray-500">Connecté en tant que {user?.email}</p>
    </main>
  );
}
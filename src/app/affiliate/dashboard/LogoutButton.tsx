"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/affiliate-login");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      aria-label="Déconnexion"
      className="flex h-9 w-9 items-center justify-center rounded-full text-[#605f5f] ring-1 ring-black/10 bg-white transition hover:bg-black/5 hover:text-[#1a1a1a]"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    </button>
  );
}

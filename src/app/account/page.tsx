import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  async function signOut() {
    "use server";
    const s = createClient();
    await s.auth.signOut();
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white px-6 py-12">
      <div className="mx-auto max-w-xl space-y-6 rounded-xl border border-white/10 bg-gray-800 p-6">
        <h1 className="text-2xl font-bold">Mon compte</h1>

        <div className="rounded-md bg-black/40 p-4 text-sm">
          <div><span className="text-gray-400">ID:</span> {data.user.id}</div>
          <div><span className="text-gray-400">Email:</span> {data.user.email}</div>
        </div>

        <form action={signOut}>
          <button className="rounded-md bg-gray-700 px-4 py-2 font-semibold hover:bg-gray-600">
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}

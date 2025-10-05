"use client";

import { useFormStatus } from "react-dom";
import { signOut } from "@/app/(auth)/actions";

function Inner() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full text-left px-3 py-2 rounded-md hover:bg-white/10 text-sm disabled:opacity-60"
    >
      {pending ? "Déconnexion..." : "Se déconnecter"}
    </button>
  );
}

export default function SignOutButton() {
  return (
    <form action={signOut}>
      <Inner />
    </form>
  );
}
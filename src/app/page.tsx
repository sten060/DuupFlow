// src/app/page.tsx - Redirection automatique vers le dashboard
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/dashboard");
}
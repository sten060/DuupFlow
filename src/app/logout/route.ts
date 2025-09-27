import { NextResponse } from "next/server";

export async function GET() {
  // on efface les cookies d'auth Supabase côté navigateur
  const res = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));

  // cookies utilisés par Supabase Auth
  res.cookies.set("sb-access-token", "", { path: "/", maxAge: 0 });
  res.cookies.set("sb-refresh-token", "", { path: "/", maxAge: 0 });

  return res;
}

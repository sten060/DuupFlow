import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  // Protège /dashboard et /api/out/*
  const protect = [/^\/dashboard(\/|$)/, /^\/api\/out(\/|$)/];

  const needsAuth = protect.some((re) => re.test(req.nextUrl.pathname));
  if (!needsAuth) return NextResponse.next();

  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => req.cookies.get(k)?.value, set: (k, v, o) => res.cookies.set(k, v, o), remove: (k, o) => res.cookies.set(k, "", { ...o, maxAge: 0 }) } }
  );

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/out/:path*"],
};
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin: rawOrigin } = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? rawOrigin;
  const code = searchParams.get("code");
  const inviteToken = searchParams.get("invite_token");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .single();

        if (!profile) {
          // No profile yet → onboarding
          if (inviteToken) {
            cookieStore.set("invite_token", inviteToken, {
              maxAge: 60 * 30,
              path: "/",
              httpOnly: true,
            });
            return NextResponse.redirect(`${origin}/onboarding?type=guest`);
          }
          return NextResponse.redirect(`${origin}/onboarding`);
        }

        // User already has a profile but arrived via invitation link
        if (inviteToken) {
          const adminClient = createAdminClient();
          const { data: invitation } = await adminClient
            .from("team_invitations")
            .select("id, host_user_id, status")
            .eq("token", inviteToken)
            .eq("status", "pending")
            .single();

          if (invitation) {
            await Promise.all([
              adminClient.from("team_invitations").update({
                status: "accepted",
                guest_user_id: user.id,
                accepted_at: new Date().toISOString(),
              }).eq("token", inviteToken),
              adminClient.from("profiles").update({
                is_guest: true,
                host_user_id: invitation.host_user_id,
              }).eq("id", user.id),
            ]);
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=lien_invalide`);
}

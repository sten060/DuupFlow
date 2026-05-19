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
          // No profile yet → check for pending invitation (by URL token or by email)
          const adminClient = createAdminClient();

          // ── 1) Invitation team check FIRST ──────────────────────────────
          // A pending invitation is an explicit, host-driven action — it
          // takes priority over a passive affiliate row. Otherwise users
          // who happen to be both (e.g. a creator we onboarded as affiliate
          // who later got invited as a guest by one of our customers) get
          // stuck in /login?error=compte_affilie and never see the invite.
          let resolvedToken = inviteToken ?? null;
          if (!resolvedToken && user.email) {
            const { data: pendingInvite } = await adminClient
              .from("team_invitations")
              .select("token")
              .eq("guest_email", user.email.toLowerCase())
              .eq("status", "pending")
              .order("created_at", { ascending: false })
              .limit(1)
              .single();
            if (pendingInvite) resolvedToken = pendingInvite.token;
          }

          if (resolvedToken) {
            cookieStore.set("invite_token", resolvedToken, {
              maxAge: 60 * 30,
              path: "/",
              httpOnly: true,
            });
            return NextResponse.redirect(`${origin}/onboarding?type=guest`);
          }

          // ── 2) Affiliate check (only if no pending invitation) ──────────
          if (user.email) {
            const { data: affiliate } = await adminClient
              .from("affiliates")
              .select("id, user_id")
              .eq("email", user.email.toLowerCase())
              .single();

            if (affiliate) {
              // Stocker le user_id si pas encore fait
              if (!affiliate.user_id) {
                await adminClient
                  .from("affiliates")
                  .update({ user_id: user.id })
                  .eq("id", affiliate.id);
              }
              // Si l'affilié vient du login classique (next=/dashboard),
              // le bloquer avec un message clair → il doit créer un compte classique.
              // Si il vient du login affilié (next=/affiliate/...), le laisser passer.
              if (!next.startsWith("/affiliate/")) {
                return NextResponse.redirect(`${origin}/login?error=compte_affilie`);
              }
              return NextResponse.redirect(`${origin}/affiliate/dashboard`);
            }
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

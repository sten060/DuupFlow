import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moveToFreeUser } from "@/lib/brevo";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { firstName, agencyName } = await req.json();
  if (!firstName?.trim() || !agencyName?.trim()) {
    return NextResponse.json({ error: "Champs requis." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").upsert({
    id: user.id,
    first_name: firstName.trim(),
    agency_name: agencyName.trim(),
    is_guest: false,
    email_sequence: "free",
    email_sequence_updated_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Add to Brevo "Free Users" list to trigger the onboarding email sequence
  if (user.email) {
    moveToFreeUser(user.email, firstName.trim()).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}

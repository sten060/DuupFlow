import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "video-uploads";
// 5 GB — covers iPhone ProRes, 4K long recordings, etc.
const FILE_SIZE_LIMIT = 5 * 1024 * 1024 * 1024;

export async function POST(req: Request) {
  const { fileName, userId } = await req.json().catch(() => ({}));
  if (!fileName) return NextResponse.json({ error: "fileName required" }, { status: 400 });

  const supabase = createAdminClient();

  // Create bucket if it doesn't exist yet
  await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: FILE_SIZE_LIMIT }).catch(() => {});
  await supabase.storage.updateBucket(BUCKET, { public: false, fileSizeLimit: FILE_SIZE_LIMIT }).catch(() => {});

  const storagePath = `${userId ?? "anon"}/${Date.now()}-${fileName}`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Erreur storage" }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path: storagePath });
}

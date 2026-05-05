import { NextResponse } from "next/server";
import sharp from "sharp";
import crypto from "crypto";
import { buildVariationPrompt, ACTION_VARIATIONS } from "@/lib/ai/variation-prompt";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { recordTransaction } from "@/lib/tokens-server";
import { imageCostCents } from "@/lib/tokens";

export const runtime = "nodejs";
export const maxDuration = 300;

type Mode = "variation" | "prompt";
type Ok = { ok: true; urls: string[]; balanceCents: number };
type Err = { ok: false; error: string; code?: string; balanceCents?: number };

const WAVESPEED_ENDPOINT =
  "https://api.wavespeed.ai/api/v3/bytedance/seedream-v4.5/edit";
const WAVESPEED_BUCKET = "video-outputs"; // reuse existing public bucket
const WAVESPEED_TMP_PREFIX = "ai-input"; // folder inside the bucket

// Convert uploaded file to a clean PNG buffer (rotates per EXIF, drops alpha edge cases).
async function normalizeImage(file: File): Promise<Buffer> {
  const buf = Buffer.from(await file.arrayBuffer());
  return sharp(buf, { sequentialRead: true })
    .rotate()
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// Push the buffer to Supabase Storage and return a signed URL the WaveSpeed
// servers can fetch. Signed URL has a short TTL — it's just a transit copy.
async function uploadToTempStorage(buffer: Buffer): Promise<{ key: string; url: string }> {
  const admin = createAdminClient();
  const key = `${WAVESPEED_TMP_PREFIX}/${crypto.randomBytes(8).toString("hex")}.png`;
  const { error: upErr } = await admin.storage
    .from(WAVESPEED_BUCKET)
    .upload(key, buffer, { contentType: "image/png", upsert: true });
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

  const { data, error: signErr } = await admin.storage
    .from(WAVESPEED_BUCKET)
    .createSignedUrl(key, 600); // 10 min — long enough for WaveSpeed to fetch
  if (signErr || !data?.signedUrl) {
    throw new Error(`Signed URL failed: ${signErr?.message ?? "unknown"}`);
  }
  return { key, url: data.signedUrl };
}

async function deleteTempStorage(key: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.storage.from(WAVESPEED_BUCKET).remove([key]);
  } catch {
    // best-effort cleanup; ignore
  }
}

// Mirror the WaveSpeed-hosted result into our own Supabase Storage so:
//   1. The image survives WaveSpeed's CDN expiration.
//   2. We have a single, CORS-safe origin for the browser to fetch.
//   3. Production filesystems (Railway etc., where /public is not writable
//      at runtime) don't matter — we don't touch local disk.
// Returns a signed URL valid for 24 h — long enough for a download flow.
async function persistResultToStorage(remoteUrl: string): Promise<string> {
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`Failed to fetch generated image: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const admin = createAdminClient();
  const key = `ai-output/${crypto.randomBytes(8).toString("hex")}.png`;
  const { error: upErr } = await admin.storage
    .from(WAVESPEED_BUCKET)
    .upload(key, buf, { contentType: "image/png", upsert: false });
  if (upErr) throw new Error(`Output upload failed: ${upErr.message}`);

  const { data, error: signErr } = await admin.storage
    .from(WAVESPEED_BUCKET)
    .createSignedUrl(key, 60 * 60 * 24); // 24 h
  if (signErr || !data?.signedUrl) {
    throw new Error(`Output signed URL failed: ${signErr?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}

type WaveSpeedCreateResp = {
  data?: {
    id: string;
    status?: "created" | "processing" | "completed" | "failed";
    outputs?: string[];
    /** Per-output NSFW flag, aligned 1:1 with outputs[]. */
    has_nsfw_contents?: boolean[];
    error?: string;
  };
  message?: string;
};

/**
 * Filter WaveSpeed outputs by their NSFW flag. Throws a recognizable error
 * when EVERY output is flagged so the per-iteration catch in POST() can
 * refund the user's tokens automatically.
 */
function pickCleanOutputs(json: WaveSpeedCreateResp): string[] {
  const outputs = json.data?.outputs ?? [];
  if (outputs.length === 0) return [];
  const flags = json.data?.has_nsfw_contents ?? [];
  const clean = outputs.filter((_, i) => !flags[i]);
  if (clean.length === 0 && outputs.length > 0) {
    throw new Error("WaveSpeed flagged all outputs as NSFW (content rejected).");
  }
  return clean;
}

async function pollWaveSpeed(taskId: string): Promise<string[]> {
  const url = `https://api.wavespeed.ai/api/v3/predictions/${taskId}/result`;
  // Poll up to 5 minutes (60 attempts × 5s)
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.WAVESPEED_API_KEY}` },
    });
    if (!res.ok) continue;
    const json: WaveSpeedCreateResp = await res.json();
    const status = json.data?.status;
    if (status === "completed" && json.data?.outputs?.length) return pickCleanOutputs(json);
    if (status === "failed") {
      throw new Error(`WaveSpeed task failed: ${json.data?.error || "unknown"}`);
    }
  }
  throw new Error("WaveSpeed polling timed out");
}

// Detect ByteDance/WaveSpeed transient errors that are worth retrying.
// Their backend occasionally times out on its internal storage (tos-cn-beijing)
// or returns 5xx — both clear after a short backoff.
function isTransientWaveSpeedError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || "").toLowerCase();
  return (
    msg.includes("read timed out") ||
    msg.includes("timeout") ||
    msg.includes("tos-cn-beijing") ||
    msg.includes("connection") ||
    /wavespeed 5\d\d/.test(msg)
  );
}

async function callWaveSpeedOnce(imageUrl: string, prompt: string): Promise<string[]> {
  const res = await fetch(WAVESPEED_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WAVESPEED_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      images: [imageUrl],
      prompt,
      enable_sync_mode: true,        // wait inline; faster for 1 image
      enable_base64_output: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WaveSpeed ${res.status}: ${text.slice(0, 300)}`);
  }
  const json: WaveSpeedCreateResp = await res.json();

  // sync mode → outputs are already there (filter NSFW so the user isn't
  // charged for a flagged image)
  if (json.data?.outputs?.length) return pickCleanOutputs(json);
  // fallback: if the API decided to switch to async, poll
  if (json.data?.id) return pollWaveSpeed(json.data.id);

  throw new Error("WaveSpeed returned no outputs");
}

async function generateOnce(imageUrl: string, prompt: string): Promise<string[]> {
  const MAX_ATTEMPTS = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callWaveSpeedOnce(imageUrl, prompt);
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_ATTEMPTS || !isTransientWaveSpeedError(err)) throw err;
      console.warn(`[ai-lab] transient error attempt ${attempt}/${MAX_ATTEMPTS}, retrying:`, (err as any)?.message);
      // 2s, 5s backoff
      await new Promise((r) => setTimeout(r, attempt * 2500));
    }
  }
  throw lastErr;
}

export async function POST(req: Request) {
  let tempKey: string | null = null;
  // Track tokens debited up-front so we can refund on partial / full failure.
  let userId: string | null = null;
  let costPerImage = 0;
  let totalDebited = 0;
  let successCount = 0;
  let variants = 1;

  try {
    if (!process.env.WAVESPEED_API_KEY) {
      return NextResponse.json<Err>(
        { ok: false, error: "WAVESPEED_API_KEY not configured in .env.local" },
        { status: 500 },
      );
    }

    // ── 1. Auth ───────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json<Err>(
        { ok: false, error: "unauthorized", code: "AUTH" },
        { status: 401 },
      );
    }
    userId = user.id;

    // ── 2. Parse request ──────────────────────────────────────────────────
    const form = await req.formData();
    const file = form.get("image") as File | null;
    const mode = ((form.get("mode") as string) || "variation") as Mode;
    variants = Math.max(1, Math.min(3, Number(form.get("variants") || 1)));
    const userPrompt = ((form.get("prompt") as string) || "").trim();

    if (!file || file.size === 0) {
      return NextResponse.json<Err>({ ok: false, error: "No image provided." }, { status: 400 });
    }
    if (mode === "prompt" && !userPrompt) {
      return NextResponse.json<Err>(
        { ok: false, error: "Prompt is required in prompt mode." },
        { status: 400 },
      );
    }

    // ── 3. Resolve plan + price ──────────────────────────────────────────
    const { data: profile } = await createAdminClient()
      .from("profiles")
      .select("plan, ai_balance_cents")
      .eq("id", userId)
      .single();
    const plan = (profile?.plan as string | null) ?? "solo";
    costPerImage = imageCostCents(plan);
    const totalCost = costPerImage * variants;
    const reason = plan === "pro" ? "image_pro" : "image_solo";

    // ── 4. Pre-debit upfront. recordTransaction returns insufficient_balance
    //      if not enough — we surface a 402 with the current balance so the
    //      UI can prompt the user to top up.
    const debit = await recordTransaction({
      userId,
      deltaCents: -totalCost,
      reason,
      metadata: { variants, mode, stage: "reserve" },
    });
    if (!debit.ok) {
      return NextResponse.json<Err>(
        {
          ok: false,
          error: debit.error === "insufficient_balance"
            ? "Solde insuffisant — recharge tes tokens."
            : (debit.error || "Token debit failed"),
          code: debit.error,
          balanceCents: debit.balanceCents,
        },
        { status: debit.error === "insufficient_balance" ? 402 : 500 },
      );
    }
    totalDebited = totalCost;

    // ── 5. Upload reference image to Supabase Storage for WaveSpeed ──────
    const buffer = await normalizeImage(file);
    const { key, url: imageUrl } = await uploadToTempStorage(buffer);
    tempKey = key;

    // ── 6. Generate N variations. Each iteration tries up to 3 times via
    //      generateOnce. Failures are caught individually so we can refund
    //      the right amount. Variation mode pre-picks distinct random actions
    //      so 2 variants never land on the same pose.
    const actionIndices: number[] = [];
    if (mode === "variation") {
      const shuffled = ACTION_VARIATIONS.map((_, i) => i).sort(() => Math.random() - 0.5);
      for (let i = 0; i < variants; i++) actionIndices.push(shuffled[i % shuffled.length]);
    }

    const resultUrls: string[] = [];
    let lastError: string | null = null;
    for (let i = 0; i < variants; i++) {
      const finalPrompt =
        mode === "variation" ? buildVariationPrompt(actionIndices[i]) : userPrompt;
      try {
        const outputs = await generateOnce(imageUrl, finalPrompt);
        let persistedThis = 0;
        for (const u of outputs) {
          try {
            const persisted = await persistResultToStorage(u);
            resultUrls.push(persisted);
            persistedThis++;
          } catch (err) {
            console.error("[ai-lab] persist failed:", err);
            lastError = (err as any)?.message ?? "persist_failed";
          }
        }
        if (persistedThis > 0) successCount++;
      } catch (err) {
        const msg = (err as any)?.message ?? String(err);
        console.error(`[ai-lab] generation ${i + 1}/${variants} failed:`, msg);
        lastError = msg;
      }
    }

    // ── 7. Refund unused tokens (failures). Successful images stay debited.
    const refundCount = variants - successCount;
    let finalBalance = debit.balanceCents;
    if (refundCount > 0) {
      const refundAmount = costPerImage * refundCount;
      const refund = await recordTransaction({
        userId,
        deltaCents: refundAmount,
        reason: "refund_failure",
        metadata: { mode, refundedImages: refundCount, totalRequested: variants },
      });
      if (refund.ok) finalBalance = refund.balanceCents;
    }

    if (resultUrls.length === 0) {
      // Surface a clear message when the model rejected for NSFW —
      // tokens are already refunded above, so the user keeps their balance.
      const isNsfw = lastError?.toLowerCase().includes("nsfw");
      const error = isNsfw
        ? "Contenu rejeté par le filtre NSFW de l'IA. Tokens remboursés."
        : `Aucune image générée. Tokens remboursés. ${lastError ? `(${lastError})` : ""}`.trim();
      return NextResponse.json<Err>(
        { ok: false, error, code: isNsfw ? "NSFW" : undefined, balanceCents: finalBalance },
        { status: 502 },
      );
    }

    return NextResponse.json<Ok>({ ok: true, urls: resultUrls, balanceCents: finalBalance });
  } catch (e: any) {
    console.error("[ai-lab] fatal:", e);

    // Hard failure — refund whatever we debited.
    let finalBalance: number | undefined;
    if (userId && totalDebited > 0) {
      const owed = costPerImage * (variants - successCount);
      if (owed > 0) {
        const refund = await recordTransaction({
          userId,
          deltaCents: owed,
          reason: "refund_failure",
          metadata: { fatal: true, error: String(e?.message || e) },
        });
        if (refund.ok) finalBalance = refund.balanceCents;
      }
    }
    return NextResponse.json<Err>(
      { ok: false, error: e?.message || "AI generation failed", balanceCents: finalBalance },
      { status: 500 },
    );
  } finally {
    if (tempKey) await deleteTempStorage(tempKey);
  }
}

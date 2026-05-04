import { NextResponse } from "next/server";
import sharp from "sharp";
import crypto from "crypto";
import { buildVariationPrompt, ACTION_VARIATIONS } from "@/lib/ai/variation-prompt";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

type Mode = "variation" | "prompt";
type Ok = { ok: true; urls: string[] };
type Err = { ok: false; error: string };

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
    error?: string;
  };
  message?: string;
};

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
    if (status === "completed" && json.data?.outputs?.length) return json.data.outputs;
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

  // sync mode → outputs are already there
  if (json.data?.outputs?.length) return json.data.outputs;
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
  try {
    if (!process.env.WAVESPEED_API_KEY) {
      return NextResponse.json<Err>(
        { ok: false, error: "WAVESPEED_API_KEY not configured in .env.local" },
        { status: 500 },
      );
    }

    const form = await req.formData();
    const file = form.get("image") as File | null;
    const mode = ((form.get("mode") as string) || "variation") as Mode;
    const variants = Math.max(1, Math.min(3, Number(form.get("variants") || 1)));
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

    // 1) Upload reference image to Supabase Storage so WaveSpeed can fetch it
    const buffer = await normalizeImage(file);
    const { key, url: imageUrl } = await uploadToTempStorage(buffer);
    tempKey = key;

    // 2) Generate N variations sequentially. Same model for both modes —
    //    only the prompt changes. In variation mode, each iteration picks
    //    a DIFFERENT random action from ACTION_VARIATIONS so the user gets
    //    visibly different poses across the N outputs.

    // Pre-pick distinct random actions for the variation pool so two variants
    // never accidentally land on the same pose.
    const actionIndices: number[] = [];
    if (mode === "variation") {
      const shuffled = ACTION_VARIATIONS.map((_, i) => i).sort(() => Math.random() - 0.5);
      for (let i = 0; i < variants; i++) actionIndices.push(shuffled[i % shuffled.length]);
    }

    const resultUrls: string[] = [];
    for (let i = 0; i < variants; i++) {
      const finalPrompt =
        mode === "variation" ? buildVariationPrompt(actionIndices[i]) : userPrompt;
      const outputs = await generateOnce(imageUrl, finalPrompt);
      for (const u of outputs) {
        try {
          const persisted = await persistResultToStorage(u);
          resultUrls.push(persisted);
        } catch (err) {
          console.error("[ai-lab] persist failed:", err);
        }
      }
    }

    if (resultUrls.length === 0) {
      return NextResponse.json<Err>(
        { ok: false, error: "AI returned no usable images. Try again." },
        { status: 502 },
      );
    }

    return NextResponse.json<Ok>({ ok: true, urls: resultUrls });
  } catch (e: any) {
    console.error("[ai-lab] fatal:", e);
    return NextResponse.json<Err>(
      { ok: false, error: e?.message || "AI generation failed" },
      { status: 500 },
    );
  } finally {
    if (tempKey) await deleteTempStorage(tempKey);
  }
}

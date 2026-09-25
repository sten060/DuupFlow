// Chunked upload for HEAVY files (compressor, > 1 GB). A single-request upload
// of a multi-GB file on an ordinary connection exceeds Railway's 15-min edge cap
// per HTTP request → 502. Here the browser slices the file into ~50 MB chunks,
// sends several in parallel (faster on far/high-latency links), retries a failed
// chunk alone, and the server writes each chunk at its offset in ONE temp file.
//
// The result is a regular `duup_direct_*` temp file, so /api/compress-sse
// consumes it exactly like an /api/upload-direct upload (and the orphan cleanup
// in cleanupOldFiles covers abandoned ones).
//
//   POST ?action=init&fileName=&size=      → { uploadId, chunkSize }
//   POST ?action=chunk&uploadId=&index=    → body = chunk bytes → { ok }
//   POST ?action=complete&uploadId=        → { uploadId, name }
//   POST ?action=status&uploadId=          → { received: number[], complete, … }
//   POST ?action=abort&uploadId=           → drops the session + temp file
//
// Resume: after a reload the browser forgets the picked file, but the chunks
// already received stay here for SESSION_MAX_AGE_MS after the last activity.
// When the user re-selects the same file, the client asks `status` and only
// sends the missing chunks.
import os from "os";
import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";

export const runtime = "nodejs";

const CHUNK_SIZE = 50 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 * 1024; // same ceiling as upload-direct
const SESSION_MAX_AGE_MS = 60 * 60 * 1000; // 1 h after the last activity

type Session = {
  userId: string;
  name: string;
  tmpPath: string;
  size: number;
  chunks: number;
  received: Map<number, number>; // chunk index → bytes written
  createdAt: number;
  touchedAt: number; // last activity — expiry is measured from here
  complete: boolean;
};
// In-memory (single Railway instance). A restart loses in-flight sessions — the
// client then gets a clear error and the user retries.
const sessions = new Map<string, Session>();

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._\- ]/g, "_").slice(0, 200);
}

function sweep() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.touchedAt > SESSION_MAX_AGE_MS) {
      sessions.delete(id);
      // A COMPLETE file may still be queued in a long compression batch: never
      // delete it here (compress-sse removes it once done, and cleanupOldFiles
      // reclaims true orphans). Only half-sent files are dropped after 1 h.
      if (!s.complete) void fs.unlink(s.tmpPath).catch(() => {});
    }
  }
}

export async function POST(req: NextRequest) {
  const t = await getServerT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return NextResponse.json({ error: t("errors.upload.notAuthenticated") }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const action = q.get("action");
  sweep();

  /* ── init: reserve the temp file ── */
  if (action === "init") {
    const name = safeName(q.get("fileName") || "upload.bin");
    const size = Number(q.get("size") || 0);
    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: t("errors.upload.emptyFile") }, { status: 400 });
    }
    if (size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: t("errors.upload.tooLarge", { name, max: String(MAX_UPLOAD_BYTES / (1024 * 1024 * 1024)) }) },
        { status: 413 },
      );
    }
    let ext = (path.extname(name) || ".bin").replace(/[^\w.-]/g, "");
    if (!ext || ext === ".") ext = ".bin";
    const uploadId = `duup_direct_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const tmpPath = path.join(os.tmpdir(), uploadId);
    await fs.writeFile(tmpPath, Buffer.alloc(0));
    sessions.set(uploadId, {
      userId: user.id, name, tmpPath, size,
      chunks: Math.ceil(size / CHUNK_SIZE), received: new Map(),
      createdAt: Date.now(), touchedAt: Date.now(), complete: false,
    });
    console.log(`[upload-chunk] init "${name}" ${size} bytes → ${Math.ceil(size / CHUNK_SIZE)} chunks`);
    return NextResponse.json({ uploadId, chunkSize: CHUNK_SIZE });
  }

  const uploadId = q.get("uploadId") || "";
  const s = sessions.get(uploadId);
  if (!s || s.userId !== user.id) {
    return NextResponse.json({ error: t("compress.errors.uploadSessionLost") }, { status: 404 });
  }
  s.touchedAt = Date.now();

  /* ── status: what's already here (resume after a reload) ── */
  if (action === "status") {
    // The temp file may already have been consumed (compressed then deleted).
    const exists = await fs.stat(s.tmpPath).then(() => true).catch(() => false);
    if (!exists) {
      sessions.delete(uploadId);
      return NextResponse.json({ error: t("compress.errors.uploadSessionLost") }, { status: 404 });
    }
    return NextResponse.json({
      uploadId, name: s.name, size: s.size, chunks: s.chunks, chunkSize: CHUNK_SIZE,
      received: [...s.received.keys()], complete: s.complete,
    });
  }

  /* ── abort: the user stopped — free the disk right away ── */
  if (action === "abort") {
    sessions.delete(uploadId);
    await fs.unlink(s.tmpPath).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  /* ── chunk: stream the body straight to its offset (no buffering) ── */
  if (action === "chunk") {
    const index = Number(q.get("index"));
    if (!Number.isInteger(index) || index < 0 || index >= s.chunks) {
      return NextResponse.json({ error: "bad chunk index" }, { status: 400 });
    }
    const offset = index * CHUNK_SIZE;
    const expected = Math.min(CHUNK_SIZE, s.size - offset);
    if (!req.body) return NextResponse.json({ error: t("errors.upload.missingBody") }, { status: 400 });

    const handle = await fs.open(s.tmpPath, "r+");
    let written = 0;
    try {
      const reader = req.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value?.length) continue;
        if (written + value.length > expected) {
          await reader.cancel().catch(() => {});
          return NextResponse.json({ error: "chunk too large" }, { status: 400 });
        }
        await handle.write(value, 0, value.length, offset + written);
        written += value.length;
      }
    } catch (e: any) {
      // Connection cut mid-chunk → the client retries this chunk alone.
      console.warn(`[upload-chunk] chunk ${index} of "${s.name}" cut: ${e?.message ?? e}`);
      return NextResponse.json({ error: t("errors.upload.cancelled") }, { status: 499 });
    } finally {
      await handle.close();
    }
    if (written !== expected) {
      return NextResponse.json({ error: `chunk incomplete (${written}/${expected})` }, { status: 400 });
    }
    s.received.set(index, written);
    return NextResponse.json({ ok: true });
  }

  /* ── complete: every chunk must be there ── */
  if (action === "complete") {
    const missing: number[] = [];
    for (let i = 0; i < s.chunks; i++) if (!s.received.has(i)) missing.push(i);
    if (missing.length) {
      return NextResponse.json({ error: `missing chunks: ${missing.slice(0, 10).join(",")}` }, { status: 400 });
    }
    // Kept (marked complete) so a reload between the end of the upload and the
    // start of the compression can still reuse the file; swept after 1 h.
    s.complete = true;
    console.log(`[upload-chunk] complete "${s.name}" ${s.size} bytes in ${Math.round((Date.now() - s.createdAt) / 1000)}s`);
    return NextResponse.json({ uploadId, name: s.name });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

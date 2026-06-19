import os from "os";
import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

// ── Global upload-slot limiter ───────────────────────────────────────────────
// Caps the TOTAL number of uploads being written to disk at once across ALL users
// on this server process. The body is streamed straight to disk (see below), so
// per-upload RAM is already ~flat regardless of file size; this cap is the second
// line of defence — it bounds temp-disk usage + HEIC-decode CPU and degrades
// gracefully (extra uploads queue FIFO) instead of piling on during a traffic
// spike. Mirrors the encode limiter in processVideos.ts (acquire/release pair).
const GLOBAL_MAX_UPLOADS = Math.max(1, parseInt(process.env.MAX_CONCURRENT_UPLOADS ?? "6", 10));
let _activeUploads = 0;
const _uploadWaiters: Array<() => void> = [];

// Acquire a slot. If `signal` aborts while we're still WAITING in the queue
// (user pressed Stop, or the connection dropped), we remove ourselves from the
// queue and reject — so an aborted request is never handed a slot it won't use
// (which would leak the slot and slowly deadlock uploads). This abort-awareness
// is the key difference vs the encode limiter, whose work survives client
// disconnect and so can't be aborted mid-wait.
function acquireUploadSlot(signal: AbortSignal): Promise<void> {
  if (_activeUploads < GLOBAL_MAX_UPLOADS) {
    _activeUploads++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      const idx = _uploadWaiters.indexOf(waiter);
      if (idx !== -1) _uploadWaiters.splice(idx, 1); // never gets handed a slot
      reject(new DOMException("Aborted", "AbortError"));
    };
    const waiter = () => {
      signal.removeEventListener("abort", onAbort);
      resolve(); // a releasing request handed us its slot (count unchanged)
    };
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    _uploadWaiters.push(waiter);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function releaseUploadSlot(): void {
  const next = _uploadWaiters.shift();
  if (next) next();        // hand our slot straight to the next waiter (count unchanged)
  else _activeUploads--;   // nobody waiting → free the slot
}

// Guard: only alphanumeric, dash, underscore, dot, space — prevents path traversal
function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._\- ]/g, "_").slice(0, 200);
}

const HEIC_RE = /\.(heic|heif)$/i;

// HEIC magic-byte detection — covers files mislabeled by the browser
// (e.g. uploaded as application/octet-stream). The HEIC/HEIF brand
// identifier ("ftyp" + heic/heix/mif1/msf1/heim/heis/hevc/...) sits
// in bytes 4-12 of the container.
function looksLikeHeic(head: Buffer): boolean {
  if (head.length < 12) return false;
  if (head.slice(4, 8).toString("ascii") !== "ftyp") return false;
  const brand = head.slice(8, 12).toString("ascii");
  return /^(heic|heix|heim|heis|hevc|hevx|mif1|msf1|avif)$/.test(brand);
}

/**
 * Convert a HEIC/HEIF buffer to JPEG using libheif-js (via heic-convert).
 *
 * Why server-side and not heic2any in the browser:
 *  • heic2any drops the ICC profile and mishandles the Display P3 → sRGB
 *    transform → output JPEG looks brighter / more saturated than the
 *    iPhone original.
 *  • heic-convert (Node) uses a newer libheif-js build, preserves EXIF
 *    and the embedded color profile, and tone-maps HDR gain maps cleanly.
 *  • libheif-js bundles libde265 in WASM, so no Railway system deps.
 */
async function convertHeicBufferToJpeg(buf: Buffer): Promise<Buffer> {
  // Dynamic import — heic-convert pulls a ~3 MB WASM blob; we only want
  // it loaded when we actually have a HEIC to process.
  const { default: convert } = await import("heic-convert");
  const out = await convert({
    buffer: buf,
    format: "JPEG",
    quality: 0.95, // near-lossless; sharp re-encodes downstream anyway
  });
  return Buffer.from(out);
}

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = req.body;
  if (!body) {
    return NextResponse.json({ error: "Corps de la requête manquant" }, { status: 400 });
  }

  const rawFileName = safeName(req.nextUrl.searchParams.get("fileName") || "upload.bin");

  // Bounded concurrency: wait for a global upload slot. An abort while waiting is
  // handled inside acquireUploadSlot → we never take (and never leak) a slot.
  try {
    await acquireUploadSlot(req.signal);
  } catch {
    // Client aborted before we started — nothing written, nothing to release.
    return NextResponse.json({ error: "Envoi annulé" }, { status: 499 });
  }

  // A slot is now held → it MUST be released exactly once, in the finally below.
  let tmpPath = "";
  let wrote = false; // did we create a temp file that may need cleanup?
  try {
    // Sanitise the extension so spaces/odd chars (e.g. "clip. mp4") can't break
    // the downstream ^duup_direct_[\w.-]+$ validation.
    let ext = (path.extname(rawFileName) || ".bin").replace(/[^\w.-]/g, "");
    if (!ext || ext === ".") ext = ".bin";
    const baseId = `duup_direct_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    tmpPath = path.join(os.tmpdir(), `${baseId}${ext}`);
    let uploadId = `${baseId}${ext}`;

    // ── Stream the body straight to disk, chunk by chunk ─────────────────────
    // We deliberately use body.getReader() and NOT Readable.fromWeb(body):
    // fromWeb crashes under concurrent uploads (Node TransformStream bug
    // "controller[kState].transformAlgorithm is not a function"). Awaiting each
    // write before the next read applies backpressure, so peak RAM per upload is
    // ~one chunk — independent of file size (up to the 5 GB client cap). This is
    // what removes the OOM risk: a 5 GB upload no longer means 5 GB of RAM.
    const reader = body.getReader();
    const handle = await fs.open(tmpPath, "w");
    wrote = true;
    let received = 0;
    let head = Buffer.alloc(0); // first ≤12 bytes, kept for HEIC magic sniffing
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.length) {
          await handle.write(value); // backpressure: one chunk at a time
          received += value.length;
          if (head.length < 12) {
            const need = 12 - head.length;
            head = Buffer.concat([head, Buffer.from(value.subarray(0, need))]);
          }
        }
      }
    } finally {
      await handle.close();
    }

    if (received === 0) {
      await fs.unlink(tmpPath).catch(() => {});
      return NextResponse.json(
        { error: "Fichier reçu vide (0 octet) — vérifiez la taille du fichier ou la connexion." },
        { status: 400 }
      );
    }

    console.log(
      `[upload-direct] received ${received} bytes for "${rawFileName}" ` +
      `(active=${_activeUploads} waiting=${_uploadWaiters.length})`
    );

    // HEIC → JPEG conversion (images only, light → safe to read the file back
    // into memory for the WASM decoder; videos never reach this branch).
    let finalName = rawFileName;
    if (HEIC_RE.test(rawFileName) || looksLikeHeic(head)) {
      const t0 = Date.now();
      try {
        const heicBuf = await fs.readFile(tmpPath);
        const jpeg = await convertHeicBufferToJpeg(heicBuf);
        finalName = rawFileName.replace(HEIC_RE, "") + ".jpg";
        const jpgId = `${baseId}.jpg`;
        const jpgPath = path.join(os.tmpdir(), jpgId);
        await fs.writeFile(jpgPath, jpeg);
        await fs.unlink(tmpPath).catch(() => {}); // drop the original HEIC temp
        tmpPath = jpgPath;
        uploadId = jpgId;
        console.log(`[upload-direct] HEIC→JPEG done for "${rawFileName}" in ${Date.now() - t0}ms (${jpeg.length} bytes)`);
      } catch (heicErr: any) {
        console.error(`[upload-direct] HEIC conversion failed for "${rawFileName}":`, heicErr?.message);
        await fs.unlink(tmpPath).catch(() => {});
        return NextResponse.json(
          { error: `Impossible de décoder le HEIC "${rawFileName}" — convertissez-le en JPEG manuellement.` },
          { status: 422 }
        );
      }
    }

    return NextResponse.json({ uploadId, name: finalName });
  } catch (e: any) {
    // Aborted mid-stream, or a disk error → drop any partial temp file so we
    // never leave a truncated source for the encoder to choke on.
    if (wrote && tmpPath) await fs.unlink(tmpPath).catch(() => {});
    if (e?.name === "AbortError" || req.signal.aborted) {
      return NextResponse.json({ error: "Envoi annulé" }, { status: 499 });
    }
    console.error(`[upload-direct] write failed for "${rawFileName}":`, e?.message);
    return NextResponse.json({ error: `Erreur écriture : ${e?.message ?? e}` }, { status: 500 });
  } finally {
    releaseUploadSlot();
  }
}

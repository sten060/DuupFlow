import sharp from "sharp";

// ── Image-processing limiter (shared) ────────────────────────────────────────
// The video pipeline already caps concurrent ffmpeg encodes; image processing
// (sharp/libvips) had no equivalent guard, so a burst of concurrent image
// duplications could decode many full-resolution images at once and OOM the
// single Railway container. This module adds the same kind of protection:
//
//   1. sharp.concurrency(N) — caps libvips' internal thread pool so concurrent
//      sharp operations don't oversubscribe the CPU.
//   2. A global semaphore — caps how many image operations run at once across
//      ALL requests in this process; the surplus queues (FIFO) instead of
//      piling on. Each decode holds a full image in RAM, so this bounds memory.

sharp.concurrency(Math.max(1, parseInt(process.env.SHARP_CONCURRENCY ?? "2", 10)));

const GLOBAL_MAX_IMAGE_OPS = Math.max(1, parseInt(process.env.MAX_CONCURRENT_IMAGE_OPS ?? "4", 10));
let _active = 0;
const _waiters: Array<() => void> = [];

function acquire(): Promise<void> {
  if (_active < GLOBAL_MAX_IMAGE_OPS) { _active++; return Promise.resolve(); }
  return new Promise<void>((resolve) => _waiters.push(resolve));
}

function release(): void {
  const next = _waiters.shift();
  if (next) next();      // hand the slot to the next waiter (count unchanged)
  else _active--;        // nobody waiting → free the slot
}

/** Run an image operation under the global concurrency cap. */
export async function runImageOp<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

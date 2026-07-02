// In-memory rate limiter for the DuupFlow API (per API key). A fixed-window
// counter — simple and enough for a single Railway instance. If the API ever
// scales to multiple instances, swap the Map for Redis (Upstash) keeping the
// same interface.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

/** Drop expired buckets occasionally so the Map can't grow unbounded. */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

export type RateResult = { allowed: boolean; limit: number; remaining: number; resetAt: number; retryAfter: number };

/**
 * Count one hit against `id` in a `windowMs` window capped at `limit`.
 * Returns whether it's allowed plus headers data.
 */
export function checkRateLimit(id: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);

  let b = buckets.get(id);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(id, b);
  }
  b.count++;

  const remaining = Math.max(0, limit - b.count);
  const retryAfter = Math.max(0, Math.ceil((b.resetAt - now) / 1000));
  return { allowed: b.count <= limit, limit, remaining, resetAt: b.resetAt, retryAfter };
}

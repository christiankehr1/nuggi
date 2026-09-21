import { LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS } from "@/config";

/**
 * Tiny in-memory sliding-window rate limiter.
 *
 * Good enough for a handful of families on Vercel: each warm function
 * instance keeps its own counter, so the effective limit is "10 per instance
 * per 15 min" — still enough to make brute-forcing a 7-character code
 * (31^7 ≈ 27 billion combinations) hopeless. See DECISIONS.md.
 */
interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(
  key: string,
  now: number = Date.now(),
  max: number = LOGIN_MAX_ATTEMPTS,
  windowMs: number = LOGIN_WINDOW_MS,
): RateLimitResult {
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= max) {
    const oldest = bucket.hits[0] ?? now;
    buckets.set(key, bucket);
    return { ok: false, remaining: 0, retryAfterMs: windowMs - (now - oldest) };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  // opportunistic cleanup so the map does not grow forever
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.hits.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }
  return { ok: true, remaining: max - bucket.hits.length, retryAfterMs: 0 };
}

/** Reset a key (e.g. after a successful login). Exported for tests. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

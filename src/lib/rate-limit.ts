// Simple in-memory sliding-window rate limiter (per IP + route bucket).
// Suitable for single-instance deployments; swap for Redis in a multi-instance setup.

type Bucket = { hits: number[]; };

const buckets = new Map<string, Bucket>();

// Periodic cleanup to avoid memory growth
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  const cutoff = now - 15 * 60_000;
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => t > cutoff);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

/**
 * Returns true when the request is allowed.
 * @param key unique bucket key, e.g. `contact:1.2.3.4`
 * @param limit max hits per window
 * @param windowMs window length in ms
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) return false;
  bucket.hits.push(now);
  return true;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

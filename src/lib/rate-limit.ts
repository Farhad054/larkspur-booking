type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** In-memory fixed-window limiter (per server instance; fine for a demo, use Redis for hard limits). */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
) {
  if (buckets.size > 5000)
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count += 1;
  return b.count > limit
    ? { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) }
    : { ok: true, retryAfter: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}

/**
 * In-memory token-bucket rate limiter. Keyed by an arbitrary identifier
 * (e.g. `login:${email}`). Resets on process restart and does not share
 * state across instances — an accepted tradeoff for a single-instance,
 * single-SQLite-file deployment (see lib/db.ts).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count += 1;
  return true;
}

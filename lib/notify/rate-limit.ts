/**
 * Sliding-window limit shared by all callers. In memory is enough because the main site runs
 * as a single instance (DESIGN.md §8). Returns true if the request may proceed.
 */
export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
}: {
  limit: number;
  windowMs: number;
  now?: () => number;
}) {
  let hits: number[] = [];

  return function allow(): boolean {
    const time = now();
    hits = hits.filter((hit) => time - hit < windowMs);
    if (hits.length >= limit) return false;
    hits.push(time);
    return true;
  };
}

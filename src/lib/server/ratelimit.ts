// Rate limiter in-memory (per-isolate). Cukup untuk MVP.
// Untuk akurasi lintas-colo, nanti bisa diganti Durable Objects / KV.

const buckets = new Map<string, number[]>();

export function isRateLimited(key: string, max = 5, windowMs = 60000): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    buckets.set(key, arr);
    return true;
  }
  arr.push(now);
  buckets.set(key, arr);
  return false;
}
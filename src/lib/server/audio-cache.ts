import "server-only";

import { createHash } from "node:crypto";

const MAX_ENTRIES = 200;
const cache = new Map<string, Buffer>();

export function cacheKey(parts: Array<string | number>) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function getCached(key: string) {
  const hit = cache.get(key);
  if (hit) {
    // Refresh recency so the map behaves as an LRU.
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit;
}

export function setCached(key: string, audio: Buffer) {
  cache.set(key, audio);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

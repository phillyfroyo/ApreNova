// Simple in-memory prefetch cache for streaming reader data
// Used to warm up page content before navigation so the reader loads instantly

const cache = new Map<string, { data: any; timestamp: number }>();
const TTL = 60_000; // 60 seconds - content may update during processing

export function setPrefetchData(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

export function getPrefetchData(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL) {
    cache.delete(key);
    return null;
  }
  cache.delete(key); // One-time use — don't serve stale data on re-fetch
  return entry.data;
}

export function hasPrefetchData(key: string): boolean {
  const entry = cache.get(key);
  if (!entry) return false;
  if (Date.now() - entry.timestamp > TTL) {
    cache.delete(key);
    return false;
  }
  return true;
}

export function readStreamCacheKey(storyId: string, level: string, chapter: number, page: number) {
  return `read-stream:${storyId}:${level}:${chapter}:${page}`;
}

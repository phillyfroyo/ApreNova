// src/components/unified-translator/translationCache.ts
//
// Per-device localStorage cache for word/phrase translation results.
//
// Why: the server-side caches are in-memory Maps that die on restart/deploy and
// don't exist across serverless instances, so "translate the same word twice"
// was only sometimes instant. This makes repeats reliably instant for the same
// student on the same device (it does NOT share across users — that's the
// future DB cache's job).
//
// CORRECTNESS: the key MUST include the sentence + level + direction, because
// the same word translates differently in different contexts. Keying on the
// bare word would return wrong translations.

const PREFIX = "tcache:";
const INDEX_KEY = "tcache:__index"; // ordered list of keys, for FIFO eviction
const MAX_ENTRIES = 500; // bound size; ~500 entries is well under the ~5MB limit

// Bump this whenever the translation OUTPUT SHAPE or prompt changes in a way
// that should invalidate every device's cached results (e.g. new card fields,
// reworked prompts). Old-version keys simply stop matching and age out via FIFO.
const CACHE_VERSION = "v1";

/** Build a context-aware cache key. Mirrors the server's keying shape. */
export function buildTranslationKey(
  kind: "word" | "phrase",
  text: string,
  sentence: string,
  level: string | number,
  lang: string,
): string {
  const t = text.toLowerCase();
  const s = (sentence || "").toLowerCase().slice(0, 100);
  return `${PREFIX}${CACHE_VERSION}|${kind}|${t}|${s}|${level ?? 2}|${lang}`;
}

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(keys: string[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(keys));
  } catch {
    /* ignore quota/availability errors */
  }
}

/** Returns the cached result for a key, or null on miss / unavailable storage. */
export function getCachedTranslation<T = unknown>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null; // private mode, disabled storage, corrupt JSON — treat as miss
  }
}

/** Stores a result, evicting the oldest entries past MAX_ENTRIES (FIFO). */
export function setCachedTranslation(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return; // out of quota / unavailable — caching is best-effort, skip silently
  }

  // Maintain the FIFO index for bounded growth.
  const index = readIndex().filter((k) => k !== key);
  index.push(key);
  while (index.length > MAX_ENTRIES) {
    const oldest = index.shift();
    if (oldest) {
      try {
        localStorage.removeItem(oldest);
      } catch {
        /* ignore */
      }
    }
  }
  writeIndex(index);
}

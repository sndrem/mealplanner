const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry<Value> {
  expiresAt: number;
  value: Value;
}

const searchCache = new Map<string, CacheEntry<unknown>>();
const bulkCache = new Map<string, CacheEntry<unknown>>();

function readCacheEntry<Value>(
  cache: Map<string, CacheEntry<unknown>>,
  key: string,
): Value | undefined {
  const entry = cache.get(key);

  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }

  return entry.value as Value;
}

function writeCacheEntry<Value>(
  cache: Map<string, CacheEntry<unknown>>,
  key: string,
  value: Value,
  ttlMs = DEFAULT_CACHE_TTL_MS,
) {
  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
}

export function getCachedSearchResult<T>(searchTerm: string) {
  return readCacheEntry<T>(searchCache, `search:${searchTerm}`);
}

export function setCachedSearchResult<T>(
  searchTerm: string,
  value: T,
  ttlMs?: number,
) {
  writeCacheEntry(searchCache, `search:${searchTerm}`, value, ttlMs);
}

export function getCachedBulkPriceResult<T>(ean: string) {
  return readCacheEntry<T>(bulkCache, `bulk:${ean}`);
}

export function setCachedBulkPriceResult<T>(
  ean: string,
  value: T,
  ttlMs?: number,
) {
  writeCacheEntry(bulkCache, `bulk:${ean}`, value, ttlMs);
}

export function resetKassalappCacheForTests() {
  searchCache.clear();
  bulkCache.clear();
}

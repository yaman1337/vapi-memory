export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

export class LRUCache<K = string, V = any> {
  private cache: Map<K, CacheEntry<V>>;
  private maxSize: number;
  private currentSize: number;

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.currentSize = 0;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (entry) {
      // Update hit count and move to end (most recently used)
      entry.hits++;
      entry.timestamp = Date.now();
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.value;
    }

    return undefined;
  }

  set(key: K, value: V): void {
    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.currentSize--;
    }

    // Evict least recently used if at capacity
    if (this.currentSize >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
        this.currentSize--;
      }
    }

    // Add new entry
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0,
    });
    this.currentSize++;
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.currentSize--;
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  size(): number {
    return this.currentSize;
  }

  entries(): Array<[K, CacheEntry<V>]> {
    return Array.from(this.cache.entries());
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  values(): V[] {
    return Array.from(this.cache.values()).map(e => e.value);
  }

  // Cleanup expired entries
  cleanup(maxAge: number): number {
    const now = Date.now();
    const cutoffTime = now - maxAge;
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < cutoffTime) {
        this.delete(key);
        removed++;
      }
    }

    return removed;
  }

  // Get cache statistics
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: K; hits: number; age: number }>;
  } {
    const entries = this.entries();
    const totalHits = entries.reduce((sum, [, e]) => sum + e.hits, 0);
    const totalAccess = totalHits + (this.maxSize - this.cache.size);

    return {
      size: this.currentSize,
      maxSize: this.maxSize,
      hitRate: totalAccess > 0 ? totalHits / totalAccess : 0,
      entries: entries.map(([key, entry]) => ({
        key,
        hits: entry.hits,
        age: Date.now() - entry.timestamp,
      })),
    };
  }
}

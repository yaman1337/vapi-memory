import { test, expect, describe, beforeEach } from 'bun:test';
import { LRUCache, type CacheEntry } from '../src/utils/cache';

describe('LRUCache', () => {
  let cache: LRUCache<string, number>;

  beforeEach(() => {
    cache = new LRUCache<string, number>(3);
  });

  test('should store and retrieve values', () => {
    cache.set('key1', 1);
    cache.set('key2', 2);

    expect(cache.get('key1')).toBe(1);
    expect(cache.get('key2')).toBe(2);
  });

  test('should return undefined for missing key', () => {
    cache.set('key1', 1);
    expect(cache.get('missing')).toBeUndefined();
  });

  test('should evict least recently used when at capacity', () => {
    cache.set('key1', 1);
    cache.set('key2', 2);
    cache.set('key3', 3);
    cache.set('key4', 4); // This should evict key1

    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBe(2);
    expect(cache.get('key3')).toBe(3);
    expect(cache.get('key4')).toBe(4);
  });

  test('should promote accessed key to most recently used', () => {
    cache.set('key1', 1);
    cache.set('key2', 2);
    cache.set('key3', 3);

    cache.get('key1'); // Access key1 to promote it

    cache.set('key4', 4); // This should evict key2 (LRU)

    expect(cache.get('key1')).toBe(1); // Should still exist
    expect(cache.get('key2')).toBeUndefined(); // Should be evicted
    expect(cache.get('key3')).toBe(3);
    expect(cache.get('key4')).toBe(4);
  });

  test('should update existing key', () => {
    cache.set('key1', 1);
    cache.set('key1', 2);

    expect(cache.get('key1')).toBe(2);
    expect(cache.size()).toBe(1);
  });

  test('should delete key', () => {
    cache.set('key1', 1);
    cache.set('key2', 2);

    const deleted = cache.delete('key1');

    expect(deleted).toBe(true);
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBe(2);
    expect(cache.size()).toBe(1);
  });

  test('should return false when deleting non-existent key', () => {
    cache.set('key1', 1);
    const deleted = cache.delete('missing');

    expect(deleted).toBe(false);
    expect(cache.size()).toBe(1);
  });

  test('should clear all entries', () => {
    cache.set('key1', 1);
    cache.set('key2', 2);

    cache.clear();

    expect(cache.size()).toBe(0);
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBeUndefined();
  });

  test('should track hit count', () => {
    cache.set('key1', 1);
    cache.set('key2', 2);

    cache.get('key1');
    cache.get('key1');
    cache.get('key2'); // This will hit (we set it above)

    const stats = cache.getStats();

    expect(stats.entries.find(e => e.key === 'key1')?.hits).toBe(2);
    expect(stats.entries.find(e => e.key === 'key2')?.hits).toBe(1);
  });

  test('should cleanup expired entries', () => {
    cache.set('key1', 1);
    cache.set('key2', 2);

    // Manually set timestamps to simulate age
    const entries = cache.entries();
    const now = Date.now();
    entries.forEach(([key, entry]) => {
      if (key === 'key1') {
        (entry as any).timestamp = now - 10000; // 10 seconds ago
      }
    });

    const removed = cache.cleanup(5000); // Cleanup entries older than 5 seconds

    expect(removed).toBe(1);
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBe(2);
  });

  test('should calculate hit rate correctly', () => {
    cache.set('key1', 1);
    cache.set('key2', 2);

    cache.get('key1'); // Hit
    cache.get('key1'); // Hit
    cache.get('key3'); // Miss
    cache.get('key4'); // Miss

    const stats = cache.getStats();

    expect(stats.hitRate).toBeGreaterThan(0);
    expect(stats.hitRate).toBeLessThan(1);
  });
});

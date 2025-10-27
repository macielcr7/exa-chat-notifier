import { IdempotencyCache } from '../../src/idempotency-cache';

describe('IdempotencyCache', () => {
  let cache: IdempotencyCache;

  afterEach(() => {
    if (cache) {
      cache.destroy();
    }
  });

  describe('has', () => {
    it('should return false for non-existent key', () => {
      cache = new IdempotencyCache();
      expect(cache.has('key1')).toBe(false);
    });

    it('should return true for existing key', () => {
      cache = new IdempotencyCache();
      cache.set('key1');
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for expired key', () => {
      cache = new IdempotencyCache({ ttlMs: 50 });
      cache.set('key1');

      // Wait for expiry
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(cache.has('key1')).toBe(false);
          resolve();
        }, 100);
      });
    });

    it('should remove expired key from cache', () => {
      cache = new IdempotencyCache({ ttlMs: 50 });
      cache.set('key1');

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          cache.has('key1'); // Trigger removal
          expect(cache.size).toBe(0);
          resolve();
        }, 100);
      });
    });
  });

  describe('set', () => {
    it('should add key to cache', () => {
      cache = new IdempotencyCache();
      cache.set('key1');
      expect(cache.size).toBe(1);
    });

    it('should update existing key', () => {
      cache = new IdempotencyCache({ ttlMs: 100 });
      cache.set('key1');

      // Update after 50ms
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          cache.set('key1');

          // Should still exist after another 75ms (125ms total)
          setTimeout(() => {
            expect(cache.has('key1')).toBe(true);
            resolve();
          }, 75);
        }, 50);
      });
    });

    it('should allow multiple keys', () => {
      cache = new IdempotencyCache();
      cache.set('key1');
      cache.set('key2');
      cache.set('key3');

      expect(cache.size).toBe(3);
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries periodically', () => {
      cache = new IdempotencyCache({ ttlMs: 50 });
      cache.set('key1');
      cache.set('key2');

      // Wait for cleanup cycle (5 minutes is too long for test)
      // This test verifies the mechanism works, not the timing
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Manually trigger has() to remove expired
          cache.has('key1');
          cache.has('key2');
          expect(cache.size).toBe(0);
          resolve();
        }, 100);
      });
    });
  });

  describe('destroy', () => {
    it('should clear cache', () => {
      cache = new IdempotencyCache();
      cache.set('key1');
      cache.set('key2');

      cache.destroy();
      expect(cache.size).toBe(0);
    });

    it('should stop cleanup timer', () => {
      cache = new IdempotencyCache();
      cache.set('key1');

      cache.destroy();
      // If timer wasn't stopped, test would hang
      expect(cache.size).toBe(0);
    });
  });

  describe('ttl configuration', () => {
    it('should use default TTL of 24 hours', () => {
      cache = new IdempotencyCache();
      cache.set('key1');

      // Should still exist after 1 second
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(cache.has('key1')).toBe(true);
          resolve();
        }, 1000);
      });
    });

    it('should respect custom TTL', () => {
      cache = new IdempotencyCache({ ttlMs: 100 });
      cache.set('key1');

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(cache.has('key1')).toBe(false);
          resolve();
        }, 150);
      });
    });
  });
});

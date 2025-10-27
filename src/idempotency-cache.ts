/**
 * Idempotency Cache
 *
 * Prevents duplicate notifications by caching sent event IDs with TTL.
 */

export interface IdempotencyCacheOptions {
  ttlMs?: number;
}

interface CacheEntry {
  expiresAt: number;
}

export class IdempotencyCache {
  private readonly cache: Map<string, CacheEntry>;
  private readonly ttlMs: number;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: IdempotencyCacheOptions = {}) {
    this.cache = new Map();
    this.ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1000; // Default: 24 hours

    // Start cleanup timer (every 5 minutes)
    this.startCleanup();
  }

  /**
   * Check if key exists in cache (not expired)
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Add key to cache with TTL
   */
  set(key: string): void {
    this.cache.set(key, {
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    // Cleanup every 5 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    // Don't block Node.js exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop cleanup timer (for testing)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cache.clear();
  }

  /**
   * Get cache size (for testing)
   */
  get size(): number {
    return this.cache.size;
  }
}

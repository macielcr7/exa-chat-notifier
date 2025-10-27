/**
 * Batch Manager
 *
 * Manages batching of notifications for optimized delivery.
 * Groups multiple notifications and sends them together based on:
 * - Batch size (number of messages)
 * - Time interval (milliseconds)
 * 
 * Benefits:
 * - Reduces HTTP overhead
 * - Optimizes rate limiting
 * - Better performance for high-volume scenarios
 */

export interface BatchItem<TPayload> {
  payload: TPayload;
  webhookName?: string;
}

export interface BatchManagerOptions {
  /** Maximum batch size before auto-flush */
  size: number;
  /** Time interval (ms) before auto-flush */
  intervalMs: number;
  /** Callback to execute when flushing batch */
  onFlush: (batch: Array<BatchItem<unknown>>) => Promise<void>;
  /** Whether to flush pending items on destroy */
  flushOnDestroy?: boolean;
}

export class BatchManager<TPayload> {
  private queue: Array<BatchItem<TPayload>> = [];
  private timer?: NodeJS.Timeout;
  private readonly options: Required<BatchManagerOptions>;
  private flushing = false;

  constructor(options: BatchManagerOptions) {
    this.options = {
      ...options,
      flushOnDestroy: options.flushOnDestroy ?? true,
    };

    // Start interval timer
    this.startTimer();
  }

  /**
   * Add item to batch queue
   */
  add(payload: TPayload, webhookName?: string): void {
    this.queue.push({ payload, webhookName });

    // Auto-flush if batch size reached
    if (this.queue.length >= this.options.size) {
      // Use setImmediate to avoid blocking
      setImmediate(() => {
        void this.flush();
      });
    }
  }

  /**
   * Force flush of pending items
   */
  async flush(): Promise<void> {
    // Prevent concurrent flushes
    if (this.flushing || this.queue.length === 0) {
      return;
    }

    this.flushing = true;

    try {
      // Take all items from queue
      const batch = this.queue.splice(0, this.queue.length);

      // Send batch
      await this.options.onFlush(batch as Array<BatchItem<unknown>>);
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if currently flushing
   */
  isFlushing(): boolean {
    return this.flushing;
  }

  /**
   * Start interval timer for auto-flush
   */
  private startTimer(): void {
    this.timer = setInterval(() => {
      if (this.queue.length > 0) {
        void this.flush();
      }
    }, this.options.intervalMs);

    // Don't keep process alive just for timer
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Stop timer and cleanup resources
   */
  async destroy(): Promise<void> {
    // Stop timer
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    // Flush pending items if configured
    if (this.options.flushOnDestroy && this.queue.length > 0) {
      await this.flush();
    } else {
      // Just clear queue
      this.queue = [];
    }
  }
}

/**
 * Main Notifier Implementation
 *
 * Orchestrates all components: config, schema, card builder, idempotency, HTTP client
 */

import { ConfigManager } from './config';
import { CardBuilder } from './card-builder';
import { IdempotencyCache } from './idempotency-cache';
import { HttpClient } from './http-client';
import { BatchManager, type BatchItem } from './batch-manager';
import type { EventSchema } from './schemas/base-schema';
import type { Notifier, NotifierOptions } from './types';

export class NotifierImpl<TPayload, TEvent extends string = string>
  implements Notifier<TPayload>
{
  private readonly config: ConfigManager;
  private readonly cardBuilder: CardBuilder<TPayload, TEvent>;
  private readonly cache?: IdempotencyCache;
  private readonly httpClient: HttpClient;
  private readonly batchManager?: BatchManager<TPayload>;
  private readonly schema: EventSchema<TPayload, TEvent>;
  private readonly level: 'all' | 'important';

  constructor(
    schema: EventSchema<TPayload, TEvent>,
    options: NotifierOptions<TPayload> = {},
  ) {
    this.schema = schema;
    this.level = options.level ?? 'all';

    // Initialize components
    this.config = new ConfigManager(options.webhooks);
    
    this.cardBuilder = new CardBuilder(schema, {
      maxMessage: options.maxMessage ?? 4000,
    });

    // Idempotency cache (optional)
    if (options.idempotencyEnabled !== false) {
      this.cache = new IdempotencyCache({
        ttlMs: options.idempotencyTtlMs ?? 24 * 60 * 60 * 1000,
      });
    }

    // HTTP client with retry
    this.httpClient = new HttpClient({
      timeoutMs: options.timeoutMs ?? 10000,
      maxRetries: options.retryMax ?? 3,
    });

    // Batch manager (optional)
    const batchEnabled = options.batchEnabled ?? process.env.CHAT_BATCH_ENABLED === 'true';
    if (batchEnabled) {
      const batchSize = options.batchSize ?? (Number(process.env.CHAT_BATCH_SIZE) || 10);
      const batchIntervalMs = options.batchIntervalMs ?? (Number(process.env.CHAT_BATCH_INTERVAL_MS) || 5000);
      const flushOnDestroy = options.batchFlushOnDestroy ?? process.env.CHAT_BATCH_FLUSH_ON_EXIT !== 'false';

      this.batchManager = new BatchManager<TPayload>({
        size: batchSize,
        intervalMs: batchIntervalMs,
        flushOnDestroy,
        onFlush: async (batch) => {
          await this.sendBatch(batch as Array<BatchItem<TPayload>>);
        },
      });
    }
  }

  /**
   * Send notification
   */
  async notify(payload: TPayload, webhookName?: string): Promise<void> {
    // Check importance level filtering
    if (this.level === 'important' && this.schema.isImportantEvent) {
      const event = this.extractEvent(payload);
      if (event && !this.schema.isImportantEvent(event)) {
        // Skip non-important event
        return;
      }
    }

    // Check idempotency
    if (this.cache && this.schema.getIdempotencyKey) {
      const key = this.schema.getIdempotencyKey(payload);
      if (key && this.cache.has(key)) {
        // Already sent
        return;
      }
    }

    // If batching enabled, add to queue instead of sending immediately
    if (this.batchManager) {
      this.batchManager.add(payload, webhookName);
      
      // Mark as queued in cache (to prevent duplicates in queue)
      if (this.cache && this.schema.getIdempotencyKey) {
        const key = this.schema.getIdempotencyKey(payload);
        if (key) {
          this.cache.set(key);
        }
      }
      
      return;
    }

    // Immediate send (non-batch mode)
    await this.sendSingle(payload, webhookName);
  }

  /**
   * Send single notification (non-batch mode)
   */
  private async sendSingle(payload: TPayload, webhookName?: string): Promise<void> {
    // Build card
    const card = this.cardBuilder.buildCard(payload);

    // Determine webhook
    const resolvedWebhookName = webhookName ?? this.schema.getWebhookName?.(payload);
    const webhookUrl = this.config.getWebhook(resolvedWebhookName);

    // Send to Google Chat
    await this.httpClient.post(webhookUrl, card);

    // Mark as sent in cache
    if (this.cache && this.schema.getIdempotencyKey) {
      const key = this.schema.getIdempotencyKey(payload);
      if (key) {
        this.cache.set(key);
      }
    }
  }

  /**
   * Send batch of notifications
   */
  private async sendBatch(batch: Array<BatchItem<TPayload>>): Promise<void> {
    // Send all items in parallel (with individual error handling)
    const promises = batch.map(async (item) => {
      try {
        await this.sendSingle(item.payload, item.webhookName);
      } catch (error) {
        // Log error but don't fail entire batch
        console.error('Failed to send notification in batch:', error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Force flush of pending batch items
   * Useful for graceful shutdown
   */
  async flush(): Promise<void> {
    if (this.batchManager) {
      await this.batchManager.flush();
    }
  }

  /**
   * Extract event from payload (helper)
   */
  private extractEvent(payload: TPayload): TEvent | undefined {
    // Try common event field names
    const p = payload as Record<string, unknown>;
    return (p.event ?? p.type ?? p.status) as TEvent | undefined;
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    // Flush batch manager first (if enabled)
    if (this.batchManager) {
      await this.batchManager.destroy();
    }

    // Then cleanup cache
    if (this.cache) {
      this.cache.destroy();
    }
  }
}

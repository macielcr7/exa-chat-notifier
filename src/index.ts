/**
 * Public API exports
 */

export { NotifierImpl } from './notifier';
export { TombamentoSchema } from './schemas/tombamento-schema';
export type { EventSchema } from './schemas/base-schema';
export type {
  Notifier,
  NotifierOptions,
  TombamentoPayload,
  TombamentoEvent,
  TombamentoNotifier,
  CardPayload,
} from './types';

// Factory functions
import { NotifierImpl } from './notifier';
import { TombamentoSchema } from './schemas/tombamento-schema';
import type {
  Notifier,
  NotifierOptions,
  TombamentoPayload,
  TombamentoNotifier,
} from './types';
import type { EventSchema } from './schemas/base-schema';

/**
 * Create a generic notifier with custom schema
 */
export function createNotifier<TPayload, TEvent extends string = string>(
  schema: EventSchema<TPayload, TEvent>,
  options?: NotifierOptions<TPayload>,
): Notifier<TPayload> {
  return new NotifierImpl(schema, options);
}

/**
 * Create a tombamento notifier with convenience methods
 */
export function createTombamentoNotifier(
  options?: NotifierOptions<TombamentoPayload>,
): TombamentoNotifier {
  const schema = new TombamentoSchema();
  const notifier = new NotifierImpl(schema, options);

  return {
    notify: (payload, webhookName) => notifier.notify(payload, webhookName),
    flush: () => notifier.flush(),
    destroy: () => notifier.destroy(),

    // Convenience methods
    uploaded: (payload) =>
      notifier.notify({ ...payload, event: 'UPLOADED' }),
    processing: (payload) =>
      notifier.notify({ ...payload, event: 'PROCESSING' }),
    invalidSchema: (payload) =>
      notifier.notify({ ...payload, event: 'INVALID_SCHEMA' }),
    processed: (payload) =>
      notifier.notify({ ...payload, event: 'PROCESSED' }),
    failed: (payload) =>
      notifier.notify({ ...payload, event: 'FAILED' }),
    reportGenerated: (payload) =>
      notifier.notify({ ...payload, event: 'REPORT_GENERATED' }),
  };
}

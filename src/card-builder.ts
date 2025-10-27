/**
 * Card Builder
 *
 * Builds Google Chat card payloads with optional threading support.
 */

import type { EventSchema } from './schemas/base-schema';

export interface CardBuilderOptions {
  maxMessage?: number;
}

interface CardPayload {
  cardsV2: Array<{
    cardId: string;
    card: unknown;
  }>;
}

export class CardBuilder<TPayload, TEvent extends string = string> {
  constructor(
    private readonly schema: EventSchema<TPayload, TEvent>,
    private readonly options: CardBuilderOptions = {},
  ) {}

  /**
   * Build Google Chat card for an event
   */
  buildCard(payload: TPayload): CardPayload {
    const maxMessage = this.options.maxMessage ?? 4000;
    const card = this.schema.buildCard(payload, { maxMessage });

    return card;
  }
}

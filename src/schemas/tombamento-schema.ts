import { EventSchema } from './base-schema';
import { TombamentoPayload, TombamentoEvent, CardPayload } from '../types';
import { sha1 } from '../utils/crypto';
import { truncateMessage } from '../utils/truncate';

/**
 * Schema padrão para eventos de tombamento de arquivos
 * Implementa cards personalizados com emojis e formatação específica
 */
export class TombamentoSchema implements EventSchema<TombamentoPayload, TombamentoEvent> {
  readonly name = 'tombamento';

  private readonly EVENT_CONFIG: Record<
    TombamentoEvent,
    { emoji: string; color: string }
  > = {
    UPLOADED: { emoji: '📥', color: '#4285F4' },
    PROCESSING: { emoji: '⚙️', color: '#FBBC04' },
    INVALID_SCHEMA: { emoji: '❌', color: '#EA4335' },
    PROCESSED: { emoji: '✅', color: '#34A853' },
    FAILED: { emoji: '🔥', color: '#EA4335' },
    REPORT_GENERATED: { emoji: '📄', color: '#34A853' },
  };

  buildCard(payload: TombamentoPayload, config: { maxMessage: number }): CardPayload {
    const eventConfig = this.EVENT_CONFIG[payload.event];
    const message = payload.message
      ? truncateMessage(payload.message, config.maxMessage)
      : undefined;

    const widgets = [
      this.buildTextField('Parceiro', payload.partner),
      this.buildTextField('Arquivo', payload.object),
      this.buildTextField('Etapa', payload.stage || payload.event),
      this.buildTextField('Data/Hora', payload.ts || new Date().toISOString()),
    ];

    // Adicionar contadores se existirem
    if (payload.counts) {
      widgets.push(this.buildCountsField(payload.counts));
    }

    // Adicionar mensagem se existir
    if (message) {
      widgets.push(this.buildTextField('Mensagem', message));
    }

    return {
      cardsV2: [
        {
          cardId: `tombamento-${Date.now()}`,
          card: {
            header: {
              title: `${eventConfig.emoji} ${payload.event}`,
              subtitle: payload.partner,
            },
            sections: [{ widgets }],
          },
        },
      ],
    };
  }

  isImportantEvent(event: TombamentoEvent): boolean {
    // 'important' exclui apenas PROCESSING
    return event !== 'PROCESSING';
  }

  getIdempotencyKey(payload: TombamentoPayload): string {
    return sha1(
      [
        payload.event,
        payload.bucket,
        payload.object,
        payload.counts?.processed?.toString() || '',
      ].join(':')
    );
  }

  private buildTextField(label: string, value: string): Record<string, unknown> {
    return {
      textParagraph: {
        text: `<b>${label}:</b> ${value}`,
      },
    };
  }

  private buildCountsField(counts: NonNullable<TombamentoPayload['counts']>): Record<string, unknown> {
    const parts: string[] = [];
    if (counts.received !== undefined) parts.push(`received: ${counts.received}`);
    if (counts.valid !== undefined) parts.push(`valid: ${counts.valid}`);
    if (counts.invalid !== undefined) parts.push(`invalid: ${counts.invalid}`);
    if (counts.processed !== undefined) parts.push(`processed: ${counts.processed}`);

    return {
      textParagraph: {
        text: `<b>Totais:</b> ${parts.join(' · ')}`,
      },
    };
  }
}

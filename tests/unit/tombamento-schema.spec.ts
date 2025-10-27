import { TombamentoSchema } from '../../src/schemas/tombamento-schema';
import { TombamentoPayload } from '../../src/types';

describe('TombamentoSchema', () => {
  let schema: TombamentoSchema;

  beforeEach(() => {
    schema = new TombamentoSchema();
  });

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(schema.name).toBe('tombamento');
    });
  });

  describe('buildCard', () => {
    it('should build card with all fields for UPLOADED event', () => {
      const payload: TombamentoPayload = {
        event: 'UPLOADED',
        partner: 'ACME',
        bucket: 'exa-teste',
        object: 'exa/file.csv',
        message: 'Arquivo enviado',
        ts: '2025-10-24T10:00:00Z',
      };

      const card = schema.buildCard(payload, { maxMessage: 800 });

      expect(card.cardsV2).toHaveLength(1);
      expect(card.cardsV2[0].card.header?.title).toContain('📥');
      expect(card.cardsV2[0].card.header?.title).toContain('UPLOADED');
      expect(card.cardsV2[0].card.header?.subtitle).toBe('ACME');
    });

    it('should include counts when provided', () => {
      const payload: TombamentoPayload = {
        event: 'PROCESSED',
        partner: 'ACME',
        bucket: 'exa-teste',
        object: 'exa/file.csv',
        counts: {
          received: 1000,
          valid: 980,
          invalid: 20,
          processed: 980,
        },
      };

      const card = schema.buildCard(payload, { maxMessage: 800 });
      const widgets = card.cardsV2[0].card.sections[0].widgets;

      // Deve ter widget de contadores
      const countsWidget = widgets.find((w: unknown) =>
        JSON.stringify(w).includes('Totais')
      );
      expect(countsWidget).toBeDefined();
    });

    it('should truncate long messages', () => {
      const longMessage = 'A'.repeat(1000);
      const payload: TombamentoPayload = {
        event: 'FAILED',
        partner: 'ACME',
        bucket: 'exa-teste',
        object: 'file.csv',
        message: longMessage,
      };

      const card = schema.buildCard(payload, { maxMessage: 100 });
      const cardStr = JSON.stringify(card);

      expect(cardStr).toContain('…');
      expect(cardStr).not.toContain('A'.repeat(100));
    });

    it('should use current timestamp when ts not provided', () => {
      const payload: TombamentoPayload = {
        event: 'PROCESSING',
        partner: 'ACME',
        bucket: 'exa-teste',
        object: 'file.csv',
      };

      const card = schema.buildCard(payload, { maxMessage: 800 });
      const cardStr = JSON.stringify(card);

      // Deve conter um timestamp ISO válido
      expect(cardStr).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should apply correct emoji for each event type', () => {
      const events: Array<TombamentoPayload['event']> = [
        'UPLOADED',
        'PROCESSING',
        'INVALID_SCHEMA',
        'PROCESSED',
        'FAILED',
        'REPORT_GENERATED',
      ];

      const emojis = ['📥', '⚙️', '❌', '✅', '🔥', '📄'];

      events.forEach((event, index) => {
        const card = schema.buildCard(
          {
            event,
            partner: 'TEST',
            bucket: 'test',
            object: 'file.csv',
          },
          { maxMessage: 800 }
        );

        expect(card.cardsV2[0].card.header?.title).toContain(emojis[index]);
      });
    });
  });

  describe('isImportantEvent', () => {
    it('should return false for PROCESSING event', () => {
      expect(schema.isImportantEvent?.('PROCESSING')).toBe(false);
    });

    it('should return true for UPLOADED event', () => {
      expect(schema.isImportantEvent?.('UPLOADED')).toBe(true);
    });

    it('should return true for error events', () => {
      expect(schema.isImportantEvent?.('INVALID_SCHEMA')).toBe(true);
      expect(schema.isImportantEvent?.('FAILED')).toBe(true);
    });

    it('should return true for completion events', () => {
      expect(schema.isImportantEvent?.('PROCESSED')).toBe(true);
      expect(schema.isImportantEvent?.('REPORT_GENERATED')).toBe(true);
    });
  });

  describe('getIdempotencyKey', () => {
    it('should generate unique key per event+file combination', () => {
      const payload: TombamentoPayload = {
        event: 'PROCESSED',
        partner: 'ACME',
        bucket: 'my-bucket',
        object: 'file.csv',
        counts: { processed: 100 },
      };

      const key = schema.getIdempotencyKey?.(payload);

      expect(key).toBeDefined();
      expect(key).toHaveLength(40); // SHA-1
    });

    it('should generate different keys for different events on same file', () => {
      const basePayload = {
        partner: 'ACME',
        bucket: 'bucket',
        object: 'file.csv',
      };

      const key1 = schema.getIdempotencyKey?.({
        ...basePayload,
        event: 'UPLOADED',
      } as TombamentoPayload);

      const key2 = schema.getIdempotencyKey?.({
        ...basePayload,
        event: 'PROCESSED',
      } as TombamentoPayload);

      expect(key1).not.toBe(key2);
    });

    it('should include processed count in key', () => {
      const basePayload: TombamentoPayload = {
        event: 'PROCESSED',
        partner: 'ACME',
        bucket: 'bucket',
        object: 'file.csv',
      };

      const key1 = schema.getIdempotencyKey?.({
        ...basePayload,
        counts: { processed: 100 },
      });

      const key2 = schema.getIdempotencyKey?.({
        ...basePayload,
        counts: { processed: 200 },
      });

      expect(key1).not.toBe(key2);
    });
  });
});

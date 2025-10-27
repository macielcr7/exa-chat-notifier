import { CardBuilder } from '../../src/card-builder';
import { TombamentoSchema } from '../../src/schemas/tombamento-schema';
import type { TombamentoPayload } from '../../src/types';

describe('CardBuilder', () => {
  const schema = new TombamentoSchema();

  const samplePayload: TombamentoPayload = {
    event: 'UPLOADED',
    partner: 'ACME Corp',
    bucket: 'uploads',
    object: 'file.csv',
    ts: '2001-09-09T01:46:40.000Z',
  };

  describe('buildCard', () => {
    it('should build card using schema', () => {
      const builder = new CardBuilder(schema);
      const card = builder.buildCard(samplePayload);

      expect(card.cardsV2).toBeDefined();
      expect(card.cardsV2).toHaveLength(1);
      expect(card.cardsV2[0].card).toBeDefined();
      // @ts-expect-error - accessing unknown card structure
      expect(card.cardsV2[0].card.header?.title).toContain('📥');
    });

    it('should pass maxMessage to schema', () => {
      const builder = new CardBuilder(schema, { maxMessage: 50 });
      const payload = { ...samplePayload, message: 'a'.repeat(100) };
      const card = builder.buildCard(payload);

      // Check that card was built successfully
      expect(card.cardsV2).toBeDefined();
      expect(card.cardsV2).toHaveLength(1);
    });
  });
});

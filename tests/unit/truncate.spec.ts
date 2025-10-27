import { truncateMessage } from '../../src/utils/truncate';

describe('truncate utils', () => {
  describe('truncateMessage', () => {
    it('should not truncate string shorter than max length', () => {
      const text = 'Short message';
      const result = truncateMessage(text, 100);
      
      expect(result).toBe('Short message');
    });

    it('should not truncate string equal to max length', () => {
      const text = 'Exact';
      const result = truncateMessage(text, 5);
      
      expect(result).toBe('Exact');
    });

    it('should truncate long string and add ellipsis', () => {
      const text = 'This is a very long message that needs to be truncated';
      const result = truncateMessage(text, 20);
      
      expect(result).toBe('This is a very long…');
      expect(result).toHaveLength(20);
    });

    it('should handle empty string', () => {
      const result = truncateMessage('', 10);
      expect(result).toBe('');
    });

    it('should handle max length of 1', () => {
      const result = truncateMessage('test', 1);
      expect(result).toBe('…');
    });

    it('should preserve unicode characters when truncating', () => {
      const text = 'Olá mundo! 👋 Este é um teste';
      const result = truncateMessage(text, 15);
      
      expect(result).toHaveLength(15);
      expect(result).toContain('…');
    });
  });
});

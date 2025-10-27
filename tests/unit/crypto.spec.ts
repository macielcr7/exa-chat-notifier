import { sha1, generateThreadKey } from '../../src/utils/crypto';

describe('crypto utils', () => {
  describe('sha1', () => {
    it('should generate correct SHA-1 hash', () => {
      const input = 'test-string';
      const hash = sha1(input);
      
      expect(hash).toBe('4f49d69613b186e71104c7ca1b26c1e5b78c9193');
      expect(hash).toHaveLength(40); // SHA-1 sempre gera 40 caracteres hex
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = sha1('input1');
      const hash2 = sha1('input2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should generate consistent hashes for same input', () => {
      const input = 'consistent-test';
      const hash1 = sha1(input);
      const hash2 = sha1(input);
      
      expect(hash1).toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = sha1('');
      expect(hash).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    });
  });

  describe('generateThreadKey', () => {
    it('should generate thread key from bucket and object', () => {
      const key = generateThreadKey('my-bucket', 'path/to/file.csv');
      
      expect(key).toBe(sha1('my-bucket:path/to/file.csv'));
      expect(key).toHaveLength(40);
    });

    it('should generate consistent keys for same inputs', () => {
      const key1 = generateThreadKey('bucket', 'object');
      const key2 = generateThreadKey('bucket', 'object');
      
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = generateThreadKey('bucket1', 'object');
      const key2 = generateThreadKey('bucket2', 'object');
      
      expect(key1).not.toBe(key2);
    });
  });
});

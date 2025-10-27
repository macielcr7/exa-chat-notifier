import { ConfigManager } from '../../src/config';

describe('ConfigManager', () => {
  const VALID_WEBHOOK_URL =
    'https://chat.googleapis.com/v1/spaces/SPACE/messages?key=KEY';
  const VALID_WEBHOOK_URL_2 =
    'https://chat.googleapis.com/v1/spaces/OTHER/messages?key=KEY2';

  // Save original env
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.CHAT_WEBHOOK_URL;
    delete process.env.CHAT_WEBHOOK_TOKEN;
    delete process.env.CHAT_WEBHOOK_ERRORS;
    delete process.env.CHAT_WEBHOOK_ERRORS_TOKEN;
    delete process.env.CHAT_WEBHOOK_REPORTS;
    delete process.env.CHAT_WEBHOOK_REPORTS_TOKEN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should throw if no webhook configured', () => {
      expect(() => new ConfigManager()).toThrow(
        'No webhook configured. Provide CHAT_WEBHOOK_URL env var or webhooks option.',
      );
    });

    it('should load default webhook from CHAT_WEBHOOK_URL env', () => {
      process.env.CHAT_WEBHOOK_URL = VALID_WEBHOOK_URL;
      const config = new ConfigManager();
      expect(config.getWebhook()).toBe(VALID_WEBHOOK_URL);
    });

    it('should load named webhooks from CHAT_WEBHOOK_<NAME> env', () => {
      process.env.CHAT_WEBHOOK_ERRORS = VALID_WEBHOOK_URL;
      process.env.CHAT_WEBHOOK_REPORTS = VALID_WEBHOOK_URL_2;

      const config = new ConfigManager();
      expect(config.getWebhook('errors')).toBe(VALID_WEBHOOK_URL);
      expect(config.getWebhook('reports')).toBe(VALID_WEBHOOK_URL_2);
    });

    it('should accept string webhook config', () => {
      const config = new ConfigManager(VALID_WEBHOOK_URL);
      expect(config.getWebhook()).toBe(VALID_WEBHOOK_URL);
    });

    it('should accept record of named webhooks', () => {
      const config = new ConfigManager({
        errors: VALID_WEBHOOK_URL,
        reports: VALID_WEBHOOK_URL_2,
      });

      expect(config.getWebhook('errors')).toBe(VALID_WEBHOOK_URL);
      expect(config.getWebhook('reports')).toBe(VALID_WEBHOOK_URL_2);
    });

    it('should override env with provided config', () => {
      process.env.CHAT_WEBHOOK_URL = 'https://chat.googleapis.com/v1/old';
      const config = new ConfigManager(VALID_WEBHOOK_URL);
      expect(config.getWebhook()).toBe(VALID_WEBHOOK_URL);
    });
  });

  describe('token separation (security)', () => {
    const BASE_URL = 'https://chat.googleapis.com/v1/spaces/SPACE/messages?key=KEY';
    const TOKEN = 'secret_token_123';
    const EXPECTED_URL = `${BASE_URL}&token=${TOKEN}`;

    it('should build webhook URL from base URL + token', () => {
      process.env.CHAT_WEBHOOK_URL = BASE_URL;
      process.env.CHAT_WEBHOOK_TOKEN = TOKEN;
      
      const config = new ConfigManager();
      expect(config.getWebhook()).toBe(EXPECTED_URL);
    });

    it('should support legacy mode with token in URL', () => {
      process.env.CHAT_WEBHOOK_URL = EXPECTED_URL;
      
      const config = new ConfigManager();
      expect(config.getWebhook()).toBe(EXPECTED_URL);
    });

    it('should prefer separate token over URL token', () => {
      process.env.CHAT_WEBHOOK_URL = BASE_URL;
      process.env.CHAT_WEBHOOK_TOKEN = TOKEN;
      
      const config = new ConfigManager();
      const result = config.getWebhook();
      
      expect(result).toContain('token=');
      expect(result).toBe(EXPECTED_URL);
    });

    it('should support named webhooks with separate tokens', () => {
      const BASE_ERRORS_URL = 'https://chat.googleapis.com/v1/spaces/ERRORS/messages?key=KEY2';
      const ERRORS_TOKEN = 'errors_token_456';
      const EXPECTED_ERRORS_URL = `${BASE_ERRORS_URL}&token=${ERRORS_TOKEN}`;

      process.env.CHAT_WEBHOOK_ERRORS = BASE_ERRORS_URL;
      process.env.CHAT_WEBHOOK_ERRORS_TOKEN = ERRORS_TOKEN;
      
      const config = new ConfigManager();
      expect(config.getWebhook('errors')).toBe(EXPECTED_ERRORS_URL);
    });

    it('should handle multiple named webhooks with tokens', () => {
      const BASE_ERRORS_URL = 'https://chat.googleapis.com/v1/spaces/ERRORS/messages?key=KEY2';
      const BASE_REPORTS_URL = 'https://chat.googleapis.com/v1/spaces/REPORTS/messages?key=KEY3';
      const ERRORS_TOKEN = 'errors_token_456';
      const REPORTS_TOKEN = 'reports_token_789';

      process.env.CHAT_WEBHOOK_ERRORS = BASE_ERRORS_URL;
      process.env.CHAT_WEBHOOK_ERRORS_TOKEN = ERRORS_TOKEN;
      process.env.CHAT_WEBHOOK_REPORTS = BASE_REPORTS_URL;
      process.env.CHAT_WEBHOOK_REPORTS_TOKEN = REPORTS_TOKEN;
      
      const config = new ConfigManager();
      expect(config.getWebhook('errors')).toBe(`${BASE_ERRORS_URL}&token=${ERRORS_TOKEN}`);
      expect(config.getWebhook('reports')).toBe(`${BASE_REPORTS_URL}&token=${REPORTS_TOKEN}`);
    });

    it('should handle URL without query params', () => {
      const BASE_URL_NO_QUERY = 'https://chat.googleapis.com/v1/spaces/SPACE/messages';
      const TOKEN = 'token_123';
      const EXPECTED_URL = `${BASE_URL_NO_QUERY}?token=${TOKEN}`;

      process.env.CHAT_WEBHOOK_URL = BASE_URL_NO_QUERY;
      process.env.CHAT_WEBHOOK_TOKEN = TOKEN;
      
      const config = new ConfigManager();
      expect(config.getWebhook()).toBe(EXPECTED_URL);
    });

    it('should work with base URL only (no token)', () => {
      process.env.CHAT_WEBHOOK_URL = BASE_URL;
      
      const config = new ConfigManager();
      expect(config.getWebhook()).toBe(BASE_URL);
    });
  });

  describe('webhook validation', () => {
    it('should reject empty webhook URL', () => {
      expect(() => new ConfigManager('')).toThrow(
        'Webhook URL cannot be empty',
      );
    });

    it('should reject non-HTTPS webhook URL', () => {
      expect(() => new ConfigManager('http://chat.googleapis.com/v1/test')).toThrow(
        'Webhook URL must use HTTPS protocol',
      );
    });

    it('should reject non-Google Chat webhook URL', () => {
      expect(() => new ConfigManager('https://example.com/webhook')).toThrow(
        'Invalid Google Chat webhook URL',
      );
    });

    it('should accept valid Google Chat webhook URL', () => {
      const config = new ConfigManager(VALID_WEBHOOK_URL);
      expect(config.getWebhook()).toBe(VALID_WEBHOOK_URL);
    });
  });

  describe('getWebhook', () => {
    it('should return default webhook when no name provided', () => {
      const config = new ConfigManager(VALID_WEBHOOK_URL);
      expect(config.getWebhook()).toBe(VALID_WEBHOOK_URL);
    });

    it('should return named webhook when found', () => {
      const config = new ConfigManager({
        errors: VALID_WEBHOOK_URL,
      });
      expect(config.getWebhook('errors')).toBe(VALID_WEBHOOK_URL);
    });

    it('should be case-insensitive for webhook names', () => {
      const config = new ConfigManager({
        errors: VALID_WEBHOOK_URL,
      });
      expect(config.getWebhook('ERRORS')).toBe(VALID_WEBHOOK_URL);
      expect(config.getWebhook('Errors')).toBe(VALID_WEBHOOK_URL);
    });

    it('should fallback to default webhook when named not found', () => {
      const config = new ConfigManager(VALID_WEBHOOK_URL);
      expect(config.getWebhook('nonexistent')).toBe(VALID_WEBHOOK_URL);
    });

    it('should throw when webhook not found and no default', () => {
      const config = new ConfigManager({ errors: VALID_WEBHOOK_URL });
      expect(() => config.getWebhook('nonexistent')).toThrow(
        "Webhook 'nonexistent' not found and no default webhook configured",
      );
    });

    it('should throw when requesting default but none configured', () => {
      const config = new ConfigManager({ errors: VALID_WEBHOOK_URL });
      expect(() => config.getWebhook()).toThrow(
        'No default webhook configured',
      );
    });
  });

  describe('getWebhookNames', () => {
    it('should return empty array when no named webhooks', () => {
      const config = new ConfigManager(VALID_WEBHOOK_URL);
      expect(config.getWebhookNames()).toEqual([]);
    });

    it('should return all configured webhook names', () => {
      const config = new ConfigManager({
        errors: VALID_WEBHOOK_URL,
        reports: VALID_WEBHOOK_URL_2,
      });

      const names = config.getWebhookNames();
      expect(names).toHaveLength(2);
      expect(names).toContain('errors');
      expect(names).toContain('reports');
    });
  });

  describe('hasWebhook', () => {
    it('should return true for existing webhook', () => {
      const config = new ConfigManager({ errors: VALID_WEBHOOK_URL });
      expect(config.hasWebhook('errors')).toBe(true);
    });

    it('should return false for non-existing webhook', () => {
      const config = new ConfigManager({ errors: VALID_WEBHOOK_URL });
      expect(config.hasWebhook('reports')).toBe(false);
    });

    it('should be case-insensitive', () => {
      const config = new ConfigManager({ errors: VALID_WEBHOOK_URL });
      expect(config.hasWebhook('ERRORS')).toBe(true);
      expect(config.hasWebhook('Errors')).toBe(true);
    });
  });
});

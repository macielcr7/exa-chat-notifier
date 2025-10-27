/**
 * Configuration Manager
 *
 * Handles webhook URL resolution and validation.
 * Supports:
 * - Default webhook via CHAT_WEBHOOK_URL (full URL or base URL + token)
 * - Token separation via CHAT_WEBHOOK_TOKEN (security best practice)
 * - Named webhooks via CHAT_WEBHOOK_<NAME> env vars
 * - Named tokens via CHAT_WEBHOOK_<NAME>_TOKEN env vars
 * - Multi-webhook configuration via options
 * 
 * Security: Tokens can be separated from URLs for better security and rotation.
 * Example:
 *   CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/SPACE/messages?key=KEY
 *   CHAT_WEBHOOK_TOKEN=secret_token
 */

export interface WebhookConfig {
  url: string;
  name?: string;
}

export class ConfigManager {
  private readonly webhooks: Map<string, string>;
  private defaultWebhook?: string;

  constructor(webhookConfig?: Record<string, string> | string) {
    this.webhooks = new Map();

    // Load from environment
    this.loadFromEnv();

    // Override with provided config
    if (typeof webhookConfig === 'string') {
      this.defaultWebhook = this.validateWebhookUrl(webhookConfig);
    } else if (webhookConfig) {
      Object.entries(webhookConfig).forEach(([name, url]) => {
        this.webhooks.set(name, this.validateWebhookUrl(url));
      });
    }

    // Validate at least one webhook is configured
    if (!this.defaultWebhook && this.webhooks.size === 0) {
      throw new Error(
        'No webhook configured. Provide CHAT_WEBHOOK_URL env var or webhooks option.',
      );
    }
  }

  /**
   * Load webhooks from environment variables
   * Supports two modes:
   * 1. Full URL with token (legacy): CHAT_WEBHOOK_URL=https://...?key=KEY&token=TOKEN
   * 2. Base URL + separate token (recommended): CHAT_WEBHOOK_URL + CHAT_WEBHOOK_TOKEN
   * 
   * For named webhooks:
   * - CHAT_WEBHOOK_<NAME>=url + CHAT_WEBHOOK_<NAME>_TOKEN=token
   */
  private loadFromEnv(): void {
    // Default webhook
    const defaultUrl = process.env.CHAT_WEBHOOK_URL;
    const defaultToken = process.env.CHAT_WEBHOOK_TOKEN;
    
    if (defaultUrl) {
      // Check if URL already contains token (legacy mode)
      if (defaultUrl.includes('token=')) {
        this.defaultWebhook = this.validateWebhookUrl(defaultUrl);
      } else if (defaultToken) {
        // Build URL with separate token (new secure mode)
        this.defaultWebhook = this.validateWebhookUrl(
          this.buildWebhookUrl(defaultUrl, defaultToken)
        );
      } else {
        // URL without token - validate as is
        this.defaultWebhook = this.validateWebhookUrl(defaultUrl);
      }
    }

    // Named webhooks (CHAT_WEBHOOK_ERRORS, CHAT_WEBHOOK_REPORTS, etc)
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('CHAT_WEBHOOK_') && 
          key !== 'CHAT_WEBHOOK_URL' && 
          key !== 'CHAT_WEBHOOK_TOKEN' &&
          !key.endsWith('_TOKEN')) {
        const name = key.replace('CHAT_WEBHOOK_', '').toLowerCase();
        const url = process.env[key];
        const tokenKey = `${key}_TOKEN`;
        const token = process.env[tokenKey];
        
        if (url) {
          // Check if URL already contains token (legacy mode)
          if (url.includes('token=')) {
            this.webhooks.set(name, this.validateWebhookUrl(url));
          } else if (token) {
            // Build URL with separate token (new secure mode)
            this.webhooks.set(name, this.validateWebhookUrl(
              this.buildWebhookUrl(url, token)
            ));
          } else {
            // URL without token - validate as is
            this.webhooks.set(name, this.validateWebhookUrl(url));
          }
        }
      }
    });
  }

  /**
   * Build webhook URL from base URL and token
   * @param baseUrl Base webhook URL (without token parameter)
   * @param token Webhook token
   * @returns Complete webhook URL
   */
  private buildWebhookUrl(baseUrl: string, token: string): string {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}token=${token}`;
  }

  /**
   * Validate webhook URL format
   */
  private validateWebhookUrl(url: string): string {
    if (!url) {
      throw new Error('Webhook URL cannot be empty');
    }

    if (!url.startsWith('https://')) {
      throw new Error(
        `Webhook URL must use HTTPS protocol: ${url.substring(0, 50)}...`,
      );
    }

    if (!url.includes('chat.googleapis.com')) {
      throw new Error(
        `Invalid Google Chat webhook URL: ${url.substring(0, 50)}...`,
      );
    }

    return url;
  }

  /**
   * Get webhook URL by name
   * Falls back to default webhook if name not found
   */
  getWebhook(name?: string): string {
    if (!name) {
      if (!this.defaultWebhook) {
        throw new Error('No default webhook configured');
      }
      return this.defaultWebhook;
    }

    const webhook = this.webhooks.get(name.toLowerCase());
    if (!webhook) {
      // Fallback to default
      if (this.defaultWebhook) {
        return this.defaultWebhook;
      }
      throw new Error(
        `Webhook '${name}' not found and no default webhook configured`,
      );
    }

    return webhook;
  }

  /**
   * Get all configured webhook names
   */
  getWebhookNames(): string[] {
    return Array.from(this.webhooks.keys());
  }

  /**
   * Check if a named webhook exists
   */
  hasWebhook(name: string): boolean {
    return this.webhooks.has(name.toLowerCase());
  }
}

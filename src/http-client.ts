/**
 * HTTP Client
 *
 * Handles Google Chat webhook requests with retry logic and exponential backoff.
 */

import fetch from 'node-fetch';

export interface HttpClientOptions {
  timeoutMs?: number;
  maxRetries?: number;
  initialDelayMs?: number;
}

export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText: string;
  body: string;
}

export class HttpClient {
  private readonly maxRetries: number;
  private readonly initialDelayMs: number;

  constructor(options: HttpClientOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.initialDelayMs = options.initialDelayMs ?? 300;
  }

  /**
   * POST JSON to webhook with retry logic
   */
  async post(url: string, payload: unknown): Promise<HttpResponse> {
    let lastError: Error | undefined;

    // Log do payload sendo enviado
    if (process.env.DEBUG_CHAT_NOTIFIER === 'true') {
      // eslint-disable-next-line no-console
      console.log('\n📤 HTTP CLIENT - SENDING:');
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(payload, null, 2));
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify(payload),
        });

        const body = await response.text();

        // Log da resposta recebida
        if (process.env.DEBUG_CHAT_NOTIFIER === 'true') {
          // eslint-disable-next-line no-console
          console.log('\n📥 HTTP CLIENT - RESPONSE:');
          // eslint-disable-next-line no-console
          console.log('   Status:', response.status, response.statusText);
          // eslint-disable-next-line no-console
          console.log('   Body:', body);
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          body,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.maxRetries) {
          const delay = this.initialDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Max retries reached');
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

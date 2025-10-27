// ============= TIPOS GENÉRICOS =============

/**
 * Configuração base do notifier (genérico)
 */
export interface NotifierOptions<TPayload = unknown> {
  /** URL do webhook principal (retrocompatível) */
  webhookUrl?: string;
  /** Múltiplos webhooks nomeados */
  webhooks?: Record<string, string>;
  /** Filtro de eventos: 'all' envia todos, 'important' filtra via schema */
  level?: 'all' | 'important';
  /** Máximo de caracteres para mensagens */
  maxMessage?: number;
  /** Timeout HTTP em milissegundos */
  timeoutMs?: number;
  /** Número máximo de tentativas de retry */
  retryMax?: number;
  /** Delay base para backoff exponencial (ms) */
  retryBaseMs?: number;
  /** TTL do cache de idempotência (ms) */
  idempotencyTtlMs?: number;
  /** Habilitar/desabilitar idempotência */
  idempotencyEnabled?: boolean;
  /** Callback de sucesso */
  onSuccess?: (payload: TPayload) => void;
  /** Callback de erro */
  onError?: (payload: TPayload, error: Error) => void;
  
  // Batching
  /** Habilitar envio em lote (batch) */
  batchEnabled?: boolean;
  /** Tamanho máximo do lote antes de enviar */
  batchSize?: number;
  /** Intervalo de tempo (ms) para envio automático do lote */
  batchIntervalMs?: number;
  /** Enviar mensagens pendentes ao destruir o notifier */
  batchFlushOnDestroy?: boolean;
}

/**
 * Interface genérica do Notifier
 */
export interface Notifier<TPayload = unknown> {
  /**
   * Envia notificação
   * @param data Payload do evento
   * @param webhookName Nome do webhook (opcional, usa default se omitido)
   */
  notify(data: TPayload, webhookName?: string): Promise<void>;

  /**
   * Força envio imediato do lote pendente (apenas em modo batch)
   */
  flush?(): Promise<void>;

  /**
   * Cleanup de recursos (timers, caches, etc)
   */
  destroy?(): Promise<void> | void;
}

/**
 * Payload de card do Google Chat (Cards v2)
 */
export interface CardPayload {
  cardsV2: Array<{
    cardId: string;
    card: {
      header?: {
        title: string;
        subtitle?: string;
      };
      sections: Array<{
        widgets: Array<unknown>;
      }>;
    };
  }>;
}

// ============= TIPOS ESPECÍFICOS DE TOMBAMENTO =============

/**
 * Eventos de tombamento de arquivos
 */
export type TombamentoEvent =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'INVALID_SCHEMA'
  | 'PROCESSED'
  | 'FAILED'
  | 'REPORT_GENERATED';

/**
 * Payload de evento de tombamento
 */
export interface TombamentoPayload {
  /** Tipo do evento */
  event: TombamentoEvent;
  /** Nome do parceiro */
  partner: string;
  /** Nome do bucket */
  bucket: string;
  /** Caminho do objeto no bucket */
  object: string;
  /** Etapa de execução (opcional, default = event) */
  stage?: TombamentoEvent;
  /** Contadores de processamento */
  counts?: {
    received?: number;
    valid?: number;
    invalid?: number;
    processed?: number;
  };
  /** Mensagem adicional */
  message?: string;
  /** ID de rastreamento */
  trace_id?: string;
  /** Timestamp ISO 8601 */
  ts?: string;
}

/**
 * Notifier específico para eventos de tombamento
 * Estende Notifier com métodos convenientes
 */
export interface TombamentoNotifier extends Notifier<TombamentoPayload> {
  uploaded(data: Omit<TombamentoPayload, 'event'>): Promise<void>;
  processing(data: Omit<TombamentoPayload, 'event'>): Promise<void>;
  invalidSchema(
    data: Omit<TombamentoPayload, 'event' | 'stage'> & { message: string }
  ): Promise<void>;
  processed(data: Omit<TombamentoPayload, 'event'>): Promise<void>;
  failed(data: Omit<TombamentoPayload, 'event' | 'stage'> & { message: string }): Promise<void>;
  reportGenerated(data: Omit<TombamentoPayload, 'event'>): Promise<void>;
  destroy(): void;
}

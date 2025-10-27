import { CardPayload } from '../types';

/**
 * Interface base para schemas de eventos customizáveis
 * Permite criar tipos de eventos personalizados com cards customizados
 */
export interface EventSchema<TPayload, TEvent extends string = string> {
  /**
   * Nome do schema (ex: 'tombamento', 'deployment', 'monitoring')
   */
  readonly name: string;

  /**
   * Construir payload Cards v2 do Google Chat
   * @param payload Dados do evento
   * @param config Configurações (ex: maxMessage)
   * @returns Payload do card
   */
  buildCard(payload: TPayload, config: { maxMessage: number }): CardPayload;

  /**
   * Determinar se evento deve ser enviado quando level='important'
   * @param event Nome do evento
   * @returns true se evento é importante
   */
  isImportantEvent?(event: TEvent): boolean;

  /**
   * Gerar chave de idempotência (opcional)
   * Retornar string única por evento, ou undefined para desabilitar
   * @param payload Dados do evento
   * @returns Idempotency key ou undefined
   */
  getIdempotencyKey?(payload: TPayload): string | undefined;

  /**
   * Extrair nome do webhook (opcional)
   * Retornar nome do webhook configurado em NotifierOptions.webhooks
   * @param payload Dados do evento
   * @returns Nome do webhook ou undefined
   */
  getWebhookName?(payload: TPayload): string | undefined;
}

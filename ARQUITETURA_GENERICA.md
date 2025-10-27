# Arquitetura Genérica - @exa/chat-notifier

## 🎯 Visão Geral

A biblioteca foi refatorada para ser **genérica e extensível**, permitindo uso além de eventos de tombamento. A arquitetura suporta:

- ✅ **Múltiplos tipos de eventos** através de schemas plugáveis
- ✅ **Múltiplos webhooks** (diferentes spaces/chats)
- ✅ **Customização completa** de cards, threading e idempotência
- ✅ **Retrocompatibilidade** com API original de tombamento

---

## 🏗️ Arquitetura Plugável

### Sistema de Schemas

```typescript
// Interface base para schemas customizados
interface EventSchema<TPayload, TEvent extends string = string> {
  name: string;
  buildCard(payload: TPayload, config: { maxMessage: number }): CardPayload;
  isImportantEvent?(event: TEvent): boolean;
  getThreadKey?(payload: TPayload): string | undefined;
  getIdempotencyKey?(payload: TPayload): string | undefined;
  getWebhookName?(payload: TPayload): string | undefined;
}
```

### Componentes Principais

```
┌────────────────────────────────────────────────┐
│         API Pública (Genérica)                 │
│  createNotifier<T>(schema, opts) → Notifier<T> │
└─────────────────┬──────────────────────────────┘
                  │
      ┌───────────┴───────────┐
      ↓                       ↓
┌──────────────┐      ┌──────────────────┐
│ Notifier<T>  │◄─────│ EventSchema<T>   │
│ (Core Logic) │      │ (Pluggable)      │
└──────┬───────┘      └──────────────────┘
       │
       ├──→ CardBuilder (delega ao schema)
       ├──→ ConfigManager (multi-webhook)
       ├──→ IdempotencyCache (chave via schema)
       └──→ HttpClient (retry logic)
```

---

## 📚 Exemplos de Uso

### 1️⃣ Uso Padrão (Tombamento - Retrocompatível)

```typescript
import { createTombamentoNotifier } from '@exa/chat-notifier';

const notifier = createTombamentoNotifier();

// API original mantida
await notifier.uploaded({
  partner: 'ACME',
  bucket: 'exa-teste',
  object: 'file.csv',
});

await notifier.processed({
  partner: 'ACME',
  bucket: 'exa-teste',
  object: 'file.csv',
  counts: { received: 1000, processed: 980 },
});
```

---

### 2️⃣ Eventos Customizados (Deployments)

```typescript
import { createNotifier, EventSchema } from '@exa/chat-notifier';
import { sha1, truncateMessage } from '@exa/chat-notifier/utils';

// 1. Definir seus tipos
type DeployEvent = 'STARTED' | 'SUCCESS' | 'FAILED';

interface DeployPayload {
  event: DeployEvent;
  service: string;
  version: string;
  environment: 'staging' | 'production';
  author: string;
  message?: string;
}

// 2. Criar schema customizado
class DeploymentSchema implements EventSchema<DeployPayload, DeployEvent> {
  name = 'deployment';

  buildCard(payload: DeployPayload, config: { maxMessage: number }) {
    const emojis = { STARTED: '🚀', SUCCESS: '✅', FAILED: '💥' };
    
    return {
      cardsV2: [{
        cardId: `deploy-${Date.now()}`,
        card: {
          header: {
            title: `${emojis[payload.event]} ${payload.event}`,
            subtitle: `${payload.service} v${payload.version}`,
          },
          sections: [{
            widgets: [
              { textParagraph: { text: `<b>Service:</b> ${payload.service}` } },
              { textParagraph: { text: `<b>Environment:</b> ${payload.environment}` } },
              { textParagraph: { text: `<b>Author:</b> ${payload.author}` } },
              ...(payload.message ? [{
                textParagraph: { text: truncateMessage(payload.message, config.maxMessage) }
              }] : []),
            ]
          }]
        }
      }]
    };
  }

  isImportantEvent(event: DeployEvent): boolean {
    return event !== 'STARTED'; // Apenas SUCCESS e FAILED
  }

  getThreadKey(payload: DeployPayload): string {
    return sha1(`${payload.service}:${payload.version}`);
  }

  getIdempotencyKey(payload: DeployPayload): string {
    return sha1(`${payload.event}:${payload.service}:${payload.version}:${payload.environment}`);
  }

  // Rotear para webhooks diferentes por ambiente
  getWebhookName(payload: DeployPayload): string {
    return payload.environment;
  }
}

// 3. Criar notifier
const deployNotifier = createNotifier(new DeploymentSchema(), {
  webhooks: {
    staging: process.env.CHAT_WEBHOOK_STAGING!,
    production: process.env.CHAT_WEBHOOK_PROD!,
  },
  level: 'important',
});

// 4. Usar!
await deployNotifier.notify({
  event: 'SUCCESS',
  service: 'api-gateway',
  version: '2.3.1',
  environment: 'production',
  author: 'john@acme.com',
  message: 'Deploy completed successfully',
});
// → Enviado automaticamente para webhook 'production'
```

---

### 3️⃣ Eventos de Monitoramento

```typescript
type AlertLevel = 'INFO' | 'WARNING' | 'CRITICAL';

interface MonitoringPayload {
  level: AlertLevel;
  service: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: string;
}

class MonitoringSchema implements EventSchema<MonitoringPayload, AlertLevel> {
  name = 'monitoring';

  buildCard(payload: MonitoringPayload) {
    const colors = { INFO: '#4285F4', WARNING: '#FBBC04', CRITICAL: '#EA4335' };
    const emojis = { INFO: 'ℹ️', WARNING: '⚠️', CRITICAL: '🚨' };

    return {
      cardsV2: [{
        cardId: `alert-${Date.now()}`,
        card: {
          header: {
            title: `${emojis[payload.level]} ${payload.level}`,
            subtitle: payload.service,
          },
          sections: [{
            widgets: [
              { textParagraph: { text: `<b>Métrica:</b> ${payload.metric}` } },
              { textParagraph: { text: `<b>Valor:</b> ${payload.value} (limite: ${payload.threshold})` } },
              { textParagraph: { text: `<b>Timestamp:</b> ${payload.timestamp}` } },
            ]
          }]
        }
      }]
    };
  }

  isImportantEvent(level: AlertLevel): boolean {
    return level !== 'INFO';
  }

  getThreadKey(payload: MonitoringPayload): string {
    return sha1(`${payload.service}:${payload.metric}`);
  }

  // Enviar alertas críticos para webhook diferente
  getWebhookName(payload: MonitoringPayload): string {
    return payload.level === 'CRITICAL' ? 'oncall' : 'monitoring';
  }
}

// Uso
const alertNotifier = createNotifier(new MonitoringSchema(), {
  webhooks: {
    monitoring: process.env.CHAT_WEBHOOK_MONITORING!,
    oncall: process.env.CHAT_WEBHOOK_ONCALL!,
  },
});

await alertNotifier.notify({
  level: 'CRITICAL',
  service: 'database',
  metric: 'cpu_usage',
  value: 98.5,
  threshold: 80,
  timestamp: new Date().toISOString(),
});
// → Enviado para webhook 'oncall'
```

---

### 4️⃣ Múltiplos Webhooks

```typescript
const notifier = createTombamentoNotifier({
  webhooks: {
    production: process.env.CHAT_WEBHOOK_PROD!,
    staging: process.env.CHAT_WEBHOOK_STG!,
    alerts: process.env.CHAT_WEBHOOK_ALERTS!,
  }
});

// Enviar para webhook específico
await notifier.notify({
  event: 'FAILED',
  partner: 'ACME',
  bucket: 'exa-teste',
  object: 'file.csv',
  message: 'Critical error',
}, 'alerts'); // ← Especificar webhook

// Enviar para webhook padrão (primeiro da lista)
await notifier.uploaded({
  partner: 'ACME',
  bucket: 'exa-teste',
  object: 'file.csv',
}); // → production
```

---

### 5️⃣ Configuração via ENV

```bash
# Webhook principal (retrocompatível)
export CHAT_WEBHOOK_URL="https://chat.googleapis.com/v1/spaces/MAIN/..."

# Webhooks adicionais (novo!)
export CHAT_WEBHOOK_STAGING="https://chat.googleapis.com/v1/spaces/STG/..."
export CHAT_WEBHOOK_PRODUCTION="https://chat.googleapis.com/v1/spaces/PROD/..."
export CHAT_WEBHOOK_ALERTS="https://chat.googleapis.com/v1/spaces/ALERTS/..."

# Outros configs
export CHAT_NOTIFY_LEVEL="important"
export CHAT_THREADING_ENABLED="true"
export CHAT_IDEMPOTENCY_ENABLED="true"
```

```typescript
// Webhooks carregados automaticamente
const notifier = createTombamentoNotifier();
// → Tem acesso a: staging, production, alerts
```

---

## 🔧 Customização Avançada

### Desabilitar Idempotência

```typescript
const notifier = createNotifier(schema, {
  idempotencyEnabled: false, // Permite duplicatas
});
```

### Hooks de Instrumentação

```typescript
const notifier = createNotifier(schema, {
  onSuccess: (payload) => {
    console.log('✅ Notificação enviada:', payload);
    metrics.increment('chat.notifications.success');
  },
  onError: (payload, error) => {
    console.error('❌ Falha ao enviar:', error);
    metrics.increment('chat.notifications.error');
    Sentry.captureException(error, { extra: { payload } });
  },
});
```

---

## 📊 Comparação: Antes vs Depois

### Antes (Específico para Tombamento)

```typescript
import { createNotifier } from '@exa/chat-notifier';

const notifier = createNotifier({
  webhookUrl: 'https://...',
});

await notifier.uploaded({ /* payload de tombamento */ });
```

**Limitações:**
- ❌ Apenas eventos de tombamento
- ❌ Um webhook por instância
- ❌ Cards fixos
- ❌ Não extensível

### Depois (Genérico e Extensível)

```typescript
// Retrocompatível
import { createTombamentoNotifier } from '@exa/chat-notifier';
const notifier = createTombamentoNotifier();
await notifier.uploaded({ /* payload */ });

// OU genérico
import { createNotifier } from '@exa/chat-notifier';
const notifier = createNotifier(customSchema, {
  webhooks: { prod: '...', stg: '...' }
});
await notifier.notify(customPayload, 'prod');
```

**Benefícios:**
- ✅ Qualquer tipo de evento
- ✅ Múltiplos webhooks
- ✅ Cards customizáveis
- ✅ Totalmente extensível
- ✅ Retrocompatível

---

## 🧪 Testes Adicionais

### Testes de Schemas Customizados

```typescript
describe('DeploymentSchema', () => {
  it('should build card with correct format', () => {
    const schema = new DeploymentSchema();
    const card = schema.buildCard({
      event: 'SUCCESS',
      service: 'api',
      version: '1.0.0',
      environment: 'production',
      author: 'john@acme.com',
    }, { maxMessage: 800 });

    expect(card.cardsV2[0].card.header.title).toContain('✅');
    expect(card.cardsV2[0].card.header.title).toContain('SUCCESS');
  });

  it('should filter important events', () => {
    const schema = new DeploymentSchema();
    expect(schema.isImportantEvent?.('STARTED')).toBe(false);
    expect(schema.isImportantEvent?.('SUCCESS')).toBe(true);
    expect(schema.isImportantEvent?.('FAILED')).toBe(true);
  });

  it('should generate consistent thread key', () => {
    const schema = new DeploymentSchema();
    const key1 = schema.getThreadKey?.({ service: 'api', version: '1.0.0' } as any);
    const key2 = schema.getThreadKey?.({ service: 'api', version: '1.0.0' } as any);
    expect(key1).toBe(key2);
  });

  it('should route to correct webhook', () => {
    const schema = new DeploymentSchema();
    const webhook = schema.getWebhookName?.({ environment: 'production' } as any);
    expect(webhook).toBe('production');
  });
});
```

### Testes de Múltiplos Webhooks

```typescript
describe('Multi-webhook support', () => {
  it('should send to specified webhook', async () => {
    const notifier = createNotifier(schema, {
      webhooks: {
        prod: 'https://chat.googleapis.com/prod',
        stg: 'https://chat.googleapis.com/stg',
      }
    });

    nock('https://chat.googleapis.com')
      .post('/stg')
      .reply(200);

    await notifier.notify(payload, 'stg');
    // Verifica que foi enviado para /stg
  });

  it('should use default webhook when not specified', async () => {
    const notifier = createNotifier(schema, {
      webhookUrl: 'https://chat.googleapis.com/default',
    });

    nock('https://chat.googleapis.com')
      .post('/default')
      .reply(200);

    await notifier.notify(payload);
    // Verifica que foi enviado para /default
  });
});
```

**Pronto para começar a implementação genérica?** 🚀

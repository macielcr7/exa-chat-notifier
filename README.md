# @exa/chat-notifier

> 📢 Biblioteca Node.js + TypeScript para padronizar notificações no Google Chat com arquitetura plugável e suporte multi-webhook.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)

## 🚀 Características

- **✨ Arquitetura Plugável**: Crie schemas customizados para qualquer tipo de evento
- **🔄 Multi-Webhook**: Suporte a múltiplos webhooks nomeados via `CHAT_WEBHOOK_<NAME>`
- **� Batching**: Sistema de filas para otimizar envio em alto volume
- **�🔁 Retry com Exponential Backoff**: Retry automático em erros 429/5xx
- **🔒 Idempotência**: Cache com TTL para evitar notificações duplicadas
- **🔐 Segurança**: Separação de tokens (URL + TOKEN) para melhor proteção
- **📊 TombamentoSchema Embutido**: Schema pronto para eventos de tombamento de arquivos
- **📝 TypeScript First**: 100% tipado com suporte a inferência de tipos
- **✅ Testes Abrangentes**: 84 testes unitários com cobertura de 94%+

## 📦 Instalação

```bash
npm install @exa/chat-notifier
```

**Requisitos**: Node.js >= 20.x

## 🎯 Uso Rápido

### Tombamento de Arquivos (Schema Padrão)

```typescript
import { createTombamentoNotifier } from '@exa/chat-notifier';

// Configure via variáveis de ambiente (modo seguro)
process.env.CHAT_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/...';
process.env.CHAT_WEBHOOK_TOKEN = 'your_secret_token';

// Ou use URL completa (legacy)
// process.env.CHAT_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/...?key=KEY&token=TOKEN';

// Crie o notifier
const notifier = createTombamentoNotifier({
  level: 'important', // Filtra eventos PROCESSING
});

// Envie notificações com métodos convenientes
await notifier.uploaded({
  partner: 'ACME Corp',
  bucket: 'uploads',
  object: 'vendas_2024.csv',
});

await notifier.processed({
  partner: 'ACME Corp',
  bucket: 'uploads',
  object: 'vendas_2024.csv',
  counts: {
    received: 1000,
    valid: 980,
    invalid: 20,
    processed: 980,
  },
});

// Cleanup (importante!)
notifier.destroy();
```

### Schema Customizado (Exemplo: Deployments)

```typescript
import { createNotifier, type EventSchema } from '@exa/chat-notifier';

// 1. Defina seu payload
interface DeploymentPayload {
  status: 'started' | 'succeeded' | 'failed';
  service: string;
  version: string;
  environment: 'dev' | 'staging' | 'prod';
  message?: string;
}

// 2. Implemente o schema
class DeploymentSchema implements EventSchema<DeploymentPayload> {
  readonly name = 'deployment';

  buildCard(payload: DeploymentPayload, config: { maxMessage: number }) {
    const emoji = payload.status === 'succeeded' ? '✅' : payload.status === 'failed' ? '❌' : '🚀';
    
    return {
      cardsV2: [{
        cardId: 'deployment-card',
        card: {
          header: {
            title: `${emoji} Deployment ${payload.status.toUpperCase()}`,
            subtitle: `${payload.service} @ ${payload.environment}`,
          },
          sections: [{
            widgets: [
              { decoratedText: { topLabel: 'Versão', text: payload.version } },
              { decoratedText: { topLabel: 'Ambiente', text: payload.environment } },
              ...(payload.message ? [{ decoratedText: { topLabel: 'Mensagem', text: payload.message } }] : []),
            ],
          }],
        },
      }],
    };
  }

  isImportantEvent(status: string) {
    return status !== 'started'; // Filtra "started" quando level='important'
  }

  getIdempotencyKey(payload: DeploymentPayload) {
    return `${payload.service}:${payload.version}:${payload.status}`;
  }
}

// 3. Use o notifier
const notifier = createNotifier(new DeploymentSchema(), {
  level: 'important',
});

await notifier.notify({
  status: 'succeeded',
  service: 'api-gateway',
  version: 'v2.4.1',
  environment: 'prod',
});
```

## � Configuração

### Variáveis de Ambiente

#### 🔑 Modo Seguro (Recomendado): Token Separado

```bash
# Webhook padrão (URL base sem token)
CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/SPACE/messages?key=KEY
CHAT_WEBHOOK_TOKEN=secret_token_here

# Webhooks nomeados com tokens separados
CHAT_WEBHOOK_ERRORS=https://chat.googleapis.com/v1/spaces/ERRORS/messages?key=KEY1
CHAT_WEBHOOK_ERRORS_TOKEN=errors_token_here

CHAT_WEBHOOK_REPORTS=https://chat.googleapis.com/v1/spaces/REPORTS/messages?key=KEY2
CHAT_WEBHOOK_REPORTS_TOKEN=reports_token_here
```

**✅ Vantagens:**
- Tokens não aparecem em logs de URL
- Fácil rotação de credenciais (muda só o token)
- Melhor segurança em ambientes compartilhados

#### 🔓 Modo Legacy: URL Completa

```bash
# Webhook padrão (URL completa com token)
CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/SPACE/messages?key=KEY&token=TOKEN

# Webhooks nomeados
CHAT_WEBHOOK_ERRORS=https://chat.googleapis.com/v1/spaces/ERRORS/messages?key=KEY1&token=TOKEN1
CHAT_WEBHOOK_REPORTS=https://chat.googleapis.com/v1/spaces/REPORTS/messages?key=KEY2&token=TOKEN2
```

**⚠️ Modo legado mantido para retrocompatibilidade. Prefira o modo seguro.**

### NotifierOptions

```typescript
interface NotifierOptions<TPayload> {
  // Webhooks
  webhooks?: Record<string, string>;  // Múltiplos webhooks nomeados
  
  // Filtros
  level?: 'all' | 'important';        // default: 'all'
  
  // Mensagens
  maxMessage?: number;                 // default: 4000
  
  // HTTP
  timeoutMs?: number;                  // default: 10000
  retryMax?: number;                   // default: 3
  retryBaseMs?: number;                // default: 300
  
  // Cache
  idempotencyEnabled?: boolean;        // default: true
  idempotencyTtlMs?: number;          // default: 86400000 (24h)
  
  // Batching
  batchEnabled?: boolean;              // default: false
  batchSize?: number;                  // default: 10
  batchIntervalMs?: number;            // default: 5000
  batchFlushOnDestroy?: boolean;       // default: true
  
  // Callbacks
  onSuccess?: (payload: TPayload) => void;
  onError?: (payload: TPayload, error: Error) => void;
}
```

## 📚 API Reference

### `createTombamentoNotifier(options?)`

Cria notifier com schema de tombamento embutido.

**Métodos Convenientes**:
- `uploaded(data)`: Arquivo enviado para bucket
- `processing(data)`: Processamento iniciado
- `invalidSchema(data)`: Arquivo com schema inválido
- `processed(data)`: Processamento concluído
- `failed(data)`: Erro no processamento
- `reportGenerated(data)`: Relatório gerado

### `createNotifier(schema, options?)`

Cria notifier genérico com schema customizado.

### `EventSchema<TPayload, TEvent>`

Interface para schemas personalizados:

```typescript
interface EventSchema<TPayload, TEvent extends string = string> {
  readonly name: string;
  
  // Obrigatório: construir Cards v2
  buildCard(payload: TPayload, config: { maxMessage: number }): CardPayload;
  
  // Opcional: filtrar eventos importantes
  isImportantEvent?(event: TEvent): boolean;
  
  // Opcional: evitar duplicatas
  getIdempotencyKey?(payload: TPayload): string | undefined;
  
  // Opcional: roteamento multi-webhook
  getWebhookName?(payload: TPayload): string | undefined;
}
```

## 🔄 Multi-Webhook

### Via Configuração Programática

```typescript
const notifier = createTombamentoNotifier({
  webhooks: {
    errors: 'https://chat.googleapis.com/v1/spaces/ERRORS/...',
    reports: 'https://chat.googleapis.com/v1/spaces/REPORTS/...',
  },
});

// Usa webhook padrão (primeiro da lista)
await notifier.uploaded({ partner: 'ACME', bucket: 'uploads', object: 'file.csv' });

// Especifica webhook
await notifier.notify(
  { event: 'FAILED', partner: 'ACME', bucket: 'uploads', object: 'file.csv', message: 'Parse error' },
  'errors' // <-- nome do webhook
);
```

### Via Schema (getWebhookName)

```typescript
class SmartSchema implements EventSchema<MyPayload> {
  // ... outros métodos
  
  getWebhookName(payload: MyPayload) {
    if (payload.severity === 'critical') return 'alerts';
    if (payload.type === 'report') return 'reports';
    return undefined; // usa default
  }
}
```

## � Segurança e Boas Práticas

### 🔑 Separação de Tokens

**⚠️ Problema:** Tokens em URLs são expostos em logs, variáveis de ambiente e traces.

**✅ Solução:** Use variáveis separadas para tokens:

```bash
# ❌ Evite: token exposto na URL
CHAT_WEBHOOK_URL="https://chat.googleapis.com/v1/spaces/AAA/messages?key=KEY&token=SECRET123"

# ✅ Recomendado: token separado
CHAT_WEBHOOK_URL="https://chat.googleapis.com/v1/spaces/AAA/messages?key=KEY"
CHAT_WEBHOOK_TOKEN="SECRET123"
```

### 🔄 Rotação de Tokens

Com tokens separados, você pode rotacionar credenciais sem alterar URLs:

```bash
# 1. Atualizar apenas o token
export CHAT_WEBHOOK_TOKEN="new_token_456"

# 2. Reiniciar a aplicação
# Não precisa mudar CHAT_WEBHOOK_URL!
```

### 📝 Gerenciamento de Secrets

**Recomendações:**
- Use secret managers (AWS Secrets Manager, HashiCorp Vault, etc)
- Nunca commite tokens no código fonte
- Use .env files apenas em desenvolvimento (adicione ao .gitignore)
- Rotacione tokens periodicamente

```typescript
// Exemplo com AWS Secrets Manager
import { SecretsManager } from 'aws-sdk';

const secrets = new SecretsManager();
const secret = await secrets.getSecretValue({ SecretId: 'chat-webhook-token' }).promise();

process.env.CHAT_WEBHOOK_TOKEN = secret.SecretString;
const notifier = createTombamentoNotifier();
```

##  Idempotência

Evite notificações duplicadas automaticamente:

```typescript
const notifier = createTombamentoNotifier({
  idempotencyEnabled: true,      // default: true
  idempotencyTtlMs: 3600000,     // 1 hora
});

await notifier.processed({ partner: 'ACME', bucket: 'uploads', object: 'vendas.csv' });
await notifier.processed({ partner: 'ACME', bucket: 'uploads', object: 'vendas.csv' });
// ☝️ Segunda chamada é ignorada (mesmo idempotency key)
```

**Idempotency Key** é gerado via `EventSchema.getIdempotencyKey()`. No TombamentoSchema, usa SHA-1 de `event:bucket:object:processed_count`.

## 📦 Batching (Envio em Lote)

Otimize o envio de notificações em cenários de alto volume agrupando mensagens em lotes.

### ⚙️ Configuração via Variáveis de Ambiente

```bash
# Habilitar batching
CHAT_BATCH_ENABLED=true              # default: false (envio imediato)

# Tamanho do lote (envia quando atingir este número)
CHAT_BATCH_SIZE=10                   # default: 10 mensagens

# Intervalo de flush (envia a cada X milissegundos)
CHAT_BATCH_INTERVAL_MS=5000          # default: 5000ms (5 segundos)

# Flush no destroy (limpar fila ao destruir)
CHAT_BATCH_FLUSH_ON_EXIT=true        # default: true
```

### 🔧 Configuração Programática

```typescript
const notifier = createTombamentoNotifier({
  batchEnabled: true,
  batchSize: 10,
  batchIntervalMs: 5000,
  batchFlushOnDestroy: true,
});
```

### 📖 Como Funciona

**Modo Imediato (default)**: Cada notificação é enviada imediatamente.

```typescript
await notifier.notify(payload);  // HTTP request enviado imediatamente
```

**Modo Batch**: Notificações são enfileiradas e enviadas em lote quando:
1. **Tamanho atingido**: Fila atinge `batchSize` mensagens (ex: 10)
2. **Tempo decorrido**: Passa `batchIntervalMs` desde o último flush (ex: 5s)
3. **Flush manual**: Chamada explícita de `flush()`
4. **Destroy**: Ao destruir o notifier (se `batchFlushOnDestroy=true`)

```typescript
const notifier = createTombamentoNotifier({
  batchEnabled: true,
  batchSize: 5,
  batchIntervalMs: 3000,
});

// Enfileiradas (não envia ainda)
notifier.notify(payload1);
notifier.notify(payload2);
notifier.notify(payload3);
notifier.notify(payload4);
notifier.notify(payload5); // ⚡ Flush automático (atingiu batchSize=5)

// Aguarda 3 segundos...
notifier.notify(payload6);
notifier.notify(payload7);
// ⏰ Flush automático após 3s (mesmo sem atingir batchSize)

// Flush manual
await notifier.flush(); // 🔧 Força envio das pendentes

// Cleanup (flush automático das pendentes)
await notifier.destroy(); // 🧹 Envia restantes e limpa recursos
```

### 🎯 Casos de Uso

**✅ Quando Usar Batching:**
- Processamento em massa (ex: 1000 arquivos por minuto)
- Rate limiting do destino (evitar 429 Too Many Requests)
- Reduzir overhead de HTTP (menos requests = menos latência)
- Logs agregados (múltiplos eventos relacionados)

**❌ Quando NÃO Usar:**
- Notificações críticas em tempo real
- Volumes baixos (< 10 msg/minuto)
- Necessidade de feedback imediato

### 📊 Exemplo Completo: Node.js Puro

```typescript
import { createTombamentoNotifier } from '@exa/chat-notifier';

// Habilitar batching
const notifier = createTombamentoNotifier({
  batchEnabled: true,
  batchSize: 10,
  batchIntervalMs: 5000,
});

// Simular processamento em lote
const files = Array.from({ length: 25 }, (_, i) => `file_${i}.csv`);

for (const file of files) {
  // Enfileira (não bloqueia)
  notifier.uploaded({
    partner: 'ACME',
    bucket: 'uploads',
    object: file,
  });
}

// Lotes enviados:
// - 1º lote: 10 arquivos (atingiu batchSize)
// - 2º lote: 10 arquivos (atingiu batchSize)
// - 3º lote: 5 arquivos (após 5s ou no destroy)

// Aguardar flush manual (opcional)
await notifier.flush();

// Cleanup (envia pendentes + limpa timer)
await notifier.destroy();
```

### 🏢 Exemplo NestJS: Integração com Lifecycle

```typescript
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createTombamentoNotifier, type Notifier } from '@exa/chat-notifier';

@Injectable()
export class NotificationService implements OnModuleDestroy {
  private notifier: Notifier<any>;

  constructor() {
    this.notifier = createTombamentoNotifier({
      batchEnabled: process.env.CHAT_BATCH_ENABLED === 'true',
      batchSize: Number(process.env.CHAT_BATCH_SIZE) || 10,
      batchIntervalMs: Number(process.env.CHAT_BATCH_INTERVAL_MS) || 5000,
      batchFlushOnDestroy: true,
    });
  }

  async onModuleDestroy() {
    // NestJS chama ao desligar (SIGTERM, SIGINT, etc)
    await this.notifier.destroy();
  }

  async notifyFileUploaded(file: string) {
    this.notifier.uploaded({
      partner: 'ACME',
      bucket: 'uploads',
      object: file,
    });
  }

  async forceFlush() {
    // Endpoint administrativo para flush manual
    await this.notifier.flush();
  }
}
```

### ⚡ Performance: Batch vs Imediato

**Cenário**: 100 notificações

| Modo | Requests HTTP | Tempo Total | Overhead |
|------|---------------|-------------|----------|
| Imediato | 100 | ~5s | Alto |
| Batch (10 msg) | 10 | ~0.5s | Baixo |

**Trade-offs:**
- ✅ Batch: Menor latência total, menos overhead, melhor para rate limiting
- ❌ Batch: Atraso de até `batchIntervalMs` (default 5s)
- ✅ Imediato: Notificação instantânea
- ❌ Imediato: Alto overhead em volumes grandes

## 🚦 Filtro de Nível

### `level: 'all'` (default)

Envia todos os eventos.

### `level: 'important'`

Filtra eventos via `EventSchema.isImportantEvent()`. No TombamentoSchema:

- ✅ Envia: `UPLOADED`, `INVALID_SCHEMA`, `PROCESSED`, `FAILED`, `REPORT_GENERATED`
- ❌ Ignora: `PROCESSING`

```typescript
const notifier = createTombamentoNotifier({ level: 'important' });

await notifier.uploaded({ ... });    // ✅ Enviado
await notifier.processing({ ... });  // ❌ Ignorado
await notifier.processed({ ... });   // ✅ Enviado
```

## 🛠️ Desenvolvimento

```bash
# Instalar dependências
npm install

# Executar testes
npm test

# Executar testes com cobertura
npm run test:coverage

# Build
npm run build

# Lint
npm run lint

# Format
npm run format
```

## 📝 Licença

MIT © Exa Inc.

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor, abra uma issue ou pull request.

## 📖 Mais Exemplos

Veja [ARQUITETURA_GENERICA.md](./ARQUITETURA_GENERICA.md) para exemplos completos de schemas customizados (Monitoring, Deployments, etc).

---

**Desenvolvido com ❤️ pela equipe Exa**

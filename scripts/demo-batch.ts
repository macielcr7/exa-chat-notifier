#!/usr/bin/env ts-node
/* eslint-disable no-console */
/**
 * Demo: Batching System
 * 
 * Este script demonstra o sistema de batching da biblioteca @exa/chat-notifier.
 * 
 * Comportamento demonstrado:
 * 1. Flush por tamanho (10 mensagens)
 * 2. Flush por tempo (5 segundos)
 * 3. Flush manual via flush()
 * 4. Flush automático no destroy()
 * 
 * Para executar:
 * ```bash
 * # Configure o webhook (modo seguro recomendado)
 * export CHAT_WEBHOOK_URL="https://chat.googleapis.com/v1/spaces/.../messages?key=KEY"
 * export CHAT_WEBHOOK_TOKEN="your_token_here"
 * 
 * # Ou use URL completa (legacy)
 * export CHAT_WEBHOOK_URL="https://chat.googleapis.com/v1/spaces/.../messages?key=KEY&token=TOKEN"
 * 
 * # Execute o script
 * npm run demo:batch
 * ```
 */

import { createTombamentoNotifier } from '../src';

async function main() {
  console.log('🚀 Iniciando demo de Batching\n');

  // Verificar webhook configurado
  if (!process.env.CHAT_WEBHOOK_URL) {
    console.error('❌ CHAT_WEBHOOK_URL não configurado!');
    console.log('\nConfigure o webhook:');
    console.log('  export CHAT_WEBHOOK_URL="https://chat.googleapis.com/v1/spaces/.../messages?key=KEY"');
    console.log('  export CHAT_WEBHOOK_TOKEN="your_token_here"');
    process.exit(1);
  }

  // Criar notifier com batching habilitado
  const notifier = createTombamentoNotifier({
    batchEnabled: true,
    batchSize: 10, // Flush ao atingir 10 mensagens
    batchIntervalMs: 5000, // Flush a cada 5 segundos
    batchFlushOnDestroy: true, // Flush ao destruir
    onSuccess: (payload) => {
      console.log(`✅ Notificação enviada: ${payload.event} - ${payload.object}`);
    },
    onError: (payload, error) => {
      console.error(`❌ Erro ao enviar: ${payload.event} - ${payload.object}`, error.message);
    },
  });

  console.log('📋 Configuração:');
  console.log('  - Batch Size: 10 mensagens');
  console.log('  - Intervalo: 5 segundos');
  console.log('  - Flush on Destroy: true\n');

  // --- Parte 1: Flush por tamanho (10 mensagens) ---
  console.log('📦 Parte 1: Enviando 15 notificações (deve fazer 2 flushes)');
  console.log('  → Esperado: 1º flush aos 10 itens, 2º flush aos 5s ou manual\n');

  for (let i = 1; i <= 15; i++) {
    notifier.uploaded({
      partner: 'ACME Corp',
      bucket: 'demo-bucket',
      object: `file_${i.toString().padStart(2, '0')}.csv`,
    });
    console.log(`  [${i}/15] Enfileirado: file_${i.toString().padStart(2, '0')}.csv`);

    if (i === 10) {
      console.log('\n  ⚡ Flush automático (atingiu batchSize=10)\n');
      // Aguardar um pouco para ver o flush
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log('\n  ℹ️  Restam 5 mensagens na fila\n');

  // Aguardar 2 segundos
  console.log('⏳ Aguardando 2 segundos...\n');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // --- Parte 2: Adicionar mais 3 mensagens ---
  console.log('📦 Parte 2: Adicionando 3 mensagens de erro');
  console.log('  → Esperado: fila com 8 mensagens (5 antigas + 3 novas)\n');

  for (let i = 1; i <= 3; i++) {
    notifier.failed({
      partner: 'ACME Corp',
      bucket: 'demo-bucket',
      object: `error_${i}.csv`,
      message: 'Validation failed',
    });
    console.log(`  Enfileirado erro: error_${i}.csv`);
  }

  console.log('\n  ℹ️  Total na fila: 8 mensagens\n');

  // --- Parte 3: Flush manual ---
  console.log('🔧 Parte 3: Flush manual');
  console.log('  → Forçando envio das 8 mensagens pendentes\n');

  await notifier.flush();
  console.log('  ✅ Flush manual concluído\n');

  // Aguardar 1 segundo
  console.log('⏳ Aguardando 1 segundo...\n');
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // --- Parte 4: Flush por tempo ---
  console.log('📦 Parte 4: Testando flush por tempo');
  console.log('  → Enviando 3 mensagens e aguardando 5 segundos\n');

  for (let i = 1; i <= 3; i++) {
    notifier.processed({
      partner: 'ACME Corp',
      bucket: 'demo-bucket',
      object: `final_${i}.csv`,
      counts: {
        received: 100 * i,
        valid: 98 * i,
        invalid: 2 * i,
        processed: 98 * i,
      },
    });
    console.log(`  Enfileirado: final_${i}.csv`);
  }

  console.log('\n  ⏰ Aguardando flush automático em 5 segundos...\n');
  await new Promise((resolve) => setTimeout(resolve, 5500));

  console.log('  ✅ Flush por tempo concluído\n');

  // --- Parte 5: Flush no destroy ---
  console.log('📦 Parte 5: Testando flush no destroy');
  console.log('  → Enviando 2 mensagens e destruindo o notifier\n');

  notifier.reportGenerated({
    partner: 'ACME Corp',
    bucket: 'demo-bucket',
    object: 'report_final.xlsx',
    message: 'Relatório consolidado',
  });
  console.log('  Enfileirado: report_final.xlsx');

  notifier.uploaded({
    partner: 'ACME Corp',
    bucket: 'demo-bucket',
    object: 'last_file.csv',
  });
  console.log('  Enfileirado: last_file.csv');

  console.log('\n  🧹 Destruindo notifier (flush automático)...\n');
  await notifier.destroy();

  console.log('✅ Demo concluída!\n');
  console.log('📊 Resumo:');
  console.log('  - Total de mensagens: 23');
  console.log('  - Flushes automáticos por tamanho: 1 (10 msgs)');
  console.log('  - Flushes manuais: 1 (8 msgs)');
  console.log('  - Flushes automáticos por tempo: 1 (3 msgs)');
  console.log('  - Flushes no destroy: 1 (2 msgs)');
  console.log('  - Total de flushes: 4\n');
}

// Executar
main().catch((error) => {
  console.error('❌ Erro na execução:', error);
  process.exit(1);
});

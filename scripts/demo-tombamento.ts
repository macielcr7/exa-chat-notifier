#!/usr/bin/env ts-node
/**
 * Script de demonstração do TombamentoSchema
 * 
 * Executa: npm run demo
 */

/* eslint-disable no-console */

import { createTombamentoNotifier } from '../src';

// Configure o webhook do Google Chat (modo seguro - token separado)
process.env.CHAT_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAQAol58A3Y/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI';
process.env.CHAT_WEBHOOK_TOKEN = 'rH9REzxkExyw409J63SZVw4PLncJqZWhh415Qbznxmk';

// Modo legacy (URL completa) também funciona:
// process.env.CHAT_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAQAol58A3Y/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=rH9REzxkExyw409J63SZVw4PLncJqZWhh415Qbznxmk';

async function main() {
  console.log('🚀 Demonstração: @exa/chat-notifier (TombamentoSchema)\n');
  console.log('📡 Enviando notificações para o Google Chat...\n');

  // Criar notifier com configurações recomendadas
  const notifier = createTombamentoNotifier({
    level: 'important',      // Filtra eventos PROCESSING
    idempotencyEnabled: true, // Evita duplicatas
  });

  try {
    // ========== CENÁRIO 1: Upload de arquivo ==========
    console.log('📥 1. Enviando notificação de UPLOAD...');
    await notifier.uploaded({
      partner: 'Partner Teste',
      bucket: 'data-uploads',
      object: 'example_2025_Q4.csv',
      trace_id: 'demo-123456',
    });
    console.log('   ✅ Notificação de upload enviada!\n');

    // Aguarda 1s para não sobrecarregar
    await sleep(1000);

    // ========== CENÁRIO 2: Processamento concluído ==========
    console.log('✅ 2. Enviando notificação de PROCESSAMENTO CONCLUÍDO...');
    await notifier.processed({
      partner: 'Partner Teste',
      bucket: 'data-uploads',
      object: 'example_2025_Q4.csv',
      counts: {
        received: 1000,
        valid: 980,
        invalid: 20,
        processed: 980,
      },
      message: 'Processamento concluído com sucesso. 980 registros válidos processados.',
      trace_id: 'demo-123456',
    });
    console.log('   ✅ Notificação de processamento enviada!\n');

    await sleep(1000);

    // ========== CENÁRIO 3: Erro de schema inválido ==========
    console.log('❌ 3. Enviando notificação de ERRO (Schema Inválido)...');
    await notifier.invalidSchema({
      partner: 'Partner Teste',
      bucket: 'data-uploads',
      object: 'example_invalido.csv',
      message: 'Erro na linha 42: campo "data" não corresponde ao formato esperado (YYYY-MM-DD)',
      trace_id: 'demo-789012',
    });
    console.log('   ✅ Notificação de erro enviada!\n');

    await sleep(1000);

    // ========== CENÁRIO 4: Falha no processamento ==========
    console.log('🔥 4. Enviando notificação de FALHA...');
    await notifier.failed({
      partner: 'Partner Teste',
      bucket: 'data-uploads',
      object: 'example_erro.csv',
      message: 'Timeout ao conectar com banco de dados. Tentativa 3/3 falhou.',
      trace_id: 'demo-345678',
    });
    console.log('   ✅ Notificação de falha enviada!\n');

    await sleep(1000);

    // ========== CENÁRIO 5: Relatório gerado ==========
    console.log('📄 5. Enviando notificação de RELATÓRIO GERADO...');
    await notifier.reportGenerated({
      partner: 'Partner Teste',
      bucket: 'data-reports',
      object: 'example_relatorio.pdf',
      counts: {
        processed: 980,
      },
      message: 'Relatório consolidado de example do Q4 disponível para download.',
      trace_id: 'demo-123456',
    });
    console.log('   ✅ Notificação de relatório enviada!\n');

    await sleep(1000);

    console.log('=' .repeat(70));
    console.log('✅ Demonstração concluída com sucesso!');
    console.log('=' .repeat(70));
    console.log('\n📱 Verifique seu Google Chat para ver as notificações.');
    console.log('💡 Dicas:');
    console.log('   - Eventos PROCESSING foram filtrados (level=important)');
    console.log('   - Cada tipo de evento tem emoji e cor diferentes');
    console.log('   - Duplicatas são automaticamente bloqueadas (idempotência)');

  } catch (error) {
    console.error('\n❌ Erro ao enviar notificação:', error);
    if (error instanceof Error) {
      console.error('   Detalhes:', error.message);
    }
    process.exit(1);
  } finally {
    // Cleanup
    notifier.destroy();
    console.log('\n🧹 Recursos liberados (cache/timers).');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Executar
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

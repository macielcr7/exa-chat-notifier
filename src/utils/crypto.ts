import { createHash } from 'crypto';

/**
 * Gera hash SHA-1 de uma string
 * @param data String para hash
 * @returns Hash SHA-1 em hexadecimal (40 caracteres)
 */
export function sha1(data: string): string {
  return createHash('sha1').update(data, 'utf8').digest('hex');
}

/**
 * Gera chave de threading baseada em bucket e object
 * Usado para agrupar mensagens relacionadas ao mesmo arquivo
 * @param bucket Nome do bucket
 * @param object Caminho do objeto
 * @returns Thread key (SHA-1)
 */
export function generateThreadKey(bucket: string, object: string): string {
  return sha1(`${bucket}:${object}`);
}

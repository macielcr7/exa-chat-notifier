/**
 * Trunca uma mensagem para o tamanho máximo especificado
 * Adiciona "…" (ellipsis) ao final se truncado
 * @param text Texto para truncar
 * @param maxLength Tamanho máximo
 * @returns Texto truncado
 */
export function truncateMessage(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  if (maxLength <= 1) {
    return '…';
  }

  return text.substring(0, maxLength - 1) + '…';
}

export function isRawMediaBase64OrKey(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  // Se contiver espaços ou quebras de linha, é um texto normal digitado por um humano
  if (/\s/.test(trimmed)) return false;

  // Se for maior que 24 caracteres e parecer um base64/hash puro sem espaços
  if (trimmed.length >= 24) {
    if (
      trimmed.startsWith('/9j/') ||
      trimmed.startsWith('iVBORw0KGgo') ||
      trimmed.startsWith('R0lGODlh') ||
      trimmed.startsWith('UklGR') ||
      trimmed.startsWith('data:image/') ||
      trimmed.startsWith('data:video/')
    ) {
      return true;
    }
    // String contínua de base64 terminada em = ou == ou hash sem espaços
    if (/^[A-Za-z0-9+/=]{32,}$/.test(trimmed)) {
      return true;
    }
  }
  return false;
}

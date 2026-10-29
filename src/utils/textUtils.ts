export function isRawMediaBase64OrKey(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  // Se contiver espaços ou quebras de linha, é um texto normal digitado por um humano
  if (/\s/.test(trimmed)) return false;

  // Headers conhecidos de imagem/vídeo em base64
  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('data:video/') ||
    trimmed.startsWith('/9j/') ||
    trimmed.startsWith('iVBORw0KGgo') ||
    trimmed.startsWith('R0lGODlh') ||
    trimmed.startsWith('UklGR')
  ) {
    return true;
  }

  // Se for menor que 32 caracteres, não é chave nem blob de mídia
  if (trimmed.length < 32) return false;

  // Se for composto exclusivamente por letras (ex: 'kkkkk...', 'hahaha...', risadas ou palavras longas), é texto humano
  if (/^[A-Za-zÀ-ÿ]+$/.test(trimmed)) return false;

  // Pouca variedade de caracteres distintos (ex: repetições, risadas, spam de teclado)
  const uniqueChars = new Set(trimmed);
  if (uniqueChars.size <= 5) return false;

  // Chave de mídia criptografada do WhatsApp (40-70 caracteres em base64 terminando em =)
  if (/^[A-Za-z0-9+/=]{40,70}$/.test(trimmed) && trimmed.endsWith('=') && /[0-9]/.test(trimmed)) {
    return true;
  }

  // Blob longo de base64 de imagem/mídia (mais de 100 caracteres com caracteres base64 e números)
  if (trimmed.length >= 100 && /^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    const hasSymbols = /[+/=]/.test(trimmed);
    const hasDigits = /[0-9]/.test(trimmed);
    const hasUpper = /[A-Z]/.test(trimmed);
    const hasLower = /[a-z]/.test(trimmed);
    if (hasDigits && (hasSymbols || (hasUpper && hasLower))) {
      return true;
    }
  }

  return false;
}

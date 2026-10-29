export type FormatType =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'monospace'
  | 'quote'
  | 'bullet'
  | 'number';

export interface FormatResult {
  nextText: string;
  newStart: number;
  newEnd: number;
}

/**
 * Aplica ou remove formatação no texto selecionado do WhatsApp.
 * - Negrito: *texto*
 * - Itálico: _texto_
 * - Tachado: ~texto~
 * - Monoespaçado: ```texto```
 * - Citação: > texto
 * - Lista com marcadores: - texto
 * - Lista numerada: 1. texto
 */
export function formatSelectedText(
  type: FormatType,
  fullText: string,
  start: number,
  end: number
): FormatResult {
  if (start === end) {
    return { nextText: fullText, newStart: start, newEnd: end };
  }

  const s = Math.min(start, end);
  const e = Math.max(start, end);
  const selected = fullText.substring(s, e);
  const before = fullText.substring(0, s);
  const after = fullText.substring(e);

  // Formatações inline delimitadas por caracteres especiais (*, _, ~)
  if (type === 'bold' || type === 'italic' || type === 'strikethrough') {
    const char = type === 'bold' ? '*' : type === 'italic' ? '_' : '~';

    // 1. Caso a própria seleção contenha os delimitadores: *texto*
    if (selected.length >= 2 && selected.startsWith(char) && selected.endsWith(char)) {
      const unwrapped = selected.slice(1, -1);
      return {
        nextText: before + unwrapped + after,
        newStart: s,
        newEnd: s + unwrapped.length,
      };
    }

    // 2. Caso os delimitadores estejam logo fora da seleção: *|texto|*
    if (s > 0 && e < fullText.length && fullText[s - 1] === char && fullText[e] === char) {
      const nextText = fullText.substring(0, s - 1) + selected + fullText.substring(e + 1);
      return {
        nextText,
        newStart: s - 1,
        newEnd: s - 1 + selected.length,
      };
    }

    // 3. Aplicar formatação envolvendo o texto selecionado
    const wrapped = `${char}${selected}${char}`;
    return {
      nextText: before + wrapped + after,
      newStart: s,
      newEnd: s + wrapped.length,
    };
  }

  // Monoespaçado (```texto```)
  if (type === 'monospace') {
    const delim = '```';

    // 1. A seleção começa e termina com ```
    if (selected.length >= 6 && selected.startsWith(delim) && selected.endsWith(delim)) {
      const unwrapped = selected.slice(3, -3);
      return {
        nextText: before + unwrapped + after,
        newStart: s,
        newEnd: s + unwrapped.length,
      };
    }

    // 2. Os delimitadores ``` estão logo fora da seleção
    if (
      s >= 3 &&
      e + 3 <= fullText.length &&
      fullText.substring(s - 3, s) === delim &&
      fullText.substring(e, e + 3) === delim
    ) {
      const nextText = fullText.substring(0, s - 3) + selected + fullText.substring(e + 3);
      return {
        nextText,
        newStart: s - 3,
        newEnd: s - 3 + selected.length,
      };
    }

    // 3. Aplicar delimitadores ```
    const wrapped = `${delim}${selected}${delim}`;
    return {
      nextText: before + wrapped + after,
      newStart: s,
      newEnd: s + wrapped.length,
    };
  }

  // Citação de bloco (> texto)
  if (type === 'quote') {
    const lines = selected.split('\n');
    const allQuoted = lines.every(
      (line) => line.trim() === '' || line.startsWith('> ') || line.startsWith('>')
    );

    let newLines: string[];
    if (allQuoted) {
      newLines = lines.map((line) => line.replace(/^>\s?/, ''));
    } else {
      newLines = lines.map((line) => (line.trim() === '' ? line : `> ${line}`));
    }

    const joined = newLines.join('\n');
    return {
      nextText: before + joined + after,
      newStart: s,
      newEnd: s + joined.length,
    };
  }

  // Lista com Marcadores (- item)
  if (type === 'bullet') {
    const lines = selected.split('\n');
    const allBulleted = lines.every((line) => line.trim() === '' || /^[-*]\s/.test(line));

    let newLines: string[];
    if (allBulleted) {
      newLines = lines.map((line) => line.replace(/^[-*]\s/, ''));
    } else {
      newLines = lines.map((line) => (line.trim() === '' ? line : `- ${line}`));
    }

    const joined = newLines.join('\n');
    return {
      nextText: before + joined + after,
      newStart: s,
      newEnd: s + joined.length,
    };
  }

  // Lista Numerada (1. item)
  if (type === 'number') {
    const lines = selected.split('\n');
    const allNumbered = lines.every((line) => line.trim() === '' || /^\d+\.\s/.test(line));

    let newLines: string[];
    if (allNumbered) {
      newLines = lines.map((line) => line.replace(/^\d+\.\s/, ''));
    } else {
      let count = 1;
      newLines = lines.map((line) => {
        if (line.trim() === '') return line;
        return `${count++}. ${line}`;
      });
    }

    const joined = newLines.join('\n');
    return {
      nextText: before + joined + after,
      newStart: s,
      newEnd: s + joined.length,
    };
  }

  return { nextText: fullText, newStart: s, newEnd: e };
}

/**
 * Verifica se um formato específico já está ativo no texto selecionado.
 */
export function isFormatActive(
  type: FormatType,
  fullText: string,
  start: number,
  end: number
): boolean {
  if (start === end) return false;
  const s = Math.min(start, end);
  const e = Math.max(start, end);
  const selected = fullText.substring(s, e);

  if (type === 'bold') {
    if (selected.length >= 2 && selected.startsWith('*') && selected.endsWith('*')) return true;
    if (s > 0 && e < fullText.length && fullText[s - 1] === '*' && fullText[e] === '*') return true;
    return false;
  }
  if (type === 'italic') {
    if (selected.length >= 2 && selected.startsWith('_') && selected.endsWith('_')) return true;
    if (s > 0 && e < fullText.length && fullText[s - 1] === '_' && fullText[e] === '_') return true;
    return false;
  }
  if (type === 'strikethrough') {
    if (selected.length >= 2 && selected.startsWith('~') && selected.endsWith('~')) return true;
    if (s > 0 && e < fullText.length && fullText[s - 1] === '~' && fullText[e] === '~') return true;
    return false;
  }
  if (type === 'monospace') {
    if (selected.length >= 6 && selected.startsWith('```') && selected.endsWith('```')) return true;
    if (
      s >= 3 &&
      e + 3 <= fullText.length &&
      fullText.substring(s - 3, s) === '```' &&
      fullText.substring(e, e + 3) === '```'
    ) {
      return true;
    }
    return false;
  }
  if (type === 'quote') {
    const lines = selected.split('\n').filter((l) => l.trim().length > 0);
    return lines.length > 0 && lines.every((l) => l.startsWith('>'));
  }
  if (type === 'bullet') {
    const lines = selected.split('\n').filter((l) => l.trim().length > 0);
    return lines.length > 0 && lines.every((l) => /^[-*]\s/.test(l));
  }
  if (type === 'number') {
    const lines = selected.split('\n').filter((l) => l.trim().length > 0);
    return lines.length > 0 && lines.every((l) => /^\d+\.\s/.test(l));
  }
  return false;
}

/**
 * Calcula o ponto horizontal central da seleção do texto dentro do textarea em pixels.
 */
export function getSelectionHorizontalOffset(
  textarea: HTMLTextAreaElement,
  start: number,
  end: number
): number {
  try {
    if (start === end || typeof window === 'undefined') {
      return textarea.clientWidth / 2;
    }

    const computed = window.getComputedStyle(textarea);
    const mirror = document.createElement('div');
    mirror.style.position = 'absolute';
    mirror.style.top = '-9999px';
    mirror.style.left = '-9999px';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordBreak = 'break-word';
    mirror.style.width = `${textarea.clientWidth}px`;
    mirror.style.font = computed.font;
    mirror.style.fontSize = computed.fontSize;
    mirror.style.fontFamily = computed.fontFamily;
    mirror.style.lineHeight = computed.lineHeight;
    mirror.style.paddingLeft = computed.paddingLeft;
    mirror.style.paddingRight = computed.paddingRight;
    mirror.style.boxSizing = computed.boxSizing;

    const beforeText = textarea.value.substring(0, start);
    const selectedText = textarea.value.substring(start, end);

    const spanBefore = document.createElement('span');
    spanBefore.textContent = beforeText;

    const spanSelected = document.createElement('span');
    spanSelected.textContent = selectedText;

    mirror.appendChild(spanBefore);
    mirror.appendChild(spanSelected);
    document.body.appendChild(mirror);

    const offsetLeft = spanSelected.offsetLeft + spanSelected.offsetWidth / 2;
    document.body.removeChild(mirror);

    return Math.max(12, Math.min(textarea.clientWidth - 12, offsetLeft));
  } catch {
    return textarea.clientWidth / 2;
  }
}

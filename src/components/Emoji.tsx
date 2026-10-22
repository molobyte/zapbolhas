import React, { useState } from 'react';

/**
 * Converte qualquer sequência unicode de emoji para o código hexadecimal do Twemoji.
 * A convenção do Twemoji remove U+FE0F (variação de emoji), exceto em sequências de teclas (keycaps com U+20E3).
 */
export function getTwemojiCode(raw: string): string {
  if (!raw) return '';
  // Se contiver U+20E3 (keycap como #️⃣ ou 1️⃣), preserva U+FE0F. Caso contrário, remove U+FE0F.
  const cleaned = raw.indexOf('\u20E3') >= 0 ? raw : raw.replace(/\uFE0F/g, '');
  const r: string[] = [];
  let c = 0;
  let p = 0;
  let i = 0;
  while (i < cleaned.length) {
    c = cleaned.charCodeAt(i++);
    if (p) {
      r.push((0x10000 + ((p - 0xd800) << 10) + (c - 0xdc00)).toString(16));
      p = 0;
    } else if (0xd800 <= c && c <= 0xdbff) {
      p = c;
    } else {
      r.push(c.toString(16));
    }
  }
  return r.join('-');
}

/**
 * Retorna a URL SVG oficial do Twemoji CDN (cdnjs).
 */
export function getTwemojiUrl(emoji: string): string {
  const code = getTwemojiCode(emoji);
  if (!code) return '';
  return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${code}.svg`;
}

interface EmojiProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  char: string;
  className?: string;
  size?: number | string;
}

/**
 * Componente universal de Emoji que renderiza gráficos vetoriais SVG de alta qualidade via Twemoji CDN.
 * Resolve problemas de emojis ausentes ou monocromáticos no Windows (como bandeiras de países que viravam texto 'ML'
 * ou corações vermelhos que apareciam como contorno branco).
 * Possui fallback automático gracioso para o caractere de texto original caso falhe o carregamento.
 */
export const Emoji: React.FC<EmojiProps> = ({
  char,
  className = '',
  size,
  alt,
  style,
  ...rest
}) => {
  const [hasError, setHasError] = useState(false);
  const code = getTwemojiCode(char);
  const src = code ? `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${code}.svg` : '';

  if (!src || hasError) {
    return <span className={`inline-block select-none ${className}`}>{char}</span>;
  }

  const computedStyle: React.CSSProperties = {
    ...(size
      ? {
          width: typeof size === 'number' ? `${size}px` : size,
          height: typeof size === 'number' ? `${size}px` : size,
        }
      : {}),
    ...style,
  };

  return (
    <img
      src={src}
      alt={alt || char}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setHasError(true)}
      className={`inline-block select-none pointer-events-none object-contain ${className}`}
      style={computedStyle}
      {...rest}
    />
  );
};

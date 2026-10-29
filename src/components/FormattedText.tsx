import React from 'react';
import { isRawMediaBase64OrKey } from '../utils/textUtils';

interface FormattedTextProps {
  text: string;
  mentions?: string[];
  className?: string;
}

// Regex aprimorada para capturar URLs http/https, www.* e domínios comuns (.com, .com.br, etc.)
// sem capturar pontuação final (como pontos, vírgulas, parênteses ou aspas)
const URL_REGEX =
  /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|www\.[^\s<]+[^<.,:;"')\]\s]|[a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.(?:com\.br|com|org|net|edu|gov|io|ai|app|dev|br|me|co|tv|gl|gg|link|info)(?:\/[^\s<]*[^<.,:;"')\]\s])?)/gi;

const DEFAULT_MENTION_BASE = '[a-zA-Z0-9_\\u00C0-\\u00FF]+';

function buildMentionRegex(mentions?: string[]): RegExp {
  if (!mentions || mentions.length === 0) {
    return new RegExp(`(^|\\s)(@${DEFAULT_MENTION_BASE})`, 'g');
  }

  const escaped = mentions
    .filter(Boolean)
    .map((m) => m.replace(/^@/, '').trim())
    .filter(Boolean)
    .map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length);

  if (escaped.length === 0) {
    return new RegExp(`(^|\\s)(@${DEFAULT_MENTION_BASE})`, 'g');
  }

  return new RegExp(`(^|\\s)(@(?:${escaped.join('|')}|${DEFAULT_MENTION_BASE}))`, 'g');
}

/**
 * Parser de formatação inline do WhatsApp (*negrito*, _itálico_, ~tachado~, ```mono```)
 */
function parseInlineMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
  if (!text) return [];

  // Se não contiver caracteres de formatação do WhatsApp, retorna o texto puro diretamente
  if (!/[*_~`]/.test(text)) {
    return [text];
  }

  const regex =
    /(```[\s\S]*?```|`[^`\n]+`|(?<=^|\s|[^\w*])\*([^\s*](?:[\s\S]*?[^\s*])?)\*(?=$|\s|[^\w*])|(?<=^|\s|[^\w_])_([^\s_](?:[\s\S]*?[^\s_])?)_(?=$|\s|[^\w_])|(?<=^|\s|[^\w~])~([^\s~](?:[\s\S]*?[^\s~])?)~(?=$|\s|[^\w~]))/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    const fullMatch = match[0];

    if (matchIndex > lastIndex) {
      nodes.push(text.slice(lastIndex, matchIndex));
    }

    const itemKey = `${keyPrefix}-${matchIndex}`;

    if (fullMatch.startsWith('```') && fullMatch.endsWith('```') && fullMatch.length >= 6) {
      nodes.push(
        <code
          key={itemKey}
          className="font-mono bg-black/30 px-1 py-0.5 rounded text-[12px] text-[#25D366] border border-white/10"
        >
          {fullMatch.slice(3, -3)}
        </code>
      );
    } else if (fullMatch.startsWith('`') && fullMatch.endsWith('`') && fullMatch.length >= 2) {
      nodes.push(
        <code
          key={itemKey}
          className="font-mono bg-black/30 px-1 py-0.5 rounded text-[12px] text-[#25D366] border border-white/10"
        >
          {fullMatch.slice(1, -1)}
        </code>
      );
    } else if (fullMatch.startsWith('*') && fullMatch.endsWith('*')) {
      const inner = fullMatch.slice(1, -1);
      nodes.push(
        <strong key={itemKey} className="font-semibold text-inherit">
          {parseInlineMarkdown(inner, `${itemKey}-b`)}
        </strong>
      );
    } else if (fullMatch.startsWith('_') && fullMatch.endsWith('_')) {
      const inner = fullMatch.slice(1, -1);
      nodes.push(
        <em key={itemKey} className="italic text-inherit">
          {parseInlineMarkdown(inner, `${itemKey}-i`)}
        </em>
      );
    } else if (fullMatch.startsWith('~') && fullMatch.endsWith('~')) {
      const inner = fullMatch.slice(1, -1);
      nodes.push(
        <del key={itemKey} className="line-through opacity-85 text-inherit">
          {parseInlineMarkdown(inner, `${itemKey}-s`)}
        </del>
      );
    } else {
      nodes.push(fullMatch);
    }

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/**
 * Renderiza o texto com suporte a blocos (citações e listas) e formatações inline.
 */
function renderWhatsAppMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
  if (!text) return [];

  // Se não contiver caracteres especiais de bloco nem de formatação, retorna imediatamente
  if (!/[*_~`>\-]/.test(text) && !/^\d+\.\s/m.test(text)) {
    return [text];
  }

  const lines = text.split('\n');
  if (lines.length === 1) {
    const line = lines[0];
    if (line.startsWith('>')) {
      return [
        <span
          key={`${keyPrefix}-q`}
          className="block border-l-2 border-[#00A884] pl-2 my-0.5 text-[#B8C7C4] italic select-text"
        >
          {parseInlineMarkdown(line.replace(/^>\s?/, ''), `${keyPrefix}-qi`)}
        </span>,
      ];
    }
    const bulletMatch = line.match(/^[-*]\s+/);
    if (bulletMatch) {
      return [
        <span key={`${keyPrefix}-bl`} className="flex items-start gap-1.5 my-0.5 select-text">
          <span className="text-[#00A884] select-none font-bold leading-none mt-1">•</span>
          <span>{parseInlineMarkdown(line.slice(bulletMatch[0].length), `${keyPrefix}-bli`)}</span>
        </span>,
      ];
    }
    const numMatch = line.match(/^(\d+\.)\s+/);
    if (numMatch) {
      return [
        <span key={`${keyPrefix}-nl`} className="flex items-start gap-1.5 my-0.5 select-text">
          <span className="text-[#00A884] font-medium select-none tabular-nums text-[12px]">
            {numMatch[1]}
          </span>
          <span>{parseInlineMarkdown(line.slice(numMatch[0].length), `${keyPrefix}-nli`)}</span>
        </span>,
      ];
    }
    return parseInlineMarkdown(line, keyPrefix);
  }

  const result: React.ReactNode[] = [];
  lines.forEach((line, index) => {
    const lineKey = `${keyPrefix}-l-${index}`;

    if (line.startsWith('>')) {
      result.push(
        <span
          key={lineKey}
          className="block border-l-2 border-[#00A884] pl-2 my-0.5 text-[#B8C7C4] italic select-text"
        >
          {parseInlineMarkdown(line.replace(/^>\s?/, ''), `${lineKey}-qi`)}
        </span>
      );
    } else {
      const bulletMatch = line.match(/^[-*]\s+/);
      if (bulletMatch) {
        result.push(
          <span key={lineKey} className="flex items-start gap-1.5 my-0.5 select-text">
            <span className="text-[#00A884] select-none font-bold leading-none mt-1">•</span>
            <span>{parseInlineMarkdown(line.slice(bulletMatch[0].length), `${lineKey}-bli`)}</span>
          </span>
        );
      } else {
        const numMatch = line.match(/^(\d+\.)\s+/);
        if (numMatch) {
          result.push(
            <span key={lineKey} className="flex items-start gap-1.5 my-0.5 select-text">
              <span className="text-[#00A884] font-medium select-none tabular-nums text-[12px]">
                {numMatch[1]}
              </span>
              <span>{parseInlineMarkdown(line.slice(numMatch[0].length), `${lineKey}-nli`)}</span>
            </span>
          );
        } else {
          result.push(...parseInlineMarkdown(line, lineKey));
        }
      }
    }

    if (index < lines.length - 1) {
      result.push('\n');
    }
  });

  return result;
}

function renderTextWithMentions(str: string, keyPrefix: string, mentions?: string[]): React.ReactNode[] {
  if (!str) return [];
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const regex = buildMentionRegex(mentions);

  while ((match = regex.exec(str)) !== null) {
    const fullMatch = match[0];
    const leadingSpace = match[1];
    const mentionTag = match[2];
    const matchIndex = match.index;

    if (matchIndex > last) {
      nodes.push(...renderWhatsAppMarkdown(str.slice(last, matchIndex), `${keyPrefix}-pre-${last}`));
    }
    if (leadingSpace) {
      nodes.push(leadingSpace);
    }
    nodes.push(
      <span
        key={`${keyPrefix}-m-${matchIndex}`}
        className="text-[#53BDEB] font-medium hover:underline cursor-pointer select-text"
      >
        {mentionTag}
      </span>
    );
    last = matchIndex + fullMatch.length;
  }

  if (last < str.length) {
    nodes.push(...renderWhatsAppMarkdown(str.slice(last), `${keyPrefix}-post-${last}`));
  }
  return nodes;
}

export const openBrowserUrl = (rawUrl: string) => {
  if (!rawUrl || typeof rawUrl !== 'string') return;
  let target = rawUrl.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target)) {
    target = `https://${target}`;
  }
  if (window.electronAPI?.openExternalUrl) {
    window.electronAPI.openExternalUrl(target);
  } else {
    window.open(target, '_blank', 'noopener,noreferrer');
  }
};

export const FormattedText: React.FC<FormattedTextProps> = ({ text, mentions, className }) => {
  if (!text || isRawMediaBase64OrKey(text)) return null;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(URL_REGEX);

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchedUrl = match[0];

    if (matchIndex > lastIndex) {
      parts.push(...renderTextWithMentions(text.slice(lastIndex, matchIndex), `t-${lastIndex}`, mentions));
    }

    let targetHref = matchedUrl;
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(targetHref)) {
      targetHref = `https://${targetHref}`;
    }

    parts.push(
      <a
        key={`${matchIndex}-${matchedUrl}`}
        href={targetHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openBrowserUrl(targetHref);
        }}
        title={`Abrir no navegador padrão: ${targetHref}`}
        className="text-[#53BDEB] hover:text-[#78cbf1] underline underline-offset-2 break-all cursor-pointer font-medium transition-colors"
      >
        {matchedUrl}
      </a>
    );

    lastIndex = matchIndex + matchedUrl.length;
  }

  if (lastIndex < text.length) {
    parts.push(...renderTextWithMentions(text.slice(lastIndex), `t-${lastIndex}`, mentions));
  }

  return (
    <span className={`whitespace-pre-wrap select-text ${className || ''}`}>
      {parts}
    </span>
  );
};

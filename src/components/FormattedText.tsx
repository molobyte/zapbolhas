import React from 'react';

interface FormattedTextProps {
  text: string;
  className?: string;
}

// Regex aprimorada para capturar URLs http/https, www.* e domínios comuns (.com, .com.br, etc.)
// sem capturar pontuação final (como pontos, vírgulas, parênteses ou aspas)
const URL_REGEX =
  /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|www\.[^\s<]+[^<.,:;"')\]\s]|[a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.(?:com\.br|com|org|net|edu|gov|io|ai|app|dev|br|me|co|tv|gl|gg|link|info)(?:\/[^\s<]*[^<.,:;"')\]\s])?)/gi;

const MENTION_REGEX = /(^|\s)(@[a-zA-Z0-9_\u00C0-\u00FF]+)/g;

function renderTextWithMentions(str: string, keyPrefix: string): React.ReactNode[] {
  if (!str) return [];
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_REGEX);

  while ((match = regex.exec(str)) !== null) {
    const fullMatch = match[0];
    const leadingSpace = match[1];
    const mentionTag = match[2];
    const matchIndex = match.index;

    if (matchIndex > last) {
      nodes.push(str.slice(last, matchIndex));
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
    nodes.push(str.slice(last));
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

export const FormattedText: React.FC<FormattedTextProps> = ({ text, className }) => {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(URL_REGEX);

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchedUrl = match[0];

    if (matchIndex > lastIndex) {
      parts.push(...renderTextWithMentions(text.slice(lastIndex, matchIndex), `t-${lastIndex}`));
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
    parts.push(...renderTextWithMentions(text.slice(lastIndex), `t-${lastIndex}`));
  }

  return (
    <span className={`whitespace-pre-wrap select-text ${className || ''}`}>
      {parts}
    </span>
  );
};

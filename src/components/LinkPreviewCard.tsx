import React, { useEffect, useState, useMemo } from 'react';
import { Play, ExternalLink, Loader2 } from 'lucide-react';
import { LinkPreviewData } from '../types/whatsapp';
import { openBrowserUrl } from './FormattedText';

interface LinkPreviewCardProps {
  text: string;
  fromMe: boolean;
}

interface ParsedLinkTarget {
  provider: 'youtube' | 'twitter';
  url: string;
  cacheKey: string;
  videoId?: string;
  tweetId?: string;
  handle?: string;
}

const rendererPreviewCache = new Map<string, LinkPreviewData | null>();
const inflightPreviewRequests = new Map<string, Promise<LinkPreviewData | null>>();

const URL_SCAN_REGEX =
  /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|www\.[^\s<]+[^<.,:;"')\]\s]|(?:youtube\.com|youtu\.be|m\.youtube\.com|twitter\.com|x\.com|fxtwitter\.com|vxtwitter\.com|fixupx\.com)\/[^\s<]+[^<.,:;"')\]\s])/gi;

const YT_ID_REGEX =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;

const TW_STATUS_REGEX =
  /(?:twitter\.com|x\.com|fxtwitter\.com|vxtwitter\.com|fixupx\.com)\/(?:([^/?#]+)\/status(?:es)?\/|i\/(?:web\/)?status\/)(\d+)/i;

export function extractPreviewTarget(text: string): ParsedLinkTarget | null {
  if (!text) return null;
  const regex = new RegExp(URL_SCAN_REGEX);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    let rawUrl = match[0];
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl)) {
      rawUrl = `https://${rawUrl}`;
    }

    const ytMatch = YT_ID_REGEX.exec(rawUrl);
    if (ytMatch && ytMatch[1]) {
      const videoId = ytMatch[1];
      return {
        provider: 'youtube',
        url: rawUrl,
        cacheKey: `yt:${videoId}`,
        videoId,
      };
    }

    const twMatch = TW_STATUS_REGEX.exec(rawUrl);
    if (twMatch && twMatch[2]) {
      const handle = twMatch[1] && twMatch[1].toLowerCase() !== 'i' ? twMatch[1] : undefined;
      const tweetId = twMatch[2];
      return {
        provider: 'twitter',
        url: rawUrl,
        cacheKey: `tw:${tweetId}`,
        tweetId,
        handle,
      };
    }
  }

  return null;
}

async function fetchPreviewData(target: ParsedLinkTarget): Promise<LinkPreviewData | null> {
  if (rendererPreviewCache.has(target.cacheKey)) {
    return rendererPreviewCache.get(target.cacheKey) || null;
  }

  const existingInflight = inflightPreviewRequests.get(target.cacheKey);
  if (existingInflight) {
    return existingInflight;
  }

  const requestPromise = (async (): Promise<LinkPreviewData | null> => {
    try {
      if (window.electronAPI?.fetchLinkPreview) {
        const res = await window.electronAPI.fetchLinkPreview(target.url);
        if (res) {
          rendererPreviewCache.set(target.cacheKey, res);
          return res;
        }
      }

      // Fallback direto no renderer caso necessário
      if (target.provider === 'youtube' && target.videoId) {
        const canonical = `https://www.youtube.com/watch?v=${target.videoId}`;
        let title = 'Vídeo do YouTube';
        let authorName = 'YouTube';
        try {
          const r = await fetch(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(canonical)}&format=json`
          );
          if (r.ok) {
            const j = await r.json();
            if (j?.title) title = j.title;
            if (j?.author_name) authorName = j.author_name;
          }
        } catch {}

        const fallbackYt: LinkPreviewData = {
          provider: 'youtube',
          url: target.url,
          videoId: target.videoId,
          title,
          authorName,
          thumbnailUrl: `https://i.ytimg.com/vi/${target.videoId}/hqdefault.jpg`,
          mediaType: 'video',
        };
        rendererPreviewCache.set(target.cacheKey, fallbackYt);
        return fallbackYt;
      }

      if (target.provider === 'twitter' && target.tweetId) {
        try {
          const r = await fetch(`https://api.fxtwitter.com/status/${target.tweetId}`);
          if (r.ok) {
            const j = await r.json();
            if (j?.tweet) {
              const t = j.tweet;
              const preview: LinkPreviewData = {
                provider: 'twitter',
                url: target.url,
                tweetId: target.tweetId,
                authorName: t.author?.name || target.handle || 'Post no X',
                authorHandle: t.author?.screen_name
                  ? `@${t.author.screen_name}`
                  : target.handle
                  ? `@${target.handle}`
                  : undefined,
                authorAvatar: t.author?.avatar_url || undefined,
                description: t.text || '',
                thumbnailUrl:
                  t.media?.photos?.[0]?.url ||
                  t.media?.videos?.[0]?.thumbnail_url ||
                  undefined,
                mediaType: t.media?.videos?.length
                  ? 'video'
                  : t.media?.photos?.length
                  ? 'photo'
                  : undefined,
              };
              rendererPreviewCache.set(target.cacheKey, preview);
              return preview;
            }
          }
        } catch {}
      }

      return null;
    } finally {
      inflightPreviewRequests.delete(target.cacheKey);
    }
  })();

  inflightPreviewRequests.set(target.cacheKey, requestPromise);
  return requestPromise;
}

export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({ text, fromMe }) => {
  const target = useMemo(() => extractPreviewTarget(text), [text]);

  const [preview, setPreview] = useState<LinkPreviewData | null>(() =>
    target ? rendererPreviewCache.get(target.cacheKey) || null : null
  );
  const [loading, setLoading] = useState<boolean>(() =>
    Boolean(target && !rendererPreviewCache.has(target.cacheKey))
  );
  const [avatarError, setAvatarError] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAvatarError(false);
    setThumbError(false);

    if (!target) {
      setPreview(null);
      setLoading(false);
      return;
    }

    if (rendererPreviewCache.has(target.cacheKey)) {
      setPreview(rendererPreviewCache.get(target.cacheKey) || null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchPreviewData(target).then((res) => {
      if (!cancelled) {
        setPreview(res);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [target]);

  if (!target) return null;

  const handleOpenLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openBrowserUrl(target.url);
  };

  const cardBgClass = fromMe
    ? 'bg-[#025144] hover:bg-[#025b4c] border-[#00A884]/25'
    : 'bg-[#1D282F] hover:bg-[#25333c] border-white/[0.08]';

  // Renderização de Preview do YouTube
  if (target.provider === 'youtube' && target.videoId) {
    const thumbUrl = thumbError
      ? `https://i.ytimg.com/vi/${target.videoId}/mqdefault.jpg`
      : preview?.thumbnailUrl || `https://i.ytimg.com/vi/${target.videoId}/hqdefault.jpg`;

    return (
      <div
        data-interactive="true"
        onClick={handleOpenLink}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleOpenLink(e as any);
          }
        }}
        title={`Assistir no YouTube: ${preview?.title || target.url}`}
        className={`group/lp mb-1.5 rounded-[6px] overflow-hidden border cursor-pointer select-none transition-all active:scale-[0.99] min-w-[220px] max-w-[310px] ${cardBgClass}`}
      >
        {/* Thumbnail do Vídeo */}
        <div className="relative w-full aspect-video bg-[#111B21] overflow-hidden">
          <img
            src={thumbUrl}
            alt={preview?.title || 'YouTube'}
            onError={() => {
              if (!thumbError) setThumbError(true);
            }}
            className="w-full h-full object-cover transition-transform duration-300 group-hover/lp:scale-[1.03]"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />

          {/* Botão Play Central estilo YouTube/WhatsApp */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-11 h-8 rounded-[9px] bg-[#FF0000]/90 group-hover/lp:bg-[#FF0000] group-hover/lp:scale-105 text-white flex items-center justify-center shadow-lg transition-all">
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </div>
          </div>

          {/* Pill YouTube no canto inferior esquerdo */}
          <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/65 text-white text-[10px] font-medium flex items-center gap-1">
            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-[#FF0000]">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            <span>YouTube</span>
          </div>
        </div>

        {/* Metadados do Vídeo */}
        <div className="px-2.5 py-2 border-l-[3px] border-l-[#FF0000]">
          <div className="text-[12.5px] font-semibold text-[#E9EDEF] leading-snug line-clamp-2">
            {preview?.title || (loading ? 'Carregando vídeo...' : 'Vídeo do YouTube')}
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-[#8696A0]">
            <span className="truncate">
              {preview?.authorName ? `${preview.authorName} • youtube.com` : 'youtube.com'}
            </span>
            <ExternalLink className="w-3 h-3 shrink-0 opacity-70 group-hover/lp:opacity-100" />
          </div>
        </div>
      </div>
    );
  }

  // Renderização de Preview do Twitter / X
  if (target.provider === 'twitter') {
    if (loading && !preview) {
      return (
        <div
          data-interactive="true"
          onClick={handleOpenLink}
          className={`mb-1.5 rounded-[6px] border border-l-[3.5px] border-l-[#1D9BF0] px-2.5 py-2 flex items-center gap-2.5 cursor-pointer select-none min-w-[210px] ${cardBgClass}`}
        >
          <Loader2 className="w-4 h-4 text-[#1D9BF0] animate-spin shrink-0" />
          <span className="text-[11.5px] text-[#8696A0] truncate">
            Carregando preview do tweet...
          </span>
        </div>
      );
    }

    if (!preview) return null;

    return (
      <div
        data-interactive="true"
        onClick={handleOpenLink}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleOpenLink(e as any);
          }
        }}
        title={`Abrir post no X: ${target.url}`}
        className={`group/lp mb-1.5 rounded-[6px] overflow-hidden border border-l-[3.5px] border-l-[#1D9BF0] cursor-pointer select-none transition-all active:scale-[0.99] min-w-[220px] max-w-[310px] ${cardBgClass}`}
      >
        <div className="px-2.5 py-2">
          {/* Cabeçalho com Avatar, Nome, @handle e Ícone X/Twitter */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {preview.authorAvatar && !avatarError ? (
                <img
                  src={preview.authorAvatar}
                  alt={preview.authorName || 'Autor'}
                  onError={() => setAvatarError(true)}
                  className="w-6 h-6 rounded-full object-cover shrink-0 border border-white/10"
                  draggable={false}
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-black/70 border border-white/15 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
              )}

              <div className="min-w-0 leading-tight">
                <div className="text-[12px] font-semibold text-[#E9EDEF] truncate">
                  {preview.authorName || 'Post no X'}
                </div>
                {preview.authorHandle && (
                  <div className="text-[10.5px] text-[#8696A0] truncate">
                    {preview.authorHandle}
                  </div>
                )}
              </div>
            </div>

            {/* Ícone X no canto direito */}
            <div className="w-5 h-5 rounded-full bg-black/45 flex items-center justify-center shrink-0 text-[#E9EDEF]/85 group-hover/lp:text-white">
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </div>
          </div>

          {/* Texto do Tweet */}
          {preview.description && (
            <div className="mt-1.5 text-[12px] text-[#D1D7DB] leading-[16.5px] line-clamp-3 whitespace-pre-line break-words">
              {preview.description}
            </div>
          )}
        </div>

        {/* Miniatura de Mídia do Tweet (se houver foto ou vídeo no tweet) */}
        {preview.thumbnailUrl && !thumbError && (
          <div className="relative w-full max-h-[155px] bg-[#111B21] overflow-hidden border-t border-white/[0.06]">
            <img
              src={preview.thumbnailUrl}
              alt="Mídia do tweet"
              onError={() => setThumbError(true)}
              className="w-full max-h-[155px] object-cover transition-transform duration-300 group-hover/lp:scale-[1.02]"
              draggable={false}
            />
            {preview.mediaType === 'video' && (
              <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                <div className="w-9 h-9 rounded-full bg-[#1D9BF0]/90 text-white flex items-center justify-center shadow-md">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rodapé discreto */}
        <div className="px-2.5 py-1 bg-black/15 flex items-center justify-between text-[10.5px] text-[#8696A0]">
          <span>x.com</span>
          <ExternalLink className="w-2.5 h-2.5 opacity-70 group-hover/lp:opacity-100" />
        </div>
      </div>
    );
  }

  return null;
};

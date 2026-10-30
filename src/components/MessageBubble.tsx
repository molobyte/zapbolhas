import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  CornerUpLeft,
  Maximize2,
  ExternalLink,
  Loader2,
  Image as ImageIcon,
  Play,
  Video as VideoIcon,
  Star,
  SmilePlus,
  Plus,
  X,
  Search,
} from 'lucide-react';
import { FormattedMessage, QuotedMessage, DEFAULT_AVATAR } from '../types/whatsapp';
import { useBubbleStore } from '../store/useBubbleStore';
import { AudioPlayer } from './AudioPlayer';
import {
  normalizeImageToStickerWebp,
  EMOJI_DATA,
  EMOJI_CATEGORIES,
  EmojiCategoryId,
  EmojiEntry,
} from './EmojiStickerPicker';
import { FormattedText } from './FormattedText';
import { LinkPreviewCard } from './LinkPreviewCard';
import { Emoji } from './Emoji';
import { isRawMediaBase64OrKey } from '../utils/textUtils';
import { MessageCheckIcon } from './MessageCheckIcon';

interface MessageBubbleProps {
  message: FormattedMessage;
  isFirstInGroup: boolean;
  isGroupChat?: boolean;
  isSenderChanged?: boolean;
  isHighlighted?: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onReply: (quote: QuotedMessage) => void;
  onJumpToMessage?: (messageId: string) => void;
  onToggleSelect?: (messageId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isFirstInGroup,
  isGroupChat,
  isSenderChanged = false,
  isHighlighted = false,
  isSelectionMode = false,
  isSelected = false,
  onReply,
  onJumpToMessage,
  onToggleSelect,
}) => {
  const {
    fromMe,
    type,
    text,
    timestamp,
    dateLabel,
    quotedMessage,
    reaction,
    audioData,
    ack,
    senderName,
    senderColor,
    senderAvatar,
    imageUrl,
    videoUrl,
    mediaDuration,
    isHdLoaded,
  } = message;

  const {
    updateMessageMedia,
    setViewingImage,
    sendReaction,
    setActiveReactionDetailsMessage,
  } = useBubbleStore();
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [autoPlayVideo, setAutoPlayVideo] = useState(false);
  const [savedSticker, setSavedSticker] = useState(false);

  // Reaction State
  const [showQuickReactions, setShowQuickReactions] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<EmojiCategoryId>('smileys');
  const [emojiSearch, setEmojiSearch] = useState('');
  const [placementAbove, setPlacementAbove] = useState(true);

  const bubbleRef = useRef<HTMLDivElement>(null);
  const quickBarRef = useRef<HTMLDivElement>(null);
  const fullPickerRef = useRef<HTMLDivElement>(null);

  const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  const checkPlacement = () => {
    if (bubbleRef.current) {
      const rect = bubbleRef.current.getBoundingClientRect();
      setPlacementAbove(rect.top >= 320);
    }
  };

  const myReactionEmoji = useMemo(() => {
    if (message.reactions) {
      const mine = message.reactions.find((r) => r.fromMe || r.senders?.some((s) => s.fromMe));
      if (mine) return mine.emoji;
    }
    if (message.reaction && message.fromMe) {
      return message.reaction;
    }
    return undefined;
  }, [message.reactions, message.reaction, message.fromMe]);

  const { distinctEmojis, totalReactionCount, reactionsList } = useMemo(() => {
    if (message.reactions && message.reactions.length > 0) {
      const total = message.reactions.reduce((sum, r) => sum + r.count, 0);
      return {
        distinctEmojis: message.reactions.map((r) => r.emoji),
        totalReactionCount: total,
        reactionsList: message.reactions,
      };
    }
    if (message.reaction) {
      return {
        distinctEmojis: [message.reaction],
        totalReactionCount: 1,
        reactionsList: [
          {
            emoji: message.reaction,
            count: 1,
            fromMe: message.fromMe,
          },
        ],
      };
    }
    return { distinctEmojis: [], totalReactionCount: 0, reactionsList: [] };
  }, [message.reactions, message.reaction, message.fromMe]);

  const hasReactions = totalReactionCount > 0;

  const handleToggleReaction = (emoji: string) => {
    sendReaction(message.chatId, message.id, emoji);
  };

  const filteredEmojis = useMemo(() => {
    const query = emojiSearch.trim().toLowerCase();
    if (query) {
      const matched: EmojiEntry[] = [];
      for (const list of Object.values(EMOJI_DATA)) {
        for (const item of list) {
          if (item.char.includes(query) || item.keywords.toLowerCase().includes(query)) {
            if (!matched.some((m) => m.char === item.char)) {
              matched.push(item);
            }
          }
        }
      }
      return matched;
    }
    const cat = selectedCategory === 'recent' ? 'smileys' : selectedCategory;
    return EMOJI_DATA[cat] || [];
  }, [emojiSearch, selectedCategory]);

  useEffect(() => {
    if (!showQuickReactions && !showFullPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        quickBarRef.current &&
        !quickBarRef.current.contains(target) &&
        fullPickerRef.current &&
        !fullPickerRef.current.contains(target)
      ) {
        setShowQuickReactions(false);
        setShowFullPicker(false);
      } else if (
        quickBarRef.current &&
        !quickBarRef.current.contains(target) &&
        !showFullPicker
      ) {
        setShowQuickReactions(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowQuickReactions(false);
        setShowFullPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showQuickReactions, showFullPicker]);

  const displayCaption = text && !isRawMediaBase64OrKey(text) ? text : '';
  // Mensagem de visualização única protegida pelo WhatsApp (aplicável apenas a mídias de foto/vídeo)
  const isMediaMsgType =
    type === 'image' ||
    type === 'video' ||
    (message as any).rawType === 'view_once' ||
    (message as any).rawType === 'image' ||
    (message as any).rawType === 'video';

  const isViewOnceMsg =
    Boolean(message.isViewOnce) ||
    (isMediaMsgType &&
      !imageUrl &&
      !videoUrl &&
      !displayCaption &&
      !audioData &&
      type !== 'audio' &&
      type !== 'sticker');

  // Decripta automaticamente imagens, vídeos, figurinhas e áudios em alta resolução (exceto visualização única protegida)
  useEffect(() => {
    let cancelled = false;
    if (
      !isViewOnceMsg &&
      (type === 'image' || type === 'sticker' || type === 'audio' || type === 'video') &&
      !isHdLoaded &&
      window.electronAPI?.downloadMedia
    ) {
      setIsLoadingMedia(true);
      window.electronAPI
        .downloadMedia(message.id)
        .then((dataUrl) => {
          if (!cancelled && dataUrl) {
            updateMessageMedia(message.chatId, message.id, dataUrl);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoadingMedia(false);
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [type, isHdLoaded, message.id, message.chatId, isViewOnceMsg, updateMessageMedia]);

  const handlePlayOrExpandVideo = async (
    e: React.MouseEvent,
    openInLightbox = false
  ) => {
    e.stopPropagation();
    let targetVideoUrl = videoUrl;

    if (!targetVideoUrl && window.electronAPI?.downloadMedia) {
      setIsLoadingMedia(true);
      try {
        const hd = await window.electronAPI.downloadMedia(message.id);
        if (hd) {
          updateMessageMedia(message.chatId, message.id, hd);
          targetVideoUrl = hd;
        }
      } finally {
        setIsLoadingMedia(false);
      }
    }

    if (!targetVideoUrl) return;

    if (openInLightbox) {
      if (
        useBubbleStore.getState().activeChatId === message.chatId &&
        useBubbleStore.getState().activePopover === 'chat-window'
      ) {
        setViewingImage({
          messageId: message.id,
          mediaType: 'video',
          imageUrl: imageUrl || '',
          videoUrl: targetVideoUrl,
          caption: text || undefined,
          senderName: fromMe
            ? 'Você'
            : senderName ||
              useBubbleStore.getState().chats.find((c) => c.id === message.chatId)?.name ||
              useBubbleStore.getState().activeBubbles.find((b) => b.chatId === message.chatId)?.name ||
              'Contato',
          timestamp,
        });
      }
    } else {
      setAutoPlayVideo(true);
    }
  };

  const handleOpenImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    let targetUrl = imageUrl;

    if (!targetUrl && window.electronAPI?.downloadMedia) {
      setIsLoadingMedia(true);
      try {
        const hd = await window.electronAPI.downloadMedia(message.id);
        if (hd) {
          updateMessageMedia(message.chatId, message.id, hd);
          targetUrl = hd;
        }
      } catch (err) {
        console.error('Error opening image:', err);
      } finally {
        setIsLoadingMedia(false);
      }
    }

    if (
      targetUrl &&
      useBubbleStore.getState().activeChatId === message.chatId &&
      useBubbleStore.getState().activePopover === 'chat-window'
    ) {
      setViewingImage({
        messageId: message.id,
        mediaType: 'image',
        imageUrl: targetUrl,
        caption: text || undefined,
        senderName: fromMe
          ? 'Você'
          : senderName ||
            useBubbleStore.getState().chats.find((c) => c.id === message.chatId)?.name ||
            useBubbleStore.getState().activeBubbles.find((b) => b.chatId === message.chatId)?.name ||
            'Contato',
        timestamp,
      });
    }
  };

  const handleOpenExternal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    let targetUrl = type === 'video' ? videoUrl : imageUrl;

    if ((!isHdLoaded || !targetUrl) && window.electronAPI?.downloadMedia) {
      setIsLoadingMedia(true);
      const hd = await window.electronAPI.downloadMedia(message.id);
      setIsLoadingMedia(false);
      if (hd) {
        updateMessageMedia(message.chatId, message.id, hd);
        targetUrl = hd;
      }
    }

    if (targetUrl && window.electronAPI?.openExternalImage) {
      await window.electronAPI.openExternalImage(targetUrl);
    }
  };

  const handleSaveStickerToLibrary = async (e: React.MouseEvent) => {
    e.stopPropagation();
    let targetUrl = imageUrl;
    if ((!isHdLoaded || !targetUrl) && window.electronAPI?.downloadMedia) {
      setIsLoadingMedia(true);
      const hd = await window.electronAPI.downloadMedia(message.id);
      setIsLoadingMedia(false);
      if (hd) {
        updateMessageMedia(message.chatId, message.id, hd);
        targetUrl = hd;
      }
    }
    if (!targetUrl || !window.electronAPI?.saveStickerToLibrary) return;
    const webpUrl = await normalizeImageToStickerWebp(targetUrl);
    const saved = await window.electronAPI.saveStickerToLibrary(webpUrl);
    if (saved) {
      setSavedSticker(true);
    }
  };

  const handleReplyTrigger = () => {
    onReply({
      id: message.id,
      author: fromMe ? 'Você' : senderName || 'Contato',
      authorColor: fromMe ? '#06CF9C' : senderColor || '#E59866',
      text:
        type === 'audio'
          ? `🎤 Mensagem de voz (${audioData?.duration || '0:46'})`
          : isViewOnceMsg
          ? '📷 Mensagem de visualização única'
          : type === 'video'
          ? text || '🎥 Vídeo'
          : type === 'image'
          ? text || '📷 Foto'
          : type === 'sticker'
          ? '💟 Figurinha'
          : text,
    });
  };

  return (
    <>
      {/* Separador de Data Centralizado (ex: "Hoje") */}
      {dateLabel && (
        <div className="flex justify-center my-2.5">
          <span className="bg-[#182229] text-[#8696A0] text-[11px] font-medium px-3 py-1 rounded-[7px] shadow-sm select-none">
            {dateLabel}
          </span>
        </div>
      )}

      {/* Linha da Mensagem */}
      <div
        ref={bubbleRef}
        data-msg-id={message.id}
        onClick={(e) => {
          if (isSelectionMode) {
            e.stopPropagation();
            onToggleSelect?.(message.id);
          }
        }}
        onDoubleClick={isSelectionMode ? undefined : handleReplyTrigger}
        className={`group/msg relative flex items-center ${
          fromMe ? 'justify-end' : 'justify-start'
        } ${hasReactions ? 'mb-3.5' : 'mb-[3px]'} ${
          isSenderChanged ? 'mt-3' : 'mt-0'
        } ${isSelectionMode ? 'cursor-pointer' : ''}`}
      >
        {/* Checkbox de Seleção no Modo de Seleção */}
        {isSelectionMode && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(message.id);
            }}
            className="mr-2 self-center cursor-pointer select-none shrink-0"
          >
            <div
              className={`w-[19px] h-[19px] rounded-full border-2 flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-[#00A884] border-[#00A884] text-white shadow-sm'
                  : 'border-white/40 bg-black/30 hover:border-white/70'
              }`}
            >
              {isSelected && (
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current stroke-[3]">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Foto do perfil do membro à esquerda do balão em conversas de grupo */}
        {!fromMe && isGroupChat && (
          <div className="w-[28px] h-[28px] mr-2 self-start mt-0.5 shrink-0">
            {isFirstInGroup && (
              <img
                src={senderAvatar || DEFAULT_AVATAR}
                alt={senderName || 'Membro'}
                className="w-[28px] h-[28px] rounded-full object-cover border border-white/10 shadow-sm"
                draggable={false}
              />
            )}
          </div>
        )}

        {/* Botões de Ação em Hover (Esquerda para enviadas) */}
        {!isSelectionMode && fromMe && (
          <div
            data-interactive="true"
            className={`mr-1.5 flex items-center gap-0.5 transition-opacity ${
              showQuickReactions || showFullPicker
                ? 'opacity-100'
                : 'opacity-0 group-hover/msg:opacity-100'
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                checkPlacement();
                setShowQuickReactions((prev) => !prev);
                setShowFullPicker(false);
              }}
              title="Reagir"
              className="p-1 rounded-full bg-[#202C33]/90 text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[#202C33] transition-colors"
            >
              <SmilePlus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleReplyTrigger}
              title="Responder mensagem"
              className="p-1 rounded-full bg-[#202C33]/90 text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[#202C33] transition-colors"
            >
              <CornerUpLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Balão da Mensagem */}
        <div
          data-msg-bubble={message.id}
          className={`relative ${
            !fromMe && isGroupChat ? 'max-w-[76%]' : 'max-w-[82%]'
          } rounded-[7.5px] px-2.5 py-1.5 shadow-[0_1px_1px_rgba(0,0,0,0.3)] text-[#E9EDEF] transition-all duration-500 ${
            isHighlighted
              ? fromMe
                ? 'bg-[#02735E] ring-2 ring-[#00A884] shadow-[0_0_18px_rgba(0,168,132,0.55)] brightness-110 scale-[1.01]'
                : 'bg-[#1a3832] ring-2 ring-[#00A884] shadow-[0_0_18px_rgba(0,168,132,0.55)] brightness-110 scale-[1.01]'
              : fromMe
              ? 'bg-[#005C4B]'
              : 'bg-[#202C33]'
          } ${isFirstInGroup && !fromMe ? 'rounded-tl-none' : ''} ${
            isFirstInGroup && fromMe ? 'rounded-tr-none' : ''
          }`}
        >
          {/* Tail / Pontinha superior do primeiro balão */}
          {isFirstInGroup && !fromMe && (
            <svg
              viewBox="0 0 8 13"
              className={`w-2 h-3 fill-current absolute -left-[7px] top-0 pointer-events-none transition-colors duration-500 ${
                isHighlighted ? 'text-[#1a3832]' : 'text-[#202C33]'
              }`}
            >
              <path d="M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z" />
            </svg>
          )}
          {isFirstInGroup && fromMe && (
            <svg
              viewBox="0 0 8 13"
              className={`w-2 h-3 fill-current absolute -right-[7px] top-0 pointer-events-none transition-colors duration-500 ${
                isHighlighted ? 'text-[#02735E]' : 'text-[#005C4B]'
              }`}
            >
              <path d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" />
            </svg>
          )}

          {/* Nome do Remetente em Grupos */}
          {!fromMe && isGroupChat && senderName && isFirstInGroup && (
            <div
              style={{ color: senderColor || '#53BDEB' }}
              className="text-[11.5px] font-semibold leading-tight truncate mb-0.5"
            >
              {senderName}
            </div>
          )}

          {/* Bloco de Mensagem Citada (Reply/Quote) */}
          {quotedMessage && (
            <div
              style={{
                borderLeftColor: quotedMessage.authorColor || '#E59866',
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (quotedMessage.id && onJumpToMessage) {
                  onJumpToMessage(quotedMessage.id);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (quotedMessage.id && onJumpToMessage) {
                    onJumpToMessage(quotedMessage.id);
                  }
                }
              }}
              role="button"
              tabIndex={0}
              title="Ir para a mensagem citada"
              className={`rounded-[5px] border-l-[4px] px-2.5 py-1.5 mb-1.5 cursor-pointer select-none transition-all active:scale-[0.99] hover:brightness-110 focus:outline-none ${
                fromMe
                  ? 'bg-[#025144] hover:bg-[#025b4c]'
                  : 'bg-[#1D282F] hover:bg-[#25333c]'
              }`}
            >
              <div
                style={{ color: quotedMessage.authorColor || '#E59866' }}
                className="text-[12px] font-semibold leading-tight truncate"
              >
                {quotedMessage.author}
              </div>
              <div className="text-[12px] text-[#B8C7C4] leading-snug line-clamp-2 mt-0.5">
                <FormattedText text={quotedMessage.text} />
              </div>
            </div>
          )}

          {/* Conteúdo: Player de Áudio, Vídeo, Imagem/Figurinha ou Texto */}
          {type === 'audio' && audioData ? (
            <AudioPlayer
              audioData={audioData}
              timestamp={timestamp}
              fromMe={fromMe}
              ack={ack}
              chatId={message.chatId}
              messageId={message.id}
            />
          ) : (
            <div className="text-[13.2px] leading-[18px] break-words text-[#E9EDEF]">
              {isViewOnceMsg ? (
                <div className="w-[260px] p-2.5 rounded-[8px] bg-[#182229]/80 border border-white/10 flex items-center gap-3 text-left select-none mb-1">
                  <div className="w-10 h-10 rounded-full bg-[#005C4B]/60 border border-[#25D366]/40 flex items-center justify-center shrink-0 text-[#25D366]">
                    <div className="relative flex items-center justify-center font-bold text-[14px]">
                      <svg
                        viewBox="0 0 24 24"
                        className="w-6 h-6 stroke-current fill-none stroke-[2]"
                      >
                        <circle cx="12" cy="12" r="9" strokeDasharray="3 2" />
                      </svg>
                      <span className="absolute text-[11px] font-bold">1</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-[#E9EDEF] flex items-center gap-1.5">
                      <span>Mídia de visualização única</span>
                    </div>
                    <div className="text-[11px] text-[#8696A0] mt-0.5 leading-tight">
                      {fromMe
                        ? 'Enviada pelo celular como visualização única.'
                        : 'Favor utilizar o celular para visualizar essa mensagem.'}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {type === 'video' && (
                    <div className="relative group/vid mb-1.5 overflow-hidden rounded-[6px] min-w-[210px]">
                      {videoUrl ? (
                        <div className="relative overflow-hidden rounded-[6px] bg-black/80">
                          <video
                            src={videoUrl}
                            poster={imageUrl}
                            controls
                            autoPlay={autoPlayVideo}
                            playsInline
                            preload="metadata"
                            onClick={(e) => e.stopPropagation()}
                            className="w-full min-w-[210px] max-h-[260px] rounded-[6px] bg-black object-contain"
                          />
                          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover/vid:opacity-100 transition-opacity flex items-center gap-1.5 z-10">
                            <button
                              type="button"
                              onClick={(e) => handlePlayOrExpandVideo(e, true)}
                              title="Ampliar vídeo na janela"
                              className="p-1.5 rounded-full bg-[#111B21]/85 text-white shadow-md hover:bg-[#00A884] transition-colors"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={handleOpenExternal}
                              title="Abrir vídeo no reprodutor do Windows"
                              className="p-1.5 rounded-full bg-[#111B21]/85 text-white shadow-md hover:bg-[#00A884] transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={(e) => handlePlayOrExpandVideo(e, false)}
                          title="Clique para carregar e reproduzir o vídeo"
                          className="relative cursor-pointer overflow-hidden rounded-[6px] min-w-[210px] min-h-[140px] flex items-center justify-center bg-[#111B21]"
                        >
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={text || 'Vídeo'}
                              className={`w-full min-w-[210px] max-h-[240px] object-cover rounded-[6px] ${
                                isLoadingMedia ? 'blur-[1.5px] brightness-75' : 'brightness-90'
                              }`}
                            />
                          ) : (
                            <div className="w-[210px] h-[140px] flex flex-col items-center justify-center gap-1.5 text-[#8696A0]">
                              <VideoIcon className="w-7 h-7 text-[#25D366]" />
                              <span className="text-[11.5px]">Vídeo</span>
                            </div>
                          )}

                          {/* Botão Play Central ou Spinner de Carregamento */}
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <div className="w-11 h-11 rounded-full bg-black/65 border border-white/25 flex items-center justify-center text-white shadow-lg group-hover/vid:scale-105 group-hover/vid:bg-[#00A884] transition-all">
                              {isLoadingMedia ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <Play className="w-5 h-5 fill-current ml-0.5" />
                              )}
                            </div>
                          </div>

                          {/* Badge inferior esquerdo com ícone de vídeo e duração */}
                          <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10.5px] flex items-center gap-1 select-none">
                            <VideoIcon className="w-3 h-3" />
                            <span>{mediaDuration || 'Vídeo'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {type !== 'video' && (type === 'image' || type === 'sticker' || imageUrl) && (
                    <div className="relative group/img mb-1.5 overflow-hidden rounded-[6px]">
                      {imageUrl ? (
                        <div
                          onClick={handleOpenImage}
                          title="Clique para visualizar e ampliar a imagem"
                          className="relative cursor-pointer overflow-hidden rounded-[6px]"
                        >
                          <img
                            src={imageUrl}
                            alt=""
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.style.display = 'none';
                              if (!isHdLoaded && window.electronAPI?.downloadMedia) {
                                window.electronAPI.downloadMedia(message.id).then((hd) => {
                                  if (hd) {
                                    updateMessageMedia(message.chatId, message.id, hd);
                                    target.style.display = 'block';
                                  }
                                });
                              }
                            }}
                            className={`w-full rounded-[6px] transition-transform duration-200 group-hover/img:scale-[1.02] ${
                              type === 'sticker'
                                ? 'max-w-[130px] max-h-[130px] object-contain'
                                : 'min-w-[190px] max-h-[240px] object-cover'
                            } ${!isHdLoaded && isLoadingMedia ? 'blur-[1.5px] brightness-90' : ''}`}
                          />

                          {/* Spinner sutil enquanto baixa a versão HD */}
                          {isLoadingMedia && (
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                              <Loader2 className="w-6 h-6 text-white animate-spin drop-shadow" />
                            </div>
                          )}

                          {/* Overlay em Hover com botões de Ampliar, Favoritar Figurinha e Abrir no Windows */}
                          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                            <span className="p-1.5 rounded-full bg-[#111B21]/85 text-white shadow-md hover:bg-[#00A884] transition-colors">
                              <Maximize2 className="w-4 h-4" />
                            </span>
                            {type === 'sticker' && (
                              <button
                                type="button"
                                onClick={handleSaveStickerToLibrary}
                                title={
                                  savedSticker
                                    ? 'Salva na sua biblioteca de figurinhas!'
                                    : 'Salvar figurinha na minha biblioteca'
                                }
                                className={`p-1.5 rounded-full bg-[#111B21]/85 shadow-md transition-colors ${
                                  savedSticker
                                    ? 'text-[#FBBF24] bg-[#005C4B]'
                                    : 'text-[#FBBF24] hover:bg-[#00A884] hover:text-white'
                                }`}
                              >
                                <Star
                                  className={`w-4 h-4 ${savedSticker ? 'fill-current' : ''}`}
                                />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={handleOpenExternal}
                              title="Abrir imagem no Visualizador de Fotos do Windows"
                              className="p-1.5 rounded-full bg-[#111B21]/85 text-white shadow-md hover:bg-[#00A884] transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleOpenImage}
                          className="w-[200px] h-[120px] rounded-[6px] bg-[#182229]/80 hover:bg-[#182229] border border-white/10 flex flex-col items-center justify-center gap-1.5 text-[#8696A0] hover:text-[#E9EDEF] transition-colors"
                        >
                          {isLoadingMedia ? (
                            <>
                              <Loader2 className="w-5 h-5 text-[#25D366] animate-spin" />
                              <span className="text-[11.5px]">Carregando foto...</span>
                            </>
                          ) : (
                            <>
                              <ImageIcon className="w-6 h-6 text-[#25D366]" />
                              <span className="text-[11.5px]">Clique para abrir a foto</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {type === 'text' && displayCaption && (
                <LinkPreviewCard text={displayCaption} fromMe={fromMe} />
              )}

              {displayCaption && <FormattedText text={displayCaption} mentions={message.mentions} />}

              <span className="inline-flex items-center float-right ml-2.5 mt-1.5 -mb-0.5 text-[10.5px] text-[#8696A0] select-none leading-none">
                <span>{timestamp}</span>
                {fromMe && <MessageCheckIcon ack={ack} />}
              </span>
            </div>
          )}

          {/* Quick Reaction Bar Popover */}
          {showQuickReactions && (
            <div
              ref={quickBarRef}
              data-interactive="true"
              className={`absolute ${
                placementAbove ? '-top-10' : '-bottom-10'
              } ${
                fromMe ? 'right-0' : 'left-0'
              } z-30 flex items-center gap-0.5 bg-[#202C33] border border-[#313D45] rounded-full px-2 py-1 shadow-2xl select-none animate-in fade-in zoom-in-95 duration-150`}
              onClick={(e) => e.stopPropagation()}
            >
              {QUICK_EMOJIS.map((emoji) => {
                const isSelected = myReactionEmoji === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleReaction(emoji);
                      setShowQuickReactions(false);
                    }}
                    title={isSelected ? 'Remover reação' : `Reagir com ${emoji}`}
                    className={`w-7 h-7 flex items-center justify-center rounded-full transition-transform duration-100 hover:scale-135 cursor-pointer ${
                      isSelected
                        ? 'bg-[#005C4B]/70 ring-1.5 ring-[#00A884]'
                        : 'hover:bg-white/10'
                    }`}
                  >
                    <Emoji char={emoji} className="w-[19px] h-[19px]" />
                  </button>
                );
              })}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowQuickReactions(false);
                  setShowFullPicker(true);
                }}
                title="Mais reações"
                className="w-7 h-7 flex items-center justify-center rounded-full text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Full Emoji Picker Popover */}
          {showFullPicker && (
            <div
              ref={fullPickerRef}
              data-interactive="true"
              className={`absolute ${
                placementAbove ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
              } ${
                fromMe ? 'right-0' : 'left-0'
              } z-40 w-[290px] h-[280px] bg-[#202C33] border border-[#313D45] rounded-2xl shadow-2xl flex flex-col overflow-hidden select-none animate-in fade-in zoom-in-95 duration-150`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-2 border-b border-white/[0.08] flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8696A0]" />
                  <input
                    type="text"
                    value={emojiSearch}
                    onChange={(e) => setEmojiSearch(e.target.value)}
                    placeholder="Pesquisar emoji"
                    className="w-full bg-[#111B21] text-[#E9EDEF] text-xs rounded-lg pl-8 pr-2.5 py-1.5 outline-none placeholder:text-[#8696A0] border border-transparent focus:border-[#00A884]"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowFullPicker(false)}
                  className="p-1 rounded-full text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!emojiSearch && (
                <div className="flex items-center justify-around px-1 py-1 border-b border-white/[0.06] bg-[#182229]/50 shrink-0">
                  {EMOJI_CATEGORIES.filter((c) => c.id !== 'recent').map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      title={cat.label}
                      className={`p-1.5 rounded-md transition-colors ${
                        selectedCategory === cat.id
                          ? 'text-[#00A884] bg-white/5'
                          : 'text-[#8696A0] hover:text-[#E9EDEF]'
                      }`}
                    >
                      {cat.icon}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10">
                <div className="grid grid-cols-7 gap-1">
                  {filteredEmojis.map((e) => {
                    const isSelected = myReactionEmoji === e.char;
                    return (
                      <button
                        key={e.char}
                        type="button"
                        onClick={() => {
                          handleToggleReaction(e.char);
                          setShowFullPicker(false);
                        }}
                        title={e.keywords}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 hover:scale-120 transition-all cursor-pointer ${
                          isSelected ? 'bg-[#005C4B]/60 ring-1 ring-[#00A884]' : ''
                        }`}
                      >
                        <Emoji char={e.char} className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Badge de Reações no Canto Inferior Direito (ex: 😂❤️ 2) */}
          {hasReactions && (
            <button
              type="button"
              data-interactive="true"
              onClick={(e) => {
                e.stopPropagation();
                setActiveReactionDetailsMessage(message);
              }}
              title="Ver reações"
              className={`absolute -bottom-[13px] right-2 border rounded-full px-1.5 py-[1px] text-[12px] leading-tight shadow-md select-none z-10 flex items-center gap-1 cursor-pointer transition-colors ${
                myReactionEmoji
                  ? 'bg-[#1A262E] border-[#00A884]/50 text-[#E9EDEF] hover:bg-[#22333E]'
                  : 'bg-[#1F2C34] border-[#0B141A] text-[#E9EDEF] hover:bg-[#2A3942]'
              }`}
            >
              <span className="flex items-center -space-x-1">
                {distinctEmojis.slice(0, 3).map((e, idx) => (
                  <span key={idx} className="inline-flex items-center justify-center">
                    <Emoji char={e} className="w-3.5 h-3.5" />
                  </span>
                ))}
              </span>
              {totalReactionCount > 1 && (
                <span className="text-[#8696A0] text-[10px] font-medium ml-0.5 leading-none">
                  {totalReactionCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Botões de Ação em Hover (Direita para recebidas) */}
        {!isSelectionMode && !fromMe && (
          <div
            data-interactive="true"
            className={`ml-1.5 flex items-center gap-0.5 transition-opacity ${
              showQuickReactions || showFullPicker
                ? 'opacity-100'
                : 'opacity-0 group-hover/msg:opacity-100'
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                checkPlacement();
                setShowQuickReactions((prev) => !prev);
                setShowFullPicker(false);
              }}
              title="Reagir"
              className="p-1 rounded-full bg-[#202C33]/90 text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[#202C33] transition-colors"
            >
              <SmilePlus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleReplyTrigger}
              title="Responder mensagem"
              className="p-1 rounded-full bg-[#202C33]/90 text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[#202C33] transition-colors"
            >
              <CornerUpLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </>
  );
};
